/**
 * Copy del boletín con Resend. La versión registrada es la de esta casilla.
 * El enlace de privacidad del correo solo se incluye si BOLETIN_AVISO_URL
 * apunta a una página ya publicada. Hoy el aviso no entra como página definitiva.
 */
export const consentimientoBoletin = {
  version: 'boletin-mensual-2026-10-29',
  texto:
    'Acepto que MKT Creativa use mi nombre y mi correo solo para enviarme el boletín mensual. Sé que debo confirmar mi suscripción desde el correo que recibiré.',
} as const;

export const mensajeBoletinApagado =
  'La suscripción al boletín estará disponible pronto. Mientras tanto, puede escribirnos por WhatsApp.';

export const mensajeTrasEnviar =
  'Gracias. Le enviamos un correo para confirmar su suscripción. Abra el enlace que contiene; si no lo ve, revise la carpeta de correo no deseado o de promociones.';

export const rutasBoletin = {
  enviado: '/boletin/enviado',
  confirmada: '/boletin/confirmada',
  enlaceNoValido: '/boletin/enlace-no-valido',
  baja: '/boletin/baja-confirmada',
} as const;

export const correoConfirmacionCopia = {
  remitenteVisible: 'MKT Creativa',
  asunto: 'Confirme su suscripción al boletín de MKT Creativa',
  preheader: 'Un clic y recibirá el boletín mensual para clínicas y consultorios.',
  solicitud: 'Recibimos una solicitud para suscribir este correo al boletín de MKT Creativa.',
  descripcion:
    'Es un boletín mensual con notas breves y prácticas para clínicas y consultorios en Chiapas: presencia en Google, redes sociales y publicidad de salud con criterio COFEPRIS.',
  instruccion: 'Para empezar a recibirlo, confirme su suscripción:',
  vigencia: 'Este enlace vence en 48 horas.',
  boton: 'Confirmar',
  respaldo: 'Si el botón no funciona, copie y pegue este enlace en su navegador:',
  ignorar: 'Si usted no hizo esta solicitud, ignore este mensaje. No le enviaremos nada si no confirma.',
  firma: 'MKT Creativa',
  oficio: 'Marketing para clínicas y profesionales de la salud en Chiapas',
  baja: 'Si ya no desea recibir mensajes de MKT Creativa, puede darse de baja aquí.',
  privacidad: 'Consulte nuestro aviso de privacidad.',
} as const;

export function boletinActivo(valor: string | undefined) {
  return valor === '1';
}

export function saludoConfirmacion(nombre: string) {
  const limpio = nombre.trim();
  return limpio ? `Hola, ${limpio}:` : 'Hola:';
}

function escapar(valor: string) {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function urlAvisoPublicado(valor: string | undefined, origen: string) {
  const texto = valor?.trim() ?? '';
  if (!texto) return null;
  if (texto.startsWith('https://')) return texto;
  if (texto.startsWith('/') && !texto.startsWith('//')) return new URL(texto, origen).href;
  return null;
}

export function correoConfirmacion(datos: { nombre: string; enlace: string; baja: string; aviso: string | null }) {
  const copia = correoConfirmacionCopia;
  const saludo = saludoConfirmacion(datos.nombre);
  const lineas = [
    copia.preheader,
    '',
    saludo,
    '',
    copia.solicitud,
    '',
    copia.descripcion,
    '',
    copia.instruccion,
    '',
    copia.vigencia,
    '',
    copia.boton,
    datos.enlace,
    '',
    `${copia.respaldo} ${datos.enlace}`,
    '',
    copia.ignorar,
    '',
    copia.firma,
    copia.oficio,
    '',
    copia.baja,
    datos.baja,
  ];
  if (datos.aviso) {
    lineas.push('', copia.privacidad, datos.aviso);
  }
  const textoPlano = lineas.join('\n');
  const aviso = datos.aviso
    ? `<p><a href="${escapar(datos.aviso)}">${escapar(copia.privacidad)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="es-MX"><body>
<div style="display:none;max-height:0;overflow:hidden;">${escapar(copia.preheader)}</div>
<p>${escapar(saludo)}</p>
<p>${escapar(copia.solicitud)}</p>
<p>${escapar(copia.descripcion)}</p>
<p>${escapar(copia.instruccion)}</p>
<p>${escapar(copia.vigencia)}</p>
<p><a href="${escapar(datos.enlace)}">${escapar(copia.boton)}</a></p>
<p>${escapar(copia.respaldo)} <a href="${escapar(datos.enlace)}">${escapar(datos.enlace)}</a></p>
<p>${escapar(copia.ignorar)}</p>
<p>${escapar(copia.firma)}<br>${escapar(copia.oficio)}</p>
<p>${escapar(copia.baja)} <a href="${escapar(datos.baja)}">${escapar(datos.baja)}</a></p>
${aviso}
</body></html>`;
  return { asunto: copia.asunto, preheader: copia.preheader, texto: textoPlano, html };
}

export function remitenteVisible(desde: string) {
  const angulos = desde.match(/<([^>]+)>/);
  const correo = (angulos?.[1] ?? desde).trim();
  return `${correoConfirmacionCopia.remitenteVisible} <${correo}>`;
}
