/**
 * Marca en un solo lugar. El encabezado usa `logo.ruta`.
 * El logo completo vive en `logoCompleto` y no se muestra en la página.
 */
export const marca = {
  logo: {
    ruta: '/brand/avra360-logo-header.svg',
    alt: 'AVRA 360',
    ancho: 124,
    alto: 40,
    altoMovil: 32,
  },
  logoCompleto: '/brand/avra360-logo.svg',
  favicon: {
    svg: '/brand/avra360-favicon.svg',
    png: '/brand/avra360-favicon-32.png',
    ico: '/favicon.ico',
    apple: '/brand/avra360-favicon-180.png',
  },
  og: '/og.png',
} as const;
