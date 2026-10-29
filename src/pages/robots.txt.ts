import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const vistaPrevia = process.env.PREVIEW === '1';
  const cuerpo = vistaPrevia
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nAllow: /\nDisallow: /aviso-de-privacidad\n';
  return new Response(cuerpo, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
