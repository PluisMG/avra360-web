/**
 * Marca en un solo lugar. Para cambiar el logo o los favicons, edite este archivo.
 * `tipo: 'texto'` muestra el wordmark. `tipo: 'svg'` usa `ruta`.
 * El logo completo con tagline vive en `logoCompleto` y no se publica como imagen
 * social hasta que exista un PNG de 1200×630. No agregue PNG del logo.
 */
export type TipoLogo = 'texto' | 'svg';

export const marca = {
  logo: {
    tipo: 'svg' as TipoLogo,
    texto: 'AVRA 360',
    ruta: '/brand/avra360-logo-header.svg',
    alt: 'AVRA 360',
    ancho: 124,
    alto: 40,
  },
  logoCompleto: '/brand/avra360-logo.svg',
  favicon: {
    svg: '/brand/avra360-favicon.svg',
    png: '/brand/avra360-favicon-32.png',
    ico: '/favicon.ico',
    apple: '/brand/avra360-favicon-180.png',
  },
} as const;
