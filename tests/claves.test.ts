import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const raiz = path.resolve(import.meta.dirname, '..');
const omitir = new Set(['node_modules', 'dist', '.git', '.astro', '.wrangler', 'coverage', 'test-results', 'playwright-report']);
const extensiones = new Set(['.ts', '.tsx', '.js', '.mjs', '.astro', '.css', '.json', '.jsonc', '.md', '.svg', '.txt', '.html']);

const patrones = [
  { nombre: 'resend', re: /\bre_[A-Za-z0-9]{8,}/ },
  { nombre: 'stripe', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+/ },
  { nombre: 'aws', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { nombre: 'slack', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/ },
  { nombre: 'github', re: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/ },
  { nombre: 'privada', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { nombre: 'openai', re: /\bsk-[A-Za-z0-9]{20,}/ },
  { nombre: 'webhook', re: /api2\.cursor\.sh\/automations\/webhook\/[A-Za-z0-9_-]{6,}/ },
  { nombre: 'jwt', re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./ },
];

test('el repositorio no contiene secretos con forma de clave', async () => {
  const hallazgos: string[] = [];
  for await (const archivo of archivos(raiz)) {
    if (archivo.endsWith('package-lock.json') || archivo.endsWith(`${path.sep}public${path.sep}chat.js`)) continue;
    const texto = await readFile(archivo, 'utf8');
    for (const patron of patrones) {
      if (patron.re.test(texto)) hallazgos.push(`${path.relative(raiz, archivo)}: ${patron.nombre}`);
    }
  }
  assert.deepEqual(hallazgos, []);
});

test('el cliente no inserta HTML crudo y el Worker no integra calendario', async () => {
  const cliente = await leerDir(path.join(raiz, 'src'));
  assert.doesNotMatch(cliente, /innerHTML|insertAdjacentHTML|outerHTML|document\.write|eval\(|new Function/);
  const worker = await leerDir(path.join(raiz, 'worker'), new Set(['prompt-sistema.txt']));
  assert.doesNotMatch(worker, /calendar\.google|googleapis\.com\/calendar|innerHTML/);
  assert.doesNotMatch(worker, /Eres AVRA|You are AVRA|system prompt/i);
  const prompt = await readFile(path.join(raiz, 'worker', 'prompt-sistema.txt'), 'utf8');
  assert.match(prompt, /Eres AVRA/);
  assert.match(prompt, /COFEPRIS/);
  assert.match(prompt, /wa\.me\/529611919199/);
  assert.doesNotMatch(prompt, /\$\s?\d/);
});

async function* archivos(directorio: string): AsyncGenerator<string> {
  const entradas = await readdir(directorio, { withFileTypes: true });
  for (const entrada of entradas) {
    if (omitir.has(entrada.name)) continue;
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) yield* archivos(ruta);
    else if (extensiones.has(path.extname(entrada.name))) yield ruta;
  }
}

async function leerDir(directorio: string, saltar = new Set<string>()): Promise<string> {
  let texto = '';
  for await (const archivo of archivos(directorio)) {
    if (archivo.endsWith('.test.ts') || saltar.has(path.basename(archivo))) continue;
    texto += await readFile(archivo, 'utf8');
  }
  return texto;
}
