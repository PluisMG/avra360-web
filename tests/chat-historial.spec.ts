import { expect, test, type Page, type Route } from '@playwright/test';

// Conversación ya guardada, con dos respuestas de una visita anterior.
// Cada envío nuevo reenvía ese historial en el SSE, como haría un búfer viejo.

const CLAVE_PRUEBA = '1x00000000000000000000AA';
const CONV = '55555555-5555-4555-8555-555555555555';
const PREVIOS = [
  { messageId: '00000000-0000-4000-8000-0000000000a1', text: 'PRUEBA respuesta previa 1' },
  { messageId: '00000000-0000-4000-8000-0000000000a2', text: 'PRUEBA respuesta previa 2' },
];

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
  const nuevas: { messageId: string; text: string }[] = [];
  await page.addInitScript((id) => {
    localStorage.setItem('avra360.conversationId', id);
  }, CONV);
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
      if (pedido.method() === 'GET' && ruta.pathname.endsWith('/events')) {
        await route.fulfill({
          json: {
            conversationId: CONV,
            status: 'listo',
            messages: PREVIOS.flatMap((previo, indice) => [
              { id: `10000000-0000-4000-8000-00000000000${indice + 1}`, role: 'user', text: `PRUEBA previa ${indice + 1}`, replyTo: null },
              { id: `20000000-0000-4000-8000-00000000000${indice + 1}`, role: 'assistant', text: previo.text, replyTo: previo.messageId },
            ]),
          },
        });
        return;
      }
      if (pedido.method() === 'POST' && ruta.pathname === '/api/chat') {
        const messageId = `00000000-0000-4000-8000-0000000000b${nuevas.length + 1}`;
        const text = `PRUEBA respuesta nueva ${nuevas.length + 1}`;
        nuevas.push({ messageId, text });
        await route.fulfill({ json: { conversationId: CONV, messageId, status: 'pending' } });
        return;
      }
      if (pedido.method() === 'GET' && ruta.pathname.endsWith('/stream')) {
        const ultimo = nuevas.at(-1);
        const bloques = [
          ...PREVIOS.flatMap((previo) => [
            evento('mensaje', { role: 'assistant', replyTo: previo.messageId, text: previo.text }),
            evento('fin', { messageId: previo.messageId, traspaso: false }),
          ]),
        ];
        if (ultimo) {
          bloques.push(evento('delta', { messageId: ultimo.messageId, text: ultimo.text }));
          bloques.push(evento('mensaje', { role: 'assistant', replyTo: ultimo.messageId, text: ultimo.text }));
          bloques.push(evento('fin', { messageId: ultimo.messageId, traspaso: false }));
        }
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8' },
          body: bloques.join(''),
        });
        return;
      }
      await route.fulfill({ status: 404, json: { status: 'no-encontrado' } });
    },
  );
}

test('una conversación guardada no repite las respuestas al enviar', async ({ page }) => {
  test.setTimeout(60_000);
  await preparar(page);
  await page.goto('/');
  await expect(page.locator('.mensaje-assistant')).toHaveText(
    ['PRUEBA respuesta previa 1', 'PRUEBA respuesta previa 2'],
    { timeout: 15_000 },
  );
  for (let turno = 1; turno <= 2; turno += 1) {
    await page.locator('#mensaje').fill(`PRUEBA turno ${turno}`);
    await page.locator('#mensaje').press('Enter');
    await expect(page.locator('.mensaje-assistant')).toHaveCount(2 + turno, { timeout: 15_000 });
  }
  const textos = await page.locator('.mensaje-assistant').allTextContents();
  expect(textos).toEqual([
    'PRUEBA respuesta previa 1',
    'PRUEBA respuesta previa 2',
    'PRUEBA respuesta nueva 1',
    'PRUEBA respuesta nueva 2',
  ]);
  expect(new Set(textos).size).toBe(textos.length);
  await expect(page.locator('.mensaje-error')).toHaveCount(0);
});
