/**
 * El build público no puede llevar marcadores ni la marca de texto provisional.
 * El aviso de privacidad sigue en el repositorio, fuera de src/pages, hasta que
 * existan los datos de Pedro y la revisión legal.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const avisoPublico = false;

export const fragmentosProhibidos = [
  '[pendiente',
  '[razón',
  '[razon',
  '[domicilio',
  '[correo',
  'por confirmar',
  '{{',
  'provisional',
  'cumple con cofepris',
  'cumplen con cofepris',
  'cumplir con cofepris',
  'sin problemas con cofepris',
  'sin meterte en problemas',
  'conformes a cofepris',
  'conforme a cofepris',
  '0 % riesgo',
  '100 % conforme',
  'agenda llena',
  'blindaje',
  'garantizado',
] as const;

export function fragmentoProhibido(texto: string) {
  const plano = texto.toLowerCase();
  return fragmentosProhibidos.find((fragmento) => plano.includes(fragmento));
}

const extensiones = new Set(['.html', '.xml', '.txt', '.css', '.js', '.svg']);

async function listar(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const archivos: string[] = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) archivos.push(...(await listar(ruta)));
    else if (extensiones.has(path.extname(entrada.name))) archivos.push(ruta);
  }
  return archivos;
}

export async function revisarDirectorioPublico(raiz: string) {
  const hallazgos: string[] = [];
  for (const archivo of await listar(raiz)) {
    const fragmento = fragmentoProhibido(await readFile(archivo, 'utf8'));
    if (fragmento) hallazgos.push(`${path.relative(raiz, archivo)} contiene «${fragmento}»`);
  }
  return hallazgos;
}
