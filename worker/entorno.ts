/**
 * Secretos que Cloudflare inyecta con `wrangler secret put`.
 * No tienen valor en el repositorio ni en wrangler.jsonc.
 * ASSETS es el binding de los archivos estáticos de dist/.
 */
export interface EntornoBoletin {
  ASSETS?: { fetch(request: Request): Promise<Response> };
  BOLETIN_ACTIVO?: string;
  RESEND_API_KEY?: string;
  RESEND_AUDIENCE_ID?: string;
  BOLETIN_FROM?: string;
  BOLETIN_SIGNING_SECRET?: string;
  /** URL publicada del aviso. Vacía hasta que esa página exista en el build. */
  BOLETIN_AVISO_URL?: string;
}
