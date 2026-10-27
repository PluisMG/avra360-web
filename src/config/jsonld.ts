import { agencia, telefono } from './agencia';
import { jsonLdDescripcion } from './textos';

export function urlCanonica(sitio: URL, pathname: string) {
  const ruta = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return new URL(ruta, sitio).href;
}

/** Misma cadena en todas las páginas, para que el hash de la CSP no cambie. */
export function jsonLdProfesional(origen: string) {
  const base = origen.replace(/\/$/, '');
  const datos = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: agencia.nombre,
    description: jsonLdDescripcion,
    url: `${base}/`,
    image: `${base}/og.png`,
    logo: `${base}/favicon.svg`,
    telephone: telefono.e164,
    address: {
      '@type': 'PostalAddress',
      addressLocality: agencia.ciudad,
      addressRegion: agencia.estado,
      addressCountry: agencia.paisCodigo,
    },
    areaServed: [
      { '@type': 'City', name: agencia.ciudad },
      { '@type': 'AdministrativeArea', name: agencia.estado },
    ],
    founder: {
      '@type': 'Person',
      name: agencia.responsable,
    },
    knowsLanguage: 'es-MX',
    serviceType: 'Marketing para servicios de salud',
  };

  const json = JSON.stringify(datos);
  if (json.includes('<')) {
    throw new Error('El JSON-LD no debe incluir el carácter <.');
  }
  return json;
}
