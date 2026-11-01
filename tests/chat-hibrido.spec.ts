import { expect, test, type Page, type Route } from '@playwright/test';

// Tres turnos en modo híbrido, sin red real. El Worker no se llama:
// OpenAI queda simulado del lado del navegador como un SSE con deltas.

const CLAVE_PRUEBA = '1x00000000000000000000AA';
const CONVERSACION = '22222222-2222-4222-8222-222222222222';

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
  const respuestas: { messageId: string; text: string }[] = [];
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
        const messageId = `00000000-0000-4000-8000-00000000000${respuestas.length + 1}`;
        const text = `PRUEBA híbrido ${respuestas.length + 1}`;
        respuestas.push({ messageId, text });
        await route.fulfill({ json: { conversationId: CONVERSACION, messageId, status: 'pending' } });
        return;
      }
      if (pedido.method() === 'GET' && ruta.pathname.endsWith('/stream')) {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8' },
          body: eventosConHistorial(respuestas),
        });
        return;
      }
      await route.fulfill({ status: 404, json: { status: 'no-encontrado' } });
    },
  );
}

const CONFIRMACION = 'PRUEBA confirmación';
const ID_CONFIRMACION = '00000000-0000-4000-8000-000000000099';

function evento(nombre: string, datos: unknown): string {
  return `event: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`;
}

function eventosConHistorial(todos: { messageId: string; text: string }[]): string {
  const ultimo = todos.at(-1);
  if (!ultimo) return '';
  const bloques: string[] = [];
  for (const previo of todos.slice(0, -1)) {
    bloques.push(evento('mensaje', { role: 'assistant', replyTo: previo.messageId, text: previo.text }));
    bloques.push(evento('fin', { messageId: previo.messageId, traspaso: false }));
  }
  if (todos.length > 1) {
    bloques.push(evento('mensaje', { role: 'assistant', replyTo: ID_CONFIRMACION, text: CONFIRMACION }));
  }
  bloques.push(evento('delta', { messageId: ultimo.messageId, text: 'PRUEBA ' }));
  bloques.push(evento('delta', { messageId: ultimo.messageId, text: ultimo.text.slice('PRUEBA '.length) }));
  bloques.push(evento('mensaje', { role: 'assistant', replyTo: ultimo.messageId, text: ultimo.text }));
  bloques.push(evento('fin', { messageId: ultimo.messageId, traspaso: todos.length === 1 }));
  if (todos.length === 1) {
    bloques.push(evento('mensaje', { role: 'assistant', replyTo: ID_CONFIRMACION, text: CONFIRMACION }));
  }
  return bloques.join('');
}

test('tres turnos en hibrido muestran el texto que llega por SSE', async ({ page }) => {
  test.setTimeout(60_000);
  await preparar(page);
  await page.goto('/');
  for (let turno = 1; turno <= 3; turno += 1) {
    await page.locator('#mensaje').fill(`PRUEBA turno ${turno}`);
    await page.locator('#mensaje').press('Enter');
    const esperados = turno + 1;
    await expect(page.locator('.mensaje-assistant')).toHaveCount(esperados, { timeout: 15_000 });
  }
  await expect(page.locator('.mensaje-assistant')).toHaveText([
    'PRUEBA híbrido 1',
    CONFIRMACION,
    'PRUEBA híbrido 2',
    'PRUEBA híbrido 3',
  ]);
  const textos = await page.locator('.mensaje-assistant').allTextContents();
  expect(new Set(textos).size).toBe(textos.length);
  await expect(page.locator('.mensaje-error')).toHaveCount(0);
});
