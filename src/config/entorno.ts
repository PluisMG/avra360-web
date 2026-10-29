import { BOLETIN_ACTIVO, PREVIEW, PUBLIC_GA4_ID, PUBLIC_META_PIXEL_ID, PUBLIC_MOSTRAR_EDICION_EJEMPLO } from 'astro:env/server';
import { boletinActivo } from './suscripcion.ts';

function limpio(valor: string | undefined) {
  const texto = valor?.trim() ?? '';
  return texto.length > 0 ? texto : undefined;
}

/** PREVIEW=1 (o true) marca el build como vista previa: noindex y robots cerrado. */
export const vistaPrevia = PREVIEW === '1' || PREVIEW === 'true';

/**
 * La edición marcada como ejemplo se oculta en el build de producción
 * salvo que PUBLIC_MOSTRAR_EDICION_EJEMPLO sea 1.
 * En `astro dev`, si la variable no está definida, sí se muestra.
 */
export function mostrarEdicionEjemplo() {
  const flag = limpio(PUBLIC_MOSTRAR_EDICION_EJEMPLO);
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return import.meta.env.DEV;
}

export function idGa4() {
  const id = limpio(PUBLIC_GA4_ID);
  if (!id) return undefined;
  return /^G-[A-Za-z0-9]+$/.test(id) ? id : undefined;
}

export function idPixelMeta() {
  const id = limpio(PUBLIC_META_PIXEL_ID);
  if (!id) return undefined;
  return /^\d{5,20}$/.test(id) ? id : undefined;
}

/**
 * El formulario solo se muestra activo si el build trae BOLETIN_ACTIVO=1.
 * El Worker igual responde 503 si falta ese valor o cualquiera de los secrets.
 */
export function formularioBoletin() {
  return { listo: boletinActivo(BOLETIN_ACTIVO) };
}
