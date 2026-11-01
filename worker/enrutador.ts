import { intentarArchivar } from './almacenamiento.ts';
import { MAX_MENSAJE, MAX_RESPUESTA, SITIO, VIDA_TOKEN_SEG } from './constantes.ts';
import { chatListo, textoEnv } from './entorno.ts';
import { correrHibrido } from './hibrido.ts';
import { usarHibrido } from './openai.ts';
import { hashIp, ipDe } from './ip.ts';
import { json, leerJson } from './json.ts';
import { firmarToken, verificarToken } from './tokens.ts';
import { verificarTurnstile } from './turnstile.ts';
import { despertarAvra, webhookAceptado, type CuerpoWebhook } from './webhook.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function enrutar(request: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/robots.txt') return null;
  if (!url.pathname.startsWith('/api/')) return null;
  if (request.method === 'POST' && url.pathname === '/api/csp-report') return postInformeCsp(request, env);
  if (request.method === 'POST' && url.pathname === '/api/chat') return postChat(request, env, ctx);
  if (request.method === 'POST' && url.pathname === '/api/chat/reply') return postReply(request, env);
  const eventos = url.pathname.match(/^\/api\/chat\/([0-9a-f-]{36})\/events$/i);
  if (request.method === 'GET' && eventos?.[1]) return getEventos(eventos[1], env);
  const flujo = url.pathname.match(/^\/api\/chat\/([0-9a-f-]{36})\/stream$/i);
  if (request.method === 'GET' && flujo?.[1]) return getStream(flujo[1], url, env);
  if (url.pathname.startsWith('/api/')) return json({ status: 'no-encontrado' }, 404);
  return null;
}

async function postInformeCsp(request: Request, env: Env): Promise<Response> {
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > 8_000) return new Response(null, { status: 413 });
  const hash = await hashIp(`csp:${ipDe(request)}`);
  const limite = await env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(hash)).consumir();
  if (limite !== 'ok') return new Response(null, { status: 429 });
  const cuerpo = new TextDecoder().decode(buffer).slice(0, 2_000);
  console.log(JSON.stringify({ evento: 'csp', bytes: buffer.byteLength, cuerpo }));
  return new Response(null, { status: 204 });
}

async function postChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const tipo = request.headers.get('content-type') ?? '';
  if (!tipo.includes('application/json')) return respuestaFormulario(request, env);
  if (!chatListo(env)) return json({ status: 'configurando' }, 503);
  const lectura = await leerJson(request);
  if (!lectura.ok) return json({ status: lectura.motivo === 'largo' ? 'largo' : 'invalido' }, lectura.motivo === 'largo' ? 413 : 400);
  if (!esCuerpoChat(lectura.valor)) return json({ status: 'invalido' }, 400);
  const message = lectura.valor.message;
  if (message.trim().length === 0 || message.length > MAX_MENSAJE || message.includes('\0')) {
    return json({ status: 'invalido' }, 400);
  }
  let conversationId = lectura.valor.conversationId;
  if (conversationId !== undefined && !UUID.test(conversationId)) return json({ status: 'invalido' }, 400);

  const ip = ipDe(request);
  const turnstileOk = await verificarTurnstile(textoEnv(env, 'TURNSTILE_SECRET_KEY'), lectura.valor.turnstileToken ?? '', ip);
  if (!turnstileOk) return json({ status: 'verificacion' }, 403);

  const hash = await hashIp(ip);
  const limite = await env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(hash)).consumir();
  if (limite !== 'ok') return json({ status: 'limite', ventana: limite }, 429);

  const nueva = !conversationId;
  conversationId ??= crypto.randomUUID();
  const conversacion = env.CONVERSATION.get(env.CONVERSATION.idFromName(conversationId));
  if (!nueva && !(await conversacion.existe())) return json({ status: 'no-encontrado' }, 404);

  const { messageId, history } = await conversacion.agregarUsuario(message);
  await conversacion.anotarTiempo(conversationId, messageId, 't_recibido', Date.now());
  const expira = Math.floor(Date.now() / 1000) + VIDA_TOKEN_SEG;
  const replyToken = await firmarToken(textoEnv(env, 'AVRA_REPLY_SIGNING_SECRET'), {
    v: 1,
    c: conversationId,
    m: messageId,
    e: expira,
  });
  const cuerpo: CuerpoWebhook = {
    conversationId,
    message,
    history,
    replyUrl: `${new URL(request.url).origin}/api/chat/reply`,
    replyToken,
    site: SITIO,
  };
  if (usarHibrido(env)) {
    ctx.waitUntil(
      correrHibrido(env, conversacion, cuerpo, messageId).catch((error: unknown) => {
        console.log(JSON.stringify({ evento: 'error', nombre: error instanceof Error ? error.name : 'Error' }));
      }),
    );
    console.log(JSON.stringify({ evento: 'chat_pendiente', conversationId, messageId }));
    return json({ conversationId, messageId, status: 'pending' });
  }
  console.log(
    JSON.stringify({
      evento: 'fallback',
      conversationId,
      messageId,
      motivo: textoEnv(env, 'CHAT_MODO') === 'hibrido' ? 'sin_clave' : 'modo',
    }),
  );
  const estadoWebhook = await despertarAvra(textoEnv(env, 'AVRA_WEBHOOK_URL'), textoEnv(env, 'AVRA_WEBHOOK_KEY'), cuerpo);
  if (webhookAceptado(estadoWebhook)) await conversacion.anotarTiempo(conversationId, messageId, 't_webhook_ok', Date.now());
  await intentarArchivar(env, { consentimiento: false, conversationId });
  if (!webhookAceptado(estadoWebhook)) {
    await conversacion.publicarTiempo(conversationId, messageId);
    return json({ status: 'error', conversationId, messageId }, 502);
  }
  console.log(JSON.stringify({ evento: 'chat_pendiente', conversationId, messageId }));
  return json({ conversationId, messageId, status: 'pending' });
}

async function postReply(request: Request, env: Env): Promise<Response> {
  if (!chatListo(env)) return json({ status: 'configurando' }, 503);
  const lectura = await leerJson(request, 24_000);
  if (!lectura.ok) return json({ status: lectura.motivo === 'largo' ? 'largo' : 'invalido' }, lectura.motivo === 'largo' ? 413 : 400);
  if (!esCuerpoReply(lectura.valor)) return json({ status: 'invalido' }, 400);
  if (lectura.valor.text.length === 0 || lectura.valor.text.length > MAX_RESPUESTA || lectura.valor.text.includes('\0')) {
    return json({ status: lectura.valor.text.length > MAX_RESPUESTA ? 'largo' : 'invalido' }, lectura.valor.text.length > MAX_RESPUESTA ? 413 : 400);
  }
  const carga = await verificarToken(textoEnv(env, 'AVRA_REPLY_SIGNING_SECRET'), lectura.valor.replyToken);
  if (!carga || !UUID.test(carga.c) || !UUID.test(carga.m)) return json({ status: 'token' }, 401);
  const resultado = await env.CONVERSATION.get(env.CONVERSATION.idFromName(carga.c)).consumirRespuesta(
    carga.m,
    lectura.valor.text,
  );
  if (resultado === 'desconocido') return json({ status: 'no-encontrado' }, 404);
  if (resultado === 'usado') return json({ status: 'usado' }, 409);
  return json({ status: 'ok' });
}

async function getStream(conversationId: string, url: URL, env: Env): Promise<Response> {
  if (!chatListo(env)) return json({ status: 'configurando' }, 503);
  if (!UUID.test(conversationId)) return json({ status: 'invalido' }, 400);
  const conversacion = env.CONVERSATION.get(env.CONVERSATION.idFromName(conversationId));
  if (!(await conversacion.existe())) return json({ status: 'no-encontrado' }, 404);
  const destino = new URL('https://conversation.internal/sse');
  const messageId = url.searchParams.get('messageId') ?? '';
  if (UUID.test(messageId)) destino.searchParams.set('messageId', messageId);
  return conversacion.fetch(new Request(destino));
}

async function getEventos(conversationId: string, env: Env): Promise<Response> {
  if (!chatListo(env)) return json({ status: 'configurando' }, 503);
  if (!UUID.test(conversationId)) return json({ status: 'invalido' }, 400);
  const conversacion = env.CONVERSATION.get(env.CONVERSATION.idFromName(conversationId));
  const estado = await conversacion.leer();
  if (!estado) return json({ status: 'no-encontrado' }, 404);
  await conversacion.marcarEntregas(true);
  const ultimo = estado.messages.at(-1);
  return json({
    conversationId,
    status: ultimo?.role === 'user' ? 'pending' : 'listo',
    messages: estado.messages,
  });
}

async function respuestaFormulario(request: Request, env: Env): Promise<Response> {
  let mensaje = '';
  try {
    const datos = await request.formData();
    const campo = datos.get('mensaje');
    if (typeof campo === 'string') mensaje = campo.slice(0, 2_000);
  } catch {
    mensaje = '';
  }
  const aviso = chatListo(env)
    ? 'Para conversar hace falta JavaScript en este navegador. Tu texto no se envió.'
    : 'El chat con AVRA está en configuración. Muy pronto podrás conversar aquí.';
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex"><title>AVRA 360</title><p>${escapar(aviso)}</p>${mensaje ? `<p>${escapar(mensaje)}</p>` : ''}<p><a href="/">Volver al inicio</a></p>`;
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function escapar(valor: string): string {
  return valor.replace(/[&<>"']/g, (caracter) => {
    const mapa: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return mapa[caracter] ?? caracter;
  });
}

function esCuerpoChat(valor: unknown): valor is { message: string; conversationId?: string; turnstileToken?: string } {
  if (!valor || typeof valor !== 'object') return false;
  const cuerpo = valor as Record<string, unknown>;
  if (typeof cuerpo.message !== 'string') return false;
  if (cuerpo.conversationId !== undefined && typeof cuerpo.conversationId !== 'string') return false;
  if (cuerpo.turnstileToken !== undefined && typeof cuerpo.turnstileToken !== 'string') return false;
  return true;
}

function esCuerpoReply(valor: unknown): valor is { replyToken: string; text: string } {
  if (!valor || typeof valor !== 'object') return false;
  const cuerpo = valor as Record<string, unknown>;
  return typeof cuerpo.replyToken === 'string' && typeof cuerpo.text === 'string';
}
