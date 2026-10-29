import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function lineal(canal: number) {
  const c = canal / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
}

function contraste(a: string, b: string) {
  const clara = Math.max(luminancia(a), luminancia(b));
  const oscura = Math.min(luminancia(a), luminancia(b));
  return (clara + 0.05) / (oscura + 0.05);
}

describe('acento', () => {
  const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');
  const token = (nombre: string) => {
    const hallado = css.match(new RegExp(`${nombre}:\\s*(#[0-9a-fA-F]{3,8})`));
    assert.ok(hallado, nombre);
    return hallado[1].toLowerCase();
  };

  it('vive solo en los dos tokens y pasa AA sobre blanco y sobre #F5F5F5', () => {
    assert.equal(token('--acento'), '#3133fc');
    assert.equal(token('--acento-hover'), '#2c2ed3');
    assert.equal(token('--tinta'), '#171717');
    assert.equal(css.toLowerCase().includes('#4375fd'), false);
    assert.equal(css.toLowerCase().includes('#3a4cfc'), false);
    for (const fondo of ['#ffffff', '#f5f5f5']) {
      assert.ok(contraste('#3133fc', fondo) >= 4.5, fondo);
      assert.ok(contraste('#2c2ed3', fondo) >= 4.5, fondo);
    }
    assert.ok(contraste('#ffffff', '#3133fc') >= 4.5);
    assert.ok(contraste('#ffffff', '#171717') >= 4.5);
    assert.ok(contraste('#737373', '#ffffff') >= 4.5);
    assert.ok(contraste('#737373', '#f5f5f5') < 4.5);
  });
});
