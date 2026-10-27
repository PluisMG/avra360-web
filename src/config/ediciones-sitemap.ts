import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type DatosEdicionArchivo = {
  id: string;
  slug: string;
  fecha?: string;
  modificado?: string;
  ejemplo: boolean;
};

export function datosDeMarkdown(nombre: string, texto: string): DatosEdicionArchivo {
  const id = nombre.replace(/\.md$/, '');
  const frente = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const campo = (clave: string) => {
    const coincidencia = frente.match(new RegExp(`^${clave}:\\s*(.+)$`, 'm'));
    if (!coincidencia) return undefined;
    return coincidencia[1].trim().replace(/^['"]|['"]$/g, '');
  };
  return {
    id,
    slug: campo('slug') || id,
    fecha: campo('fecha'),
    modificado: campo('modificado'),
    ejemplo: campo('ejemplo') === 'true',
  };
}

/** lastmod solo de ediciones reales. La clave es la ruta pública. */
export async function mapaLastmodBoletin(directorio: string) {
  const mapa = new Map<string, string>();
  let nombres: string[] = [];
  try {
    nombres = (await readdir(directorio)).filter((nombre) => nombre.endsWith('.md'));
  } catch {
    return mapa;
  }
  for (const nombre of nombres) {
    const datos = datosDeMarkdown(nombre, await readFile(path.join(directorio, nombre), 'utf8'));
    if (datos.ejemplo) continue;
    const fecha = datos.modificado || datos.fecha;
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    mapa.set(`/boletin/${datos.slug}`, fecha);
  }
  return mapa;
}
