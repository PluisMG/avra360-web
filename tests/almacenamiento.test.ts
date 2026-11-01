import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AVISO_VERSION } from '../worker/constantes.ts';
import { intentarArchivar, type BaseDeDatos } from '../worker/almacenamiento.ts';

test('sin aviso aprobado no se persiste aunque haya consentimiento y bandera', async () => {
  const resultado = await intentarArchivar(
    { ALMACENAMIENTO_ACTIVO: '1', AVISO_APROBADO: '0', DB: baseFalsa() },
    { consentimiento: true, conversationId: 'abc' },
  );
  assert.deepEqual(resultado, { persistido: false, motivo: 'aviso-no-aprobado' });
});

test('con aviso aprobado pero almacenamiento apagado no se persiste', async () => {
  const resultado = await intentarArchivar(
    { ALMACENAMIENTO_ACTIVO: '0', AVISO_APROBADO: '1' },
    { consentimiento: true, conversationId: 'abc' },
  );
  assert.equal(resultado.persistido, false);
  assert.equal(resultado.motivo, 'apagado');
});

test('sin consentimiento no se persiste', async () => {
  const resultado = await intentarArchivar(
    { ALMACENAMIENTO_ACTIVO: '1', AVISO_APROBADO: '1', DB: baseFalsa() },
    { consentimiento: false, conversationId: 'abc' },
  );
  assert.equal(resultado.motivo, 'sin-consentimiento');
});

test('si las banderas están encendidas y no hay binding, no se persiste', async () => {
  const resultado = await intentarArchivar(
    { ALMACENAMIENTO_ACTIVO: '1', AVISO_APROBADO: '1' },
    { consentimiento: true, conversationId: 'abc' },
  );
  assert.equal(resultado.motivo, 'no-enlazado');
});

test('el adaptador de D1 solo escribe con consentimiento, aviso y binding', async () => {
  const llamadas: { sql: string; valores: unknown[] }[] = [];
  const db: BaseDeDatos = {
    prepare(sql) {
      return {
        bind(...valores) {
          return {
            async run() {
              llamadas.push({ sql, valores });
            },
          };
        },
      };
    },
  };
  const resultado = await intentarArchivar(
    { ALMACENAMIENTO_ACTIVO: '1', AVISO_APROBADO: '1', DB: db },
    { consentimiento: true, conversationId: 'conv-1', ahora: new Date('2026-10-29T12:00:00.000Z') },
  );
  assert.equal(resultado.motivo, 'archivado');
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0]?.sql ?? '', /INSERT INTO conversaciones/);
  assert.equal(llamadas[0]?.valores[0], 'conv-1');
  assert.equal(llamadas[0]?.valores[1], AVISO_VERSION);
});

function baseFalsa(): BaseDeDatos {
  return {
    prepare() {
      return { bind: () => ({ run: async () => { throw new Error('no debía escribir'); } }) };
    },
  };
}
