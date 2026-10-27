# MKT Creativa

Sitio estático de MKT Creativa, agencia de marketing y publicidad de Pedro Luis Maldonado Gordillo en Tuxtla Gutiérrez, Chiapas. El contenido está en español de México.

Los textos de marketing son **provisionales**. El posicionamiento definitivo sale del plan estratégico y el equipo creativo los va a pulir. El aviso de privacidad es un **borrador para revisión legal**.

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

`npm run verificar` revisa, sobre `dist/`, que cada página tenga un solo `h1`, título, descripción, Open Graph y JSON-LD, y que los enlaces internos, anclas, teléfono y WhatsApp coincidan con lo construido.

## Dónde se edita el contenido

| Qué | Archivo |
| --- | --- |
| Nombre, teléfono, WhatsApp, ciudad, navegación | `src/config/agencia.ts` |
| Textos de las páginas y mensajes de cada pantalla | `src/config/textos.ts` |
| Borrador del aviso de privacidad | `src/config/aviso.ts` |
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

Cada edición es un Markdown en `src/content/boletin/`. El esquema está en `src/content.config.ts` y el build falla si no se cumple. El boletín sale el día **1** y el día **15**: la fecha del archivo tiene que ser uno de esos días.

### Cómo agregar una edición

1. Cree `src/content/boletin/AAAA-MM-DD.md`. Use el día 1 o el 15. No use el prefijo `ejemplo-`: está reservado para la edición de muestra.
2. Copie este frontmatter y sustituya los textos:

```yaml
---
titulo: "Título de la edición, con al menos doce caracteres"
fecha: "2026-11-01"
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
5. Ejecute `npm run build`. Si falta una nota, la fecha no es 1 o 15, o la descripción se pasa de largo, el build se detiene y dice por qué.

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

La casilla de consentimiento y el enlace al aviso de privacidad están en los dos estados.

## Precios

En `src/config/agencia.ts`, `mostrarPrecios` está en `false`. `/servicios` muestra el bloque de inversión desactivado y sin montos. Para publicarlos, pase el indicador a `true` y llene `precios` con los montos ya aprobados. No deje cifras de ejemplo.

## Analítica

`PUBLIC_GA4_ID` (formato `G-…`) y `PUBLIC_META_PIXEL_ID` (solo dígitos) se leen en el build. El script `public/scripts/consentimiento.js` los inserta **solo** si existen y la persona pulsa «Aceptar analítica». La decisión se guarda en el navegador. «Rechazar» no carga nada. Sin identificadores, aceptar tampoco carga nada.

«Preferencias de cookies», en el pie, vuelve a mostrar la pregunta.

## Aviso de privacidad

`/aviso-de-privacidad` es un borrador alineado a la LFPDPPP publicada en el DOF el 20 de marzo de 2025 (texto con la reforma del 14 de noviembre de 2025). Cubre datos de contacto y suscriptores del boletín. Está marcado como borrador y enlazado en el pie y en el formulario.

Hay que sustituir, como mínimo:

- `[RAZÓN SOCIAL]`
- `[DOMICILIO]`
- `[CORREO DE PRIVACIDAD]`

También están pendientes `[HORARIO]` y `[PROVEEDOR DE HOSPEDAJE]`. No publique el dominio como sitio definitivo hasta la revisión legal.

## SEO

Cada página tiene título y meta descripción propios, un solo `h1`, Open Graph, canónica y JSON-LD `ProfessionalService` con los datos que sí están confirmados: nombre comercial, persona responsable, teléfono, Tuxtla Gutiérrez y Chiapas. No hay calificaciones, reseñas, precios ni domicilio de calle inventados.

El sitemap se genera en el build. La edición de ejemplo no se incluye.

## Datos pendientes

- Razón social, domicilio legal y correo de privacidad
- Horario de atención
- Dominio real (`SITE`)
- URL pública del formulario de MailerLite y nombres de campo, si cambian
- Identificadores de GA4 y del píxel de Meta, si se van a usar
- Precios aprobados
- Textos definitivos del plan estratégico
- Revisión legal del aviso antes de tratarlo como vigente
- Proveedor de hospedaje, para nombrarlo en el aviso
- Métricas reales y, si se quieren publicar, hallazgos del diagnóstico de MentalCareClinic
- URL oficial del sitio de la clínica, si se va a enlazar
- Retirar la edición de ejemplo cuando existan ediciones reales
