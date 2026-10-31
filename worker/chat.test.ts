import { env } from 'cloudflare:workers';
import { createExecutionContext, runDurableObjectAlarm, runInDurableObject, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIMEOUT_WEBHOOK_MS } from './constantes.ts';
import worker from './index.ts';
import { hashIp } from './ip.ts';
import { firmarToken } from './tokens.ts';

const SECRETO = 'secreto-de-firma-de-prueba';
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const red = {
  turnstile: true,
  webhookFalla: false,
  llamadas: [] as { url: string; init: RequestInit }[],
};

let octeto = 30;

beforeEach(() => {
  red.turnstile = true;
  red.webhookFalla = false;
  red.llamadas = [];
  vi.spyOn(AbortSignal, 'timeout');
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('challenges.cloudflare.com')) {
      return Response.json(
        red.turnstile ? { success: true } : { success: false, 'error-codes': ['timeout-or-duplicate'] },
      );
    }
    if (url.startsWith('https://webhook.test/avra')) {
      red.llamadas.push({ url, init: init ?? {} });
      if (red.webhookFalla) throw new Error('red');
      return new Response('ok', { status: 200 });
    }
    throw new Error(`fetch inesperado: ${url}`);
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('configuración', () => {
  it('responde 503 si el chat no está activo', async () => {
    const respuesta = await postChat({ message: 'Hola', turnstileToken: 'x' }, ipNueva(), { ...env, CHAT_ACTIVO: '0' });
    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toEqual({ status: 'configurando' });
    expect(red.llamadas).toHaveLength(0);
    exigirSeguridad(respuesta);
  });

  it('responde 503 si falta un secret', async () => {
    const respuesta = await postChat({ message: 'Hola', turnstileToken: 'x' }, ipNueva(), { ...env, AVRA_WEBHOOK_URL: '' });
    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toEqual({ status: 'configurando' });
    expect(red.llamadas).toHaveLength(0);
  });
});

describe('chat activo', () => {
  it('rechaza Turnstile inválido sin llamar al webhook', async () => {
    red.turnstile = false;
    const registros: string[] = [];
    const espia = vi.spyOn(console, 'log').mockImplementation((linea: unknown) => {
      registros.push(String(linea));
    });
    const respuesta = await postChat({ message: 'Hola', turnstileToken: 'malo' }, ipNueva());
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({ status: 'verificacion' });
    expect(red.llamadas).toHaveLength(0);
    const rechazo = registros.map((linea) => JSON.parse(linea) as { evento?: string; codigos?: string[] }).find((dato) => dato.evento === 'turnstile_rechazado');
    expect(rechazo?.codigos).toEqual(['timeout-or-duplicate']);
    expect(registros.join('\n')).not.toContain('malo');
    expect(registros.join('\n')).not.toContain('secreto-turnstile');
    espia.mockRestore();
  });

  it('rechaza un mensaje vacío o demasiado largo', async () => {
    expect((await postChat({ message: '   ', turnstileToken: 'ok' }, ipNueva())).status).toBe(400);
    expect((await postChat({ message: 'a'.repeat(2001), turnstileToken: 'ok' }, ipNueva())).status).toBe(400);
    expect(red.llamadas).toHaveLength(0);
  });

  it('limita 10 mensajes por 10 minutos', async () => {
    const ip = ipNueva();
    for (let i = 0; i < 10; i += 1) {
      const respuesta = await postChat({ message: `mensaje ${i}`, turnstileToken: 'ok' }, ip);
      expect(respuesta.status).toBe(200);
    }
    const extra = await postChat({ message: 'de más', turnstileToken: 'ok' }, ip);
    expect(extra.status).toBe(429);
    expect(await extra.json()).toMatchObject({ status: 'limite', ventana: 'minuto' });
  });

  it('limita 40 mensajes por día', async () => {
    const ip = ipNueva();
    const hash = await hashIp(ip);
    const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(hash));
    await runInDurableObject(stub, async (_instancia, state) => {
      const haceUnaHora = Date.now() - 60 * 60 * 1000;
      for (let i = 0; i < 40; i += 1) state.storage.sql.exec('INSERT INTO golpes (at) VALUES (?)', haceUnaHora);
    });
    const respuesta = await postChat({ message: 'uno más', turnstileToken: 'ok' }, ip);
    expect(respuesta.status).toBe(429);
    expect(await respuesta.json()).toMatchObject({ status: 'limite', ventana: 'dia' });
  });

  it('firma la respuesta, acepta el texto una vez y trata el HTML como texto', async () => {
    const ip = ipNueva();
    const creado = await postChat({ message: 'Quiero una marca', turnstileToken: 'ok' }, ip);
    expect(creado.status).toBe(200);
    const pendiente = (await creado.json()) as { conversationId: string; messageId: string; status: string };
    expect(pendiente.status).toBe('pending');
    expect(red.llamadas).toHaveLength(1);
    const init = red.llamadas[0]?.init ?? {};
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer llave-webhook-de-prueba');
    expect(headers.get('x-automation-key')).toBe('llave-webhook-de-prueba');
    expect(AbortSignal.timeout).toHaveBeenCalledWith(TIMEOUT_WEBHOOK_MS);
    const cuerpo = JSON.parse(String(init.body)) as {
      conversationId: string;
      message: string;
      history: unknown[];
      replyUrl: string;
      replyToken: string;
      site: string;
    };
    expect(Object.keys(cuerpo).sort()).toEqual(['conversationId', 'history', 'message', 'replyToken', 'replyUrl', 'site']);
    expect(cuerpo.site).toBe('avra360-preview');
    expect(cuerpo.replyUrl).toBe('https://avra360.example/api/chat/reply');
    expect(cuerpo.history).toEqual([]);
    expect(cuerpo.message).toBe('Quiero una marca');
    expect(JSON.stringify(cuerpo)).not.toContain(ip);

    const partes = cuerpo.replyToken.split('.');
    const firma = partes[1] ?? '';
    const medio = Math.floor(firma.length / 2);
    const signo = firma[medio] === 'a' ? 'b' : 'a';
    const alterado = `${partes[0]}.${firma.slice(0, medio)}${signo}${firma.slice(medio + 1)}`;
    expect((await postReply(alterado, 'no')).status).toBe(401);
    const expirado = await firmarToken(SECRETO, {
      v: 1,
      c: pendiente.conversationId,
      m: pendiente.messageId,
      e: Math.floor(Date.now() / 1000) - 30,
    });
    expect((await postReply(expirado, 'no')).status).toBe(401);

    const xss = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const aceptada = await postReply(cuerpo.replyToken, xss);
    expect(aceptada.status).toBe(200);
    expect((await postReply(cuerpo.replyToken, xss)).status).toBe(409);

    const eventos = await getEventos(pendiente.conversationId);
    expect(eventos.status).toBe(200);
    expect(eventos.headers.get('content-type')).toContain('application/json');
    expect(eventos.headers.get('x-content-type-options')).toBe('nosniff');
    const crudo = await eventos.text();
    expect(crudo.startsWith('<')).toBe(false);
    const data = JSON.parse(crudo) as { messages: { role: string; text: string; replyTo: string | null }[] };
    expect(data.messages.find((mensaje) => mensaje.role === 'assistant')?.text).toBe(xss);
  });

  it('manda solo los últimos 10 turnos', async () => {
    const conversationId = crypto.randomUUID();
    const stub = env.CONVERSATION.get(env.CONVERSATION.idFromName(conversationId));
    for (let i = 0; i < 11; i += 1) await stub.agregarUsuario(`m${i}`);
    const respuesta = await postChat({ message: 'm11', conversationId, turnstileToken: 'ok' }, ipNueva());
    expect(respuesta.status).toBe(200);
    const cuerpo = JSON.parse(String(red.llamadas.at(-1)?.init.body)) as { history: { text: string }[]; message: string };
    expect(cuerpo.history).toHaveLength(10);
    expect(cuerpo.history[0]?.text).toBe('m1');
    expect(cuerpo.history[9]?.text).toBe('m10');
    expect(cuerpo.message).toBe('m11');
  });

  it('intenta el webhook una sola vez', async () => {
    red.webhookFalla = true;
    const respuesta = await postChat({ message: 'Hola', turnstileToken: 'ok' }, ipNueva());
    expect(respuesta.status).toBe(502);
    expect(red.llamadas).toHaveLength(1);
  });

  it('empuja la respuesta por SSE, conserva el sondeo y anota los tiempos', async () => {
    const registros: string[] = [];
    const espia = vi.spyOn(console, 'log').mockImplementation((linea: unknown) => {
      registros.push(String(linea));
    });
    const ip = ipNueva();
    const creado = await postChat({ message: 'Quiero una marca', turnstileToken: 'ok' }, ip);
    const pendiente = (await creado.json()) as { conversationId: string; messageId: string };
    const cuerpo = JSON.parse(String(red.llamadas.at(-1)?.init.body)) as { replyToken: string };
    expect((await postReply(cuerpo.replyToken, 'Listo por SSE')).status).toBe(200);

    const flujo = await getStream(pendiente.conversationId);
    expect(flujo.status).toBe(200);
    expect(flujo.headers.get('content-type')).toContain('text/event-stream');
    expect(flujo.headers.get('content-security-policy')).toContain("connect-src 'self'");
    const crudo = await leerHastaFin(flujo);
    expect(crudo).toContain('event: mensaje');
    expect(crudo).toContain('Listo por SSE');
    expect(crudo).toContain('event: fin');

    const sondeo = await getEventos(pendiente.conversationId);
    expect(sondeo.headers.get('content-type')).toContain('application/json');
    const data = (await sondeo.json()) as { messages: { text: string }[] };
    expect(data.messages.some((mensaje) => mensaje.text === 'Listo por SSE')).toBe(true);

    const tiempos = registros
      .map((linea) => JSON.parse(linea) as Record<string, unknown>)
      .filter((dato) => dato.evento === 'chat_tiempo' && dato.messageId === pendiente.messageId);
    const completo = tiempos.find((dato) => dato.t_entregado != null);
    expect(completo?.conversationId).toBe(pendiente.conversationId);
    expect(completo?.t_recibido).toEqual(expect.any(Number));
    expect(completo?.t_webhook_ok).toEqual(expect.any(Number));
    expect(completo?.t_respuesta).toEqual(expect.any(Number));
    expect(completo?.t_entregado).toEqual(expect.any(Number));
    expect(completo?.ms_webhook).toBe(Number(completo?.t_webhook_ok) - Number(completo?.t_recibido));
    expect(completo?.ms_respuesta).toBe(Number(completo?.t_respuesta) - Number(completo?.t_webhook_ok));
    expect(completo?.ms_entrega).toBe(Number(completo?.t_entregado) - Number(completo?.t_respuesta));
    expect(completo?.ms_total).toBe(Number(completo?.t_entregado) - Number(completo?.t_recibido));
    const serializado = JSON.stringify(tiempos);
    expect(serializado).not.toContain('Quiero una marca');
    expect(serializado).not.toContain('Listo por SSE');
    expect(serializado).not.toContain(ip);
    espia.mockRestore();
  });

  it('borra la conversación cuando corre la alarma de 24 h', async () => {
    const creado = await postChat({ message: 'Temporal', turnstileToken: 'ok' }, ipNueva());
    const { conversationId } = (await creado.json()) as { conversationId: string };
    const stub = env.CONVERSATION.get(env.CONVERSATION.idFromName(conversationId));
    await runInDurableObject(stub, async (_instancia, state) => {
      const alarma = await state.storage.getAlarm();
      expect(alarma).not.toBeNull();
      expect((alarma ?? 0) - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await getEventos(conversationId)).status).toBe(404);
    expect(await runDurableObjectAlarm(stub)).toBe(false);
  });
});

describe('csp y formulario sin JavaScript', () => {
  it('acepta un informe y lo limita por IP', async () => {
    const ip = ipNueva();
    for (let i = 0; i < 10; i += 1) {
      const respuesta = await informeCsp(ip, '{"csp-report":{"violated-directive":"script-src"}}');
      expect(respuesta.status).toBe(204);
    }
    expect((await informeCsp(ip, '{}')).status).toBe(429);
  });

  it('devuelve el texto del formulario sin ejecutarlo como HTML', async () => {
    const ctx = createExecutionContext();
    const respuesta = await worker.fetch(
      new IncomingRequest('https://avra360.example/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': ipNueva() },
        body: 'mensaje=' + encodeURIComponent('Hola <script>alert(1)</script>'),
      }),
      { ...env, CHAT_ACTIVO: '0' },
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(respuesta.status).toBe(200);
    const html = await respuesta.text();
    expect(html).toContain('El chat con AVRA está en configuración. Muy pronto podrás conversar aquí.');
    expect(html).toContain('Hola &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('activos y encabezados', () => {
  it('no guarda una semana un 404 de la marca', async () => {
    const respuesta = await pedir('https://avra360.example/brand/no-existe.svg');
    expect(respuesta.status).toBe(404);
    expect(respuesta.headers.get('cache-control') ?? '').not.toContain('max-age=604800');
  });

  it('guarda la marca y el favicon una semana', async () => {
    for (const ruta of ['/brand/avra360-favicon.svg', '/favicon.ico']) {
      const respuesta = await pedir(`https://avra360.example${ruta}`);
      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get('cache-control')).toBe('public, max-age=604800');
    }
  });

  it('sirve robots y encabezados de vista previa', async () => {
    const respuesta = await pedir('https://avra360.example/robots.txt');
    expect(await respuesta.text()).toContain('Disallow: /');
    exigirSeguridad(respuesta);
  });

  it('estampa la seguridad en el 404', async () => {
    const respuesta = await pedir('https://avra360.example/no-existe');
    expect(respuesta.status).toBe(404);
    exigirSeguridad(respuesta);
  });

  it('estampa la seguridad en el 301', async () => {
    const respuesta = await pedir('https://avra360.example/aviso-de-privacidad/');
    expect(respuesta.status).toBe(301);
    exigirSeguridad(respuesta);
  });

  it('no publica la nota de configuración cuando el chat está listo', async () => {
    const respuesta = await pedir('https://avra360.example/');
    const html = await respuesta.text();
    expect(html).toContain('data-chat-activo="1"');
    expect(html).toContain('data-turnstile-site-key="site-key-de-prueba"');
    expect(html).toContain('id="nota-config" hidden');
    expect(html).not.toContain('secreto-turnstile-de-prueba');
    expect(html).not.toContain('llave-webhook-de-prueba');
  });
});

function ipNueva() {
  octeto += 1;
  return `203.0.113.${octeto}`;
}

async function postChat(cuerpo: unknown, ip: string, entorno: Env = env) {
  const ctx = createExecutionContext();
  const respuesta = await worker.fetch(
    new IncomingRequest('https://avra360.example/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify(cuerpo),
    }),
    entorno,
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
  return pedir(`https://avra360.example/api/chat/${conversationId}/events`);
}

async function getStream(conversationId: string) {
  const ctx = createExecutionContext();
  const respuesta = await worker.fetch(
    new IncomingRequest(`https://avra360.example/api/chat/${conversationId}/stream`),
    env,
    ctx,
  );
  return respuesta;
}

async function leerHastaFin(respuesta: Response): Promise<string> {
  const lector = respuesta.body?.getReader();
  if (!lector) return '';
  const decodificador = new TextDecoder();
  let buf = '';
  const fallo = new Promise<never>((_, rechazar) => {
    setTimeout(() => rechazar(new Error('sse-test')), 5_000);
  });
  try {
    while (!buf.includes('event: fin')) {
      const paso = await Promise.race([lector.read(), fallo]);
      if (paso.done) break;
      buf += decodificador.decode(paso.value, { stream: true });
    }
  } finally {
    await lector.cancel();
  }
  return buf;
}

async function informeCsp(ip: string, cuerpo: string) {
  const ctx = createExecutionContext();
  const respuesta = await worker.fetch(
    new IncomingRequest('https://avra360.example/api/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report', 'cf-connecting-ip': ip },
      body: cuerpo,
    }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return respuesta;
}

async function pedir(url: string) {
  const ctx = createExecutionContext();
  const respuesta = await worker.fetch(new IncomingRequest(url), env, ctx);
  await waitOnExecutionContext(ctx);
  return respuesta;
}

function exigirSeguridad(respuesta: Response) {
  expect(respuesta.headers.get('strict-transport-security')).toContain('max-age=31536000');
  expect(respuesta.headers.get('x-content-type-options')).toBe('nosniff');
  expect(respuesta.headers.get('x-frame-options')).toBe('DENY');
  expect(respuesta.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  const csp = respuesta.headers.get('content-security-policy') ?? '';
  expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain('frame-src https://challenges.cloudflare.com');
  expect(csp).toContain('report-to csp');
  expect(csp).toContain('report-uri /api/csp-report');
  expect(csp).not.toContain('strict-dynamic');
  expect(csp).not.toContain('sha256-');
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
  expect(respuesta.headers.get('reporting-endpoints')).toContain('/api/csp-report');
  expect(respuesta.headers.get('x-robots-tag')).toBe('noindex, nofollow');
}
