import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hrefTarjetaInicio } from './paginas.ts';
import { datosDeMarkdown } from './ediciones-sitemap.ts';
import { grafoOrganizacion, jsonLdArticulo, serializar } from './schema.ts';

const origen = 'https://agencia-prueba.mx';

describe('JSON-LD de la organización', () => {
  it('omite lo que depende de Pedro y conserva el teléfono confirmado', () => {
    const json = serializar(grafoOrganizacion(origen, ['seo-local-google-maps', 'paginas-web-para-medicos']));
    const datos = JSON.parse(json);
    const agencia = datos['@graph'][0];
    assert.equal(agencia.telephone, '+529611919199');
    assert.equal(agencia.legalName, undefined);
    assert.equal(agencia.email, undefined);
    assert.equal(agencia.slogan, undefined);
    assert.equal(agencia.address.streetAddress, undefined);
    assert.equal(agencia.address.postalCode, undefined);
    assert.equal(agencia.geo, undefined);
    assert.equal(agencia.openingHoursSpecification, undefined);
    assert.equal(agencia.priceRange, undefined);
    assert.equal(agencia.sameAs, undefined);
    assert.equal(datos['@graph'][1].sameAs, undefined);
    assert.equal(datos['@graph'][1].jobTitle, 'Fundador');
    assert.equal(json.includes('{{'), false);
    assert.equal(json.includes('9613164292'), false);
    assert.equal(agencia.logo.url, 'https://agencia-prueba.mx/logo-512.png');
    assert.deepEqual(
      agencia.hasOfferCatalog.itemListElement.map(
        (oferta: { itemOffered: { url: string } }) => oferta.itemOffered.url,
      ),
      [
        'https://agencia-prueba.mx/servicios/paginas-web-para-medicos',
        'https://agencia-prueba.mx/servicios/seo-local-google-maps',
      ],
    );
  });

  it('no publica el catálogo si ninguna página de servicio existe', () => {
    const agencia = grafoOrganizacion(origen, [])['@graph'][0];
    assert.equal(agencia.hasOfferCatalog, undefined);
  });

  it('arma el Article sin palabras ni fuentes cuando no vienen', () => {
    const datos = JSON.parse(
      jsonLdArticulo(origen, {
        slug: 'edicion-de-prueba',
        titulo: 'Una edición de prueba del boletín',
        descripcion: 'Descripción de prueba con más de cincuenta caracteres para el esquema del artículo.',
        fecha: '2026-11-03',
      }),
    );
    const articulo = datos['@graph'][0];
    assert.equal(articulo['@type'], 'Article');
    assert.equal(articulo.keywords, undefined);
    assert.equal(articulo.citation, undefined);
    assert.equal(articulo.author['@id'], 'https://agencia-prueba.mx/#pedro');
    assert.equal(articulo.datePublished, '2026-11-03T08:00:00-06:00');
    assert.equal(datos['@graph'][1]['@type'], 'BreadcrumbList');
  });

  it('rechaza marcadores', () => {
    assert.throws(() => serializar({ nombre: '{{DOMINIO}}' }));
  });
});

describe('enlaces que dependen de un archivo', () => {
  it('no apunta a un servicio cuyo markdown no existe', () => {
    assert.equal(hrefTarjetaInicio('estrategia', new Set()), '/servicios#estrategia');
    assert.equal(hrefTarjetaInicio('sitio-web', new Set()), '/servicios');
    assert.equal(
      hrefTarjetaInicio('sitio-web', new Set(['paginas-web-para-medicos'])),
      '/servicios/paginas-web-para-medicos',
    );
  });
});

describe('lastmod del boletín', () => {
  it('usa modificado, ignora el ejemplo y respeta el slug', () => {
    const real = datosDeMarkdown(
      '2026-11-03.md',
      '---\nfecha: "2026-11-03"\nslug: maps-consultorios\nmodificado: 2026-11-04\nejemplo: false\n---\n',
    );
    const ejemplo = datosDeMarkdown('ejemplo-2026-10-15.md', '---\nfecha: 2026-10-15\nejemplo: true\n---\n');
    assert.equal(real.slug, 'maps-consultorios');
    assert.equal(real.modificado, '2026-11-04');
    assert.equal(ejemplo.ejemplo, true);
    assert.equal(ejemplo.slug, 'ejemplo-2026-10-15');
  });
});
