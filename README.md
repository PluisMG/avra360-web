# AVRA 360

Pantalla conversacional de vista previa. El sitio público es `/`, `/aviso-de-privacidad` y el 404. El chat habla con **AVRA**, un agente de Grok Bot. Las instrucciones de AVRA viven en su perfil: este repositorio no trae prompt de sistema ni personalidad.

No despliega, no toca DNS y no publica. El paquete para subir con la API de Cloudflare queda en el Agent Store: `worker.mjs`, `worker-config.json` y `dist.tar.gz` (compilado con `PREVIEW=1`).

## Desarrollo

```bash
npm run build
npm test
npm run test:e2e
npm run preview
```

`npm run build` deja el sitio en `dist/`. El cliente del chat lo empaqueta Astro en `/_astro/` con hash en el nombre. El HTML sale con `no-cache`; los archivos con hash, con caché larga. Inter se autoaloja en woff2, subset latino, con `font-display: swap`. No hay Google Fonts en tiempo de ejecución.

## Chat

`POST /api/chat` responde `{ status: "configurando" }` con 503 salvo que se cumplan todas estas condiciones:

| Nombre | Dónde | Valor para encender el chat |
| --- | --- | --- |
| `CHAT_ACTIVO` | variable | exactamente `"1"` |
| `PUBLIC_TURNSTILE_SITE_KEY` | variable | site key pública de Turnstile |
| `AVRA_WEBHOOK_URL` | secret | URL `https` del webhook de routine |
| `AVRA_WEBHOOK_KEY` | secret | la misma llave en `Authorization: Bearer` y `X-Automation-Key` |
| `AVRA_REPLY_SIGNING_SECRET` | secret | HMAC del `replyToken` |
| `TURNSTILE_SECRET_KEY` | secret | secret de Siteverify |

El webhook es un POST, cuerpo JSON, timeout de 8 segundos y un solo intento. Responde 200 cuando AVRA despierta y no trae la respuesta. AVRA devuelve `{ replyToken, text }` a `POST /api/chat/reply`. El Durable Object `Conversation` empuja esa respuesta por SSE en `GET /api/chat/:conversationId/stream`. Si el flujo no abre, el navegador vuelve al sondeo de `GET /api/chat/:conversationId/events` (2 segundos y backoff). A los 3 minutos la interfaz dice: «AVRA está tardando más de lo normal». `connect-src` es `'self' https://challenges.cloudflare.com`, que es el origen al que Turnstile se conecta.

Cada mensaje deja una sola línea `chat_tiempo`, al entregarse, con los tiempos finales y las duraciones en milisegundos. `fallback` dice `sin_clave`, `modo`, `error` o `timeout`. `openai_error` lleva el estado HTTP, el código y el modelo. `traspaso_avra` lleva el motivo y el estado HTTP del webhook. En esos logs solo hay identificadores, códigos y milisegundos, sin texto ni datos personales.

El token de Turnstile se pide al enfocar el campo y de nuevo después de cada envío. Cada token se usa una sola vez.

La conversación vive en el Durable Object `Conversation` solo para retransmitir. Una alarma la borra a las 24 horas. La IP no se guarda: `RateLimiter` usa su hash (10 mensajes cada 10 minutos y 40 al día).

## Chat híbrido

`CHAT_MODO` vale `avra` (predeterminado) o `hibrido`. `OPENAI_MODELO` es el modelo; si se deja vacío, el Worker usa `gpt-6-luna` sin razonamiento (`reasoning.effort: none`).

En `hibrido`, y solo si el secret `OPENAI_API_KEY` está cargado en Cloudflare, el Worker responde al visitante con la API Responses y empuja los tokens por el mismo SSE. Pedro carga esa llave en Cloudflare y conviene que ponga un tope de gasto mensual en la cuenta de OpenAI. La llave no va en este repositorio.

Si falta la llave, el modo no es `hibrido`, OpenAI responde con error o el primer token tarda más de 8 segundos, ese mensaje sigue por el webhook de AVRA, sin un aviso de fallo.

`pasar_a_avra` solo se usa si la persona pide una cita o una reunión, o si pide que la contacten o que le envíen una cotización. Preguntas de precio, garantías o salud las responde el modelo, sin cifras y sin prometer curas. Si hay traspaso, el visitante ve esa respuesta y después: «Le paso tu solicitud a nuestro equipo; en unos segundos te confirmo por aquí.» El Worker despierta a AVRA en segundo plano con el resumen. La confirmación entra por el `POST /api/chat/reply` firmado y se empuja al navegador.

El prompt está en `worker/prompt-sistema.txt`. No da precios ni rangos, no promete curas y no pide datos sensibles. El historial que se manda cabe en unos 10 turnos y se borra con la conversación, a las 24 horas. La salida del modelo queda cerca de 300 tokens. Siguen valiendo los límites de 10 mensajes cada 10 minutos y 40 al día por IP.

No hace falta una migración nueva de Durable Objects: `Conversation` y `RateLimiter` siguen en la migración `v1`. Las tablas nuevas se crean con `CREATE TABLE IF NOT EXISTS` dentro del objeto.

Mientras falte algo de la tabla, la caja sigue visible y dice: «El chat con AVRA está en configuración. Muy pronto podrás conversar aquí.» No se simula una respuesta.

## Almacenamiento, apagado

`LeadStore` y `ConversationArchive` tienen adaptadores para D1 y KV. Ninguno está enlazado en `wrangler.jsonc`. `ALMACENAMIENTO_ACTIVO` y `AVISO_APROBADO` solo se encienden con `"1"`. Sin aviso aprobado y sin consentimiento no se persiste nada más allá de la retransmisión. La versión del borrador es `aviso-borrador-2026-10-29`.

Para activarlo más adelante:

1. Sustituir este borrador por el aviso definitivo, sin corchetes, y publicar esa página.
2. Poner `AVISO_APROBADO` en `"1"`.
3. Enlazar D1 o KV y crear las tablas o las claves que esperan `AdaptadorD1` y `AdaptadorKv` en `worker/almacenamiento.ts`.
4. Pedir consentimiento expreso ligado a la versión del aviso.
5. Solo entonces poner `ALMACENAMIENTO_ACTIVO` en `"1"`.

Hoy `POST /api/chat` llama al archivo con consentimiento en falso, así que no escribe.

## Calendario

Este Worker no integra Google Calendar ni guarda credenciales de calendario. Si una conversación necesita una cita, la agenda la hace AVRA desde su perfil.

## Vista previa

Con `PREVIEW=1` (es el valor de `wrangler.jsonc` y del `dist.tar.gz`) todas las respuestas llevan `X-Robots-Tag: noindex, nofollow` y `robots.txt` responde `Disallow: /`. `/aviso-de-privacidad` también lleva `noindex` en el HTML. Los encabezados de seguridad, incluida la CSP y HSTS, salen del Worker también en los 301 y en el 404.

No hay analítica ni cookies de terceros. El único dato en el navegador es `avra360.conversationId` en `localStorage`, y solo después de un chat activo. El aviso de privacidad lo dice.
