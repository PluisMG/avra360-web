import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clasificarAccionFormulario, directiva, politicaCsp } from './csp.ts';

const hash = 'abc123';
const accionMailerLite = 'https://assets.mailerlite.com/jsonp/1/forms/2/subscribe';

function cspDe(accionFormulario?: string) {
  return politicaCsp({ hash, accionFormulario });
}

describe('CSP del formulario de MailerLite', () => {
  it('sin URL deja form-action en self y no menciona a MailerLite', () => {
    const csp = cspDe();
    assert.equal(directiva(csp, 'form-action'), "'self'");
    assert.equal(csp.includes('mailerlite'), false);
  });

  it('con la URL agrega solo el origen real a form-action', () => {
    const csp = cspDe(accionMailerLite);
    assert.equal(directiva(csp, 'form-action'), "'self' https://assets.mailerlite.com");
    assert.equal(csp.includes('/jsonp/'), false);
    assert.equal(directiva(csp, 'connect-src')?.includes('mailerlite'), false);
  });

  it('toma el host del form action, no un comodín fijo', () => {
    const csp = cspDe('https://static.mailerlite.com/webforms/submit/abc');
    assert.equal(directiva(csp, 'form-action'), "'self' https://static.mailerlite.com");
  });

  it('no abre form-action si la URL trae un secreto o no es https', () => {
    const conSecreto = cspDe(`${accionMailerLite}?api_key=no-va-aqui`);
    const http = cspDe('http://assets.mailerlite.com/jsonp/1/forms/2/subscribe');
    assert.equal(directiva(conSecreto, 'form-action'), "'self'");
    assert.equal(directiva(http, 'form-action'), "'self'");
    assert.equal(clasificarAccionFormulario(`${accionMailerLite}?token=x`).lista, false);
  });
});
