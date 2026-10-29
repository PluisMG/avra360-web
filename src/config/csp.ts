export function politicaCsp(hashBase64: string): string {
  return [
    "default-src 'none'",
    `script-src 'self' 'strict-dynamic' 'sha256-${hashBase64}' https://challenges.cloudflare.com`,
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://challenges.cloudflare.com",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}
