import { agencia } from './agencia';

/**
 * Borrador para revisión legal. Los marcadores entre corchetes se sustituyen
 * antes de usar este texto como aviso definitivo.
 */
export const aviso = {
  fechaBorrador: '2026-10-27',
  ley: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares, nueva ley publicada en el Diario Oficial de la Federación el 20 de marzo de 2025, texto vigente con la reforma publicada el 14 de noviembre de 2025.',
  leyUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf',
};

export type BloqueAviso = {
  id: string;
  titulo: string;
  parrafos?: string[];
  lista?: string[];
};

export const bloquesAviso: BloqueAviso[] = [
  {
    id: 'borrador',
    titulo: 'Naturaleza de este documento',
    parrafos: [
      'Este aviso es un borrador para revisión legal. No está vigente como aviso definitivo mientras sigan los marcadores [Responsable: pendiente], [Domicilio: pendiente] y [Correo de contacto: pendiente], y mientras una persona licenciada en derecho no lo revise.',
      `Describe el tratamiento previsto en el sitio de ${agencia.nombre} para datos de contacto y para quienes se suscriban al boletín. No cubre expedientes clínicos. La agencia no presta servicios de salud.`,
    ],
  },
  {
    id: 'responsable',
    titulo: 'Responsable del tratamiento',
    parrafos: [
      `Identidad: [Responsable: pendiente], con nombre comercial ${agencia.nombre}. La persona de contacto público es ${agencia.responsable}.`,
      `Domicilio para oír y recibir notificaciones: [Domicilio: pendiente]. La agencia opera en ${agencia.ciudad}, ${agencia.estado}, ${agencia.pais}. Esa ciudad no sustituye el domicilio legal, que sigue pendiente.`,
      'Correo para privacidad y para derechos ARCO: [Correo de contacto: pendiente]. Hasta que ese correo exista y se publique sin corchetes, las solicitudes de privacidad no tienen un buzón definitivo. El WhatsApp de la agencia sirve para conversaciones comerciales, no como canal formal de derechos ARCO.',
    ],
  },
  {
    id: 'datos',
    titulo: 'Datos personales que se recaban',
    parrafos: [
      'Del formulario del boletín, cuando esté conectado: nombre y correo electrónico, más la manifestación de consentimiento. Del contacto por WhatsApp o por teléfono: el número desde el que escribe o llama la persona, y lo que ella decida contar en esa conversación. Esos mensajes los recibe la aplicación de WhatsApp o la red telefónica; este sitio estático no guarda el chat.',
      'Si más adelante se aceptan cookies de analítica, el navegador de la persona puede enviar a Google o a Meta identificadores técnicos de visita (por ejemplo, páginas vistas y un identificador de cookie). Eso solo ocurre después del consentimiento y solo si los identificadores de medición están configurados. Hoy no están configurados y no se carga ningún script de analítica.',
      'La preferencia de consentimiento (aceptar o rechazar analítica) se guarda en el propio navegador, con localStorage, en el equipo de la persona. No se envía a un servidor de la agencia.',
    ],
  },
  {
    id: 'sensibles',
    titulo: 'Datos sensibles',
    parrafos: [
      'No se solicitan datos personales sensibles. En particular, no se piden datos de salud, información genética, creencias, opiniones políticas ni preferencia sexual. No se deben enviar datos de pacientes, historias clínicas, estudios ni cualquier dato de una persona atendida en un consultorio.',
      'Si alguien incluye ese tipo de información sin que se le pida, no forma parte de la finalidad de este sitio. La instrucción es no enviarla. Cuando exista el correo de privacidad, se podrá pedir su cancelación.',
    ],
  },
  {
    id: 'finalidades',
    titulo: 'Finalidades',
    parrafos: [
      'Finalidades que se desprenden de la solicitud que la persona inicia: responder un mensaje de WhatsApp o una llamada sobre los servicios de la agencia. En la medida en que exista una relación jurídica pedida por la persona titular, el artículo 9 de la ley prevé supuestos en los que no se requiere un consentimiento adicional. La revisión legal debe confirmar cómo aplica eso a cada canal.',
      'Finalidades que sí requieren consentimiento de la persona titular: enviar el boletín, una vez al mes, al correo que ella anote, y —solo si se configuran las herramientas y ella acepta— medir la audiencia del sitio con Google Analytics 4 y con el píxel de Meta.',
      'No usamos los datos para vender bases, para perfilar estado de salud ni para publicidad de tratamientos. No hay finalidades secundarias de mercadeo de terceros.',
    ],
  },
  {
    id: 'consentimiento-tratamiento',
    titulo: 'Consentimiento',
    parrafos: [
      'El boletín pide consentimiento expreso mediante una casilla que no viene marcada. Sin esa casilla no hay suscripción. La persona puede negarse sin que eso impida llamar o escribir por WhatsApp.',
      'La analítica pide una decisión distinta: aceptar o rechazar. El rechazo no bloquea el sitio. Mientras no haya identificadores configurados, aceptar tampoco instala Google Analytics ni el píxel de Meta.',
      'El consentimiento puede revocarse en cualquier momento, sin efectos retroactivos, como prevé el artículo 7 de la ley. El mecanismo previsto es un escrito al correo [Correo de contacto: pendiente]. Para el boletín, la baja también se podrá pedir por el enlace que incluya cada envío cuando MailerLite esté conectado.',
    ],
  },
  {
    id: 'limitar',
    titulo: 'Opciones para limitar el uso o la divulgación',
    lista: [
      'No marcar la casilla del boletín.',
      'Elegir “Rechazar” en las cookies de analítica, o volver a abrir “Preferencias de cookies” en el pie y cambiar la decisión.',
      'No enviar datos clínicos ni de terceros.',
      'Pedir la limitación o la baja en [Correo de contacto: pendiente] cuando ese correo esté activo.',
      'Dejar de escribir por WhatsApp. La conversación que ya esté en esa aplicación se rige también por el aviso de su proveedor.',
    ],
  },
  {
    id: 'arco',
    titulo: 'Derechos ARCO y revocación',
    parrafos: [
      'La persona titular, o su representante, puede pedir acceso, rectificación, cancelación u oposición respecto de los datos que estén en posesión del responsable. El ejercicio de un derecho no impide ejercer otro, conforme al artículo 21.',
      'La solicitud se envía a [Correo de contacto: pendiente] e incluye: nombre de la persona titular, una forma de acreditar su identidad (y la representación, si aplica), la descripción clara del derecho que quiere ejercer y los datos para recibir la respuesta. En una rectificación conviene indicar el dato correcto y, si hace falta, un documento de apoyo. El medio para entregar el acceso será una copia electrónica, salvo que la persona pida otro medio razonable.',
      'Conforme al artículo 31, el responsable comunicará la determinación en un plazo máximo de veinte días hábiles contados desde que reciba la solicitud, y la hará efectiva, si procede, dentro de los quince días hábiles siguientes a esa comunicación. El artículo 34 prevé que el ejercicio es gratuito; solo pueden cobrarse los costos de reproducción, copias o envío.',
      'Si la persona considera que la respuesta no atiende su solicitud, o si no hay respuesta, puede presentar una solicitud de protección de datos ante la Secretaría Anticorrupción y Buen Gobierno. El artículo 40 da un plazo de quince días hábiles siguientes a la fecha en que el responsable comunique su respuesta. La revisión legal debe confirmar el conducto vigente de esa Secretaría antes de publicar este aviso como definitivo.',
    ],
  },
  {
    id: 'transferencias',
    titulo: 'Transferencias y personas encargadas',
    parrafos: [
      'No se venden datos personales ni se ceden para publicidad de terceros.',
      'MailerLite, cuando se contrate la cuenta, trataría nombre y correo por cuenta de la agencia para enviar el boletín: sería persona encargada, no una cesión para fines propios. Hoy la cuenta no existe y el formulario del sitio está desactivado, así que no hay envío. Al conectarlo se indicará aquí la relación y se le comunicará el aviso y las finalidades, como corresponde frente a quien trata datos por cuenta del responsable.',
      'Al pulsar WhatsApp, la persona sale hacia el servicio de Meta con su propio aviso. Al llamar, usa la red de su operador. Esos actos los inicia la persona.',
      'El hospedaje del sitio todavía no está contratado. Cuando se elija, se nombrará aquí como persona encargada de la infraestructura: [PROVEEDOR DE HOSPEDAJE]. Un proveedor de hospedaje puede tratar registros técnicos de conexión, como la dirección IP, para operar y asegurar el servicio.',
      'No hay otras transferencias previstas. Si en el futuro se necesitara una transferencia que requiera consentimiento, se pedirá de forma expresa y se actualizará este aviso, conforme al artículo 35. El artículo 36 lista supuestos estrechos en los que una transferencia puede ocurrir sin consentimiento; no son el plan de este sitio.',
    ],
  },
  {
    id: 'cookies',
    titulo: 'Cookies y analítica',
    parrafos: [
      'El sitio se puede usar sin cookies de analítica. No hay cookies necesarias de sesión: es un sitio estático.',
      'Google Analytics 4 y el píxel de Meta quedan preparados en la configuración y apagados. Solo se insertan sus scripts si existen identificadores públicos y la persona pulsa “Aceptar analítica”. Esos identificadores no son la API key de ningún servicio. La API key de MailerLite no se usa en el sitio y no debe colocarse en el código ni en variables públicas.',
      'Rechazar la analítica deja el sitio igual de usable. La decisión se recuerda en ese navegador hasta que la persona la cambie desde “Preferencias de cookies”.',
    ],
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad y vulneraciones',
    parrafos: [
      'El artículo 18 pide medidas de seguridad administrativas, técnicas y físicas acordes al riesgo. En este sitio el riesgo previsto es el de una lista de nombres y correos, no el de un expediente clínico. Las medidas mínimas previstas son: no publicar bases de datos en el repositorio, no poner secretos en el código, limitar quién administra MailerLite cuando exista, y usar el sitio estático sin formularios propios que guarden datos en el servidor de la agencia.',
      'Si una vulneración afectara de forma significativa los derechos patrimoniales o morales de las personas titulares, el artículo 19 prevé informarles de forma inmediata. El canal previsto para ese aviso es [Correo de contacto: pendiente] y, si hiciera falta un aviso más amplio, esta misma página.',
      'Quien intervenga en el tratamiento debe guardar confidencialidad, también después de terminar su relación con el responsable, conforme al artículo 20.',
    ],
  },
  {
    id: 'conservacion',
    titulo: 'Conservación',
    parrafos: [
      'Los datos del boletín se conservan mientras la persona quiera recibirlo y la finalidad siga vigente. Al pedir la baja, se dejan de usar para nuevos envíos. Si deben permanecer bloqueados para atender responsabilidades y después suprimirse, se seguirá el artículo 11: bloqueo y, cumplido el plazo, cancelación.',
      'Los mensajes de WhatsApp permanecen en esa aplicación según la configuración de cada persona y las condiciones de Meta. Este sitio no tiene una copia.',
    ],
  },
  {
    id: 'cambios',
    titulo: 'Cambios a este aviso',
    parrafos: [
      'Los cambios se publicarán en esta misma página, que es el procedimiento previsto por el artículo 15, fracción VI. La fecha visible al inicio se actualizará. Si el cambio exige un nuevo consentimiento —por ejemplo, una finalidad distinta—, no se aplicará a los datos ya recabados hasta obtenerlo, conforme al artículo 11.',
      'Si un dato no se obtuvo directamente de la persona y hubiera que informarle un cambio, se observará el artículo 17. No es el caso previsto para el boletín ni para el contacto, que los entrega la propia persona.',
    ],
  },
  {
    id: 'autoridad',
    titulo: 'Autoridad y quejas',
    parrafos: [
      'La ley vigente encomienda a la Secretaría Anticorrupción y Buen Gobierno difundir y vigilar la protección de datos personales en posesión de los particulares. Además de los derechos ARCO ante el responsable, la persona puede acudir a esa Secretaría en los términos de los artículos 38 y siguientes.',
      'Este borrador no es asesoría legal para otras clínicas ni un modelo para que un consultorio lo copie en su propio aviso. Cada responsable tiene que informar su propio tratamiento.',
    ],
  },
];
