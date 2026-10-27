import { agencia, telefono } from './agencia.ts';
import { catalogoServicios } from './paginas.ts';

/** Descripción de schema-org.json, sin las propiedades que todavía dependen de Pedro. */
export const descripcionAgencia =
  'Agencia de marketing y publicidad para clínicas, consultorios y profesionales de la salud en Chiapas, con énfasis en salud mental. Trabaja estrategia, sitio web, SEO local y contenido revisado contra el Reglamento de la Ley General de Salud en Materia de Publicidad. No promete resultados.';

const conoce = [
  'Marketing para clínicas y consultorios',
  'Marketing en salud mental',
  'SEO local y Google Maps',
  'Publicidad de servicios de salud en México',
  'Reglamento de la Ley General de Salud en Materia de Publicidad',
];

export function serializar(datos: unknown) {
  const json = JSON.stringify(datos);
  if (json.includes('<') || json.includes('{{')) {
    throw new Error('El JSON-LD no debe incluir < ni marcadores {{.');
  }
  return json;
}

export function urlCanonica(sitio: URL, pathname: string) {
  const ruta = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return new URL(ruta, sitio).href;
}

export function origenLimpio(origen: string) {
  return origen.replace(/\/$/, '');
}

export function areaServida() {
  return [
    {
      '@type': 'City',
      name: 'Tuxtla Gutiérrez',
      sameAs: 'https://es.wikipedia.org/wiki/Tuxtla_Guti%C3%A9rrez',
    },
    {
      '@type': 'City',
      name: 'Tapachula',
      sameAs: 'https://es.wikipedia.org/wiki/Tapachula_de_C%C3%B3rdova_y_Ord%C3%B3%C3%B1ez',
    },
    {
      '@type': 'City',
      name: 'San Cristóbal de las Casas',
      sameAs: 'https://es.wikipedia.org/wiki/San_Crist%C3%B3bal_de_las_Casas',
    },
    { '@type': 'State', name: 'Chiapas' },
  ];
}

export function grafoOrganizacion(origen: string, slugsPublicados: readonly string[]) {
  const base = origenLimpio(origen);
  const agenciaId = `${base}/#agencia`;
  const pedroId = `${base}/#pedro`;
  const publicados = catalogoServicios.filter((servicio) => slugsPublicados.includes(servicio.slug));
  const profesional: Record<string, unknown> = {
    '@type': 'ProfessionalService',
    '@id': agenciaId,
    name: agencia.nombre,
    description: descripcionAgencia,
    url: `${base}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${base}/logo-512.png`,
      width: 512,
      height: 512,
    },
    image: `${base}/og.png`,
    telephone: telefono.e164,
    address: {
      '@type': 'PostalAddress',
      addressLocality: agencia.ciudad,
      addressRegion: agencia.estado,
      addressCountry: agencia.paisCodigo,
    },
    areaServed: areaServida(),
    founder: { '@id': pedroId },
    knowsLanguage: 'es-MX',
    knowsAbout: conoce,
  };

  if (publicados.length > 0) {
    profesional.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Servicios de marketing para clínicas y consultorios',
      itemListElement: publicados.map((servicio) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          '@id': `${base}/servicios/${servicio.slug}#servicio`,
          name: servicio.nombreSchema,
          serviceType: servicio.serviceType,
          url: `${base}/servicios/${servicio.slug}`,
        },
      })),
    };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      profesional,
      {
        '@type': 'Person',
        '@id': pedroId,
        name: agencia.responsable,
        jobTitle: 'Fundador',
        worksFor: { '@id': agenciaId },
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#sitio`,
        url: `${base}/`,
        name: agencia.nombre,
        inLanguage: 'es-MX',
        publisher: { '@id': agenciaId },
      },
    ],
  };
}

export function jsonLdOrganizacion(origen: string, slugsPublicados: readonly string[]) {
  return serializar(grafoOrganizacion(origen, slugsPublicados));
}

function migas(pasos: { name: string; item?: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: pasos.map((paso, indice) => {
      const elemento: Record<string, unknown> = {
        '@type': 'ListItem',
        position: indice + 1,
        name: paso.name,
      };
      if (paso.item) elemento.item = paso.item;
      return elemento;
    }),
  };
}

export function jsonLdServicio(
  origen: string,
  servicio: { slug: string; nombreSchema: string; serviceType: string },
  descripcion: string,
  h1: string,
) {
  const base = origenLimpio(origen);
  const url = `${base}/servicios/${servicio.slug}`;
  return serializar({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${url}#servicio`,
        name: servicio.nombreSchema,
        serviceType: servicio.serviceType,
        url,
        description: descripcion,
        provider: { '@id': `${base}/#agencia` },
        areaServed: areaServida(),
      },
      migas([
        { name: 'Inicio', item: `${base}/` },
        { name: 'Servicios', item: `${base}/servicios` },
        { name: h1 },
      ]),
    ],
  });
}

export function jsonLdMigas(origen: string, slug: string, h1: string, seccion: 'guias' | 'raiz') {
  const base = origenLimpio(origen);
  const url = seccion === 'guias' ? `${base}/guias/${slug}` : `${base}/${slug}`;
  return serializar({
    '@context': 'https://schema.org',
    '@graph': [migas([{ name: 'Inicio', item: `${base}/` }, { name: h1, item: url }])],
  });
}

export type DatosArticulo = {
  slug: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  modificado?: string;
  autor?: string;
  fuentes?: readonly string[];
  palabras?: readonly string[];
};

function instante(fecha: string) {
  return `${fecha}T08:00:00-06:00`;
}

/** Article + BreadcrumbList, con la forma de schema-edicion.json y sin campos vacíos. */
export function jsonLdArticulo(origen: string, datos: DatosArticulo) {
  const base = origenLimpio(origen);
  const url = `${base}/boletin/${datos.slug}`;
  const articulo: Record<string, unknown> = {
    '@type': 'Article',
    '@id': `${url}#articulo`,
    headline: datos.titulo,
    description: datos.descripcion,
    datePublished: instante(datos.fecha),
    dateModified: instante(datos.modificado ?? datos.fecha),
    inLanguage: 'es-MX',
    isPartOf: {
      '@type': 'CreativeWorkSeries',
      '@id': `${base}/boletin#serie`,
      name: 'Boletín MKT Creativa',
    },
    articleSection: 'Boletín',
    image: `${base}/og.png`,
    author: datos.autor ? { '@type': 'Person', name: datos.autor } : { '@id': `${base}/#pedro` },
    publisher: { '@id': `${base}/#agencia` },
    mainEntityOfPage: url,
  };
  if (datos.palabras && datos.palabras.length > 0) articulo.keywords = [...datos.palabras];
  if (datos.fuentes && datos.fuentes.length > 0) articulo.citation = [...datos.fuentes];

  return serializar({
    '@context': 'https://schema.org',
    '@graph': [
      articulo,
      migas([
        { name: 'Inicio', item: `${base}/` },
        { name: 'Boletín', item: `${base}/boletin` },
        { name: datos.titulo },
      ]),
    ],
  });
}
