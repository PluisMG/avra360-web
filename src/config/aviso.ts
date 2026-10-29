export const AVISO_VERSION = 'aviso-borrador-2026-10-29';

export const aviso = {
  fechaBorrador: '2026-10-29',
  fechaVisible: '29 de octubre de 2026',
  version: AVISO_VERSION,
  ley: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares, nueva ley publicada en el Diario Oficial de la Federación el 20 de marzo de 2025, texto vigente con la reforma publicada el 14 de noviembre de 2025.',
  leyUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf',
  banner: 'Borrador pendiente de aprobación de Pedro Luis Maldonado Gordillo',
  razonSocial: '[Razón social pendiente]',
  domicilio: '[Domicilio pendiente]',
  correoArco: '[Correo de contacto ARCO pendiente]',
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
      'Este aviso es un borrador para revisión legal. No está vigente como aviso definitivo mientras sigan los marcadores [Razón social pendiente], [Domicilio pendiente] y [Correo de contacto ARCO pendiente], y mientras una persona licenciada en derecho no lo revise.',
      `La versión de este borrador es ${aviso.version}. Describe el tratamiento previsto en el sitio de AVRA 360 para la conversación que una persona inicia en la pantalla principal. No cubre un archivo de prospectos: ese archivo está preparado y apagado.`,
    ],
  },
  {
    id: 'responsable',
    titulo: 'Responsable del tratamiento',
    parrafos: [
      `Identidad: ${aviso.razonSocial}, con nombre comercial AVRA 360. La persona de contacto público es Pedro Luis Maldonado Gordillo.`,
      `Domicilio para oír y recibir notificaciones: ${aviso.domicilio}. La agencia opera en Tuxtla Gutiérrez, Chiapas, México. Esa ciudad no sustituye el domicilio legal, que sigue pendiente.`,
      `Correo para privacidad y para derechos ARCO: ${aviso.correoArco}. Hasta que ese correo exista y se publique sin corchetes, las solicitudes de privacidad no tienen un buzón definitivo.`,
    ],
  },
  {
    id: 'datos',
    titulo: 'Datos personales que se recaban',
    parrafos: [
      'Si la persona escribe en el chat, el sitio trata el texto del mensaje y un identificador de la conversación generado en ese momento. No pide nombre, correo, teléfono ni otros datos de contacto. Si la persona los escribe por su cuenta, viajan dentro del mensaje.',
      'Para limitar abusos, el sitio calcula un hash de la dirección IP y usa solo ese hash. La IP en claro no se guarda. El hash se conserva, como máximo, el tiempo de la ventana de límite (24 horas) y después se descarta.',
      'Cloudflare Turnstile, cuando el chat esté activo, puede recibir un token de verificación y la dirección IP para distinguir a una persona de un envío automatizado. Hoy el chat está en configuración y ese script no se carga al abrir la página.',
      `El navegador puede guardar únicamente el identificador de la conversación en localStorage, con la clave avra360.conversationId, en el equipo de la persona. Sirve para continuar el mismo hilo. No es una cookie, no se usa para medir audiencia y no se comparte con herramientas de analítica. Si el navegador bloquea localStorage, la conversación de esa visita sigue, sin recordar el identificador después.`,
    ],
  },
  {
    id: 'sensibles',
    titulo: 'Datos sensibles',
    parrafos: [
      'No se solicitan datos personales sensibles. En particular, no se piden datos de salud, información genética, creencias, opiniones políticas ni preferencia sexual.',
      'Si alguien incluye ese tipo de información sin que se le pida, no forma parte de la finalidad de este sitio. La instrucción es no enviarla. Cuando exista el correo de privacidad, se podrá pedir su cancelación.',
    ],
  },
  {
    id: 'finalidades',
    titulo: 'Finalidades',
    parrafos: [
      'La finalidad es responder, dentro del chat, a la idea que la persona escribe: una marca, una campaña, un presupuesto u otra solicitud relacionada con los servicios de AVRA 360. La respuesta la produce AVRA, el asistente de la agencia. Las instrucciones de AVRA viven en su perfil y no en el código de este sitio.',
      'También se trata el hash de la IP para aplicar un límite de mensajes, y el token de Turnstile para verificar el envío cuando el chat esté activo.',
      'No hay finalidades de analítica, de boletín, de publicidad de terceros ni de venta de bases de datos. El sitio no accede a Google Calendar. Si en una conversación se habla de una cita, la agenda la lleva AVRA desde su perfil, no este sitio.',
    ],
  },
  {
    id: 'consentimiento-tratamiento',
    titulo: 'Consentimiento',
    parrafos: [
      'Escribir en el chat es un acto de la persona. Mientras este aviso siga en borrador y el archivo de conversaciones esté apagado, el mensaje solo se retransmite para obtener la respuesta y se borra de forma automática a las 24 horas. No se pide un consentimiento de archivo porque no hay archivo.',
      `Cuando el aviso definitivo esté aprobado, un registro de consentimiento podrá guardarse con esta versión del aviso, o con la versión que entonces se publique. Sin ese aviso aprobado y sin el consentimiento de la persona, no se persiste nada más allá de la retransmisión transitoria. La versión de este borrador es ${aviso.version}.`,
      `El consentimiento, cuando exista, podrá revocarse sin efectos retroactivos, como prevé el artículo 7 de la ley. El mecanismo previsto es un escrito a ${aviso.correoArco}.`,
    ],
  },
  {
    id: 'limitar',
    titulo: 'Opciones para limitar el uso o la divulgación',
    lista: [
      'No escribir en el chat.',
      'No incluir datos de contacto ni datos de terceros en el mensaje.',
      'Borrar avra360.conversationId en el almacenamiento local del navegador.',
      `Pedir la limitación en ${aviso.correoArco} cuando ese correo esté activo.`,
    ],
  },
  {
    id: 'arco',
    titulo: 'Derechos ARCO y revocación',
    parrafos: [
      'La persona titular, o su representante, puede pedir acceso, rectificación, cancelación u oposición respecto de los datos que estén en posesión del responsable. El ejercicio de un derecho no impide ejercer otro, conforme al artículo 21.',
      `La solicitud se envía a ${aviso.correoArco} e incluye: nombre de la persona titular, una forma de acreditar su identidad (y la representación, si aplica), la descripción clara del derecho que quiere ejercer y los datos para recibir la respuesta. En una rectificación conviene indicar el dato correcto y, si hace falta, un documento de apoyo. El medio para entregar el acceso será una copia electrónica, salvo que la persona pida otro medio razonable.`,
      'Conforme al artículo 31, el responsable comunicará la determinación en un plazo máximo de veinte días hábiles contados desde que reciba la solicitud, y la hará efectiva, si procede, dentro de los quince días hábiles siguientes a esa comunicación. El artículo 34 prevé que el ejercicio es gratuito; solo pueden cobrarse los costos de reproducción, copias o envío.',
      'Si la persona considera que la respuesta no atiende su solicitud, o si no hay respuesta, puede presentar una solicitud de protección de datos ante la Secretaría Anticorrupción y Buen Gobierno. El artículo 40 da un plazo de quince días hábiles siguientes a la fecha en que el responsable comunique su respuesta. La revisión legal debe confirmar el conducto vigente de esa Secretaría antes de publicar este aviso como definitivo.',
    ],
  },
  {
    id: 'transferencias',
    titulo: 'Transferencias y personas encargadas',
    parrafos: [
      'No se venden datos personales ni se ceden para publicidad de terceros.',
      'Cloudflare hospeda el sitio (Workers y Durable Objects) y, cuando el chat esté activo, opera Turnstile. Trata datos técnicos de conexión para servir el sitio, limitar abusos y verificar el envío. Es persona encargada de la infraestructura. El hash de la IP y la conversación transitoria viven en esa infraestructura y se borran como se indica en conservación.',
      'Para generar la respuesta, el mensaje, los últimos turnos de esa conversación y el identificador se envían a AVRA mediante un webhook de Cursor (https://api2.cursor.sh). Cursor actúa como encargado de esa retransmisión. La llamada despierta a AVRA y no devuelve la respuesta; AVRA la entrega después, en un canal firmado y de un solo uso, al propio sitio. Este código no contiene instrucciones de personalidad de AVRA.',
      'No hay otras transferencias previstas. Si en el futuro se necesitara una transferencia que requiera consentimiento, se pedirá de forma expresa y se actualizará este aviso, conforme al artículo 35. El artículo 36 lista supuestos estrechos en los que una transferencia puede ocurrir sin consentimiento; no son el plan de este sitio.',
    ],
  },
  {
    id: 'cookies',
    titulo: 'Cookies, almacenamiento local y analítica',
    parrafos: [
      'No hay cookies de analítica ni de terceros. No se usa Google Analytics ni el píxel de Meta. No hay banner de cookies porque no hay medición que aceptar o rechazar.',
      'El único dato que el sitio escribe en el navegador es avra360.conversationId en localStorage, y solo después de que el chat activo acepte un mensaje. En la vista en configuración no se escribe.',
    ],
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad y vulneraciones',
    parrafos: [
      'El artículo 18 pide medidas de seguridad administrativas, técnicas y físicas acordes al riesgo. Las medidas previstas son: no publicar secretos en el repositorio, firmar y caducar a los 15 minutos el token con el que AVRA devuelve la respuesta, usarlo una sola vez, limitar la longitud de los mensajes, no interpretar el texto como HTML, y borrar la conversación transitoria a las 24 horas.',
      `Si una vulneración afectara de forma significativa los derechos patrimoniales o morales de las personas titulares, el artículo 19 prevé informarles de forma inmediata. El canal previsto para ese aviso es ${aviso.correoArco} y, si hiciera falta un aviso más amplio, esta misma página.`,
      'Quien intervenga en el tratamiento debe guardar confidencialidad, también después de terminar su relación con el responsable, conforme al artículo 20.',
    ],
  },
  {
    id: 'conservacion',
    titulo: 'Conservación',
    parrafos: [
      'La conversación que se usa para retransmitir el mensaje se guarda en un Durable Object solo para ese fin. Una alarma la borra a las 24 horas. No es un expediente de prospecto.',
      'El archivo de conversaciones y el registro de prospectos están preparados en el código y apagados. No se encienden sin el aviso definitivo aprobado, sin el consentimiento de la persona y sin un almacén enlazado a propósito. Hoy no hay ese almacén enlazado.',
      'El hash de la IP se conserva como máximo 24 horas, que es la ventana del límite de mensajes.',
    ],
  },
  {
    id: 'cambios',
    titulo: 'Cambios a este aviso',
    parrafos: [
      'Los cambios se publicarán en esta misma página, que es el procedimiento previsto por el artículo 15, fracción VI. La fecha visible al inicio se actualizará. Si el cambio exige un nuevo consentimiento —por ejemplo, una finalidad distinta—, no se aplicará a los datos ya recabados hasta obtenerlo, conforme al artículo 11.',
      'Si un dato no se obtuvo directamente de la persona y hubiera que informarle un cambio, se observará el artículo 17. No es el caso previsto para el chat, cuyo mensaje lo escribe la propia persona.',
    ],
  },
  {
    id: 'autoridad',
    titulo: 'Autoridad y quejas',
    parrafos: [
      'La ley vigente encomienda a la Secretaría Anticorrupción y Buen Gobierno difundir y vigilar la protección de datos personales en posesión de los particulares. Además de los derechos ARCO ante el responsable, la persona puede acudir a esa Secretaría en los términos de los artículos 38 y siguientes.',
      'Este borrador no es asesoría legal para otras personas ni un modelo para copiarlo. Cada responsable tiene que informar su propio tratamiento.',
    ],
  },
];
