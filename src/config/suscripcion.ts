/**
 * Versión del consentimiento del boletín. El texto visible y el valor de la
 * casilla tienen que coincidir con lo que firma el Worker.
 * El texto definitivo del estado desactivado lo tiene que dar Creativo;
 * este mensaje es el genérico mientras llega.
 */
export const consentimientoBoletin = {
  version: 'boletin-2026-10-29',
  texto: 'Acepto que MKT Creativa use mi nombre y mi correo solo para enviarme el boletín.',
} as const;

export const mensajeBoletinApagado = 'La suscripción al boletín no está disponible en este momento.';

export function boletinActivo(valor: string | undefined) {
  return valor === '1';
}
