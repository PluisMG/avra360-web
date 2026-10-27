import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { agencia } from '../../config/agencia';
import { incluirEdicion, ordenarEdiciones } from '../../config/boletin';
import { htmlDeEdicion, slugDeEdicion } from '../../config/edicion';
import { fechaRss } from '../../config/fechas';

export const GET: APIRoute = async (context) => {
  const sitio = context.site ?? new URL('https://mktcreativa.example');
  const self = new URL('/boletin/rss.xml', sitio).href;
  const ediciones = ordenarEdiciones(await getCollection('boletin', incluirEdicion));
  return rss({
    title: `Boletín ${agencia.nombre}`,
    description: `Notas para clínicas y profesionales de la salud en ${agencia.ciudad}, ${agencia.estado}. Se publica una vez al mes.`,
    site: sitio,
    trailingSlash: false,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
      dc: 'http://purl.org/dc/elements/1.1/',
    },
    customData: `<language>es-mx</language><atom:link href="${self}" rel="self" type="application/rss+xml"/>`,
    items: ediciones.map((edicion) => ({
      title: edicion.data.titulo,
      pubDate: fechaRss(edicion.data.fecha),
      description: edicion.data.descripcion,
      link: `/boletin/${slugDeEdicion(edicion)}`,
      categories: [edicion.data.tema],
      content: htmlDeEdicion(edicion),
      customData: `<dc:creator>${agencia.responsable}</dc:creator>`,
    })),
  });
};
