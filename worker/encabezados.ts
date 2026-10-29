import { ENCABEZADO_INFORMES, politicaCsp } from '../src/config/csp.ts';

export function conSeguridad(respuesta: Response, env: Env): Response {
  const headers = new Headers(respuesta.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('strict-transport-security', 'max-age=31536000');
  headers.set('content-security-policy', politicaCsp());
  headers.set('reporting-endpoints', ENCABEZADO_INFORMES);
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
