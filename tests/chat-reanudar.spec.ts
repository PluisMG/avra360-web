import { expect, test, type Page, type Route } from '@playwright/test';

const CLAVE_PRUEBA = '1x00000000000000000000AA';
const VIEJA = '33333333-3333-4333-8333-333333333333';
const NUEVA = '44444444-4444-4444-8444-444444444444';
const MENSAJE = '00000000-0000-4000-8000-000000000010';

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
  const cuerpos: { conversationId?: string; message: string }[] = [];
  await page.addInitScript((id) => {
    localStorage.setItem('avra360.conversationId', id);
  }, VIEJA);
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
        const cuerpo = pedido.postDataJSON() as { conversationId?: string; message: string };
        cuerpos.push(cuerpo);
        if (cuerpo.conversationId === VIEJA) {
          await route.fulfill({ status: 404, json: { status: 'no-encontrado' } });
          return;
        }
        await route.fulfill({ json: { conversationId: NUEVA, messageId: MENSAJE, status: 'pending' } });
        return;
      }
      if (pedido.method() === 'GET' && ruta.pathname.endsWith('/events')) {
        await route.fulfill({ json: { conversationId: VIEJA, status: 'listo', messages: [] } });
        return;
      }
      if (pedido.method() === 'GET' && ruta.pathname.endsWith('/stream')) {
        const cuerpo = [
          `event: mensaje\ndata: ${JSON.stringify({ role: 'assistant', replyTo: MENSAJE, text: 'PRUEBA conversación nueva' })}\n\n`,
          `event: fin\ndata: ${JSON.stringify({ messageId: MENSAJE, traspaso: false })}\n\n`,
        ].join('');
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8' },
          body: cuerpo,
        });
        return;
      }
      await route.fulfill({ status: 404, json: { status: 'no-encontrado' } });
    },
  );
  return cuerpos;
}

test('si el servidor ya borró la conversación, olvida el id y reenvía una vez', async ({ page }) => {
  const cuerpos = await preparar(page);
  await page.goto('/');
  await page.locator('#mensaje').fill('PRUEBA retomar');
  await page.locator('#mensaje').press('Enter');
  await expect(page.locator('.mensaje-assistant')).toHaveText('PRUEBA conversación nueva', { timeout: 15_000 });
  await expect(page.locator('.mensaje-error')).toHaveCount(0);
  await expect(page.locator('.mensaje-user')).toHaveCount(1);
  expect(cuerpos).toHaveLength(2);
  expect(cuerpos[0]?.conversationId).toBe(VIEJA);
  expect(cuerpos[1]?.conversationId).toBeUndefined();
  expect(cuerpos[1]?.message).toBe('PRUEBA retomar');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('avra360.conversationId'))).toBe(NUEVA);
});
