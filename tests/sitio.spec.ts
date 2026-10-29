import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const TITULO_1 = 'Las ideas evolucionan.';
const TITULO_2 = 'La creatividad también.';
const LEDE =
  'En AVRA 360 fusionamos creatividad e inteligencia artificial para transformar ideas en experiencias visuales, estrategias de marketing y publicidad que conectan.';
const CIERRE = 'Imagina. Nosotros lo hacemos posible.';
const PLACEHOLDER = '¿Qué te gustaría crear hoy?';
const SUGERENCIAS = ['Crear mi marca', 'Diseñar una campaña', 'Solicitar presupuesto'] as const;
const PIE = '© AVRA 360 — Marketing & Advertising';
const CONFIG = 'El chat con AVRA está en configuración. Muy pronto podrás conversar aquí.';
const BANNER = 'Borrador pendiente de aprobación de Pedro Luis Maldonado Gordillo';
const ETIQUETA = 'Captura de test. Estado en configuración; no es una conversación con AVRA.';

const vistas = [
  { nombre: '1440x900', width: 1440, height: 900 },
  { nombre: '390x844', width: 390, height: 844 },
] as const;

for (const vista of vistas) {
  test.describe(vista.nombre, () => {
    test.use({ viewport: { width: vista.width, height: vista.height } });

    test('muestra los textos exactos y el estado de configuración', async ({ page }) => {
      const errores = vigilar(page);
      await page.goto('/');
      await expect(page.locator('h1')).toContainText(TITULO_1);
      await expect(page.locator('h1')).toContainText(TITULO_2);
      const titulo = await page.locator('h1').innerHTML();
      expect(titulo).toContain(`${TITULO_1}<br`);
      expect(titulo).toContain(TITULO_2);
      await expect(page.locator('.lede')).toHaveText(LEDE);
      await expect(page.locator('.cierre')).toHaveText(CIERRE);
      await expect(page.locator('#mensaje')).toHaveAttribute('placeholder', PLACEHOLDER);
      await expect(page.locator('footer')).toContainText(PIE);
      await expect(page.locator('#nota-config')).toHaveText(CONFIG);
      await expect(page.locator('#mensajes')).toHaveAttribute('aria-live', 'polite');
      await expect(page.locator('.logo')).toHaveText('AVRA 360');
      const html = await page.content();
      expect(html).not.toContain('fonts.googleapis');
      expect(html.toLowerCase()).not.toContain('cookie');
      expect(errores).toEqual([]);
    });

    test('Enter envía, Shift+Enter hace un salto y el botón también envía', async ({ page }) => {
      vigilar(page);
      await page.goto('/');
      await page.locator('#mensaje').focus();
      await page.keyboard.type('Hola');
      await page.keyboard.press('Shift+Enter');
      await page.keyboard.type('otra');
      await expect(page.locator('#mensaje')).toHaveValue('Hola\notra');
      await expect(page.locator('.mensaje-user')).toHaveCount(0);
      await page.locator('#mensaje').fill('Una idea');
      await page.locator('#mensaje').press('Enter');
      await expect(page.locator('.mensaje-user')).toHaveText('Una idea');
      await expect(page.locator('#mensaje')).toHaveValue('');
      await expect(page.locator('#mensaje')).toBeFocused();
      await page.locator('#mensaje').fill('Desde el botón');
      await page.getByRole('button', { name: 'Enviar' }).click();
      await expect(page.locator('.mensaje-user').last()).toHaveText('Desde el botón');
    });

    test('las sugerencias inician la conversación y la caja queda fija', async ({ page }) => {
      vigilar(page);
      for (const texto of SUGERENCIAS) {
        await page.goto('/');
        await page.getByRole('button', { name: texto, exact: true }).click();
        await expect(page.locator('.mensaje-user')).toHaveText(texto);
        await expect(page.locator('body')).toHaveClass(/en-conversacion/);
        const hero = await page.locator('#hero').boundingBox();
        expect((hero?.width ?? 0) <= 1 && (hero?.height ?? 0) <= 1).toBe(true);
        await expect(page.locator('.dock')).toHaveCSS('position', 'fixed');
        const caja = await page.locator('.dock').boundingBox();
        const alto = page.viewportSize()?.height ?? 0;
        expect(caja).not.toBeNull();
        expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeGreaterThan(alto - 8);
        await expect(page.locator('[data-config]')).toHaveText(CONFIG);
      }
    });

    test('el teclado recorre el flujo sin ratón', async ({ page }) => {
      vigilar(page);
      await page.goto('/');
      await page.keyboard.press('Tab');
      await expect(page.locator('.saltar')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('.logo')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#mensaje')).toBeFocused();
      await page.keyboard.type('Tecla');
      await page.keyboard.press('Shift+Enter');
      await page.keyboard.type('dos');
      await expect(page.locator('#mensaje')).toHaveValue('Tecla\ndos');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Enviar' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Crear mi marca' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('.mensaje-user')).toHaveText('Crear mi marca');
      await expect(page.locator('body')).toHaveClass(/en-conversacion/);
    });

    test('axe no reporta violaciones en inicio, conversación, aviso y 404', async ({ page }) => {
      vigilar(page);
      await page.goto('/');
      await sinViolaciones(page);
      await page.getByRole('button', { name: 'Diseñar una campaña' }).click();
      await expect(page.locator('body')).toHaveClass(/en-conversacion/);
      await sinViolaciones(page);
      await page.goto('/aviso-de-privacidad');
      await expect(page.locator('.banner')).toHaveText(BANNER);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.getByText('[Razón social pendiente]').first()).toBeVisible();
      await expect(page.getByText('[Domicilio pendiente]').first()).toBeVisible();
      await expect(page.getByText('[Correo de contacto ARCO pendiente]').first()).toBeVisible();
      await expect(page.getByText(/avra360\.conversationId/).first()).toBeVisible();
      await sinViolaciones(page);
      const respuesta = await page.goto('/ruta-que-no-existe');
      expect(respuesta?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: 'Esta página no existe.' })).toBeVisible();
      await sinViolaciones(page);
    });
  });
}

test('la tipografía es local y la página usa dvh', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(1);
  const preload = await page.locator('link[rel="preload"][as="font"]').getAttribute('href');
  expect(preload).toMatch(/\.woff2/);
  const hojas = await page.locator('link[rel="stylesheet"]').evaluateAll((elementos) =>
    elementos.map((elemento) => elemento.getAttribute('href')).filter((href): href is string => Boolean(href)),
  );
  let css = '';
  for (const href of hojas) css += await (await page.request.get(href)).text();
  expect(css).toMatch(/font-display:\s*swap/);
  expect(css).toContain('woff2');
  expect(css).not.toContain('fonts.googleapis');
  expect(css).toContain('100dvh');
  expect(css).toContain('safe-area-inset-bottom');
  const robots = await page.request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
});

test('respeta prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Solicitar presupuesto' }).click();
  await expect(page.locator('body')).toHaveClass(/en-conversacion/);
  const animacion = await page.locator('.mensaje-user').evaluate((elemento) => getComputedStyle(elemento).animationName);
  expect(animacion).toBe('none');
});

test('capturas de test del inicio y de la conversación', async ({ page }) => {
  await mkdir('/opt/cursor/artifacts', { recursive: true });
  await capturar(page, 1440, 900, 'escritorio-1440-inicio', false);
  await capturar(page, 1440, 900, 'escritorio-1440-conversacion-test', true);
  await capturar(page, 390, 844, 'movil-390-inicio', false);
  await capturar(page, 390, 844, 'movil-390-conversacion-test', true);
});

function vigilar(page: Page) {
  const errores: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => errores.push(error.message));
  return errores;
}

async function sinViolaciones(page: Page) {
  await page.addScriptTag({ content: readFileSync('node_modules/axe-core/axe.min.js', 'utf8') });
  const violaciones = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (nodo: Document) => Promise<{ violations: { id: string; help: string; nodes: { target: unknown[] }[] }[] }> } }).axe;
    const resultado = await axe.run(document);
    return resultado.violations.map((violacion) => ({
      id: violacion.id,
      help: violacion.help,
      target: violacion.nodes.map((nodo) => String(nodo.target)),
    }));
  });
  expect(violaciones).toEqual([]);
}

async function capturar(page: Page, width: number, height: number, nombre: string, conversacion: boolean) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  if (conversacion) {
    await page.getByRole('button', { name: 'Crear mi marca' }).click();
    await expect(page.locator('body')).toHaveClass(/en-conversacion/);
  }
  await page.evaluate((texto) => {
    document.querySelector('[data-captura]')?.remove();
    const barra = document.createElement('p');
    barra.dataset.captura = '1';
    barra.textContent = texto;
    barra.style.cssText = 'margin:0;padding:8px 16px;background:#171717;color:#fff;font:14px/1.4 sans-serif;text-align:center';
    document.body.prepend(barra);
  }, ETIQUETA);
  await page.screenshot({ path: `/opt/cursor/artifacts/${nombre}.png` });
}
