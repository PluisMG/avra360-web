import { expect, test, type Page, type Route } from '@playwright/test';

const CLAVE_PRUEBA = '1x00000000000000000000AA';
const CONV = '77777777-7777-4777-8777-777777777777';
const LARGO = `PRUEBA línea\n`.repeat(40);

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
      }, 20);
    },
    reset() { actual = null; },
    getResponse() { return actual ?? undefined; },
  };
})();
`;

async function preparar(page: Page) {
  let turno = 0;
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
      const ruta = new URL(pedido.url());
      if (pedido.method() === 'POST' && ruta.pathname === '/api/chat') {
        turno += 1;
        const messageId = `00000000-0000-4000-8000-0000000000d${turno}`;
        await route.fulfill({ json: { conversationId: CONV, messageId, status: 'pending' } });
        return;
      }
      if (pedido.method() === 'GET' && ruta.pathname.endsWith('/stream')) {
        const messageId = `00000000-0000-4000-8000-0000000000d${turno}`;
        const text = `${LARGO}PRUEBA final ${turno}`;
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8' },
          body: [
            `event: delta\ndata: ${JSON.stringify({ messageId, text: 'PRUEBA ' })}\n\n`,
            `event: mensaje\ndata: ${JSON.stringify({ role: 'assistant', replyTo: messageId, text })}\n\n`,
            `event: fin\ndata: ${JSON.stringify({ messageId, traspaso: false })}\n\n`,
          ].join(''),
        });
        return;
      }
      await route.fulfill({ status: 404, json: { status: 'no-encontrado' } });
    },
  );
}

test('en escritorio el hilo baja al mensaje nuevo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await preparar(page);
  await page.goto('/');
  await expect(page.locator('#mensajes')).toHaveAttribute('aria-live', 'polite');
  await page.locator('#mensaje').fill('PRUEBA uno');
  await page.locator('#mensaje').press('Enter');
  await expect(page.locator('.mensaje-assistant')).toContainText('PRUEBA final 1', { timeout: 15_000 });
  await expect
    .poll(async () =>
      page.locator('#hilo').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    )
    .toBeLessThan(80);
  const ultimo = await page.locator('.mensaje-assistant').boundingBox();
  const hilo = await page.locator('#hilo').boundingBox();
  expect(ultimo && hilo && ultimo.y < hilo.y + hilo.height).toBe(true);

  await page.locator('#hilo').evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });
  await page.locator('#mensaje').fill('PRUEBA dos');
  await page.locator('#mensaje').press('Enter');
  await expect(page.locator('.mensaje-assistant').nth(1)).toContainText('PRUEBA final 2', { timeout: 15_000 });
  await expect
    .poll(async () =>
      page.locator('#hilo').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    )
    .toBeLessThan(80);
});
