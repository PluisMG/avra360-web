/**
 * El build público no puede llevar marcadores sueltos ni notas internas.
 * El aviso de privacidad sí se publica, con noindex, y solo ahí pueden verse
 * los tres campos pendientes del borrador.
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
  'notas para pixel',
  'pendientes.md',
  'clave sugerida',
  'mensaje prellenado',
  'borrador ·',
  'revisión seo',
  'revision seo',
] as const;

const marcadoresAvisoBorrador = [
  '[responsable: pendiente]',
  '[domicilio: pendiente]',
  '[correo de contacto: pendiente]',
];

export function fragmentoProhibido(texto: string, opciones?: { avisoBorrador?: boolean }) {
  let plano = texto.toLowerCase();
  if (opciones?.avisoBorrador) {
    for (const marca of marcadoresAvisoBorrador) plano = plano.split(marca).join(' ');
  }
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
    const avisoBorrador = archivo.split(path.sep).includes('aviso-de-privacidad');
    const fragmento = fragmentoProhibido(await readFile(archivo, 'utf8'), { avisoBorrador });
    if (fragmento) hallazgos.push(`${path.relative(raiz, archivo)} contiene «${fragmento}»`);
  }
  return hallazgos;
}
