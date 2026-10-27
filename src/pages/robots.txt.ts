import type { APIRoute } from 'astro';
import { vistaPrevia } from '../config/entorno';

export const GET: APIRoute = ({ site }) => {
  const origen = site?.href.replace(/\/$/, '') ?? 'https://mktcreativa.example';
  const lineas = vistaPrevia
    ? ['User-agent: *', 'Disallow: /', '']
    : ['User-agent: *', 'Allow: /', '', `Sitemap: ${origen}/sitemap.xml`, ''];

  return new Response(lineas.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
