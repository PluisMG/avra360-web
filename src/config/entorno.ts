import {
  PREVIEW,
  PUBLIC_GA4_ID,
  PUBLIC_MAILERLITE_CONSENT_FIELD,
  PUBLIC_MAILERLITE_EMAIL_FIELD,
  PUBLIC_MAILERLITE_FORM_ACTION,
  PUBLIC_MAILERLITE_NAME_FIELD,
  PUBLIC_META_PIXEL_ID,
  PUBLIC_MOSTRAR_EDICION_EJEMPLO,
} from 'astro:env/server';
import { clasificarAccionFormulario } from './csp';
import { avisoPublico } from './publicacion';

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

const campoSeguro = /^[A-Za-z0-9_-]+(?:\[[A-Za-z0-9_-]+\])?$/;

function campo(valor: string | undefined, respaldo: string) {
  const texto = limpio(valor) ?? respaldo;
  return campoSeguro.test(texto) ? texto : respaldo;
}

export type FormularioBoletin =
  | {
      listo: true;
      action: string;
      campoCorreo: string;
      campoNombre: string;
      campoConsentimiento?: string;
    }
  | {
      listo: false;
      motivo: 'sin-configuracion' | 'url-invalida' | 'parece-secreto';
    };

/**
 * Solo usa la URL pública de acción del formulario embebido.
 * No existe ninguna variable para la API key de MailerLite: no debe llegar al cliente.
 */
export function formularioBoletin(): FormularioBoletin {
  const accion = clasificarAccionFormulario(PUBLIC_MAILERLITE_FORM_ACTION);
  if (!accion.lista) {
    if (accion.motivo === 'parece-secreto' || accion.motivo === 'url-invalida') {
      return { listo: false, motivo: accion.motivo };
    }
    return { listo: false, motivo: 'sin-configuracion' };
  }
  // El formulario pide aviso de privacidad. Sin datos ni revisión legal no se publica.
  if (!avisoPublico) return { listo: false, motivo: 'sin-configuracion' };

  const consentimiento = limpio(PUBLIC_MAILERLITE_CONSENT_FIELD);

  return {
    listo: true,
    action: accion.action,
    campoCorreo: campo(PUBLIC_MAILERLITE_EMAIL_FIELD, 'fields[email]'),
    campoNombre: campo(PUBLIC_MAILERLITE_NAME_FIELD, 'fields[name]'),
    campoConsentimiento:
      consentimiento && campoSeguro.test(consentimiento) ? consentimiento : undefined,
  };
}
