import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aplicarTrampa,
  borrarCookiesAnalitica,
  CAMPO_TRAMPA,
  despacharContacto,
  directivasDeBorrado,
  dominiosDeBorrado,
  nombresAnalitica,
  tipoContacto,
} from '../../public/scripts/consentimiento.js';

const GA = 'G-ABC123';
const PIXEL = '1234567890';
const WHATSAPP = 'https://wa.me/529611919199?text=hola';
const TELEFONO = 'tel:+529611919199';

function registrar() {
  const gtag: unknown[][] = [];
  const fbq: unknown[][] = [];
  return {
    gtag,
    fbq,
    enviar(consentimiento: string | null, href: string, gaId: string = GA, pixelId: string = PIXEL) {
      return despacharContacto({
        consentimiento,
        href,
        gaId,
        pixelId,
        gtag: (...args: unknown[]) => {
          gtag.push(args);
        },
        fbq: (...args: unknown[]) => {
          fbq.push(args);
        },
      });
    },
  };
}

function documentoCon(cookie: string) {
  const escritas: string[] = [];
  return {
    escritas,
    documento: {
      get cookie() {
        return cookie;
      },
      set cookie(valor: string) {
        escritas.push(valor);
      },
    },
  };
}

function formulario(valor: string | null) {
  const campo = valor === null ? null : { value: valor, disabled: false };
  return {
    campo,
    querySelector(selector: string) {
      return selector === `input[name="${CAMPO_TRAMPA}"]` ? campo : null;
    },
  };
}

describe('eventos de contacto', () => {
  it('sin consentimiento no envía nada', () => {
    for (const consentimiento of [null, 'rechazado']) {
      const canal = registrar();
      const enviados = canal.enviar(consentimiento, WHATSAPP);
      assert.deepEqual(enviados, []);
      assert.deepEqual(canal.gtag, []);
      assert.deepEqual(canal.fbq, []);
      const llamada = registrar();
      assert.deepEqual(llamada.enviar(consentimiento, TELEFONO), []);
      assert.deepEqual(llamada.gtag, []);
      assert.deepEqual(llamada.fbq, []);
    }
  });

  it('con consentimiento envía el clic a GA4 y, si hay píxel, Contact a Meta', () => {
    const whatsapp = registrar();
    assert.deepEqual(whatsapp.enviar('aceptado', WHATSAPP), [
      { canal: 'ga4', nombre: 'contacto_whatsapp' },
      { canal: 'meta', nombre: 'Contact' },
    ]);
    assert.deepEqual(whatsapp.gtag, [['event', 'contacto_whatsapp', { transport_type: 'beacon' }]]);
    assert.deepEqual(whatsapp.fbq, [['track', 'Contact', { content_name: 'contacto_whatsapp' }]]);

    const llamada = registrar();
    assert.deepEqual(llamada.enviar('aceptado', TELEFONO), [
      { canal: 'ga4', nombre: 'contacto_llamada' },
      { canal: 'meta', nombre: 'Contact' },
    ]);
    assert.deepEqual(llamada.gtag, [['event', 'contacto_llamada', { transport_type: 'beacon' }]]);
    assert.deepEqual(llamada.fbq, [['track', 'Contact', { content_name: 'contacto_llamada' }]]);
  });

  it('no llama a Meta si el píxel no está configurado, ni a GA4 sin identificador', () => {
    const sinPixel = registrar();
    assert.deepEqual(sinPixel.enviar('aceptado', WHATSAPP, GA, ''), [{ canal: 'ga4', nombre: 'contacto_whatsapp' }]);
    assert.deepEqual(sinPixel.fbq, []);

    const sinGa = registrar();
    assert.deepEqual(sinGa.enviar('aceptado', TELEFONO, '', PIXEL), [{ canal: 'meta', nombre: 'Contact' }]);
    assert.deepEqual(sinGa.gtag, []);
  });

  it('ignora enlaces que no son WhatsApp ni teléfono', () => {
    const canal = registrar();
    assert.equal(tipoContacto('https://mktcreativa.example/contacto'), null);
    assert.deepEqual(canal.enviar('aceptado', 'https://mktcreativa.example/contacto'), []);
    assert.deepEqual(canal.gtag, []);
    assert.deepEqual(canal.fbq, []);
  });
});

describe('revocación de cookies de analítica', () => {
  it('borra _ga, _ga_* y _fbp del dominio actual y del dominio padre', () => {
    const { documento, escritas } = documentoCon('_ga=GA1.1.1.1; _ga_MED123=1; _fbp=fb.1; tema=claro');
    borrarCookiesAnalitica(documento, 'www.mktcreativa.mx');
    assert.deepEqual(nombresAnalitica('_ga=1; _ga_MED123=1; _fbp=1; tema=claro'), ['_fbp', '_ga', '_ga_MED123']);
    assert.ok(dominiosDeBorrado('www.mktcreativa.mx').includes(''));
    assert.ok(dominiosDeBorrado('www.mktcreativa.mx').includes('www.mktcreativa.mx'));
    assert.ok(dominiosDeBorrado('www.mktcreativa.mx').includes('.www.mktcreativa.mx'));
    assert.ok(dominiosDeBorrado('www.mktcreativa.mx').includes('mktcreativa.mx'));
    assert.ok(dominiosDeBorrado('www.mktcreativa.mx').includes('.mktcreativa.mx'));
    for (const nombre of ['_ga', '_ga_MED123', '_fbp']) {
      assert.ok(escritas.some((linea) => linea === `${nombre}=; Max-Age=0; Path=/`));
      assert.ok(escritas.some((linea) => linea === `${nombre}=; Max-Age=0; Path=/; Domain=mktcreativa.mx`));
      assert.ok(escritas.some((linea) => linea === `${nombre}=; Max-Age=0; Path=/; Domain=.mktcreativa.mx`));
      assert.ok(escritas.some((linea) => linea === `${nombre}=; Max-Age=0; Path=/; Domain=www.mktcreativa.mx`));
    }
    assert.equal(escritas.some((linea) => linea.startsWith('tema=')), false);
  });

  it('en localhost o una IP no escribe Domain', () => {
    assert.deepEqual(dominiosDeBorrado('localhost'), ['']);
    assert.deepEqual(dominiosDeBorrado('127.0.0.1'), ['']);
    assert.deepEqual(dominiosDeBorrado('::1'), ['']);
    const directivas = directivasDeBorrado(['_ga', '_fbp'], 'localhost');
    assert.equal(directivas.some((linea) => linea.includes('Domain=')), false);
    assert.ok(directivas.some((linea) => linea === '_ga=; Max-Age=0; Path=/'));
    assert.ok(directivas.some((linea) => linea === '_fbp=; Max-Age=0; Path=/; Secure'));
  });
});

describe('honeypot del formulario', () => {
  it('si el campo viene lleno, no se envía', () => {
    const lleno = formulario('http://spam.test');
    let evitado = false;
    const decision = aplicarTrampa({
      target: lleno,
      preventDefault() {
        evitado = true;
      },
    });
    assert.equal(decision, 'bloquear');
    assert.equal(evitado, true);
    assert.equal(lleno.campo?.disabled, false);
  });

  it('si el campo viene vacío, se omite del POST', () => {
    const vacio = formulario('');
    const borrados: string[] = [];
    let evitado = false;
    const decision = aplicarTrampa({
      target: vacio,
      formData: {
        delete(nombre: string) {
          borrados.push(nombre);
        },
      },
      preventDefault() {
        evitado = true;
      },
    });
    assert.equal(decision, 'omitir');
    assert.equal(evitado, false);
    assert.equal(vacio.campo?.disabled, true);
    assert.deepEqual(borrados, [CAMPO_TRAMPA]);
  });

  it('un espacio cuenta como lleno y un formulario sin el campo no se toca', () => {
    const espacio = formulario(' ');
    let evitado = false;
    assert.equal(
      aplicarTrampa({
        target: espacio,
        preventDefault() {
          evitado = true;
        },
      }),
      'bloquear',
    );
    assert.equal(evitado, true);
    assert.equal(aplicarTrampa({ target: formulario(null), preventDefault() {} }), 'ajeno');
  });
});
