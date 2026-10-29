import {
  boletinActivo,
  consentimientoBoletin,
  correoConfirmacion,
  mensajeBoletinApagado,
  remitenteVisible,
  rutasBoletin,
  urlAvisoPublicado,
} from '../src/config/suscripcion.ts';
import type { EntornoBoletin } from './entorno.ts';

const CORREO =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const ORIGEN = /^\/[A-Za-z0-9/_-]{0,120}$/;
const CAMPO_TRAMPA = 'empresa_web';
const CONFIRMACION_SEGUNDOS = 48 * 60 * 60;
const BAJA_SEGUNDOS = 400 * 24 * 60 * 60;
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 5;

const texto = new TextEncoder();

export type UsoToken = 'confirmar' | 'baja';

export type CargaToken = {
  v: 1;
  uso: UsoToken;
  email: string;
  exp: number;
  iat: number;
  solicitado: string;
  version: string;
  ip: string;
  origen: string;
  nombre: string;
};

export type Dependencias = {
  fetch: typeof fetch;
  ahora: () => number;
  limites: Map<string, number[]>;
};

const limitesGlobales = new Map<string, number[]>();

export function boletinConfigurado(env: EntornoBoletin) {
  const remitente = env.BOLETIN_FROM;
  const firma = env.BOLETIN_SIGNING_SECRET;
  return (
    boletinActivo(env.BOLETIN_ACTIVO) &&
    lleno(env.RESEND_API_KEY) &&
    lleno(env.RESEND_AUDIENCE_ID) &&
    lleno(remitente) &&
    remitente.includes('@') &&
    lleno(firma) &&
    firma.length >= 16
  );
}

function lleno(valor: string | undefined): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

export function correoValido(valor: unknown) {
  if (typeof valor !== 'string') return null;
  const correo = valor.trim().toLowerCase();
  if (correo.length < 6 || correo.length > 120 || !CORREO.test(correo)) return null;
  return correo;
}

export function limitarSolicitud(ip: string, ahora: number, limites: Map<string, number[]>) {
  const previas = (limites.get(ip) ?? []).filter((marca) => ahora - marca < VENTANA_MS);
  if (previas.length >= MAX_POR_VENTANA) {
    limites.set(ip, previas);
    return false;
  }
  previas.push(ahora);
  limites.set(ip, previas);
  return true;
}

async function clave(secret: string) {
  return crypto.subtle.importKey('raw', texto.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

function aBase64Url(bytes: Uint8Array) {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function deBase64Url(valor: string) {
  const relleno = valor.length % 4 === 0 ? '' : '='.repeat(4 - (valor.length % 4));
  const binario = atob(valor.replaceAll('-', '+').replaceAll('_', '/') + relleno);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export async function firmarToken(carga: CargaToken, secret: string) {
  const payload = aBase64Url(texto.encode(JSON.stringify(carga)));
  const firma = new Uint8Array(await crypto.subtle.sign('HMAC', await clave(secret), texto.encode(payload)));
  return `${payload}.${aBase64Url(firma)}`;
}

export async function leerToken(token: string, secret: string, ahora: number, uso: UsoToken) {
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  let firma: Uint8Array;
  try {
    firma = deBase64Url(partes[1]);
  } catch {
    return null;
  }
  const valida = await crypto.subtle.verify(
    'HMAC',
    await clave(secret),
    firma.slice(),
    texto.encode(partes[0]),
  );
  if (!valida) return null;
  let carga: CargaToken;
  try {
    carga = JSON.parse(new TextDecoder().decode(deBase64Url(partes[0]))) as CargaToken;
  } catch {
    return null;
  }
  if (carga.v !== 1 || carga.uso !== uso || typeof carga.exp !== 'number') return null;
  if (carga.exp < Math.floor(ahora / 1000)) return { vencido: true as const };
  if (!correoValido(carga.email)) return null;
  return { vencido: false as const, carga };
}

export async function hashIp(ip: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', texto.encode(ip || 'desconocida')));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function ipDe(request: Request) {
  const directa = request.headers.get('cf-connecting-ip')?.trim();
  if (directa) return directa;
  const reenviada = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return reenviada || '';
}

function origenDe(valor: unknown) {
  if (typeof valor !== 'string') return '/boletin';
  const ruta = valor.trim();
  return ORIGEN.test(ruta) ? ruta : '/boletin';
}

async function leerCampos(request: Request) {
  const tipo = request.headers.get('content-type') ?? '';
  if (tipo.includes('application/json')) {
    const datos = (await request.json()) as Record<string, unknown>;
    return datos;
  }
  const formulario = await request.formData();
  const salida: Record<string, string> = {};
  for (const [clave, valor] of formulario.entries()) {
    if (typeof valor === 'string') salida[clave] = valor;
  }
  return salida;
}

function html(estado: number, titulo: string, parrafo: string) {
  const cuerpo = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>${titulo}</title></head><body><h1>${titulo}</h1><p>${parrafo}</p></body></html>`;
  return new Response(cuerpo, {
    status: estado,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function redirigir(ruta: string) {
  return new Response(null, {
    status: 303,
    headers: { location: ruta, 'cache-control': 'no-store' },
  });
}

function responder(request: Request, estado: number, titulo: string, parrafo: string, json: Record<string, unknown>) {
  const tipo = request.headers.get('content-type') ?? '';
  const acepta = request.headers.get('accept') ?? '';
  if (tipo.includes('application/json') || acepta.includes('application/json')) {
    return new Response(JSON.stringify(json), {
      status: estado,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  return html(estado, titulo, parrafo);
}

function propiedades(carga: CargaToken, confirmado: string | null) {
  return {
    consentimiento_solicitado: carga.solicitado,
    consentimiento_confirmado: confirmado,
    consentimiento_version: carga.version,
    consentimiento_texto: consentimientoBoletin.texto,
    ip_hash: carga.ip,
    origen: carga.origen,
  };
}

async function guardarContacto(
  deps: Dependencias,
  env: EntornoBoletin,
  email: string,
  nombre: string,
  unsubscribed: boolean,
  props: Record<string, string | null>,
) {
  const cuerpo: Record<string, unknown> = {
    email,
    unsubscribed,
    properties: props,
    segments: [{ id: env.RESEND_AUDIENCE_ID }],
  };
  if (nombre) cuerpo.first_name = nombre;
  const encabezados = {
    authorization: `Bearer ${env.RESEND_API_KEY}`,
    'content-type': 'application/json',
  };
  const creado = await deps.fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: encabezados,
    body: JSON.stringify(cuerpo),
  });
  if (creado.ok) return true;
  if (creado.status !== 409 && creado.status !== 422) return false;
  const actualizado = await deps.fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: encabezados,
    body: JSON.stringify(cuerpo),
  });
  return actualizado.ok;
}

async function enviarConfirmacion(
  deps: Dependencias,
  env: EntornoBoletin,
  email: string,
  nombre: string,
  confirmar: string,
  baja: string,
  origen: string,
) {
  const aviso = urlAvisoPublicado(env.BOLETIN_AVISO_URL, origen);
  const correo = correoConfirmacion({ nombre, enlace: confirmar, baja, aviso });
  const respuesta = await deps.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: remitenteVisible(env.BOLETIN_FROM ?? ''),
      to: [email],
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    }),
  });
  return respuesta.ok;
}

function noDisponible(request: Request) {
  return responder(request, 503, 'Suscripción no disponible', mensajeBoletinApagado, {
    ok: false,
    error: 'no_disponible',
  });
}

function resultado(request: Request, estado: number, ruta: string, json: Record<string, unknown>) {
  const tipo = request.headers.get('content-type') ?? '';
  const acepta = request.headers.get('accept') ?? '';
  if (tipo.includes('application/json') || acepta.includes('application/json')) {
    return new Response(JSON.stringify(json), {
      status: estado,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (estado >= 400 && ruta === rutasBoletin.enlaceNoValido) return redirigir(ruta);
  if (estado >= 400) {
    return html(estado, 'Suscripción no disponible', mensajeBoletinApagado);
  }
  return redirigir(ruta);
}

export async function manejarBoletin(request: Request, env: EntornoBoletin, parciales: Partial<Dependencias> = {}) {
  const deps: Dependencias = {
    fetch: parciales.fetch ?? fetch,
    ahora: parciales.ahora ?? Date.now,
    limites: parciales.limites ?? limitesGlobales,
  };
  const url = new URL(request.url);
  const ruta = url.pathname.replace(/\/$/, '');

  if (ruta === '/api/boletin/suscribir') {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    if (!boletinConfigurado(env)) return noDisponible(request);
    let campos: Record<string, unknown>;
    try {
      campos = await leerCampos(request);
    } catch {
      return responder(request, 400, 'No se pudo leer el formulario', 'Revise los datos e intente de nuevo.', {
        ok: false,
        error: 'correo',
      });
    }
    const trampa = typeof campos[CAMPO_TRAMPA] === 'string' ? campos[CAMPO_TRAMPA].trim() : '';
    if (trampa) {
      return resultado(request, 200, rutasBoletin.enviado, { ok: true });
    }
    const ip = ipDe(request);
    if (!limitarSolicitud(ip || 'desconocida', deps.ahora(), deps.limites)) {
      return responder(request, 429, 'Demasiadas solicitudes', 'Espere unos minutos e intente de nuevo.', {
        ok: false,
        error: 'limite',
      });
    }
    const email = correoValido(campos.correo ?? campos.email);
    if (!email) {
      return responder(request, 400, 'Correo no válido', 'Escriba un correo electrónico válido.', {
        ok: false,
        error: 'correo',
      });
    }
    if (campos.consentimiento !== consentimientoBoletin.version) {
      return responder(request, 400, 'Falta el consentimiento', 'Marque la casilla para continuar.', {
        ok: false,
        error: 'consentimiento',
      });
    }
    const nombre = typeof campos.nombre === 'string' ? campos.nombre.trim().slice(0, 80) : '';
    const ahora = deps.ahora();
    const solicitado = new Date(ahora).toISOString();
    const base: Omit<CargaToken, 'uso' | 'exp'> = {
      v: 1,
      email,
      iat: Math.floor(ahora / 1000),
      solicitado,
      version: consentimientoBoletin.version,
      ip: await hashIp(ip),
      origen: origenDe(campos.origen),
      nombre,
    };
    const secret = env.BOLETIN_SIGNING_SECRET ?? '';
    const confirmarToken = await firmarToken(
      { ...base, uso: 'confirmar', exp: base.iat + CONFIRMACION_SEGUNDOS },
      secret,
    );
    const bajaToken = await firmarToken({ ...base, uso: 'baja', exp: base.iat + BAJA_SEGUNDOS }, secret);
    const confirmar = new URL(`/api/boletin/confirmar?token=${encodeURIComponent(confirmarToken)}`, url.origin).href;
    const baja = new URL(`/api/boletin/baja?token=${encodeURIComponent(bajaToken)}`, url.origin).href;
    const enviado = await enviarConfirmacion(deps, env, email, nombre, confirmar, baja, url.origin);
    if (!enviado) {
      return responder(request, 502, 'No se pudo enviar la confirmación', 'Intente de nuevo más tarde.', {
        ok: false,
        error: 'envio',
      });
    }
    console.log(JSON.stringify({ evento: 'boletin_confirmacion_enviada' }));
    return resultado(request, 200, rutasBoletin.enviado, {
      ok: true,
      estado: 'confirmacion_enviada',
    });
  }

  if (ruta === '/api/boletin/confirmar' || ruta === '/api/boletin/baja') {
    if (ruta === '/api/boletin/confirmar' && request.method !== 'GET') return new Response(null, { status: 405 });
    if (ruta === '/api/boletin/baja' && request.method !== 'GET' && request.method !== 'POST') {
      return new Response(null, { status: 405 });
    }
    if (!boletinConfigurado(env)) return noDisponible(request);
    const token = url.searchParams.get('token') ?? '';
    const uso: UsoToken = ruta.endsWith('/baja') ? 'baja' : 'confirmar';
    const leido = await leerToken(token, env.BOLETIN_SIGNING_SECRET ?? '', deps.ahora(), uso);
    if (!leido) {
      return resultado(request, 400, rutasBoletin.enlaceNoValido, { ok: false, error: 'token' });
    }
    if (leido.vencido) {
      return resultado(request, 400, rutasBoletin.enlaceNoValido, { ok: false, error: 'expirado' });
    }
    const confirmado = uso === 'confirmar' ? new Date(deps.ahora()).toISOString() : null;
    const guardado = await guardarContacto(
      deps,
      env,
      leido.carga.email,
      leido.carga.nombre,
      uso === 'baja',
      propiedades(leido.carga, confirmado),
    );
    if (!guardado) {
      return responder(request, 502, 'No se pudo guardar', 'Intente de nuevo más tarde.', { ok: false, error: 'contacto' });
    }
    console.log(JSON.stringify({ evento: uso === 'baja' ? 'boletin_baja' : 'boletin_confirmado' }));
    if (uso === 'baja') {
      return resultado(request, 200, rutasBoletin.baja, { ok: true, estado: 'baja' });
    }
    return resultado(request, 200, rutasBoletin.confirmada, { ok: true, estado: 'confirmado' });
  }

  return new Response(null, { status: 404 });
}
