/**
 * Política CSP que el build escribe en dist/_headers.
 * El formulario del boletín hace POST a este mismo sitio, así que form-action es 'self'.
 */

export type ReporteCsp =
  | { lista: true; url: string }
  | { lista: false; motivo: 'sin-configuracion' | 'url-invalida' };

/** Nombre del grupo en report-to y en Reporting-Endpoints. */
export const grupoReporteCsp = 'csp-endpoint';

export function clasificarReporteCsp(valor: string | undefined): ReporteCsp {
  const texto = valor?.trim() ?? '';
  if (!texto) return { lista: false, motivo: 'sin-configuracion' };

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { lista: false, motivo: 'url-invalida' };
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    return { lista: false, motivo: 'url-invalida' };
  }
  if (url.origin === 'null' || /[\s;"'\\]/.test(url.toString())) {
    return { lista: false, motivo: 'url-invalida' };
  }

  return { lista: true, url: url.toString() };
}

export function politicaCsp(opciones: {
  hashes: readonly string[];
  reporte?: string;
}) {
  const hashes = [...new Set(opciones.hashes)].sort();
  const scriptSrc = [
    "'self'",
    "'strict-dynamic'",
    ...hashes.map((hash) => `'sha256-${hash}'`),
    'https://www.googletagmanager.com',
    'https://connect.facebook.net',
  ].join(' ');

  const directivas = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self'",
    "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
  ];

  if (opciones.reporte !== undefined) {
    const reporte = clasificarReporteCsp(opciones.reporte);
    if (!reporte.lista) {
      throw new Error('CSP_REPORT_URL debe ser una URL https absoluta, sin usuario ni contraseña.');
    }
    directivas.push(`report-uri ${reporte.url}`);
    directivas.push(`report-to ${grupoReporteCsp}`);
  }

  return directivas.join('; ');
}

export function encabezadoReportingEndpoints(url: string) {
  const reporte = clasificarReporteCsp(url);
  if (!reporte.lista) {
    throw new Error('CSP_REPORT_URL debe ser una URL https absoluta, sin usuario ni contraseña.');
  }
  return `${grupoReporteCsp}="${reporte.url}"`;
}

export function directiva(csp: string, nombre: string) {
  const encontrada = csp.split('; ').find((parte) => parte.startsWith(`${nombre} `));
  return encontrada?.slice(nombre.length + 1);
}
