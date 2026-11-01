export function politicaCsp(): string {
  return [
    "default-src 'none'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
    'report-to csp',
    'report-uri /api/csp-report',
  ].join('; ');
}

export const ENCABEZADO_INFORMES = 'csp="/api/csp-report"';
