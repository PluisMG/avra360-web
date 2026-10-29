import { manejarBoletin } from './boletin.ts';
import type { EntornoBoletin } from './entorno.ts';

const rutas = new Set(['/api/boletin/suscribir', '/api/boletin/confirmar', '/api/boletin/baja']);

export default {
  async fetch(request: Request, env: EntornoBoletin): Promise<Response> {
    const ruta = new URL(request.url).pathname.replace(/\/$/, '') || '/';
    if (rutas.has(ruta)) return manejarBoletin(request, env);
    if (!env.ASSETS) return new Response(null, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
