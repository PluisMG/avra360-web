import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { directiva } from '../src/config/csp.ts';
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

const encabezados = await readFile(path.join(dist, '_headers'), 'utf8').catch(() => '');
if (!encabezados.includes('Content-Security-Policy')) anotar('Falta _headers con Content-Security-Policy.');
if (!encabezados.includes('Strict-Transport-Security: max-age=31536000')) {
  anotar('Falta Strict-Transport-Security: max-age=31536000.');
}
const cspLinea = encabezados.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? '';
const scriptSrc = encabezados ? directiva(cspLinea, 'script-src') : '';
if (scriptSrc && !scriptSrc.includes("'strict-dynamic'")) anotar("La CSP no incluye 'strict-dynamic'.");
const tieneReportTo = /\breport-to\b/.test(cspLinea);
const tieneReportUri = /\breport-uri\b/.test(cspLinea);
const tieneEndpoints = encabezados.includes('Reporting-Endpoints:');
if (tieneReportTo !== tieneReportUri || tieneReportTo !== tieneEndpoints) {
  anotar('report-to, report-uri y Reporting-Endpoints deben publicarse juntos, y solo cuando hay CSP_REPORT_URL.');
}
const redirects = await readFile(path.join(dist, '_redirects'), 'utf8').catch(() => '');
for (const regla of ['/index.html / 301', '/*/index.html /:splat 301', '/*/ /:splat 301', '/sitemap.xml /sitemap-index.xml 301']) {
  if (!redirects.includes(regla)) anotar(`Falta la redirección «${regla}».`);
}

let origen;
const origenes = new Set();

function anotarOrigen(valor) {
  try {
    origenes.add(new URL(valor).origin);
  } catch {
    anotar(`URL absoluta ilegible: ${valor}`);
  }
}

function origenesDeJson(valor, salida) {
  if (typeof valor === 'string' && /^https?:\/\//.test(valor)) {
    let url;
    try {
      url = new URL(valor);
    } catch {
      anotar(`JSON-LD con URL ilegible: ${valor}`);
      return;
    }
    const externo = ['schema.org', 'wikipedia.org', 'www.gob.mx', 'gob.mx'].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
    if (!externo) salida.add(url.origin);
    return;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) origenesDeJson(item, salida);
  } else if (valor && typeof valor === 'object') {
    for (const item of Object.values(valor)) origenesDeJson(item, salida);
  }
}
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
  const bloques = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const bloque of bloques) {
    const cuerpo = bloque[1] ?? '';
    if (cuerpo.includes('{{')) anotar(`${publica} tiene un marcador {{ en el JSON-LD.`);
    try {
      origenesDeJson(JSON.parse(cuerpo), origenes);
    } catch {
      anotar(`${publica} tiene JSON-LD que no se puede leer.`);
    }
    if (scriptSrc) {
      const hash = createHash('sha256').update(cuerpo, 'utf8').digest('base64');
      if (!scriptSrc.includes(`'sha256-${hash}'`)) {
        anotar(`${publica} tiene un JSON-LD cuyo hash no está en la CSP.`);
      }
    }
  }
  if (publica === '/casos/mentalcareclinic' && /<img\b/i.test(html)) {
    anotar(`${publica} muestra una imagen. MentalCareClinic sigue solo con texto hasta la autorización por escrito.`);
  }

  const canonica = html.match(/rel="canonical" href="([^"]+)"/);
  if (canonica) {
    origen ??= new URL(canonica[1]).origin;
    anotarOrigen(canonica[1]);
  }
  const ogUrl = html.match(/property="og:url" content="([^"]+)"/);
  if (ogUrl) anotarOrigen(ogUrl[1]);

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
  if (!html.includes('href="/favicon.ico"')) anotar(`${publica} no enlaza favicon.ico.`);
  if (!html.includes('src="/scripts/consentimiento.js"') || !/integrity="sha256-[^"]+"/.test(html)) {
    anotar(`${publica} no publica el script de consentimiento con integrity.`);
  }
  if (scriptSrc) {
    const integridad = html.match(/integrity="sha256-([^"]+)"/);
    if (integridad && !scriptSrc.includes(`'sha256-${integridad[1]}'`)) {
      anotar(`${publica} tiene un script cuyo hash no está en la CSP.`);
    }
  }
  if (html.includes('href="#consentimiento"') || !/<button\b[^>]*id="consent-reabrir"/.test(html)) {
    anotar(`${publica} debe reabrir las cookies con un botón, sin navegar a #consentimiento.`);
  }
  if (!html.includes('class="trampa"') || !html.includes('aria-hidden="true"') || !html.includes('name="empresa_web"')) {
    anotar(`${publica} no tiene el campo oculto del formulario.`);
  }
  if (!html.includes('tabindex="-1"') || !html.includes('autocomplete="off"')) {
    anotar(`${publica} no esconde el campo del formulario como se pidió.`);
  }
  if (html.includes('banda-provisional')) anotar(`${publica} todavía tiene la banda provisional.`);
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
if (!robots.includes('Disallow: /') && !robots.includes('/sitemap.xml')) {
  anotar('robots.txt de producción debe declarar /sitemap.xml.');
}

const sitemap = await readFile(path.join(dist, 'sitemap-index.xml'), 'utf8').catch(() => '');
if (!sitemap) anotar('Falta sitemap-index.xml.');
else {
  const mapas = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((coincidencia) => coincidencia[1]);
  for (const completo of mapas) {
    anotarOrigen(completo);
    const mapa = new URL(completo).pathname;
    if (!(await existeRuta(mapa))) anotar(`El índice de sitemap apunta a ${mapa}, que no está en dist/.`);
    else {
      const xml = await readFile(await archivoDe(mapa), 'utf8');
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((coincidencia) => coincidencia[1]);
      for (const completoLoc of locs) {
        anotarOrigen(completoLoc);
        const loc = new URL(completoLoc).pathname;
        if (loc.includes('/boletin/ejemplo-')) anotar(`El sitemap incluye la edición de ejemplo: ${loc}`);
        if (loc.includes('/aviso-de-privacidad')) anotar(`El sitemap incluye el aviso de privacidad: ${loc}`);
        if (!(await existeRuta(loc))) anotar(`El sitemap enlaza a ${loc}, que no está en dist/.`);
      }
    }
  }
}

const rss = await readFile(path.join(dist, 'boletin/rss.xml'), 'utf8').catch(() => '');
if (!rss.includes('xmlns:atom')) anotar('El RSS no declara xmlns:atom.');
if (!/rel="self"/.test(rss)) anotar('El RSS no tiene atom:link rel="self".');
const rssLink = rss.match(/<link>([^<]+)<\/link>/);
if (rssLink) anotarOrigen(rssLink[1]);
const atom = rss.match(/<atom:link[^>]*href="([^"]+)"/);
if (atom) anotarOrigen(atom[1]);
if (rss.includes('{{')) anotar('El RSS contiene un marcador {{.');

if (!(await existeRuta('/logo-512.png'))) anotar('Falta logo-512.png en el build.');
if (!(await existeRuta('/favicon.ico'))) anotar('Falta favicon.ico.');
if (!(await existeRuta('/sitemap.xml'))) anotar('Falta sitemap.xml.');
if (origenes.size > 1) {
  anotar(`Canonical, Open Graph, sitemap, RSS o schema no comparten un solo origen: ${[...origenes].join(', ')}.`);
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
