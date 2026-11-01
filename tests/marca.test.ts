import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const raiz = path.resolve(import.meta.dirname, '..');

test('el encabezado conserva los degradados y pesa menos de 47 KB', async () => {
  const archivo = path.join(raiz, 'public/brand/avra360-logo-header.svg');
  const svg = await readFile(archivo, 'utf8');
  const peso = (await stat(archivo)).size;
  assert.ok(peso < 20_000, `el encabezado pesa ${peso} bytes`);
  assert.match(svg, /offset="0\.05"/);
  assert.match(svg, /offset="0\.15"/);
  assert.match(svg, /id="hdr-avra-pierna1"/);
  assert.match(svg, /url\(#hdr-avra-pierna1\)/);
  assert.doesNotMatch(svg, /id="avra-pierna1"/);
});

test('el favicon de 32 px se sirve como /favicon.ico y no hay PNG del logo', async () => {
  const png = await readFile(path.join(raiz, 'public/brand/avra360-favicon-32.png'));
  const ico = await readFile(path.join(raiz, 'public/favicon.ico'));
  assert.deepEqual(ico, png);
  const og = await readFile(path.join(raiz, 'public/og.png'));
  assert.equal(og.readUInt32BE(16), 1200);
  assert.equal(og.readUInt32BE(20), 630);
  const pngs = await listarPng(raiz);
  assert.deepEqual(
    pngs.filter((archivo) => /logo/i.test(archivo)),
    [],
  );
});

async function listarPng(directorio: string): Promise<string[]> {
  const omitir = new Set(['node_modules', 'dist', '.git', '.astro']);
  const entradas = await readdir(directorio, { withFileTypes: true });
  const archivos: string[] = [];
  for (const entrada of entradas) {
    if (omitir.has(entrada.name)) continue;
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) archivos.push(...(await listarPng(ruta)));
    else if (entrada.name.endsWith('.png')) archivos.push(path.relative(raiz, ruta));
  }
  return archivos;
}
