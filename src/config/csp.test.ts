import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clasificarReporteCsp,
  directiva,
  encabezadoReportingEndpoints,
  politicaCsp,
} from './csp.ts';

const hash = 'abc123';

describe('CSP del formulario', () => {
  it('deja form-action en self y no menciona a MailerLite ni a Resend', () => {
    const csp = politicaCsp({ hashes: [hash] });
    assert.equal(directiva(csp, 'form-action'), "'self'");
    assert.equal(csp.toLowerCase().includes('mailerlite'), false);
    assert.equal(csp.includes('resend.com'), false);
  });

  it('incluye cada hash de JSON-LD, en orden estable', () => {
    const csp = politicaCsp({ hashes: ['bbb', 'aaa', 'bbb'] });
    const script = directiva(csp, 'script-src') ?? '';
    assert.ok(script.includes(`'sha256-aaa'`));
    assert.ok(script.includes(`'sha256-bbb'`));
    assert.ok(script.indexOf(`'sha256-aaa'`) < script.indexOf(`'sha256-bbb'`));
    assert.equal(script.split(`'sha256-bbb'`).length - 1, 1);
  });

  it('usa strict-dynamic y no emite report-to si no hay URL', () => {
    const csp = politicaCsp({ hashes: [hash] });
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
