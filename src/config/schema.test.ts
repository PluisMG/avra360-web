import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { enlaceAPaginaAusente, guiaPilar, hrefTarjetaInicio, seoDeGuia } from './paginas.ts';
import { datosDeMarkdown } from './ediciones-sitemap.ts';
import { grafoOrganizacion, jsonLdArticulo, jsonLdGuia, serializar } from './schema.ts';

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
    assert.equal(agencia.logo.url, 'https://agencia-prueba.mx/brand/avra360-logo-header.svg');
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
  const claves = ['estrategia', 'sitio-web', 'seo-local', 'contenido-cofepris'] as const;

  it('sin archivo conserva el ancla de /servicios y no inventa la página', () => {
    const publicados = new Set<string>();
    assert.deepEqual(
      claves.map((clave) => hrefTarjetaInicio(clave, publicados)),
      [
        '/servicios#estrategia',
        '/servicios#sitio-web',
        '/servicios#seo-local',
        '/servicios#contenido-cofepris',
      ],
    );
    for (const href of claves.map((clave) => hrefTarjetaInicio(clave, publicados))) {
      assert.equal(enlaceAPaginaAusente(href, publicados), false);
    }
  });

  it('con archivo apunta a /servicios/{slug} y no a una página que no está en el conjunto', () => {
    const publicados = new Set(['seo-local-google-maps']);
    assert.equal(hrefTarjetaInicio('seo-local', publicados), '/servicios/seo-local-google-maps');
    assert.equal(hrefTarjetaInicio('sitio-web', publicados), '/servicios#sitio-web');
    assert.equal(hrefTarjetaInicio('contenido-cofepris', publicados), '/servicios#contenido-cofepris');
    for (const href of claves.map((clave) => hrefTarjetaInicio(clave, publicados))) {
      assert.equal(enlaceAPaginaAusente(href, publicados), false);
    }
    assert.equal(enlaceAPaginaAusente('/servicios/marketing-para-psicologos', publicados), true);
    assert.equal(enlaceAPaginaAusente('/servicios/diagnostico-digital', new Set()), true);
  });
});

describe('JSON-LD de la guía', () => {
  it('deja Guías sin enlace y cita las fuentes', () => {
    const datos = JSON.parse(
      jsonLdGuia(origen, {
        slug: 'cofepris',
        h1: '¿Aviso o permiso de publicidad de COFEPRIS?',
        titulo: '¿Aviso o permiso de publicidad COFEPRIS? Guía para médicos',
        descripcion: 'Cuándo basta el aviso de publicidad y cuándo se necesita permiso de COFEPRIS, qué cuesta y qué datos lleva, explicado para consultorios y clínicas.',
        fuentes: ['https://www.gob.mx/cofepris'],
      }),
    );
    const migas = datos['@graph'][1];
    assert.equal(datos['@graph'][0]['@type'], 'Article');
    assert.deepEqual(datos['@graph'][0].citation, ['https://www.gob.mx/cofepris']);
    assert.equal(migas['@type'], 'BreadcrumbList');
    assert.equal(migas.itemListElement[1].name, 'Guías');
    assert.equal(migas.itemListElement[1].item, undefined);
  });
});

describe('guía pilar en /guias/cofepris', () => {
  it('usa el título y la meta de la pilar, sin el sufijo de la marca', () => {
    const seo = seoDeGuia({
      slug: 'cofepris',
      titulo: 'Guías de publicidad COFEPRIS para médicos',
      descripcion: 'Texto del hub que no debe publicarse como título de esta URL.',
      sufijo: true,
    });
    assert.equal(seo.titulo, guiaPilar.titulo);
    assert.equal(seo.titulo, '¿Aviso o permiso de publicidad COFEPRIS? Guía para médicos');
    assert.equal(
      seo.descripcion,
      'Cuándo basta el aviso de publicidad y cuándo se necesita permiso de COFEPRIS, qué cuesta y qué datos lleva, explicado para consultorios y clínicas.',
    );
    assert.equal(seo.sufijo, false);
    assert.ok(seo.titulo.length <= 80);
    assert.ok(seo.descripcion.length <= 180);
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
