import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mensajesWhatsapp } from './agencia.ts';
import { fragmentoProhibido } from './publicacion.ts';
import {
  boletin,
  caso,
  contacto,
  errorPagina,
  formularioBoletinTextos,
  inicio,
  jsonLdDescripcion,
  pie,
  seo,
  servicios,
} from './textos.ts';

function recoger(valor: unknown, salida: string[] = []) {
  if (typeof valor === 'string') salida.push(valor);
  else if (Array.isArray(valor)) for (const item of valor) recoger(item, salida);
  else if (valor && typeof valor === 'object') for (const item of Object.values(valor)) recoger(item, salida);
  return salida;
}

describe('textos que sí se publican', () => {
  it('no incluyen marcadores ni la marca de provisional', () => {
    const piezas = recoger({
      seo,
      inicio,
      servicios,
      caso,
      boletin,
      contacto,
      errorPagina,
      formularioBoletinTextos,
      pie,
      mensajesWhatsapp,
      jsonLdDescripcion,
    });
    for (const pieza of piezas) {
      assert.equal(fragmentoProhibido(pieza), undefined, pieza);
    }
  });

  it('deja los títulos en 60 caracteres y las metas en 155, sin el sufijo del layout', () => {
    for (const pagina of Object.values(seo)) {
      assert.ok(pagina.titulo.length <= 60, `${pagina.titulo.length}: ${pagina.titulo}`);
      assert.ok(pagina.descripcion.length <= 155, `${pagina.descripcion.length}: ${pagina.descripcion}`);
    }
  });
});

describe('detector del build', () => {
  it('reconoce los fragmentos con y sin la URL de un dato', () => {
    assert.equal(fragmentoProhibido('valor [Pendiente]'), '[pendiente');
    assert.equal(fragmentoProhibido('[PENDIENTE: métrica por confirmar]'), '[pendiente');
    assert.equal(fragmentoProhibido('[RAZÓN SOCIAL]'), '[razón');
    assert.equal(fragmentoProhibido('[DOMICILIO]'), '[domicilio');
    assert.equal(fragmentoProhibido('[CORREO DE PRIVACIDAD]'), '[correo');
    assert.equal(fragmentoProhibido('POR CONFIRMAR'), 'por confirmar');
    assert.equal(fragmentoProhibido('Hola {{nombre}}'), '{{');
    assert.equal(fragmentoProhibido('Textos PROVISIONALES'), 'provisional');
    assert.equal(fragmentoProhibido('MKT Creativa © 2026. Tuxtla Gutiérrez, Chiapas.'), undefined);
  });
});
