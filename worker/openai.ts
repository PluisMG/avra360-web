import instrucciones from './prompt-sistema.txt';
import { HISTORIAL, MAX_SALIDA_MODELO, TIMEOUT_PRIMER_TOKEN_MS } from './constantes.ts';
import { presente, textoEnv } from './entorno.ts';
import type { Turno } from './webhook.ts';

export const MODELO_PREDETERMINADO = 'gpt-6-luna';
export const TEXTO_TRASPASO =
  'Le paso tu solicitud a nuestro equipo; en unos segundos te confirmo por aquí.';
export const INSTRUCCIONES = instrucciones.trim();

export type PedidoAvra = {
  motivo: 'cita' | 'prospecto';
  resumen: string;
  cuando: string;
};

export type ResultadoModelo =
  | { ok: true; texto: string; traspaso: PedidoAvra | null; tPrimerToken: number; tFin: number }
  | { ok: false; motivo: 'http' | 'timeout' | 'red' };

const HERRAMIENTA = {
  type: 'function',
  name: 'pasar_a_avra',
  description:
    'Pasa la conversación a una persona del equipo cuando hay un prospecto o una solicitud de cita. No la uses para preguntas generales.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      motivo: { type: 'string', enum: ['cita', 'prospecto'] },
      resumen: { type: 'string', description: 'Resumen corto de lo que la persona necesita.' },
      cuando: { type: 'string', description: 'Fecha u hora pedida. Cadena vacía si no hay.' },
    },
    required: ['motivo', 'resumen', 'cuando'],
  },
};

export function usarHibrido(env: Env): boolean {
  return textoEnv(env, 'CHAT_MODO') === 'hibrido' && presente(textoEnv(env, 'OPENAI_API_KEY'));
}

export function modeloDe(env: Env): string {
  const modelo = textoEnv(env, 'OPENAI_MODELO').trim();
  return modelo || MODELO_PREDETERMINADO;
}

export function timeoutPrimerToken(env: Env & { CHAT_TIMEOUT_TOKEN_MS?: string }): number {
  const n = Number(env.CHAT_TIMEOUT_TOKEN_MS);
  if (Number.isFinite(n) && n >= 20 && n <= TIMEOUT_PRIMER_TOKEN_MS) return n;
  return TIMEOUT_PRIMER_TOKEN_MS;
}

export function mensajeParaAvra(pedido: PedidoAvra): string {
  const tipo = pedido.motivo === 'cita' ? 'Solicitud de cita' : 'Prospecto';
  const cuando = pedido.cuando ? ` Fecha u hora pedida: ${pedido.cuando}.` : '';
  return `${tipo}. ${pedido.resumen}.${cuando}`.replace(/\s+\./g, '.').slice(0, 2_000);
}

export async function hablarConModelo(opciones: {
  apiKey: string;
  modelo: string;
  historial: Turno[];
  mensaje: string;
  timeoutMs: number;
  alDelta: (fragmento: string) => Promise<void>;
}): Promise<ResultadoModelo> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), opciones.timeoutMs);
  let vioToken = false;
  let tPrimerToken = 0;
  let texto = '';
  let argumentos = '';
  let traspaso: PedidoAvra | null = null;

  const marcar = () => {
    if (vioToken) return;
    vioToken = true;
    tPrimerToken = Date.now();
    clearTimeout(temporizador);
  };

  try {
    const respuesta = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${opciones.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: opciones.modelo,
        instructions: INSTRUCCIONES,
        input: [
          ...opciones.historial.slice(-HISTORIAL).map((turno) => ({ role: turno.role, content: turno.text })),
          { role: 'user', content: opciones.mensaje },
        ],
        stream: true,
        max_output_tokens: MAX_SALIDA_MODELO,
        reasoning: { effort: 'none' },
        store: false,
        tools: [HERRAMIENTA],
      }),
      signal: controlador.signal,
    });
    if (!respuesta.ok || !respuesta.body) return { ok: false, motivo: 'http' };

    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let resto = '';
    while (true) {
      const paso = await lector.read();
      if (paso.done) break;
      resto += decodificador.decode(paso.value, { stream: true });
      const bloques = resto.split('\n\n');
      resto = bloques.pop() ?? '';
      for (const bloque of bloques) {
        const evento = leerEvento(bloque);
        if (!evento) continue;
        const tipo = typeof evento.type === 'string' ? evento.type : '';
        if (tipo === 'response.output_text.delta' && typeof evento.delta === 'string' && evento.delta) {
          marcar();
          texto += evento.delta;
          await opciones.alDelta(evento.delta);
        }
        if (tipo === 'response.function_call_arguments.delta' && typeof evento.delta === 'string') {
          marcar();
          argumentos += evento.delta;
        }
        if (tipo === 'response.function_call_arguments.done') {
          marcar();
          const crudo = typeof evento.arguments === 'string' ? evento.arguments : argumentos;
          const nombre = typeof evento.name === 'string' ? evento.name : 'pasar_a_avra';
          if (nombre === 'pasar_a_avra') traspaso = interpretarTraspaso(crudo);
        }
        if (tipo === 'response.output_item.done' && evento.item && typeof evento.item === 'object') {
          const item = evento.item as Record<string, unknown>;
          if (item.type === 'function_call' && item.name === 'pasar_a_avra' && typeof item.arguments === 'string') {
            marcar();
            traspaso = interpretarTraspaso(item.arguments);
          }
        }
      }
    }
  } catch {
    if (!vioToken) return { ok: false, motivo: 'timeout' };
    if (!texto.trim() && !traspaso) return { ok: false, motivo: 'red' };
  } finally {
    clearTimeout(temporizador);
  }

  if (!vioToken) return { ok: false, motivo: 'timeout' };
  const visible = textoFinal(texto, traspaso);
  if (!visible) return { ok: false, motivo: 'red' };
  return { ok: true, texto: visible, traspaso, tPrimerToken, tFin: Date.now() };
}

function textoFinal(texto: string, traspaso: PedidoAvra | null): string {
  const limpio = texto.trim();
  if (!traspaso) return limpio;
  if (limpio.includes(TEXTO_TRASPASO)) return limpio;
  return limpio ? `${limpio}\n${TEXTO_TRASPASO}` : TEXTO_TRASPASO;
}

export function interpretarTraspaso(crudo: string): PedidoAvra | null {
  try {
    const valor = JSON.parse(crudo) as unknown;
    if (!valor || typeof valor !== 'object') return null;
    const cuerpo = valor as Record<string, unknown>;
    if (cuerpo.motivo !== 'cita' && cuerpo.motivo !== 'prospecto') return null;
    if (typeof cuerpo.resumen !== 'string' || !cuerpo.resumen.trim()) return null;
    const cuando = typeof cuerpo.cuando === 'string' ? cuerpo.cuando.trim().slice(0, 200) : '';
    return { motivo: cuerpo.motivo, resumen: cuerpo.resumen.trim().slice(0, 1_000), cuando };
  } catch {
    return null;
  }
}

function leerEvento(bloque: string): Record<string, unknown> | null {
  const datos: string[] = [];
  for (const linea of bloque.split('\n')) {
    if (linea.startsWith('data:')) datos.push(linea.slice(5).trim());
  }
  if (datos.length === 0) return null;
  try {
    const valor = JSON.parse(datos.join('\n')) as unknown;
    if (!valor || typeof valor !== 'object') return null;
    return valor as Record<string, unknown>;
  } catch {
    return null;
  }
}
