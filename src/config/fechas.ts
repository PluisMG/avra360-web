/** Fecha civil AAAA-MM-DD. Cualquier día del mes es válido: el boletín es mensual. */
export function validarFechaEdicion(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'La fecha se escribe AAAA-MM-DD.';
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const real =
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  if (!real) return 'La fecha no existe en el calendario.';
  return undefined;
}

export function formatearFecha(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

/** Mediodía UTC para que el día civil no cambie al convertir la zona. */
export function fechaRss(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 14, 0, 0));
}
