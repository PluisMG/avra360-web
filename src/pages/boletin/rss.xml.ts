import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { agencia } from '../../config/agencia';
import { incluirEdicion, ordenarEdiciones } from '../../config/boletin';
import { fechaRss } from '../../config/fechas';

export const GET: APIRoute = async (context) => {
  const ediciones = ordenarEdiciones(await getCollection('boletin', incluirEdicion));
  return rss({
    title: `Boletín ${agencia.nombre}`,
    description: `Notas para clínicas y profesionales de la salud en ${agencia.ciudad}, ${agencia.estado}. Se publica una vez al mes.`,
    site: context.site ?? 'https://mktcreativa.example',
    trailingSlash: false,
    customData: '<language>es-mx</language>',
    items: ediciones.map((edicion) => ({
      title: edicion.data.titulo,
      pubDate: fechaRss(edicion.data.fecha),
      description: edicion.data.descripcion,
      link: `/boletin/${edicion.id}`,
      categories: [edicion.data.tema],
    })),
  });
};
