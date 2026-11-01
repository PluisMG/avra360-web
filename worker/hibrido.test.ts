import { env } from 'cloudflare:workers';
import { createExecutionContext, runInDurableObject, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SALIDA_MODELO } from './constantes.ts';
import worker from './index.ts';
import { hashIp } from './ip.ts';
import {
  HERRAMIENTA,
  INSTRUCCIONES,
  MODELO_PREDETERMINADO,
  TEXTO_TRASPASO,
  mensajeParaAvra,
  modeloDe,
  textoVisible,
  usarHibrido,
} from './openai.ts';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const red = {
  modo: 'texto' as 'texto' | 'herramienta' | 'cuelga' | 'cuelga-traspaso' | 'solo-herramienta',
  estado: 200,
  llamadas: [] as { url: string; init: RequestInit }[],
};

let octeto = 80;

beforeEach(() => {
  red.modo = 'texto';
  red.estado = 200;
  red.llamadas = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('challenges.cloudflare.com')) return Response.json({ success: true });
    if (url.startsWith('https://webhook.test/avra')) {
      red.llamadas.push({ url, init: init ?? {} });
      return new Response('ok', { status: 200 });
    }
    if (url === 'https://api.openai.com/v1/responses') {
      red.llamadas.push({ url, init: init ?? {} });
      if (red.estado !== 200) {
        return Response.json(
          { error: { message: 'detalle interno que no se registra', code: 'server_error' } },
          { status: red.estado },
        );
      }
      if (red.modo === 'cuelga-traspaso') {
        const encoder = new TextEncoder();
        const cuerpo = flujoHerramienta().replace(/\nevent: response\.completed[\s\S]*$/, '\n');
        return new Response(
          new ReadableStream({
            start(control) {
              control.enqueue(encoder.encode(cuerpo));
              const senal = init?.signal;
              const cortar = () => {
                try {
                  control.error(new DOMException('aborted', 'AbortError'));
                } catch {
                  /* el lector ya terminó */
                }
              };
              if (senal?.aborted) cortar();
              else senal?.addEventListener('abort', cortar, { once: true });
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }
      if (red.modo === 'solo-herramienta') {
        return new Response(flujoSoloHerramienta(), { headers: { 'content-type': 'text/event-stream' } });
      }
      if (red.modo === 'cuelga') {
        await new Promise((_resolver, rechazar) => {
          const senal = init?.signal;
          if (!senal) return;
          if (senal.aborted) rechazar(new DOMException('aborted', 'AbortError'));
          senal.addEventListener('abort', () => rechazar(new DOMException('aborted', 'AbortError')), { once: true });
        });
      }
      const mensaje = mensajeDe(init);
      const cuerpo =
        red.modo === 'herramienta'
          ? flujoHerramienta()
          : flujoTexto(`Eco ${mensaje}`);
      return new Response(cuerpo, { headers: { 'content-type': 'text/event-stream' } });
    }
    throw new Error(`fetch inesperado: ${url}`);
  }) as typeof fetch;
});

describe('selección de modo', () => {
  it('solo usa OpenAI con CHAT_MODO hibrido y la llave', () => {
    expect(usarHibrido({ ...env, CHAT_MODO: 'avra', OPENAI_API_KEY: 'sk-prueba' })).toBe(false);
    expect(usarHibrido({ ...env, CHAT_MODO: 'hibrido', OPENAI_API_KEY: '' })).toBe(false);
    expect(usarHibrido({ ...env, CHAT_MODO: 'hibrido' })).toBe(false);
    expect(usarHibrido({ ...env, CHAT_MODO: 'hibrido', OPENAI_API_KEY: 'sk-prueba' })).toBe(true);
    expect(modeloDe({ ...env, OPENAI_MODELO: '' })).toBe(MODELO_PREDETERMINADO);
    expect(modeloDe({ ...env, OPENAI_MODELO: 'gpt-6-luna' })).toBe('gpt-6-luna');
    expect(INSTRUCCIONES).toContain('COFEPRIS');
    expect(INSTRUCCIONES).toContain('https://wa.me/529611919199');
    expect(INSTRUCCIONES).toContain('No des precios');
    expect(INSTRUCCIONES).not.toMatch(/\$\s?\d/);
  });

  it('sin llave, o fuera de hibrido, despierta a AVRA', async () => {
    red.llamadas = [];
    const registros = espiar();
    const sinLlave = await postChat('Hola', ipNueva(), { ...env, CHAT_MODO: 'hibrido', OPENAI_API_KEY: '' });
    expect(sinLlave.status).toBe(200);
    const enAvra = await postChat('Hola', ipNueva(), { ...env, CHAT_MODO: 'avra', OPENAI_API_KEY: 'sk-prueba' });
    expect(enAvra.status).toBe(200);
    expect(red.llamadas.every((llamada) => llamada.url.startsWith('https://webhook.test/avra'))).toBe(true);
    expect(red.llamadas).toHaveLength(2);
    const motivos = registros.lineas
      .map((linea) => JSON.parse(linea) as { evento?: string; motivo?: string })
      .filter((dato) => dato.evento === 'fallback')
      .map((dato) => dato.motivo);
    expect(motivos).toEqual(['sin_clave', 'modo']);
    registros.restaurar();
  });
});

describe('respaldo', () => {
  it('si OpenAI responde 500, el mensaje sigue por el webhook', async () => {
    red.llamadas = [];
    red.estado = 500;
    const registros = espiar();
    const respuesta = await postChat('Hola', ipNueva(), entorno());
    red.estado = 200;
    expect(respuesta.status).toBe(200);
    expect(red.llamadas.map((llamada) => llamada.url)).toEqual([
      'https://api.openai.com/v1/responses',
      'https://webhook.test/avra',
    ]);
    const eventos = registros.lineas.map((linea) => JSON.parse(linea) as Record<string, unknown>);
    expect(eventos.find((dato) => dato.evento === 'openai_error')).toMatchObject({
      status: 500,
      codigo: 'server_error',
      modelo: 'gpt-6-luna',
    });
    expect(eventos.find((dato) => dato.evento === 'fallback')).toMatchObject({ motivo: 'error' });
    expect(JSON.stringify(eventos)).not.toContain('detalle interno');
    expect(JSON.stringify(eventos)).not.toContain('Hola');
    const reply = JSON.parse(String(red.llamadas.at(-1)?.init.body)) as { replyToken: string };
    const pendiente = (await respuesta.json()) as { conversationId: string; messageId: string };
    expect((await postReply(reply.replyToken, 'PRUEBA por AVRA')).status).toBe(200);
    expect((await getStream(pendiente.conversationId, pendiente.messageId)).status).toBe(200);
    const tiempos = eventos
      .concat(registros.lineas.slice(eventos.length).map((linea) => JSON.parse(linea) as Record<string, unknown>))
      .filter((dato) => dato.evento === 'chat_tiempo' && dato.messageId === pendiente.messageId);
    expect(tiempos).toHaveLength(1);
    expect(tiempos[0]).toMatchObject({ fallback: true, conversationId: pendiente.conversationId });
    expect(tiempos[0]?.t_recibido).toEqual(expect.any(Number));
    expect(tiempos[0]?.t_webhook_ok).toEqual(expect.any(Number));
    expect(tiempos[0]?.t_fin).toEqual(expect.any(Number));
    expect(JSON.stringify(tiempos)).not.toContain('PRUEBA por AVRA');
    registros.restaurar();
  });

  it('si el primer token no llega, cae al webhook', async () => {
    red.llamadas = [];
    red.modo = 'cuelga';
    const registros = espiar();
    const respuesta = await postChat('Hola', ipNueva(), entorno({ CHAT_TIMEOUT_TOKEN_MS: '40' }));
    red.modo = 'texto';
    expect(respuesta.status).toBe(200);
    expect(red.llamadas.map((llamada) => llamada.url)).toEqual([
      'https://api.openai.com/v1/responses',
      'https://webhook.test/avra',
    ]);
    const cuerpo = JSON.parse(String(red.llamadas[1]?.init.body)) as { message: string };
    expect(cuerpo.message).toBe('Hola');
    const motivos = registros.lineas
      .map((linea) => JSON.parse(linea) as { evento?: string; motivo?: string })
      .filter((dato) => dato.evento === 'fallback')
      .map((dato) => dato.motivo);
    expect(motivos).toEqual(['timeout']);
    expect(registros.lineas.join('\n')).not.toContain('openai_error');
    expect(registros.lineas.join('\n')).not.toContain('Hola');
    registros.restaurar();
  });
});

describe('streaming', () => {
  it('empuja los tokens y no llama al webhook', async () => {
    red.llamadas = [];
    red.modo = 'texto';
    const registros = espiar();
    const creado = await postChat('Buen día', ipNueva(), entorno());
    const pendiente = (await creado.json()) as { conversationId: string; messageId: string; status: string };
    expect(pendiente.status).toBe('pending');
    expect(red.llamadas).toHaveLength(1);
    const pedido = JSON.parse(String(red.llamadas[0]?.init.body)) as {
      model: string;
      max_output_tokens: number;
      reasoning: { effort: string };
      store: boolean;
      tools: { name: string }[];
      instructions: string;
    };
    expect(pedido.model).toBe('gpt-6-luna');
    expect(pedido.max_output_tokens).toBe(MAX_SALIDA_MODELO);
    expect(pedido.reasoning).toEqual({ effort: 'none' });
    expect(pedido.store).toBe(false);
    expect(pedido.tools[0]?.name).toBe('pasar_a_avra');
    expect(pedido.instructions).toContain('Chiapas');
    expect(red.llamadas[0]?.init.headers && new Headers(red.llamadas[0].init.headers).get('authorization')).toBe(
      'Bearer sk-prueba',
    );

    const flujo = await getStream(pendiente.conversationId);
    const crudo = await leerHasta(flujo, 'event: fin');
    expect(crudo).toContain('event: delta');
    expect(crudo).toContain('Eco Buen día');
    const tiempos = marcas(registros).filter((dato) => dato.messageId === pendiente.messageId);
    expect(tiempos).toHaveLength(1);
    const fin = tiempos[0];
    expect(fin?.t_recibido).toEqual(expect.any(Number));
    expect(fin?.t_primer_token).toEqual(expect.any(Number));
    expect(fin?.t_fin).toEqual(expect.any(Number));
    expect(fin?.fallback).toBe(false);
    expect(fin?.ms_primer_token).toBe(Number(fin?.t_primer_token) - Number(fin?.t_recibido));
    expect(JSON.stringify(tiempos)).not.toContain('Buen día');
    expect(JSON.stringify(tiempos)).not.toContain('sk-prueba');
    registros.restaurar();
  });
});

describe('preguntas que responde el modelo', () => {
  const preguntas = [
    '¿Cuánto cuesta el manejo de redes?',
    '¿Me garantizan más pacientes y que mis tratamientos curan?',
  ];

  it('no pasa a AVRA un precio ni una garantía, y el pedido lo dice', async () => {
    expect(textoVisible('', true)).not.toBe(TEXTO_TRASPASO);
    expect(textoVisible('', true)).toContain(TEXTO_TRASPASO);
    expect(textoVisible('La cotización es personalizada.', true)).toContain('personalizada');
    expect(textoVisible(`Ya lo anoté.\n${TEXTO_TRASPASO}`, true).split(TEXTO_TRASPASO).length - 1).toBe(1);

    for (const pregunta of preguntas) {
      red.llamadas = [];
      red.modo = 'texto';
      const creado = await postChat(pregunta, ipNueva(), entorno());
      expect(creado.status).toBe(200);
      expect(red.llamadas.map((llamada) => llamada.url)).toEqual(['https://api.openai.com/v1/responses']);
      const pedido = JSON.parse(String(red.llamadas[0]?.init.body)) as {
        instructions: string;
        input: { role: string; content: string }[];
        tools: { name: string; description: string }[];
      };
      expect(pedido.input.at(-1)?.content).toBe(pregunta);
      expect(pedido.instructions).toBe(INSTRUCCIONES);
      expect(pedido.instructions).toContain('respóndelos tú');
      expect(pedido.instructions).toContain('La cotización es personalizada');
      expect(pedido.instructions).toContain('https://wa.me/529611919199');
      expect(pedido.instructions).toContain('COFEPRIS');
      expect(pedido.instructions).toContain('No garantices resultados');
      expect(pedido.instructions).not.toContain('llama a pasar_a_avra con motivo');
      expect(pedido.tools[0]).toEqual(HERRAMIENTA);
      expect(pedido.tools[0]?.description).toContain('solo si la persona pide explícitamente una cita');
      expect(pedido.tools[0]?.description).toContain('No la uses para preguntas de precio');
      const flujo = await getStream(((await creado.clone().json()) as { conversationId: string }).conversationId);
      const crudo = await leerHasta(flujo, 'event: fin');
      expect(crudo).toContain(`Eco ${pregunta}`);
      expect(crudo).not.toContain(TEXTO_TRASPASO);
    }
  });
});

describe('resumen para AVRA', () => {
  it('no duplica puntos y no se publica como mensaje del visitante', async () => {
    const resumen = mensajeParaAvra({
      motivo: 'cita',
      resumen: 'Juan solicita agendar. Proporcionó nombre, clínica y correo.',
      cuando: 'martes 3 de noviembre a las 11:00 a. m.',
    });
    expect(resumen).toBe(
      'Solicitud de cita. Juan solicita agendar. Proporcionó nombre, clínica y correo. Fecha u hora pedida: martes 3 de noviembre a las 11:00 a. m.',
    );
    expect(resumen).not.toContain('..');

    red.llamadas = [];
    red.modo = 'herramienta';
    const creado = await postChat('Quiero una cita el martes', ipNueva(), entorno());
    red.modo = 'texto';
    const pendiente = (await creado.json()) as { conversationId: string };
    const eventos = await getEventos(pendiente.conversationId);
    const data = (await eventos.json()) as { messages: { role: string; text: string }[] };
    expect(data.messages.some((mensaje) => mensaje.text.includes('Solicitud de cita'))).toBe(false);
    expect(data.messages.some((mensaje) => mensaje.role === 'user' && mensaje.text.includes('correo'))).toBe(false);
    expect(data.messages.some((mensaje) => mensaje.role === 'assistant')).toBe(true);
  });
});

describe('traspaso', () => {
  it('pasar_a_avra despierta a AVRA y la confirmación firmada se empuja', async () => {
    red.llamadas = [];
    red.modo = 'herramienta';
    const registros = espiar();
    const creado = await postChat('Quiero una cita el martes', ipNueva(), entorno());
    red.modo = 'texto';
    const pendiente = (await creado.json()) as { conversationId: string; messageId: string };
    const webhooks = red.llamadas.filter((llamada) => llamada.url.startsWith('https://webhook.test/'));
    expect(webhooks).toHaveLength(1);
    const cuerpo = JSON.parse(String(webhooks[0]?.init.body)) as {
      message: string;
      replyToken: string;
      history: { role: string; text: string }[];
    };
    expect(cuerpo.message).toContain('Solicitud de cita');
    expect(cuerpo.message).toContain('martes 10:00');
    expect(cuerpo.history.some((turno) => turno.text === 'Quiero una cita el martes')).toBe(true);
    expect(cuerpo.history.some((turno) => turno.text.includes('Con gusto'))).toBe(true);
    expect(cuerpo.history.some((turno) => turno.text.includes(TEXTO_TRASPASO))).toBe(true);
    expect(cuerpo.history.some((turno) => turno.text.trim() === TEXTO_TRASPASO)).toBe(false);

    expect((await postReply(cuerpo.replyToken, 'PRUEBA cita anotada')).status).toBe(200);
    const flujo = await getStream(pendiente.conversationId);
    const crudo = await leerHasta(flujo, 'PRUEBA cita anotada');
    expect(crudo).toContain(TEXTO_TRASPASO);
    expect(crudo).toContain('PRUEBA cita anotada');
    expect(crudo).toContain('"traspaso":true');
    const avisos = registros.lineas
      .map((linea) => JSON.parse(linea) as { evento?: string; motivo?: string; estado?: number; messageId?: string })
      .filter((dato) => dato.evento === 'traspaso_avra');
    expect(avisos).toEqual([
      expect.objectContaining({ motivo: 'cita', estado: 200, conversationId: pendiente.conversationId }),
    ]);
    expect(JSON.stringify(avisos)).not.toContain('martes');
    expect(JSON.stringify(avisos)).not.toContain('Quiere una cita');
    const tiempos = registros.lineas
      .map((linea) => JSON.parse(linea) as { evento?: string; messageId?: string })
      .filter((dato) => dato.evento === 'chat_tiempo' && dato.messageId === pendiente.messageId);
    expect(tiempos).toHaveLength(1);
    registros.restaurar();
  });

  it('si el stream no cierra después de pasar_a_avra, igual entrega y registra', async () => {
    red.llamadas = [];
    red.modo = 'cuelga-traspaso';
    const registros = espiar();
    const creado = await postChat('Agéndame una cita', ipNueva(), entorno({ CHAT_TIMEOUT_TOKEN_MS: '80' }));
    red.modo = 'texto';
    expect(creado.status).toBe(200);
    const pendiente = (await creado.json()) as { conversationId: string; messageId: string };
    expect(red.llamadas.some((llamada) => llamada.url.startsWith('https://webhook.test/'))).toBe(true);
    const flujo = await getStream(pendiente.conversationId, pendiente.messageId);
    const crudo = await leerHasta(flujo, TEXTO_TRASPASO);
    expect(crudo).toContain('Con gusto');
    expect(crudo).toContain(TEXTO_TRASPASO);
    const eventos = registros.lineas.map((linea) => JSON.parse(linea) as { evento?: string; motivo?: string; messageId?: string });
    expect(eventos.some((dato) => dato.evento === 'traspaso_avra' && dato.motivo === 'cita')).toBe(true);
    expect(eventos.some((dato) => dato.evento === 'fallback')).toBe(false);
    expect(eventos.filter((dato) => dato.evento === 'chat_tiempo' && dato.messageId === pendiente.messageId)).toHaveLength(1);
    expect(registros.lineas.join('\n')).not.toContain('Agéndame');
    registros.restaurar();
  });

  it('una herramienta sin texto igual deja una respuesta útil y el aviso', async () => {
    red.llamadas = [];
    red.modo = 'solo-herramienta';
    const registros = espiar();
    const creado = await postChat('Quiero que me contacten', ipNueva(), entorno());
    red.modo = 'texto';
    const pendiente = (await creado.json()) as { conversationId: string; messageId: string };
    const flujo = await getStream(pendiente.conversationId, pendiente.messageId);
    const crudo = await leerHasta(flujo, TEXTO_TRASPASO);
    expect(crudo).toContain(TEXTO_TRASPASO);
    expect(crudo).not.toContain(`"text":"${TEXTO_TRASPASO}"`);
    expect(red.llamadas.some((llamada) => llamada.url.startsWith('https://webhook.test/'))).toBe(true);
    const eventos = registros.lineas.map((linea) => JSON.parse(linea) as { evento?: string; messageId?: string });
    expect(eventos.filter((dato) => dato.evento === 'chat_tiempo' && dato.messageId === pendiente.messageId)).toHaveLength(1);
    expect(eventos.some((dato) => dato.evento === 'traspaso_avra')).toBe(true);
    registros.restaurar();
  });
});

describe('tres turnos con OpenAI simulado', () => {
  it('conserva el historial, el límite y no despierta a AVRA', async () => {
    red.llamadas = [];
    red.modo = 'texto';
    const ip = ipNueva();
    let conversationId = '';
    for (const texto of ['Hola', 'Quiero una marca', '¿Hacen sitios?']) {
      const creado = await postChat(texto, ip, entorno(), conversationId || undefined);
      const pendiente = (await creado.json()) as { conversationId: string };
      conversationId = pendiente.conversationId;
      const flujo = await getStream(conversationId);
      const crudo = await leerHasta(flujo, 'event: fin');
      expect(crudo).toContain(`Eco ${texto}`);
    }
    expect(red.llamadas.every((llamada) => llamada.url === 'https://api.openai.com/v1/responses')).toBe(true);
    expect(red.llamadas).toHaveLength(3);
    const tercero = JSON.parse(String(red.llamadas[2]?.init.body)) as {
      input: { role: string; content: string }[];
    };
    expect(tercero.input.map((turno) => turno.content)).toEqual([
      'Hola',
      'Eco Hola',
      'Quiero una marca',
      'Eco Quiero una marca',
      '¿Hacen sitios?',
    ]);

    const hash = await hashIp(ip);
    const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(hash));
    await runInDurableObject(stub, async (_instancia, state) => {
      const ahora = Date.now();
      for (let i = 0; i < 7; i += 1) state.storage.sql.exec('INSERT INTO golpes (at) VALUES (?)', ahora);
    });
    red.llamadas = [];
    const extra = await postChat('de más', ip, entorno(), conversationId);
    expect(extra.status).toBe(429);
    expect(red.llamadas).toHaveLength(0);
  });
});

function entorno(extra: Record<string, string> = {}): Env {
  return { ...env, CHAT_MODO: 'hibrido', OPENAI_API_KEY: 'sk-prueba', OPENAI_MODELO: 'gpt-6-luna', ...extra };
}

function ipNueva() {
  octeto += 1;
  return `203.0.113.${octeto}`;
}

function espiar() {
  const lineas: string[] = [];
  const espia = vi.spyOn(console, 'log').mockImplementation((linea: unknown) => {
    lineas.push(String(linea));
  });
  return {
    lineas,
    restaurar: () => espia.mockRestore(),
  };
}

function marcas(registros: { lineas: string[] }, prohibido?: string) {
  const tiempos = registros.lineas
    .map((linea) => JSON.parse(linea) as Record<string, unknown>)
    .filter((dato) => dato.evento === 'chat_tiempo');
  if (prohibido) expect(JSON.stringify(tiempos)).not.toContain(prohibido);
  return tiempos;
}

function mensajeDe(init?: RequestInit): string {
  const pedido = JSON.parse(String(init?.body)) as { input: { content: string }[] };
  return pedido.input.at(-1)?.content ?? '';
}

function flujoTexto(texto: string): string {
  const partes = texto.match(/.{1,8}/g) ?? [texto];
  return partes
    .map(
      (delta) =>
        `event: response.output_text.delta\ndata: ${JSON.stringify({ type: 'response.output_text.delta', delta })}\n\n`,
    )
    .join('');
}

function flujoHerramienta(): string {
  const argumentos = JSON.stringify({
    motivo: 'cita',
    resumen: 'Quiere una cita para revisar su marca',
    cuando: 'martes 10:00',
  });
  return [
    `event: response.output_text.delta\ndata: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'Con gusto. ' })}\n\n`,
    `event: response.output_item.added\ndata: ${JSON.stringify({ type: 'response.output_item.added', item: { type: 'function_call', name: 'pasar_a_avra' } })}\n\n`,
    `event: response.function_call_arguments.done\ndata: ${JSON.stringify({ type: 'response.function_call_arguments.done', name: 'pasar_a_avra', arguments: argumentos })}\n\n`,
    `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed' })}\n\n`,
  ].join('');
}

function flujoSoloHerramienta(): string {
  const argumentos = JSON.stringify({
    motivo: 'cita',
    resumen: 'Pide una reunión',
    cuando: '',
  });
  return [
    `event: response.function_call_arguments.done\ndata: ${JSON.stringify({ type: 'response.function_call_arguments.done', arguments: argumentos })}\n\n`,
    `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed' })}\n\n`,
  ].join('');
}

async function postChat(message: string, ip: string, entornoChat: Env, conversationId?: string) {
  const ctx = createExecutionContext();
  const respuesta = await worker.fetch(
    new IncomingRequest('https://avra360.example/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify({ message, turnstileToken: 'ok', ...(conversationId ? { conversationId } : {}) }),
    }),
    entornoChat,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return respuesta;
}

async function postReply(replyToken: string, text: string) {
  const ctx = createExecutionContext();
  const respuesta = await worker.fetch(
    new IncomingRequest('https://avra360.example/api/chat/reply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ replyToken, text }),
    }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return respuesta;
}

async function getEventos(conversationId: string) {
  const ctx = createExecutionContext();
  return worker.fetch(new IncomingRequest(`https://avra360.example/api/chat/${conversationId}/events`), env, ctx);
}

async function getStream(conversationId: string, messageId?: string) {
  const ctx = createExecutionContext();
  const consulta = messageId ? `?messageId=${encodeURIComponent(messageId)}` : '';
  return worker.fetch(
    new IncomingRequest(`https://avra360.example/api/chat/${conversationId}/stream${consulta}`),
    env,
    ctx,
  );
}

async function leerHasta(respuesta: Response, aguja: string): Promise<string> {
  const lector = respuesta.body?.getReader();
  if (!lector) return '';
  const decodificador = new TextDecoder();
  let buf = '';
  const fallo = new Promise<never>((_, rechazar) => {
    setTimeout(() => rechazar(new Error('sse-test')), 5_000);
  });
  try {
    while (!buf.includes(aguja)) {
      const paso = await Promise.race([lector.read(), fallo]);
      if (paso.done) break;
      buf += decodificador.decode(paso.value, { stream: true });
    }
  } finally {
    await lector.cancel();
  }
  return buf;
}
