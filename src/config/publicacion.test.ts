import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mensajesWhatsapp } from './agencia.ts';
import { fragmentoProhibido } from './publicacion.ts';
import { descripcionAgencia } from './schema.ts';
import {
  boletin,
  caso,
  contacto,
  errorPagina,
  formularioBoletinTextos,
  inicio,
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
      descripcionAgencia,
    });
    for (const pieza of piezas) {
      assert.equal(fragmentoProhibido(pieza), undefined, pieza);
    }
  });

  it('deja los títulos en 80 caracteres y las metas en 180, sin el sufijo del layout', () => {
    for (const pagina of Object.values(seo)) {
      assert.ok(pagina.titulo.length <= 80, `${pagina.titulo.length}: ${pagina.titulo}`);
      assert.ok(pagina.descripcion.length <= 180, `${pagina.descripcion.length}: ${pagina.descripcion}`);
    }
  });

  it('usa los títulos y metas de la revisión SEO', () => {
    assert.equal(seo.inicio.titulo, 'Agencia de marketing médico en Tuxtla Gutiérrez');
    assert.equal(seo.inicio.descripcion, 'Marketing para clínicas, consultorios y salud mental en Tuxtla Gutiérrez, Chiapas: estrategia, sitio web y SEO local, con criterio COFEPRIS y sin promesas.');
    assert.equal(seo.boletin.descripcion, 'Boletín mensual para clínicas y consultorios de Chiapas: Google Maps, publicidad con criterio COFEPRIS e IA. Lea el archivo y suscríbase.');
    assert.equal(seo.contacto.titulo, 'Contacto de MKT Creativa en Tuxtla Gutiérrez, Chiapas');
    assert.equal(seo.contacto.descripcion.includes('+52 961 191 9199'), true);
    assert.equal(seo.contacto.descripcion.includes('{{'), false);
    assert.equal(seo.aviso.descripcion.includes('Borrador'), false);
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
    assert.equal(fragmentoProhibido('la agencia que cumple con COFEPRIS'), 'cumple con cofepris');
    assert.equal(fragmentoProhibido('sin meterte en problemas con la norma'), 'sin meterte en problemas');
    assert.equal(fragmentoProhibido('anuncios conformes a COFEPRIS'), 'conformes a cofepris');
    assert.equal(fragmentoProhibido('0 % riesgo regulatorio'), '0 % riesgo');
    assert.equal(fragmentoProhibido('resultado garantizado'), 'garantizado');
    assert.equal(fragmentoProhibido('No ofrecemos el primer lugar en Google.'), undefined);
    assert.equal(fragmentoProhibido('conforme a la LFPDPPP'), undefined);
    assert.equal(fragmentoProhibido('MKT Creativa © 2026. Tuxtla Gutiérrez, Chiapas.'), undefined);
  });
});
