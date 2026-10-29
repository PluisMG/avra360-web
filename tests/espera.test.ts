import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESPERA_INICIAL_MS, ESPERA_MAX_MS, esperaAgotada, siguienteEspera } from '../src/cliente/estado.ts';

test('a los 3 minutos la espera se agota', () => {
  assert.equal(esperaAgotada(1_000, 1_000 + ESPERA_MAX_MS - 1), false);
  assert.equal(esperaAgotada(1_000, 1_000 + ESPERA_MAX_MS), true);
});

test('el sondeo empieza en 2 s y hace backoff hasta 8 s', () => {
  assert.equal(ESPERA_INICIAL_MS, 2_000);
  assert.equal(siguienteEspera(2_000), 3_000);
  assert.equal(siguienteEspera(8_000), 8_000);
});
