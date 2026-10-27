/**
 * Catálogo de la arquitectura aprobada.
 * Una página de este catálogo entra al build solo si existe
 * src/content/paginas/<slug>.md. Sin archivo no hay ruta, menú, sitemap ni enlace.
 */

export type TipoPagina = 'servicio' | 'guia' | 'nosotros';

export type EntradaServicio = {
  slug: string;
  tipo: 'servicio';
  menu: string;
  nombreSchema: string;
  serviceType: string;
  orden: number;
};

export const catalogoServicios: readonly EntradaServicio[] = [
  {
    slug: 'paginas-web-para-medicos',
    tipo: 'servicio',
    menu: 'Páginas web',
    nombreSchema: 'Páginas web para médicos y consultorios',
    serviceType: 'Diseño web',
    orden: 1,
  },
  {
    slug: 'seo-local-google-maps',
    tipo: 'servicio',
    menu: 'SEO local',
    nombreSchema: 'SEO local y Google Maps para consultorios',
    serviceType: 'SEO local',
    orden: 2,
  },
  {
    slug: 'publicidad-medica-cofepris',
    tipo: 'servicio',
    menu: 'Publicidad COFEPRIS',
    nombreSchema: 'Revisión de publicidad médica con criterio COFEPRIS',
    serviceType: 'Revisión editorial de publicidad de servicios de salud',
    orden: 3,
  },
  {
    slug: 'marketing-para-psicologos',
    tipo: 'servicio',
    menu: 'Salud mental',
    nombreSchema: 'Marketing para psicólogos y clínicas de salud mental',
    serviceType: 'Marketing en salud mental',
    orden: 4,
  },
  {
    slug: 'diagnostico-digital',
    tipo: 'servicio',
    menu: 'Diagnóstico',
    nombreSchema: 'Diagnóstico digital y de cumplimiento para consultorios',
    serviceType: 'Auditoría de marketing',
    orden: 5,
  },
];

export const catalogoGuias = [
  { slug: 'cofepris', tipo: 'guia' as const, menu: 'Guías COFEPRIS' },
  { slug: 'aviso-o-permiso-de-publicidad-cofepris', tipo: 'guia' as const },
  { slug: 'publicidad-en-redes-sociales-cofepris', tipo: 'guia' as const },
  { slug: 'checklist-publicidad-cofepris', tipo: 'guia' as const },
] as const;

export const catalogoNosotros = {
  slug: 'nosotros',
  tipo: 'nosotros' as const,
  menu: 'Nosotros',
};

export type EntradaCatalogo = { slug: string; tipo: TipoPagina };

export function entradaDeSlug(slug: string): EntradaCatalogo | undefined {
  return (
    catalogoServicios.find((entrada) => entrada.slug === slug) ??
    catalogoGuias.find((entrada) => entrada.slug === slug) ??
    (catalogoNosotros.slug === slug ? catalogoNosotros : undefined)
  );
}

export function servicioDeSlug(slug: string) {
  return catalogoServicios.find((entrada) => entrada.slug === slug);
}

export function exigirPaginasConocidas(paginas: { id: string; data: { slug: string; tipo: string }; body?: string }[]) {
  for (const pagina of paginas) {
    const entrada = entradaDeSlug(pagina.data.slug);
    if (!entrada) {
      throw new Error(
        `src/content/paginas/${pagina.id}.md usa el slug «${pagina.data.slug}», que no está en el catálogo aprobado.`,
      );
    }
    if (entrada.tipo !== pagina.data.tipo) {
      throw new Error(
        `src/content/paginas/${pagina.id}.md declara tipo «${pagina.data.tipo}» y el catálogo espera «${entrada.tipo}».`,
      );
    }
    if (pagina.id !== pagina.data.slug) {
      throw new Error(`El archivo src/content/paginas/${pagina.id}.md debe llamarse ${pagina.data.slug}.md.`);
    }
    if (!pagina.body?.trim()) {
      throw new Error(`src/content/paginas/${pagina.id}.md no tiene cuerpo. Sin texto, la página no se construye.`);
    }
  }
}

export type ClaveTarjeta = 'estrategia' | 'sitio-web' | 'seo-local' | 'contenido-cofepris';

const slugPorTarjeta: Record<Exclude<ClaveTarjeta, 'estrategia'>, string> = {
  'sitio-web': 'paginas-web-para-medicos',
  'seo-local': 'seo-local-google-maps',
  'contenido-cofepris': 'publicidad-medica-cofepris',
};

/** Si el archivo del servicio no existe, el enlace no apunta a esa URL. */
export function hrefTarjetaInicio(clave: ClaveTarjeta, publicados: ReadonlySet<string>) {
  if (clave === 'estrategia') return '/servicios#estrategia';
  const slug = slugPorTarjeta[clave];
  return publicados.has(slug) ? `/servicios/${slug}` : '/servicios';
}
