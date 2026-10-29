import { codigoArranque } from '../src/cliente/arranque.ts';
import { politicaCsp } from '../src/config/csp.ts';

let politica: Promise<string> | undefined;

async function csp(): Promise<string> {
  politica ??= (async () => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigoArranque));
    const bytes = new Uint8Array(digest);
    let binario = '';
    for (const byte of bytes) binario += String.fromCharCode(byte);
    return politicaCsp(btoa(binario));
  })();
  return politica;
}

export async function conSeguridad(respuesta: Response, env: Env): Promise<Response> {
  const headers = new Headers(respuesta.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('strict-transport-security', 'max-age=31536000');
  headers.set('content-security-policy', await csp());
  if (env.PREVIEW === '1') headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers,
  });
}

export function robots(env: Env): Response {
  const cuerpo =
    env.PREVIEW === '1'
      ? 'User-agent: *\nDisallow: /\n'
      : 'User-agent: *\nAllow: /\nDisallow: /aviso-de-privacidad\n';
  return new Response(cuerpo, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
