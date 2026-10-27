/**
 * Datos públicos de la agencia. Lo que no está confirmado vive como marcador,
 * nunca como un dato inventado.
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

export const navegacion = [
  { href: '/', etiqueta: 'Inicio' },
  { href: '/servicios', etiqueta: 'Servicios' },
  { href: '/casos/mentalcareclinic', etiqueta: 'Caso' },
  { href: '/boletin', etiqueta: 'Boletín' },
  { href: '/contacto', etiqueta: 'Contacto' },
] as const;

export const navegacionPie = [
  ...navegacion,
  { href: '/aviso-de-privacidad', etiqueta: 'Aviso de privacidad' },
  { href: '/boletin/rss.xml', etiqueta: 'RSS del boletín' },
] as const;

export function enlaceWhatsapp(mensaje: string) {
  return `${telefono.whatsappBase}?text=${encodeURIComponent(mensaje)}`;
}

export const mensajesWhatsapp = {
  inicio:
    'Hola. Vi el sitio de MKT Creativa y quiero platicar sobre el marketing de mi clínica o consultorio en Chiapas.',
  servicios:
    'Hola. Quiero conocer los servicios de estrategia, sitio web y SEO local de MKT Creativa para un servicio de salud.',
  caso:
    'Hola. Leí el proceso de MentalCareClinic en el sitio de MKT Creativa y quiero conversar sobre el de mi clínica.',
  boletin: 'Hola. Quiero información sobre el boletín de MKT Creativa.',
  contacto: 'Hola. Quiero contactar a MKT Creativa.',
  aviso: 'Hola. Tengo una duda sobre el aviso de privacidad de MKT Creativa.',
  error: 'Hola. No encontré una página en el sitio de MKT Creativa y necesito orientación.',
  ejemplo:
    'Hola. Vi la edición de ejemplo del boletín de MKT Creativa y quiero información.',
} as const;
