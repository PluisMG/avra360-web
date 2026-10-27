/**
 * Datos públicos de la agencia. Razón social, domicilio, horario y correos
 * no se publican hasta que Pedro los confirme: no hay marcadores en el HTML.
 */
export const agencia = {
  nombre: 'MKT Creativa',
  responsable: 'Pedro Luis Maldonado Gordillo',
  oficio: 'Agencia de marketing y publicidad',
  ciudad: 'Tuxtla Gutiérrez',
  estado: 'Chiapas',
  pais: 'México',
  paisCodigo: 'MX',
} as const;

export const telefono = {
  e164: '+529611919199',
  visible: '+52 961 191 9199',
  tel: 'tel:+529611919199',
  whatsappNumero: '529611919199',
  whatsappBase: 'https://wa.me/529611919199',
} as const;

export const pendientes = {
  razonSocial: '[RAZÓN SOCIAL]',
  domicilio: '[DOMICILIO]',
  correoPrivacidad: '[CORREO DE PRIVACIDAD]',
  horario: '[HORARIO]',
  proveedorHospedaje: '[PROVEEDOR DE HOSPEDAJE]',
} as const;

/**
 * Poner en true solo cuando Pedro apruebe los precios.
 * Con false, la página de servicios muestra el bloque desactivado y sin montos.
 */
export const mostrarPrecios = false;

export type PrecioPublico = {
  servicio: string;
  monto: string;
  nota: string;
};

/** Vacío a propósito. No agregar cifras hasta que estén aprobadas. */
export const precios: PrecioPublico[] = [];

export function enlaceWhatsapp(mensaje: string) {
  return `${telefono.whatsappBase}?text=${encodeURIComponent(mensaje)}`;
}

export const mensajesWhatsapp = {
  inicio:
    'Hola. Vi el sitio de MKT Creativa y me interesa conversar sobre el marketing de mi clínica o consultorio en Chiapas.',
  servicios:
    'Hola. Me interesan los servicios de MKT Creativa para mi clínica o consultorio y quiero recibir una cotización.',
  caso: 'Hola. Leí el caso de MentalCareClinic en el sitio de MKT Creativa y me interesa un proceso similar para mi clínica.',
  boletin: 'Hola. Quiero recibir el boletín de MKT Creativa para clínicas y consultorios.',
  contacto: 'Hola. Quiero hablar con MKT Creativa sobre el marketing de mi clínica o consultorio.',
  aviso: 'Hola. Tengo una duda sobre el aviso de privacidad de MKT Creativa.',
  error: 'Hola. No encontré una página en el sitio de MKT Creativa y necesito orientación.',
  ejemplo: 'Hola. Vi la edición de ejemplo del boletín de MKT Creativa y quiero más información.',
} as const;
