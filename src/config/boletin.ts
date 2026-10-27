import { mostrarEdicionEjemplo } from './entorno';

export function incluirEdicion(edicion: { data: { ejemplo?: boolean } }) {
  if (edicion.data.ejemplo && !mostrarEdicionEjemplo()) return false;
  return true;
}

export function ordenarEdiciones<T extends { data: { fecha: string } }>(ediciones: T[]) {
  return [...ediciones].sort((a, b) => {
    if (a.data.fecha === b.data.fecha) return 0;
    return a.data.fecha < b.data.fecha ? 1 : -1;
  });
}
