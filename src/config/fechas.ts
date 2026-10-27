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
