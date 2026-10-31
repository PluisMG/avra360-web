import { env } from 'cloudflare:workers';
import { createExecutionContext, runInDurableObject, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SALIDA_MODELO } from './constantes.ts';
import worker from './index.ts';
import { hashIp } from './ip.ts';
import { INSTRUCCIONES, MODELO_PREDETERMINADO, TEXTO_TRASPASO, modeloDe, usarHibrido } from './openai.ts';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const red = {
  modo: 'texto' as 'texto' | 'herramienta' | 'cuelga',
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
      if (red.estado !== 200) return new Response('no', { status: red.estado });
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
    const sinLlave = await postChat('Hola', ipNueva(), { ...env, CHAT_MODO: 'hibrido', OPENAI_API_KEY: '' });
    expect(sinLlave.status).toBe(200);
    const enAvra = await postChat('Hola', ipNueva(), { ...env, CHAT_MODO: 'avra', OPENAI_API_KEY: 'sk-prueba' });
    expect(enAvra.status).toBe(200);
    expect(red.llamadas.every((llamada) => llamada.url.startsWith('https://webhook.test/avra'))).toBe(true);
    expect(red.llamadas).toHaveLength(2);
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
    const tiempos = marcas(registros, 'Hola');
    expect(tiempos.some((dato) => dato.fallback === true)).toBe(true);
    expect(JSON.stringify(tiempos)).not.toContain('Hola');
    registros.restaurar();
  });

  it('si el primer token no llega, cae al webhook', async () => {
    red.llamadas = [];
    red.modo = 'cuelga';
    const respuesta = await postChat('Hola', ipNueva(), entorno({ CHAT_TIMEOUT_TOKEN_MS: '40' }));
    red.modo = 'texto';
    expect(respuesta.status).toBe(200);
    expect(red.llamadas.map((llamada) => llamada.url)).toEqual([
      'https://api.openai.com/v1/responses',
      'https://webhook.test/avra',
    ]);
    const cuerpo = JSON.parse(String(red.llamadas[1]?.init.body)) as { message: string };
    expect(cuerpo.message).toBe('Hola');
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
    const fin = tiempos.find((dato) => dato.t_fin != null);
    expect(fin?.t_recibido).toEqual(expect.any(Number));
    expect(fin?.t_primer_token).toEqual(expect.any(Number));
    expect(fin?.fallback).toBe(false);
    expect(fin?.ms_primer_token).toBe(Number(fin?.t_primer_token) - Number(fin?.t_recibido));
    expect(JSON.stringify(tiempos)).not.toContain('Buen día');
    expect(JSON.stringify(tiempos)).not.toContain('sk-prueba');
    registros.restaurar();
  });
});

describe('traspaso', () => {
  it('pasar_a_avra despierta a AVRA y la confirmación firmada se empuja', async () => {
    red.llamadas = [];
    red.modo = 'herramienta';
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
    expect(cuerpo.history.some((turno) => turno.text.includes(TEXTO_TRASPASO))).toBe(true);

    expect((await postReply(cuerpo.replyToken, 'PRUEBA cita anotada')).status).toBe(200);
    const flujo = await getStream(pendiente.conversationId);
    const crudo = await leerHasta(flujo, 'PRUEBA cita anotada');
    expect(crudo).toContain(TEXTO_TRASPASO);
    expect(crudo).toContain('PRUEBA cita anotada');
    expect(crudo).toContain('"traspaso":true');
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
    `event: response.function_call_arguments.done\ndata: ${JSON.stringify({ type: 'response.function_call_arguments.done', name: 'pasar_a_avra', arguments: argumentos })}\n\n`,
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

async function getStream(conversationId: string) {
  const ctx = createExecutionContext();
  return worker.fetch(new IncomingRequest(`https://avra360.example/api/chat/${conversationId}/stream`), env, ctx);
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
