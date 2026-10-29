import { chatListo, textoEnv } from './entorno.ts';
import { conSeguridad, robots } from './encabezados.ts';
import { enrutar } from './enrutador.ts';
import { json } from './json.ts';

export { Conversation } from './conversation.ts';
export { RateLimiter } from './limitador.ts';

const SITE_KEY = /^[0-9A-Za-z_-]{8,200}$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      const destino = canonica(url.pathname);
      if (destino) {
        const redirige = new URL(request.url);
        redirige.pathname = destino;
        return conSeguridad(Response.redirect(redirige.toString(), 301), env);
      }
      if (url.pathname === '/robots.txt') return conSeguridad(robots(env), env);
      const api = await enrutar(request, env);
      if (api) return conSeguridad(api, env);
      if (url.pathname.startsWith('/api/')) return conSeguridad(json({ status: 'no-encontrado' }, 404), env);
      const asset = await env.ASSETS.fetch(request);
      const html = await prepararHtml(asset, env);
      return cacheEstatico(conSeguridad(html, env), url.pathname);
    } catch (error) {
      console.log(JSON.stringify({ evento: 'error', nombre: error instanceof Error ? error.name : 'Error' }));
      return conSeguridad(json({ status: 'error' }, 500), env);
    }
  },
} satisfies ExportedHandler<Env>;

async function prepararHtml(respuesta: Response, env: Env): Promise<Response> {
  const tipo = respuesta.headers.get('content-type') ?? '';
  if (!respuesta.ok || !tipo.includes('text/html') || !chatListo(env)) return respuesta;
  const siteKey = textoEnv(env, 'PUBLIC_TURNSTILE_SITE_KEY');
  if (!SITE_KEY.test(siteKey)) return respuesta;
  const html = await respuesta.text();
  if (!html.includes('data-chat-activo="0"')) return texto(respuesta, html);
  const salida = html
    .replace('data-chat-activo="0"', 'data-chat-activo="1"')
    .replace('data-turnstile-site-key=""', `data-turnstile-site-key="${siteKey}"`)
    .replace('id="nota-config"', 'id="nota-config" hidden');
  return texto(respuesta, salida);
}

function cacheEstatico(respuesta: Response, pathname: string): Response {
  const marcaOFavicon = pathname.startsWith('/brand/') || pathname === '/favicon.ico' || pathname === '/favicon.svg';
  if (!marcaOFavicon) return respuesta;
  const headers = new Headers(respuesta.headers);
  headers.set('cache-control', 'public, max-age=604800');
  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers,
  });
}

function canonica(pathname: string): string | null {
  if (pathname === '/index.html') return '/';
  if (pathname.endsWith('/index.html')) {
    const base = pathname.slice(0, -'/index.html'.length);
    return base || '/';
  }
  if (pathname.length > 1 && pathname.endsWith('/') && !pathname.startsWith('/api/')) {
    return pathname.replace(/\/+$/, '') || '/';
  }
  return null;
}

function texto(respuesta: Response, html: string): Response {
  const headers = new Headers(respuesta.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(html, { status: respuesta.status, statusText: respuesta.statusText, headers });
}
