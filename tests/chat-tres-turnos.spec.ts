import { expect, test, type Page, type Route } from '@playwright/test';

// Conversación de 3 turnos con el chat activo. No toca la red real:
// - el HTML se sirve con data-chat-activo="1" y la clave de prueba de Turnstile;
// - api.js de Turnstile se sustituye por un doble que imita al real: execute()
//   sobre un widget ya resuelto vuelve a entregar EL MISMO token hasta reset();
// - /api/chat valida cada token una sola vez (como Siteverify) y AVRA "responde"
//   por /events. Todos los textos van marcados PRUEBA.

const CLAVE_PRUEBA = '1x00000000000000000000AA';
const CONVERSACION = '11111111-1111-4111-8111-111111111111';

const TURNSTILE_FALSO = `
(() => {
  let emitidos = 0;
  let actual = null;
  window.turnstile = {
    render() { return 'w-prueba'; },
    execute(_id, opciones) {
      setTimeout(() => {
        if (!actual) { emitidos += 1; actual = 'PRUEBA-token-' + emitidos; }
        opciones.callback(actual);
      }, 30);
    },
    reset() { actual = null; },
    getResponse() { return actual ?? undefined; },
  };
})();
`;

async function prepararChat(page: Page, opciones: { rechazarPrimero?: boolean } = {}) {
  const tokens: string[] = [];
  const usados = new Set<string>();
  const respuestas: { messageId: string; text: string }[] = [];
  let rechazos = opciones.rechazarPrimero ? 1 : 0;

  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_FALSO }),
  );
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      const original = await route.fetch();
      const html = (await original.text())
        .replace('data-chat-activo="0"', 'data-chat-activo="1"')
        .replace('data-turnstile-site-key=""', `data-turnstile-site-key="${CLAVE_PRUEBA}"`);
      await route.fulfill({ response: original, body: html });
    },
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/chat'),
    async (route: Route) => {
      const pedido = route.request();
      if (pedido.method() === 'POST' && new URL(pedido.url()).pathname === '/api/chat') {
        const cuerpo = pedido.postDataJSON() as { message: string; turnstileToken: string };
        tokens.push(cuerpo.turnstileToken);
        if (usados.has(cuerpo.turnstileToken) || rechazos > 0) {
          rechazos = Math.max(0, rechazos - 1);
          usados.add(cuerpo.turnstileToken);
          await route.fulfill({ status: 403, json: { status: 'verificacion' } });
          return;
        }
        usados.add(cuerpo.turnstileToken);
        const messageId = `00000000-0000-4000-8000-00000000000${respuestas.length + 1}`;
        respuestas.push({ messageId, text: `PRUEBA respuesta ${respuestas.length + 1}` });
        await route.fulfill({ json: { conversationId: CONVERSACION, messageId, status: 'pending' } });
        return;
      }
      if (pedido.method() === 'GET' && pedido.url().endsWith('/events')) {
        await route.fulfill({
          json: {
            conversationId: CONVERSACION,
            status: 'listo',
            messages: respuestas.map((r) => ({ role: 'assistant', replyTo: r.messageId, text: r.text })),
          },
        });
        return;
      }
      await route.fulfill({ status: 404, json: { status: 'no-encontrado' } });
    },
  );
  return { tokens };
}

async function enviar(page: Page, texto: string) {
  await page.locator('#mensaje').fill(texto);
  await page.locator('#mensaje').press('Enter');
}

test('tres turnos seguidos usan un token de Turnstile distinto cada vez', async ({ page }) => {
  test.setTimeout(60_000);
  const { tokens } = await prepararChat(page);
  await page.goto('/');
  for (let turno = 1; turno <= 3; turno += 1) {
    await enviar(page, `PRUEBA turno ${turno}`);
    await expect(page.locator('.mensaje-assistant')).toHaveCount(turno, { timeout: 15_000 });
    await expect(page.locator('.mensaje-assistant').nth(turno - 1)).toHaveText(`PRUEBA respuesta ${turno}`);
  }
  await expect(page.locator('.mensaje-error')).toHaveCount(0);
  expect(tokens).toHaveLength(3);
  expect(new Set(tokens).size).toBe(3);
});

test('si el servidor rechaza el token, pide uno nuevo y reintenta una sola vez', async ({ page }) => {
  const { tokens } = await prepararChat(page, { rechazarPrimero: true });
  await page.goto('/');
  await enviar(page, 'PRUEBA token vencido');
  await expect(page.locator('.mensaje-assistant')).toHaveText('PRUEBA respuesta 1', { timeout: 15_000 });
  await expect(page.locator('.mensaje-error')).toHaveCount(0);
  expect(tokens).toHaveLength(2);
  expect(tokens[0]).not.toBe(tokens[1]);
});
