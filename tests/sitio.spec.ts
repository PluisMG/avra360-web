import { expect, test } from '@playwright/test';

for (const ancho of [1024, 1366]) {
  test(`el menú y el WhatsApp de la cabecera se pueden usar a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 768 });
    await page.goto('/');

    const nav = page.locator('nav.enlaces--escritorio');
    await expect(nav).toBeVisible();
    await expect(page.locator('details.menu')).toBeHidden();

    for (const nombre of ['Inicio', 'Guías COFEPRIS', 'Caso', 'Boletín', 'Nosotros', 'Contacto']) {
      const enlace = nav.getByRole('link', { name: nombre, exact: true });
      await expect(enlace).toBeVisible();
      await enlace.click({ trial: true });
    }

    const servicios = nav.locator('summary', { hasText: 'Servicios' });
    await expect(servicios).toBeVisible();
    await servicios.click();
    await expect(nav.getByRole('link', { name: 'Páginas web' })).toBeVisible();

    const whatsapp = page.locator('a.boton--cabecera');
    await expect(whatsapp).toBeVisible();
    await whatsapp.click({ trial: true });

    const banner = page.locator('#consentimiento');
    await expect(banner).toBeVisible();
    await expect(banner).toBeInViewport();

    const cajaBanner = await banner.boundingBox();
    const cajaTitulo = await page.getByRole('heading', { level: 1 }).boundingBox();
    const cajaWhatsapp = await whatsapp.boundingBox();
    expect(cajaBanner).not.toBeNull();
    expect(cajaTitulo).not.toBeNull();
    expect(cajaWhatsapp).not.toBeNull();
    expect(cajaTitulo!.y + cajaTitulo!.height).toBeLessThanOrEqual(cajaBanner!.y + 1);
    expect(cajaWhatsapp!.y + cajaWhatsapp!.height).toBeLessThanOrEqual(cajaBanner!.y + 1);

    await nav.getByRole('link', { name: 'Todos los servicios', exact: true }).click();
    await expect(page).toHaveURL(/\/servicios$/);
    await expect(page.locator('#sitio-web')).toBeVisible();
    await expect(page.locator('#seo-local')).toBeVisible();
    await expect(page.locator('#contenido-cofepris')).toBeVisible();

    await page.goto('/');
    const principal = page.locator('#contenido');
    await expect(principal.locator('a[href="/servicios/paginas-web-para-medicos"]')).toBeVisible();
    await expect(principal.locator('a[href="/servicios/seo-local-google-maps"]')).toBeVisible();
    await expect(principal.locator('a[href="/servicios/publicidad-medica-cofepris"]')).toBeVisible();
    await expect(principal.locator('a[href="/servicios#estrategia"]')).toBeVisible();
    await expect(principal.locator('a[href="/servicios#sitio-web"]')).toHaveCount(0);
    await page.locator('nav.enlaces--escritorio').getByRole('link', { name: 'Contacto', exact: true }).click();
    await expect(page).toHaveURL(/\/contacto$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

test('el campo oculto bloquea el envío si viene lleno', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/contacto');

  const campo = page.locator('input[name="empresa_web"]');
  await expect(campo).toHaveAttribute('tabindex', '-1');
  await expect(campo).toHaveAttribute('autocomplete', 'off');
  await expect(page.locator('.trampa')).toHaveAttribute('aria-hidden', 'true');

  const caja = await campo.boundingBox();
  expect(caja).not.toBeNull();
  expect(caja!.x + caja!.width).toBeLessThan(0);

  const bloqueado = await page.evaluate(() => {
    const form = document.querySelector('form');
    const input = form?.querySelector('input[name="empresa_web"]');
    if (!form || !(input instanceof HTMLInputElement)) return false;
    input.value = 'http://spam.test';
    const evento = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(evento);
    return evento.defaultPrevented;
  });
  expect(bloqueado).toBe(true);
});
