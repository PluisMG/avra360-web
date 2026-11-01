export const TEXTO_CONFIGURACION =
  'El chat con AVRA está en configuración. Muy pronto podrás conversar aquí.';

export const TEXTO_LENTO = 'AVRA está tardando más de lo normal';

export const ESPERA_MAX_MS = 180_000;

export const ESPERA_INICIAL_MS = 2_000;

export function esperaAgotada(inicioMs: number, ahoraMs: number): boolean {
  return ahoraMs - inicioMs >= ESPERA_MAX_MS;
}

export function siguienteEspera(anteriorMs: number): number {
  return Math.min(anteriorMs + 1_000, 8_000);
}
