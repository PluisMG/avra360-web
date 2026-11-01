import instrucciones from './prompt-sistema.txt';
import { HISTORIAL, MAX_SALIDA_MODELO, TIMEOUT_GENERACION_MS, TIMEOUT_PRIMER_TOKEN_MS } from './constantes.ts';
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

export const HERRAMIENTA = {
  type: 'function',
  name: 'pasar_a_avra',
  description:
    'Úsala solo si la persona pide explícitamente una cita o una reunión, o si pide explícitamente que la contacten o que le envíen una cotización. No la uses para preguntas de precio, garantías, resultados ni salud: esas se responden en el texto.',
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

export function timeoutGeneracion(env: Env & { CHAT_TIMEOUT_TOKEN_MS?: string }): number {
  const primero = timeoutPrimerToken(env);
  if (primero < TIMEOUT_PRIMER_TOKEN_MS) return primero;
  return TIMEOUT_GENERACION_MS;
}

export function mensajeParaAvra(pedido: PedidoAvra): string {
  const tipo = pedido.motivo === 'cita' ? 'Solicitud de cita' : 'Prospecto';
  const partes = [cerrarFrase(tipo), cerrarFrase(pedido.resumen)];
  if (pedido.cuando.trim()) partes.push(cerrarFrase(`Fecha u hora pedida: ${pedido.cuando}`));
  return partes.filter(Boolean).join(' ').slice(0, 2_000);
}

function cerrarFrase(texto: string): string {
  const limpio = texto.trim().replace(/[. ]+$/g, '').trim();
  return limpio ? `${limpio}.` : '';
}

export async function hablarConModelo(opciones: {
  apiKey: string;
  modelo: string;
  historial: Turno[];
  mensaje: string;
  timeoutMs: number;
  timeoutTotalMs: number;
  alDelta: (fragmento: string) => Promise<void>;
}): Promise<ResultadoModelo> {
  const controlador = new AbortController();
  const corteTotal = setTimeout(() => controlador.abort(), opciones.timeoutTotalMs);
  let vioToken = false;
  let tPrimerToken = 0;
  let texto = '';
  let argumentos = '';
  let nombreFuncion = '';
  let traspaso: PedidoAvra | null = null;
  const cortePrimer = setTimeout(() => {
    if (!vioToken) controlador.abort();
  }, opciones.timeoutMs);

  const marcar = () => {
    if (vioToken) return;
    vioToken = true;
    tPrimerToken = Date.now();
    clearTimeout(cortePrimer);
  };

  const cerrar = () => {
    clearTimeout(cortePrimer);
    clearTimeout(corteTotal);
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
    if (!respuesta.ok || !respuesta.body) {
      const codigo = respuesta.body ? await codigoDeError(respuesta) : '';
      console.log(
        JSON.stringify({ evento: 'openai_error', status: respuesta.status, codigo, modelo: opciones.modelo }),
      );
      return { ok: false, motivo: 'http' };
    }

    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let resto = '';
    let seguir = true;
    while (seguir) {
      const paso = await lector.read();
      if (paso.done) break;
      resto += decodificador.decode(paso.value, { stream: true });
      const bloques = resto.split('\n\n');
      resto = bloques.pop() ?? '';
      for (const bloque of bloques) {
        const leido = leerEvento(bloque);
        if (!leido) continue;
        const { tipo, datos } = leido;
        if (tipo === 'response.output_text.delta' && typeof datos.delta === 'string' && datos.delta) {
          marcar();
          texto += datos.delta;
          await opciones.alDelta(datos.delta);
        }
        if (tipo === 'response.output_item.added' && datos.item && typeof datos.item === 'object') {
          const item = datos.item as Record<string, unknown>;
          if (item.type === 'function_call' && typeof item.name === 'string') nombreFuncion = item.name;
        }
        if (tipo === 'response.function_call_arguments.delta' && typeof datos.delta === 'string') {
          marcar();
          argumentos += datos.delta;
        }
        if (tipo === 'response.function_call_arguments.done' || tipo === 'response.output_item.done') {
          marcar();
          const pedido = pedidoDeFuncion(datos, argumentos, nombreFuncion);
          if (pedido) traspaso = pedido;
        }
        if (tipo === 'response.completed' || tipo === 'response.done') seguir = false;
      }
    }
    await lector.cancel().catch(() => undefined);
  } catch {
    if (!vioToken && !traspaso) return { ok: false, motivo: 'timeout' };
  } finally {
    cerrar();
  }

  if (traspaso || texto.trim()) {
    const visible = textoFinal(texto, traspaso);
    if (visible) return { ok: true, texto: visible, traspaso, tPrimerToken: tPrimerToken || Date.now(), tFin: Date.now() };
  }
  if (!vioToken) return { ok: false, motivo: 'timeout' };
  return { ok: false, motivo: 'red' };
}

export function textoVisible(texto: string, hayTraspaso: boolean): string {
  const limpio = texto.trim();
  if (!hayTraspaso) return limpio;
  const util = limpio.split(TEXTO_TRASPASO).join('').trim();
  const base = util || 'Te explico por aquí y, si quieres, una persona del equipo lo sigue contigo.';
  if (util && limpio.includes(TEXTO_TRASPASO)) return limpio;
  return `${base}\n${TEXTO_TRASPASO}`;
}

function textoFinal(texto: string, traspaso: PedidoAvra | null): string {
  return textoVisible(texto, traspaso !== null);
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

async function codigoDeError(respuesta: Response): Promise<string> {
  try {
    const data = (await respuesta.json()) as { error?: { code?: unknown } };
    const codigo = data.error?.code;
    if (typeof codigo === 'string') return codigo.slice(0, 64);
    if (typeof codigo === 'number' && Number.isFinite(codigo)) return String(codigo);
  } catch {
    return '';
  }
  return '';
}

function pedidoDeFuncion(
  datos: Record<string, unknown>,
  acumulado: string,
  nombreVisto: string,
): PedidoAvra | null {
  const item = datos.item && typeof datos.item === 'object' ? (datos.item as Record<string, unknown>) : null;
  const tipoEvento = typeof datos.type === 'string' ? datos.type : '';
  if (item && item.type !== 'function_call' && tipoEvento !== 'response.function_call_arguments.done') return null;
  const nombre =
    (typeof datos.name === 'string' && datos.name) ||
    (item && typeof item.name === 'string' ? item.name : '') ||
    nombreVisto ||
    (tipoEvento === 'response.function_call_arguments.done' ? 'pasar_a_avra' : '');
  if (nombre !== 'pasar_a_avra') return null;
  const crudo = textoArgumentos(datos.arguments) || (item ? textoArgumentos(item.arguments) : '') || acumulado;
  return crudo ? interpretarTraspaso(crudo) : null;
}

function textoArgumentos(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (valor && typeof valor === 'object') return JSON.stringify(valor);
  return '';
}

function leerEvento(bloque: string): { tipo: string; datos: Record<string, unknown> } | null {
  let nombre = '';
  const lineas: string[] = [];
  for (const linea of bloque.split('\n')) {
    if (linea.startsWith('event:')) nombre = linea.slice(6).trim();
    else if (linea.startsWith('data:')) lineas.push(linea.slice(5).trim());
  }
  if (lineas.length === 0) return null;
  try {
    const valor = JSON.parse(lineas.join('\n')) as unknown;
    if (!valor || typeof valor !== 'object') return null;
    const datos = valor as Record<string, unknown>;
    const tipo = typeof datos.type === 'string' ? datos.type : nombre;
    return tipo ? { tipo, datos } : null;
  } catch {
    return null;
  }
}
