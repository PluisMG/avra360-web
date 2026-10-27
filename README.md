# MKT Creativa

Sitio estático de MKT Creativa, agencia de marketing y publicidad de Pedro Luis Maldonado Gordillo en Tuxtla Gutiérrez, Chiapas. El contenido está en español de México.

Los textos de marketing son los de Creativo, del 26 de octubre de 2026. El aviso de privacidad sigue como borrador en el repositorio y **no entra al build** hasta tener los datos de Pedro y la revisión legal.

## Requisitos

- Node.js 22.23.4 o superior
- npm

## Desarrollo y build

```bash
npm install
npm run dev
npm run build
npm run preview
npm run check
npm run verificar
```

`npm run build` genera la carpeta `dist/`, lista para un hospedaje estático. No despliega nada y no toca DNS.

`npm run verificar` revisa, sobre `dist/`, que cada página tenga un solo `h1`, título, descripción, Open Graph y JSON-LD, y que los enlaces internos, anclas, teléfono y WhatsApp coincidan con lo construido. También falla si el HTML público contiene un marcador (`[Pendiente`, `[RAZÓN`, `[DOMICILIO`, `[CORREO`), `POR CONFIRMAR`, `{{` o `PROVISIONAL`. El propio `npm run build` se detiene con la misma revisión.

## Dónde se edita el contenido

| Qué | Archivo |
| --- | --- |
| Nombre, teléfono, WhatsApp, ciudad, navegación | `src/config/agencia.ts` |
| Textos de las páginas y mensajes de cada pantalla | `src/config/textos.ts` |
| Borrador del aviso de privacidad (fuera del build) | `src/config/aviso.ts` y `src/borradores/aviso-de-privacidad.astro` |
| Ediciones del boletín | `src/content/boletin/*.md` |
| Precios (apagados) | `mostrarPrecios` y `precios` en `src/config/agencia.ts` |

No invente clientes, logotipos de terceros, cifras, testimonios ni datos de pacientes. El repositorio es público: no suba claves, tokens ni identificadores privados.

## Cloudflare Pages

Cuando se decida publicar, el proyecto estático se puede conectar a Cloudflare Pages con:

- Comando de build: `npm run build`
- Directorio de salida: `dist`
- Node.js 22

El build escribe `dist/_headers` (seguridad y caché de assets). No hay `_redirects`: todavía no hay dominio que redirigir y no se debe forzar uno desde este repositorio.

Variables útiles en el panel, ninguna de ellas es secreta:

- `SITE` — URL canónica https del dominio propio. Si no se define, el build usa `https://mktcreativa.example`, un marcador que no debe quedarse en producción.
- `PREVIEW` — `1` para un build de vista previa.
- `PUBLIC_MOSTRAR_EDICION_EJEMPLO`
- `PUBLIC_MAILERLITE_FORM_ACTION` y, si hace falta, los nombres de campo.
- `PUBLIC_GA4_ID`
- `PUBLIC_META_PIXEL_ID`

No cree una variable pública para la API key de MailerLite. El sitio no la usa y no debe estar en el cliente.

## Vista previa

Con `PREVIEW=1 npm run build`:

- cada página lleva `<meta name="robots" content="noindex, nofollow">`
- `robots.txt` queda en `Disallow: /` y no publica el sitemap

Sirve para un enlace de revisión. No use ese build como sitio indexable.

## Boletín

Cada edición es un Markdown en `src/content/boletin/`. El esquema está en `src/content.config.ts` y el build falla si no se cumple. El boletín se publica **una vez al mes**. La fecha puede ser cualquier día civil válido, en formato `AAAA-MM-DD`.

### Cómo agregar una edición

1. Cree `src/content/boletin/AAAA-MM-DD.md`. Use cualquier día del mes. No use el prefijo `ejemplo-`: está reservado para la edición de muestra.
2. Copie este frontmatter y sustituya los textos:

```yaml
---
titulo: "Título de la edición, con al menos doce caracteres"
fecha: "2026-11-03"
tema: "Tema principal de la edición"
descripcion: "Resumen de 50 a 160 caracteres para la ficha, el RSS y la meta descripción."
ejemplo: false
notas:
  - titulo: "Primera nota"
    texto: "Texto breve de la nota, de al menos cuarenta caracteres, sin cifras inventadas."
  - titulo: "Segunda nota"
    texto: "Otra nota breve. Puede haber una tercera, no más."
llamado:
  texto: "Una sola acción concreta para quien termina de leer."
  enlace: /contacto
  etiqueta: Escribir a la agencia
---
```

3. Debajo del frontmatter puede ir el cuerpo en Markdown. No use un `h1`: la página ya lo pone con el título. Empiece en `h2` si necesita subtítulos.
4. `enlace` del llamado es una ruta del sitio (`/contacto`) o una URL `https`.
5. Ejecute `npm run build`. Si falta una nota, la fecha no existe o la descripción se pasa de largo, el build se detiene y dice por qué.

La portada del boletín lista las ediciones por fecha, de la más nueva a la más antigua. Cada una vive en `/boletin/[slug]`. El RSS está en `/boletin/rss.xml`.

### Edición de ejemplo

`src/content/boletin/ejemplo-2026-10-15.md` está marcada con `ejemplo: true` y en la página se ve como ejemplo. No es una edición publicada.

- Sin variable, `npm run dev` la muestra y `npm run build` la omite.
- `PUBLIC_MOSTRAR_EDICION_EJEMPLO=1` la incluye también en el build.
- `PUBLIC_MOSTRAR_EDICION_EJEMPLO=0` la oculta incluso en desarrollo.

Aunque se muestre, esa página lleva `noindex` y no entra al sitemap. Quítela del repositorio cuando ya no haga falta como muestra.

## Suscripción a MailerLite

El formulario del boletín (en `/boletin` y en el pie) está listo, pero la cuenta todavía no existe.

- Ponga en `PUBLIC_MAILERLITE_FORM_ACTION` la URL **pública** de acción del formulario embebido.
- Si los campos no se llaman `fields[email]` y `fields[name]`, defina `PUBLIC_MAILERLITE_EMAIL_FIELD` y `PUBLIC_MAILERLITE_NAME_FIELD`.
- Si el formulario de MailerLite tiene un campo para guardar el consentimiento, ponga su nombre en `PUBLIC_MAILERLITE_CONSENT_FIELD`. Si no, la casilla igual es obligatoria en el navegador y no se envía con un nombre inventado.
- Sin una URL https válida, el formulario se muestra desactivado, con un mensaje claro, y el botón no envía nada.
- Con URL válida, el build añade su origen (el host real, por ejemplo `https://assets.mailerlite.com`) a `form-action` de la CSP. Sin URL, `form-action` queda en `'self'`. El envío es un POST del formulario, así que no hace falta abrir `connect-src`.
- Si la URL trae un parámetro `api_key`, `token`, `secret` o `password`, el formulario también se queda desactivado.
- Aunque la URL sea válida, el formulario sigue desactivado mientras `avisoPublico` sea `false` en `src/config/publicacion.ts`. Hoy lo es: falta el aviso de privacidad. El estado desactivado no enlaza a esa página.

Cuando el aviso pueda publicarse, el formulario activo usa la casilla de consentimiento y el enlace «Leer el aviso de privacidad».

## Precios

En `src/config/agencia.ts`, `mostrarPrecios` está en `false`. `/servicios` muestra el bloque de inversión desactivado y sin montos. Para publicarlos, pase el indicador a `true` y llene `precios` con los montos ya aprobados. No deje cifras de ejemplo.

## Analítica

`PUBLIC_GA4_ID` (formato `G-…`) y `PUBLIC_META_PIXEL_ID` (solo dígitos) se leen en el build. El script `public/scripts/consentimiento.js` los inserta **solo** si existen y la persona pulsa «Aceptar analítica». La decisión se guarda en el navegador. «Rechazar» no carga nada. Sin identificadores, aceptar tampoco carga nada.

«Preferencias de cookies», en el pie, vuelve a mostrar la pregunta.

## Aviso de privacidad

El borrador sigue en el repositorio (`src/config/aviso.ts` y `src/borradores/aviso-de-privacidad.astro`), alineado a la LFPDPPP publicada en el DOF el 20 de marzo de 2025 (texto con la reforma del 14 de noviembre de 2025). **No se genera** `/aviso-de-privacidad`, no entra al sitemap y ninguna página pública lo enlaza.

Para volver a publicarlo hacen falta la razón social, el domicilio, el correo de privacidad, el horario, el proveedor de hospedaje y la revisión legal. Hasta entonces el formulario del boletín permanece desactivado. No deje marcadores en el HTML.

## SEO

Cada página tiene título y meta descripción propios, un solo `h1`, Open Graph, canónica y JSON-LD `ProfessionalService` con los datos que sí están confirmados: nombre comercial, persona responsable, teléfono, Tuxtla Gutiérrez y Chiapas. No hay calificaciones, reseñas, precios ni domicilio de calle inventados.

El sitemap se genera en el build. La edición de ejemplo no se incluye.

## Datos pendientes

Estos datos no aparecen en el sitio. No hay marcadores en su lugar:

- Razón social, domicilio legal y correos (privacidad y agencia)
- Horario de atención
- Si el diagnóstico de entrada es sin costo o de pago
- Métricas del caso, cuando exista una medición con fecha. Los indicadores previstos son: visitas orgánicas al sitio nuevo, conversaciones de WhatsApp iniciadas desde el sitio, presencia en búsquedas locales de Tuxtla Gutiérrez y tiempo de carga medido del sitio nuevo
- Hallazgos del diagnóstico de MentalCareClinic, fecha y dirección del sitio nuevo, y estado de su ficha de Google, si Pedro autoriza publicarlos
- Condiciones del piloto y testimonio de la dirección, solo con autorización
- Dominio real (`SITE`)
- URL pública del formulario de MailerLite y nombres de campo, si cambian
- Identificadores de GA4 y del píxel de Meta, si se van a usar
- Precios aprobados
- Revisión legal del aviso antes de tratarlo como vigente
- Proveedor de hospedaje, para nombrarlo en el aviso
- URL oficial del sitio de la clínica, si se va a enlazar
- Retirar la edición de ejemplo cuando existan ediciones reales
