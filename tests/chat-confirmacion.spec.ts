import { expect, test, type Page, type Route } from '@playwright/test';

const CLAVE_PRUEBA = '1x00000000000000000000AA';
const CONV = '66666666-6666-4666-8666-666666666666';
const MENSAJE = '00000000-0000-4000-8000-0000000000c1';
const AVRA = '00000000-0000-4000-8000-0000000000c2';
const AVISO = 'Anoté el martes a las 11:00.\nLe paso tu solicitud a nuestro equipo; en unos segundos te confirmo por aquí.';
const CONFIRMACION = 'PRUEBA cita confirmada';

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

function evento(nombre: string, datos: unknown): string {
  return `event: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`;
}

async function preparar(page: Page) {
  let traspasoEn = 0;
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
        await route.fulfill({ json: { conversationId: CONV, messageId: MENSAJE, status: 'pending' } });
        return;
      }
      if (pedido.method() === 'GET' && ruta.pathname.endsWith('/stream')) {
        if (!traspasoEn) traspasoEn = Date.now();
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8' },
          body: [
            evento('mensaje', { role: 'assistant', replyTo: MENSAJE, text: AVISO }),
            evento('fin', { messageId: MENSAJE, traspaso: true }),
          ].join(''),
        });
        return;
      }
      if (pedido.method() === 'GET' && ruta.pathname.endsWith('/events')) {
        const lista: { role: string; replyTo: string; text: string }[] = [
          { role: 'assistant', replyTo: MENSAJE, text: AVISO },
        ];
        if (traspasoEn && Date.now() - traspasoEn >= 20_000) {
          lista.push({ role: 'assistant', replyTo: AVRA, text: CONFIRMACION });
        }
        await route.fulfill({
          json: { conversationId: CONV, status: 'listo', messages: lista },
        });
        return;
      }
      await route.fulfill({ status: 404, json: { status: 'no-encontrado' } });
    },
  );
}

test('la confirmación del traspaso llega sin recargar, aunque tarde 20 s', async ({ page }) => {
  test.setTimeout(50_000);
  await preparar(page);
  await page.goto('/');
  await page.locator('#mensaje').fill('PRUEBA quiero una cita el martes a las 11');
  await page.locator('#mensaje').press('Enter');
  await expect(page.locator('.mensaje-assistant')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('.mensaje-assistant')).toContainText('martes a las 11:00');
  await expect(page.locator('#escribiendo')).toBeVisible();
  await expect(page.locator('.mensaje-assistant').nth(1)).toHaveText(CONFIRMACION, { timeout: 40_000 });
  await expect(page.locator('#escribiendo')).toHaveCount(0);
  await expect(page.locator('.mensaje-error')).toHaveCount(0);
  await expect(page.locator('.mensaje-assistant')).toHaveCount(2);
});
