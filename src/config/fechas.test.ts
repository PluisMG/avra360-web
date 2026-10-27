import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validarFechaEdicion } from './fechas.ts';

describe('fecha del boletín mensual', () => {
  it('acepta cualquier día civil del mes', () => {
    assert.equal(validarFechaEdicion('2026-10-15'), undefined);
    assert.equal(validarFechaEdicion('2026-11-03'), undefined);
    assert.equal(validarFechaEdicion('2026-02-01'), undefined);
  });

  it('rechaza una fecha que no existe', () => {
    assert.equal(validarFechaEdicion('2026-02-31'), 'La fecha no existe en el calendario.');
    assert.match(validarFechaEdicion('15/10/2026') ?? '', /AAAA-MM-DD/);
  });
});
