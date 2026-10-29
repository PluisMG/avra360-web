import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consentimientoBoletin } from '../src/config/suscripcion.ts';
import { firmarToken, manejarBoletin, type CargaToken } from './boletin.ts';
import type { EntornoBoletin } from './entorno.ts';

const SECRET = 'secreto-de-prueba-boletin-32';
const AHORA = Date.parse('2026-10-29T18:00:00.000Z');

function entorno(parcial: Partial<EntornoBoletin> = {}): EntornoBoletin {
  return {
    BOLETIN_ACTIVO: '1',
    RESEND_API_KEY: 're_prueba',
    RESEND_AUDIENCE_ID: 'aud_prueba',
    BOLETIN_FROM: 'Boletín <boletin@example.com>',
    BOLETIN_SIGNING_SECRET: SECRET,
    ...parcial,
  };
}

function solicitud(ruta: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', '203.0.113.8');
  return new Request(`https://agencia-prueba.mx${ruta}`, { ...init, headers });
}

function json(cuerpo: unknown) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.8' },
    body: JSON.stringify(cuerpo),
  };
}

function deps(fetchImpl: typeof fetch) {
  return { fetch: fetchImpl, ahora: () => AHORA, limites: new Map<string, number[]>() };
}

function captura() {
  const llamadas: { url: string; method: string; body: Record<string, unknown> }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    llamadas.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
    });
    if (url.endsWith('/emails')) return new Response('{"id":"email_1"}', { status: 200 });
    if (url.includes('/contacts') && init?.method === 'POST') return new Response('{"id":"contact_1"}', { status: 200 });
    if (url.includes('/contacts') && init?.method === 'PATCH') return new Response('{"id":"contact_1"}', { status: 200 });
    return new Response('no', { status: 500 });
  };
  return { llamadas, fetchImpl };
}

const alta = {
  correo: 'persona@clinica.mx',
  nombre: 'Ana',
  consentimiento: consentimientoBoletin.version,
  origen: '/boletin',
};

describe('suscripción del boletín', () => {
  it('responde 200 y no llama a Resend si el honeypot viene lleno', async () => {
    const red = captura();
    const respuesta = await manejarBoletin(
      solicitud('/api/boletin/suscribir', json({ ...alta, empresa_web: 'http://spam.test' })),
      entorno(),
      deps(red.fetchImpl),
    );
    assert.equal(respuesta.status, 200);
    assert.equal(red.llamadas.length, 0);
  });

  it('rechaza un correo inválido', async () => {
    const red = captura();
    const respuesta = await manejarBoletin(
      solicitud('/api/boletin/suscribir', json({ ...alta, correo: 'no-es-correo' })),
      entorno(),
      deps(red.fetchImpl),
    );
    assert.equal(respuesta.status, 400);
    assert.equal((await respuesta.json()).error, 'correo');
    assert.equal(red.llamadas.length, 0);
  });

  it('responde 503 si falta un secret o el boletín no está activo', async () => {
    const red = captura();
    for (const env of [
      entorno({ BOLETIN_ACTIVO: '0' }),
      entorno({ RESEND_API_KEY: '' }),
      entorno({ RESEND_AUDIENCE_ID: undefined }),
      entorno({ BOLETIN_FROM: '' }),
      entorno({ BOLETIN_SIGNING_SECRET: 'corto' }),
    ]) {
      const respuesta = await manejarBoletin(
        solicitud('/api/boletin/suscribir', json(alta)),
        env,
        deps(red.fetchImpl),
      );
      assert.equal(respuesta.status, 503);
    }
    assert.equal(red.llamadas.length, 0);
  });

  it('envía el correo de confirmación y todavía no crea el contacto', async () => {
    const red = captura();
    const respuesta = await manejarBoletin(
      solicitud('/api/boletin/suscribir', json(alta)),
      entorno(),
      deps(red.fetchImpl),
    );
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json()).estado, 'confirmacion_enviada');
    assert.equal(red.llamadas.length, 1);
    assert.equal(red.llamadas[0].url, 'https://api.resend.com/emails');
    assert.equal(red.llamadas[0].body.subject, 'Confirme su suscripción al boletín de MKT Creativa');
    assert.equal(red.llamadas[0].body.from, 'MKT Creativa <boletin@example.com>');
    const texto = String(red.llamadas[0].body.text);
    const html = String(red.llamadas[0].body.html);
    assert.match(texto, /Hola, Ana:/);
    assert.match(texto, /Este enlace vence en 48 horas\./);
    assert.match(texto, /\/api\/boletin\/confirmar\?token=/);
    assert.match(texto, /\/api\/boletin\/baja\?token=/);
    assert.equal(texto.includes('Consulte nuestro aviso de privacidad.'), false);
    assert.match(html, /Un clic y recibirá el boletín mensual para clínicas y consultorios\./);
    assert.match(html, />Confirmar</);
    assert.equal(red.llamadas.some((llamada) => llamada.url.includes('/contacts')), false);
  });

  it('si no hay nombre saluda con Hola: y solo enlaza privacidad si hay URL publicada', async () => {
    const red = captura();
    const respuesta = await manejarBoletin(
      solicitud('/api/boletin/suscribir', json({ ...alta, nombre: '  ', correo: 'persona@clinica.mx' })),
      entorno({ BOLETIN_AVISO_URL: 'https://agencia-prueba.mx/aviso-de-privacidad' }),
      deps(red.fetchImpl),
    );
    assert.equal(respuesta.status, 200);
    const texto = String(red.llamadas[0].body.text);
    assert.match(texto, /^Un clic y recibirá el boletín mensual para clínicas y consultorios\.\n\nHola:\n/);
    assert.match(texto, /Consulte nuestro aviso de privacidad\.\nhttps:\/\/agencia-prueba\.mx\/aviso-de-privacidad/);
    assert.equal(String(red.llamadas[0].body.html).includes('href="https://agencia-prueba.mx/aviso-de-privacidad"'), true);
  });
});

async function tokenDe(env: EntornoBoletin, uso: 'confirmar' | 'baja', exp: number) {
  const carga: CargaToken = {
    v: 1,
    uso,
    email: 'persona@clinica.mx',
    exp,
    iat: Math.floor(AHORA / 1000),
    solicitado: '2026-10-29T18:00:00.000Z',
    version: consentimientoBoletin.version,
    ip: 'abc123',
    origen: '/boletin',
    nombre: 'Ana',
  };
  return firmarToken(carga, env.BOLETIN_SIGNING_SECRET ?? '');
}

describe('confirmación y baja', () => {
  it('con un token válido crea el contacto suscrito y guarda el consentimiento', async () => {
    const env = entorno();
    const red = captura();
    const token = await tokenDe(env, 'confirmar', Math.floor(AHORA / 1000) + 3600);
    const respuesta = await manejarBoletin(
      solicitud(`/api/boletin/confirmar?token=${encodeURIComponent(token)}`, {
        headers: { accept: 'application/json' },
      }),
      env,
      deps(red.fetchImpl),
    );
    assert.equal(respuesta.status, 200);
    const contacto = red.llamadas.find((llamada) => llamada.url === 'https://api.resend.com/contacts');
    assert.ok(contacto);
    assert.equal(contacto.method, 'POST');
    assert.equal(contacto.body.unsubscribed, false);
    assert.deepEqual(contacto.body.segments, [{ id: 'aud_prueba' }]);
    const props = contacto.body.properties as Record<string, string>;
    assert.equal(props.consentimiento_solicitado, '2026-10-29T18:00:00.000Z');
    assert.equal(props.consentimiento_confirmado, '2026-10-29T18:00:00.000Z');
    assert.equal(props.consentimiento_version, consentimientoBoletin.version);
    assert.equal(props.consentimiento_texto, consentimientoBoletin.texto);
    assert.equal(props.origen, '/boletin');
    assert.equal(typeof props.ip_hash, 'string');
    assert.equal(props.ip_hash.includes('203.0.113.8'), false);
  });

  it('rechaza un token expirado y uno alterado', async () => {
    const env = entorno();
    const red = captura();
    const vencido = await tokenDe(env, 'confirmar', Math.floor(AHORA / 1000) - 10);
    const expirado = await manejarBoletin(
      solicitud(`/api/boletin/confirmar?token=${encodeURIComponent(vencido)}`, {
        headers: { accept: 'application/json' },
      }),
      env,
      deps(red.fetchImpl),
    );
    assert.equal(expirado.status, 400);
    assert.equal((await expirado.json()).error, 'expirado');

    const vigente = await tokenDe(env, 'confirmar', Math.floor(AHORA / 1000) + 3600);
    const alterado = `${vigente.slice(0, -4)}aaaa`;
    const malo = await manejarBoletin(
      solicitud(`/api/boletin/confirmar?token=${encodeURIComponent(alterado)}`, {
        headers: { accept: 'application/json' },
      }),
      env,
      deps(red.fetchImpl),
    );
    assert.equal(malo.status, 400);
    assert.equal((await malo.json()).error, 'token');
    assert.equal(red.llamadas.length, 0);
  });

  it('la baja marca unsubscribed y acepta GET y POST', async () => {
    const env = entorno();
    const token = await tokenDe(env, 'baja', Math.floor(AHORA / 1000) + 3600);
    for (const method of ['GET', 'POST'] as const) {
      const red = captura();
      const respuesta = await manejarBoletin(
        solicitud(`/api/boletin/baja?token=${encodeURIComponent(token)}`, {
          method,
          headers: { accept: 'application/json' },
        }),
        env,
        deps(red.fetchImpl),
      );
      assert.equal(respuesta.status, 200);
      const contacto = red.llamadas.find((llamada) => llamada.url === 'https://api.resend.com/contacts');
      assert.equal(contacto?.body.unsubscribed, true);
    }
  });

  it('si el contacto ya existe, lo actualiza', async () => {
    const env = entorno();
    const token = await tokenDe(env, 'confirmar', Math.floor(AHORA / 1000) + 3600);
    const llamadas: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      llamadas.push(`${init?.method} ${input}`);
      if (init?.method === 'POST') return new Response('{"message":"exists"}', { status: 409 });
      return new Response('{"id":"contact_1"}', { status: 200 });
    };
    const respuesta = await manejarBoletin(
      solicitud(`/api/boletin/confirmar?token=${encodeURIComponent(token)}`, {
        headers: { accept: 'application/json' },
      }),
      env,
      deps(fetchImpl),
    );
    assert.equal(respuesta.status, 200);
    assert.equal(llamadas[1]?.startsWith('PATCH https://api.resend.com/contacts/persona%40clinica.mx'), true);
  });
});
