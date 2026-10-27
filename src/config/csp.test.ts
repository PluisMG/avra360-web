import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clasificarAccionFormulario,
  clasificarReporteCsp,
  directiva,
  encabezadoReportingEndpoints,
  politicaCsp,
} from './csp.ts';

const hash = 'abc123';
const accionMailerLite = 'https://assets.mailerlite.com/jsonp/1/forms/2/subscribe';

function cspDe(accionFormulario?: string) {
  return politicaCsp({ hashes: [hash], accionFormulario });
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

  it('incluye cada hash de JSON-LD, en orden estable', () => {
    const csp = politicaCsp({ hashes: ['bbb', 'aaa', 'bbb'] });
    const script = directiva(csp, 'script-src') ?? '';
    assert.ok(script.includes(`'sha256-aaa'`));
    assert.ok(script.includes(`'sha256-bbb'`));
    assert.ok(script.indexOf(`'sha256-aaa'`) < script.indexOf(`'sha256-bbb'`));
    assert.equal(script.split(`'sha256-bbb'`).length - 1, 1);
  });

  it('no abre form-action si la URL trae un secreto o no es https', () => {
    const conSecreto = cspDe(`${accionMailerLite}?api_key=no-va-aqui`);
    const http = cspDe('http://assets.mailerlite.com/jsonp/1/forms/2/subscribe');
    assert.equal(directiva(conSecreto, 'form-action'), "'self'");
    assert.equal(directiva(http, 'form-action'), "'self'");
    assert.equal(clasificarAccionFormulario(`${accionMailerLite}?token=x`).lista, false);
  });

  it('usa strict-dynamic y no emite report-to si no hay URL', () => {
    const csp = cspDe();
    const script = directiva(csp, 'script-src') ?? '';
    assert.equal(script.includes("'strict-dynamic'"), true);
    assert.equal(csp.includes('report-to'), false);
    assert.equal(csp.includes('report-uri'), false);
  });
});

describe('reporte de CSP', () => {
  const url = 'https://reportes.ejemplo/csp';

  it('con una URL https agrega report-uri, report-to y Reporting-Endpoints', () => {
    const csp = politicaCsp({ hashes: [hash], reporte: url });
    assert.equal(directiva(csp, 'report-uri'), url);
    assert.equal(directiva(csp, 'report-to'), 'csp-endpoint');
    assert.equal(encabezadoReportingEndpoints(url), `csp-endpoint="${url}"`);
  });

  it('sin variable no clasifica un endpoint y rechaza http o userinfo', () => {
    assert.equal(clasificarReporteCsp(undefined).lista, false);
    assert.equal(clasificarReporteCsp('').lista, false);
    assert.equal(clasificarReporteCsp('http://reportes.ejemplo/csp').lista, false);
    assert.equal(clasificarReporteCsp('https://user:pass@reportes.ejemplo/csp').lista, false);
    assert.throws(() => politicaCsp({ hashes: [hash], reporte: 'http://reportes.ejemplo/csp' }));
  });
});
