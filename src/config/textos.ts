/**
 * Textos finales de Creativo (26 de octubre de 2026).
 * Lo que todavía depende de Pedro —diagnóstico de entrada, métricas,
 * razón social, domicilio y correos— no se publica aquí.
 */

import { consentimientoBoletin, mensajeBoletinApagado } from './suscripcion.ts';

export const seo = {
  inicio: {
    titulo: 'Agencia de marketing médico en Tuxtla Gutiérrez',
    descripcion:
      'Marketing para clínicas, consultorios y salud mental en Tuxtla Gutiérrez, Chiapas: estrategia, sitio web y SEO local, con criterio COFEPRIS y sin promesas.',
  },
  servicios: {
    titulo: 'Servicios de marketing para clínicas en Chiapas',
    descripcion:
      'Páginas web para médicos, SEO local y Google Maps, revisión COFEPRIS de publicidad y marketing de salud mental para clínicas y consultorios en Chiapas.',
  },
  caso: {
    titulo: 'Caso MentalCareClinic: sitio y SEO local',
    descripcion:
      'Cómo trabajamos el sitio y el SEO local de MentalCareClinic en Tuxtla Gutiérrez: diagnóstico, estrategia, sitio nuevo y Google. Relación declarada.',
  },
  boletin: {
    titulo: 'Boletín de marketing para clínicas en Chiapas',
    descripcion:
      'Boletín mensual para clínicas y consultorios de Chiapas: Google Maps, publicidad con criterio COFEPRIS e IA. Lea el archivo y suscríbase.',
  },
  contacto: {
    titulo: 'Contacto de MKT Creativa en Tuxtla Gutiérrez, Chiapas',
    descripcion:
      'Escríbanos por WhatsApp o llame al +52 961 191 9199. Atendemos clínicas y consultorios en Tuxtla Gutiérrez, Tapachula y San Cristóbal de las Casas.',
  },
  aviso: {
    titulo: 'Aviso de privacidad',
    descripcion:
      'Aviso de privacidad integral de MKT Creativa para datos de contacto y suscriptores del boletín, conforme a la LFPDPPP.',
  },
  error: {
    titulo: 'Página no encontrada',
    descripcion:
      'Esta página no existe en el sitio de MKT Creativa, agencia de marketing para clínicas en Tuxtla Gutiérrez, Chiapas.',
  },
} as const;

export const inicio = {
  ceja: 'Agencia de marketing y publicidad para la salud · Tuxtla Gutiérrez, Chiapas',
  h1: 'Agencia de marketing médico en Tuxtla Gutiérrez',
  lede: 'MKT Creativa acompaña a clínicas, consultorios y profesionales de la salud de Chiapas a darse a conocer con una comunicación clara, ética y apegada a la regulación sanitaria. Estrategia, sitio web y presencia en Google, trabajados por un solo equipo y con el mismo criterio.',
  apoyo:
    'Revisamos cada texto, pieza y anuncio antes de publicarlo: cédula profesional a la vista, nada de promesas de curación ni de resultados, y el aviso o permiso de publicidad identificado antes de difundir.',
  fichaTitulo: 'En una mirada',
  ficha: [
    { termino: 'Para quién', detalle: 'Clínicas, consultorios y profesionales de la salud' },
    { termino: 'Especialidad de la agencia', detalle: 'Salud mental y servicios de salud en general' },
    { termino: 'Dónde', detalle: 'Tuxtla Gutiérrez y el resto de Chiapas' },
    { termino: 'Contacto principal', detalle: 'WhatsApp +52 961 191 9199' },
  ],
  aclaracion:
    'Este es el sitio de una agencia de marketing. MKT Creativa no presta servicios de salud, no atiende pacientes ni recibe datos clínicos.',
  paraQuienTitulo: 'Para quién es este trabajo',
  paraQuien: [
    {
      titulo: 'Clínicas y consultorios con equipo',
      texto:
        'Si dirige una clínica o un consultorio con varias personas, necesita que su marca, su sitio, su ficha de Google y sus anuncios digan lo mismo y puedan sostenerse ante la autoridad sanitaria. Ordenamos esas piezas en un solo encargo, con un solo equipo.',
    },
    {
      titulo: 'Profesionales que atienden por su cuenta',
      texto:
        'Si usted ejerce de forma individual, le ayudamos a tener una presencia propia, además de los directorios en los que ya aparece: una ficha de Google bien cuidada, un sitio sencillo con su cédula a la vista y un canal claro para que lo contacten.',
    },
    {
      titulo: 'Salud mental, nuestro énfasis',
      texto:
        'Psiquiatría, psicología y centros de atención en salud mental requieren un lenguaje especialmente cuidadoso, tanto por la norma sanitaria como por las políticas de Meta y Google. Ese es el terreno en el que más trabajamos, y el mismo criterio se aplica a cualquier especialidad.',
    },
  ],
  criteriosTitulo: 'Cómo trabajamos',
  criterios: [
    {
      numero: '01',
      titulo: 'Cumplimiento antes de publicar',
      texto:
        'La publicidad de servicios de salud en México se rige por la Ley General de Salud y su Reglamento en Materia de Publicidad, y la agencia que la elabora también responde por ella. Antes de producir o pautar, identificamos si su caso requiere aviso o permiso de COFEPRIS y le pedimos copia del acuse del aviso o del permiso. No sustituimos a la autoridad ni a un abogado; le ayudamos a llegar preparado.',
    },
    {
      numero: '02',
      titulo: 'Información, no promesas',
      texto:
        'Comunicamos qué servicio ofrece, quién lo presta, con qué formación y cómo se solicita. No publicamos promesas de curación, porcentajes de mejoría, testimonios de pacientes ni imágenes de antes y después. Si una afirmación no se puede sustentar, no se publica.',
    },
    {
      numero: '03',
      titulo: 'Estrategia, sitio y Google, juntos',
      texto:
        'El mensaje, el sitio web y la ficha de Google se trabajan como una sola pieza. Nombre, especialidad, ciudad y datos de contacto coinciden en todos los canales, para que las personas lo encuentren y entiendan lo que ofrece.',
    },
  ],
  serviciosTitulo: 'Servicios',
  serviciosIntro: 'Cuatro líneas de trabajo que se contratan juntas o por separado. El detalle está en la página de servicios.',
  servicios: [
    {
      clave: 'estrategia',
      titulo: 'Estrategia',
      texto: 'Qué decir, a quién y en qué canales, dentro de la norma.',
    },
    {
      clave: 'sitio-web',
      titulo: 'Sitio web',
      texto: 'Rápido, claro, accesible y con su cédula a la vista.',
    },
    {
      clave: 'seo-local',
      titulo: 'SEO local y Google',
      texto: 'Que lo encuentren en su ciudad, con datos consistentes.',
    },
    {
      clave: 'contenido-cofepris',
      titulo: 'Contenido y campañas',
      texto: 'Piezas revisadas con criterio COFEPRIS antes de publicarse.',
    },
  ],
  casoTitulo: 'Un caso contado con transparencia',
  casoTexto:
    'Con MentalCareClinic, una clínica de salud mental en Chiapas, documentamos el proceso completo: diagnóstico de su presencia digital, estrategia de comunicación, sitio nuevo y SEO local. Publicaremos resultados solo cuando estén medidos y con fecha.',
  casoRelacion:
    'Declaración de interés: Pedro Luis Maldonado Gordillo, fundador de MKT Creativa, es socio de MentalCareClinic.',
  casoEnlace: 'Conocer el proceso',
  boletinTitulo: 'Boletín para clínicas y consultorios',
  boletinTexto:
    'Notas breves y prácticas sobre marketing de salud en Chiapas: qué se puede decir en público, cómo cuidar su ficha de Google y qué cambia en la regulación. Un tema por edición, una vez al mes.',
  boletinEnlace: 'Conocer el boletín',
  cierreTitulo: 'El primer paso es una conversación',
  cierreTexto:
    'Cuéntenos qué servicio ofrece, en qué ciudad atiende y cómo lo encuentran hoy sus pacientes. Con eso le proponemos un diagnóstico digital y de cumplimiento, y le decimos con claridad qué podemos hacer por su clínica.',
} as const;

export const servicios = {
  h1: 'Servicios de marketing para clínicas y consultorios en Chiapas',
  lede: 'Cuatro líneas de trabajo que se diseñan juntas para que su comunicación sea clara, coherente y apegada a la regulación sanitaria. Puede contratarlas como un solo encargo o empezar por la que más necesite. Nuestro énfasis está en la salud mental.',
  bloques: [
    {
      id: 'estrategia',
      numero: '01',
      titulo: 'Estrategia',
      parrafos: [
        'Antes de rehacer un sitio o lanzar un anuncio, definimos con usted qué servicios va a comunicar, en qué ciudades, a qué público y con qué mensajes. También acordamos qué frases quedan fuera, porque en salud lo que no se dice importa tanto como lo que se dice.',
        'La estrategia identifica desde el inicio qué piezas requieren aviso o permiso de publicidad ante COFEPRIS y qué documentos los respaldan. Si un caso necesita la opinión de un abogado sanitario, se lo decimos antes de producir, no después de publicar.',
      ],
    },
    {
      id: 'sitio-web',
      numero: '02',
      titulo: 'Sitio web',
      parrafos: [
        'Construimos sitios que cargan rápido, se leen bien en el teléfono y pueden usarse con teclado y lector de pantalla. Cada página dice qué servicio ofrece, quién lo presta, dónde y cómo se solicita.',
        'Incluimos lo que la norma pide y lo que da confianza: nombre de la institución que expidió el título y número de cédula profesional de quien ofrece el servicio, aviso de privacidad y un botón directo a WhatsApp. No usamos contadores de pacientes, testimonios como prueba ni imágenes de antes y después.',
      ],
    },
    {
      id: 'seo-local',
      numero: '03',
      titulo: 'SEO local y Google',
      parrafos: [
        'Trabajamos para que su servicio pueda encontrarse en su ciudad: páginas con la especialidad y la ubicación escritas con claridad, una ficha de Google completa y verificada, y datos de contacto idénticos en el sitio, en Google y en los directorios donde ya aparece.',
        'No ofrecemos “el primer lugar en Google” ni compramos reseñas. Le ayudamos a pedir opiniones de forma legítima y a responderlas sin revelar datos de salud. Cuando medimos avances, los reportamos como datos observados, con su fecha.',
      ],
    },
    {
      id: 'contenido-cofepris',
      numero: '04',
      titulo: 'Contenido y campañas con criterio COFEPRIS',
      parrafos: [
        'Textos del sitio, publicaciones en redes, artículos, boletines y anuncios salen del mismo criterio. Cada pieza informa sobre el tipo, las características y la forma de acceder al servicio, sin atribuirle efectos que no se puedan comprobar.',
        'En campañas pagadas también cuidamos las políticas de Meta y Google para temas de salud, como no aludir a la condición de salud de quien lee el anuncio. Antes de pautar, confirmamos que el aviso o el permiso de publicidad que corresponda esté presentado.',
      ],
    },
  ],
  cofepris: {
    id: 'cofepris',
    titulo: 'Cómo trabajamos la publicidad de servicios de salud',
    parrafos: [
      'En México, la publicidad de servicios de salud se rige por la Ley General de Salud y por el Reglamento de la Ley General de Salud en Materia de Publicidad, y la vigila la Comisión Federal para la Protección contra Riesgos Sanitarios (COFEPRIS). La ley y el reglamento obligan también a las agencias de publicidad: quien elabora el material debe apegarse al aviso o permiso del anunciante.',
      'De forma general, la publicidad de un profesional que ejerce de manera individual requiere presentar un aviso de publicidad antes de difundirse, mientras que la de un establecimiento, como una clínica, requiere permiso de publicidad. En ambos casos, la publicidad debe indicar la institución que expidió el título y, en su caso, el número de cédula profesional. Cada caso concreto se confirma con el trámite vigente ante COFEPRIS.',
      'Por eso nuestro método es concreto: no prometemos resultados ni tiempos de mejoría; no ofrecemos curas; no usamos testimonios de pacientes como prueba de eficacia; no publicamos antes y después; no afirmamos superioridad sobre otros profesionales sin sustento, y guardamos la documentación que respalda cada afirmación. Si una pieza requiere aviso o permiso, se lo señalamos y preparamos el material para el trámite.',
      'Este texto describe el criterio de trabajo de la agencia. No es un dictamen jurídico ni una autorización sanitaria: el permiso lo otorga la autoridad y un abogado sanitario puede confirmar su caso particular.',
    ],
  },
  cierreTitulo: 'Conversemos sobre su clínica o consultorio',
  cierreTexto:
    'Cuéntenos su especialidad, la ciudad donde atiende y si ya tiene sitio web o ficha de Google. Le respondemos con una propuesta clara de por dónde empezar.',
  inversionEstado: 'Cotización a la medida',
  inversionTexto:
    'Cada propuesta se prepara según el tamaño de su clínica o consultorio, las ciudades donde atiende y los servicios que necesita. Escríbanos y le enviamos una cotización por escrito, con el alcance detallado.',
  inversionEnlace: 'Solicitar cotización',
} as const;

export const caso = {
  h1: 'Caso MentalCareClinic: el proceso, paso a paso',
  lede: 'MentalCareClinic es una clínica de salud mental en Chiapas. En esta página contamos cómo trabajamos su comunicación digital, de principio a fin. Es un caso de proceso: los resultados se publicarán cuando estén medidos y con fecha.',
  relacion:
    'Pedro Luis Maldonado Gordillo, fundador de MKT Creativa, es socio de MentalCareClinic. Lo decimos al inicio para que usted lea este caso sabiendo que no se trata de un cliente independiente de la agencia.',
  fasesTitulo: 'Las cuatro fases del trabajo',
  fases: [
    {
      titulo: 'Diagnóstico de la presencia digital',
      texto:
        'Partimos del sitio que la clínica tenía en Google Sites y de cómo aparecía en Google. Revisamos qué decía, cómo estaba organizado, si sus datos de contacto coincidían entre canales y qué frases podían representar un riesgo frente a la norma de publicidad sanitaria.',
    },
    {
      titulo: 'Estrategia de comunicación',
      texto:
        'Definimos qué servicios comunica la clínica, a quién se dirige en Chiapas y con qué lenguaje. En salud mental el cuidado es mayor: los mensajes informan sobre el servicio y la forma de solicitarlo, sin prometer resultados clínicos y sin aludir a la condición de salud de quien los lee.',
    },
    {
      titulo: 'Sitio nuevo, rápido y accesible',
      texto:
        'Diseñamos un sitio pensado para cargar rápido, leerse en el teléfono y recorrerse con teclado y lector de pantalla, con WhatsApp como canal principal de contacto y con la información profesional del equipo a la vista.',
    },
    {
      titulo: 'SEO local',
      texto:
        'Ordenamos el servicio, la ciudad y los datos de contacto para que coincidan entre el sitio, la ficha de Google y los directorios. El objetivo es que quien busca atención en salud mental en su ciudad encuentre información clara y correcta.',
    },
  ],
  sinTestimonios:
    'Esta página no incluye testimonios. Nunca publicaremos opiniones de pacientes. Si la dirección de la clínica decide compartir su experiencia con la agencia, la agregaremos con su nombre y su autorización por escrito.',
  cierreTitulo: '¿Quiere un proceso similar para su clínica?',
  cierre:
    'Cada clínica parte de un punto distinto. Cuéntenos qué servicios ofrece y en qué ciudad atiende, y le proponemos por dónde empezar, con un diagnóstico de su presencia digital y de los riesgos de publicidad que detectemos.',
} as const;

export const boletin = {
  h1: 'Boletín de MKT Creativa para clínicas y consultorios',
  lede: 'Notas breves y prácticas para quienes dirigen clínicas y consultorios en Chiapas: cómo darse a conocer, cómo cuidar su presencia en Google y qué se puede decir en público según la norma sanitaria. Se publica una vez al mes.',
  ritmoTitulo: 'Qué encontrará en cada edición',
  ritmo: [
    'Un tema principal, explicado de forma concreta y aplicable a su consultorio.',
    'Dos o tres notas breves sobre Google, redes sociales o publicidad de salud.',
    'Un recordatorio práctico de cumplimiento con la norma de COFEPRIS.',
    'Un solo llamado a la acción, sin saturar su bandeja.',
    'Sin promesas de resultados, sin cifras sin fuente y sin datos de pacientes.',
  ],
  vacioTitulo: 'Ediciones',
  vacio:
    'La primera edición está en preparación. Cuando el formulario esté activo, podrá suscribirse aquí para recibirla.',
  archivoTitulo: 'Ediciones anteriores',
  rss: 'Seguir el boletín por RSS',
} as const;

export const formularioBoletinTextos = {
  titulo: 'Reciba el boletín',
  ayudaActiva:
    'Déjenos su nombre y su correo. Le enviaremos un mensaje para confirmar y, después, cada edición. Puede darse de baja en cualquier momento.',
  leyendaActiva: 'Datos para recibir el boletín',
  placeholderNombre: 'Su nombre',
  placeholderCorreo: 'nombre@suclinica.mx',
  casilla: consentimientoBoletin.texto,
  boton: 'Suscribirme',
  ayudaApagada: mensajeBoletinApagado,
  leyendaApagada: 'Suscripción no disponible',
  botonApagado: 'Suscripción no disponible',
} as const;

export const contacto = {
  h1: 'Hablemos de su clínica o consultorio',
  lede: 'La forma más rápida de contactarnos es WhatsApp. También puede llamarnos al mismo número. Cuéntenos su especialidad, la ciudad donde atiende y qué le gustaría mejorar de su presencia digital, y le respondemos con una propuesta de primer paso.',
  avisoClinica:
    'MKT Creativa es una agencia de marketing: no presta servicios de salud ni agenda consultas. Por favor, no nos envíe datos clínicos, estudios ni información de sus pacientes por ningún medio.',
  canalesTitulo: 'Canales de contacto',
  datosTitulo: 'Datos de la agencia',
  atendemos: 'Clínicas, consultorios y profesionales de la salud de Chiapas',
} as const;

export const errorPagina = {
  h1: 'Esta página no existe',
  lede: 'Es posible que el enlace haya cambiado. Puede volver al inicio, ver nuestros servicios o escribirnos por WhatsApp.',
} as const;

export const pie = {
  linea:
    'MKT Creativa es una agencia de marketing. No presta servicios de salud, no atiende pacientes ni recibe datos clínicos.',
  derechos: 'MKT Creativa © 2026. Tuxtla Gutiérrez, Chiapas.',
} as const;
