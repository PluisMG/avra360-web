import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { revisarDirectorioPublico } from '../src/config/publicacion.ts';

const dist = path.resolve('dist');
const errores = [];
const externos = new Set();

function anotar(mensaje) {
  errores.push(mensaje);
}

async function listar(directorio, extension) {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const archivos = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) archivos.push(...(await listar(ruta, extension)));
    else if (entrada.name.endsWith(extension)) archivos.push(ruta);
  }
  return archivos;
}

function rutaPublica(archivo) {
  const relativo = path.relative(dist, archivo).split(path.sep).join('/');
  if (relativo === 'index.html') return '/';
  if (relativo.endsWith('/index.html')) return `/${relativo.slice(0, -'/index.html'.length)}`;
  if (relativo.endsWith('.html')) return `/${relativo.slice(0, -'.html'.length)}`;
  return `/${relativo}`;
}

async function existeRuta(ruta) {
  const limpia = ruta.replace(/\/$/, '') || '/';
  const candidatos = [
    path.join(dist, limpia === '/' ? 'index.html' : `${limpia.slice(1)}.html`),
    path.join(dist, limpia === '/' ? 'index.html' : path.join(limpia.slice(1), 'index.html')),
    path.join(dist, limpia.slice(1)),
  ];
  for (const candidato of candidatos) {
    try {
      const info = await stat(candidato);
      if (info.isFile()) return true;
    } catch {
      /* sigue */
    }
  }
  return false;
}

const htmls = await listar(dist, '.html');
if (htmls.length === 0) anotar('No hay HTML en dist/. Ejecute npm run build.');

let origen;
for (const archivo of htmls) {
  const html = await readFile(archivo, 'utf8');
  const publica = rutaPublica(archivo);
  const titulo = html.match(/<title>([^<]*)<\/title>/);
  if (!titulo || titulo[1].trim().length < 8) anotar(`${publica} no tiene <title> útil.`);
  if (!html.includes('lang="es-MX"')) anotar(`${publica} no declara lang es-MX.`);
  const h1 = html.match(/<h1\b/g) ?? [];
  if (h1.length !== 1) anotar(`${publica} tiene ${h1.length} elementos h1.`);
  if (!html.includes('name="description"')) anotar(`${publica} no tiene meta descripción.`);
  if (!html.includes('property="og:title"') || !html.includes('property="og:description"')) {
    anotar(`${publica} no tiene Open Graph básico.`);
  }
  if (!html.includes('application/ld+json')) anotar(`${publica} no tiene JSON-LD.`);

  const canonica = html.match(/rel="canonical" href="([^"]+)"/);
  if (canonica) origen ??= new URL(canonica[1]).origin;

  const atributos = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
  for (const valor of atributos) {
    if (valor.startsWith('mailto:') || valor.startsWith('tel:') || valor.startsWith('data:') || valor.startsWith('javascript:')) {
      if (valor.startsWith('tel:') && valor !== 'tel:+529611919199') {
        anotar(`${publica} tiene un teléfono distinto de tel:+529611919199: ${valor}`);
      }
      continue;
    }
    if (valor.startsWith('https://wa.me/') && !valor.startsWith('https://wa.me/529611919199?text=')) {
      anotar(`${publica} tiene un WhatsApp que no usa el número y el mensaje previstos: ${valor}`);
    }
    if (/^https?:\/\//.test(valor)) {
      const url = new URL(valor);
      if (origen && url.origin === origen) {
        await revisarInterna(publica, `${url.pathname}${url.hash}`, html);
      } else {
        externos.add(url.origin + url.pathname);
      }
      continue;
    }
    if (valor.startsWith('/')) await revisarInterna(publica, valor, html);
    else if (valor.startsWith('#')) await revisarInterna(publica, `${publica}${valor}`, html);
  }

  if (/api[_-]?key\s*[:=]|MAILERLITE_API|sk_live|AKIA[0-9A-Z]{8,}|xoxb-|BEGIN PRIVATE KEY/i.test(html)) {
    anotar(`${publica} parece contener un secreto.`);
  }
}

async function revisarInterna(desde, valor) {
  const [ruta, hash] = valor.split('#');
  const destino = ruta || '/';
  if (!(await existeRuta(destino))) {
    anotar(`${desde} enlaza a ${valor}, y esa ruta no está en dist/.`);
    return;
  }
  if (!hash) return;
  const archivo = await archivoDe(destino);
  const html = await readFile(archivo, 'utf8');
  const id = hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`\\sid="${id}"`).test(html)) {
    anotar(`${desde} apunta a #${hash} en ${destino}, y ese id no existe.`);
  }
}

async function archivoDe(ruta) {
  const limpia = ruta.replace(/\/$/, '') || '/';
  const candidatos = [
    path.join(dist, limpia === '/' ? 'index.html' : path.join(limpia.slice(1), 'index.html')),
    path.join(dist, limpia === '/' ? 'index.html' : `${limpia.slice(1)}.html`),
    path.join(dist, limpia === '/' ? 'index.html' : limpia.slice(1)),
  ];
  for (const candidato of candidatos) {
    try {
      await stat(candidato);
      return candidato;
    } catch {
      /* sigue */
    }
  }
  throw new Error(`No se encontró el archivo de ${ruta}`);
}

const robotsPath = path.join(dist, 'robots.txt');
const robots = await readFile(robotsPath, 'utf8').catch(() => '');
if (!robots.includes('User-agent:')) anotar('Falta robots.txt.');
if (!robots.includes('Disallow: /') && !robots.includes('Sitemap:')) {
  anotar('robots.txt no permite el sitio ni declara el sitemap.');
}

const encabezados = await readFile(path.join(dist, '_headers'), 'utf8').catch(() => '');
if (!encabezados.includes('Content-Security-Policy')) anotar('Falta _headers con Content-Security-Policy.');

const sitemap = await readFile(path.join(dist, 'sitemap-index.xml'), 'utf8').catch(() => '');
if (!sitemap) anotar('Falta sitemap-index.xml.');
else {
  const mapas = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((coincidencia) => new URL(coincidencia[1]).pathname);
  for (const mapa of mapas) {
    if (!(await existeRuta(mapa))) anotar(`El índice de sitemap apunta a ${mapa}, que no está en dist/.`);
    else {
      const xml = await readFile(await archivoDe(mapa), 'utf8');
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((coincidencia) => new URL(coincidencia[1]).pathname);
      for (const loc of locs) {
        if (loc.includes('/boletin/ejemplo-')) anotar(`El sitemap incluye la edición de ejemplo: ${loc}`);
        if (loc.includes('/aviso-de-privacidad')) anotar(`El sitemap incluye el aviso de privacidad: ${loc}`);
        if (!(await existeRuta(loc))) anotar(`El sitemap enlaza a ${loc}, que no está en dist/.`);
      }
    }
  }
}

if (!(await existeRuta('/404'))) anotar('Falta la página 404.');
if (await existeRuta('/aviso-de-privacidad')) {
  anotar('El aviso de privacidad no debe salir en el build público.');
}
for (const hallazgo of await revisarDirectorioPublico(dist)) anotar(hallazgo);

if (errores.length) {
  console.error(errores.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Enlaces internos en orden. ${htmls.length} páginas HTML. Externos: ${[...externos].join(', ') || 'ninguno'}.`);
