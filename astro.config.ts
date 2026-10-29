import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { defineConfig } from 'astro/config';
import { ENCABEZADO_INFORMES, politicaCsp } from './src/config/csp';

const sitio = resolverSitio(process.env.SITE ?? 'https://avra360.example');

function resolverSitio(valor: string) {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('SITE debe ser una URL absoluta, por ejemplo https://tu-dominio.mx');
  }
  if (url.username || url.password) throw new Error('SITE no debe incluir usuario ni contraseña.');
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('SITE debe usar http o https.');
  return url.origin;
}

async function listar(directorio: string, extension: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const archivos: string[] = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) archivos.push(...(await listar(ruta, extension)));
    else if (entrada.name.endsWith(extension)) archivos.push(ruta);
  }
  return archivos;
}

function revisarPublicacion(): AstroIntegration {
  return {
    name: 'revisar-publicacion',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const raiz = path.resolve(fileURLToPath(dir));
        const paginas = await listar(raiz, '.html');
        const prohibido = [
          'fonts.googleapis.com',
          'fonts.gstatic.com',
          'googletagmanager',
          'google-analytics',
          'connect.facebook',
          'mailerlite',
          'api.resend.com',
          '961 191 9199',
          '+529611919199',
        ];
        for (const archivo of paginas) {
          let html = await readFile(archivo, 'utf8');
          const ajustado = html.replace(/<a\b[^>]*>/g, enlaceExterno);
          if (ajustado !== html) {
            await writeFile(archivo, ajustado);
            html = ajustado;
          }
          const bajo = html.toLowerCase();
          for (const marca of prohibido) {
            if (bajo.includes(marca)) throw new Error(`${archivo} incluye «${marca}», que no debe publicarse.`);
          }
          if (/<style[\s>]/i.test(html)) throw new Error(`Hay un <style> en ${archivo}.`);
          const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
          for (const script of scripts) {
            const atributos = script[1] ?? '';
            const cuerpo = (script[2] ?? '').trim();
            if (cuerpo) throw new Error(`Hay un script en línea en ${archivo}.`);
            if (!/\bsrc="\/chat\.js"/.test(atributos) || !/\btype="module"/.test(atributos)) {
              throw new Error(`El único script permitido es el módulo /chat.js. Revisar ${archivo}.`);
            }
          }
        }
        const css = (await Promise.all((await listar(raiz, '.css')).map((archivo) => readFile(archivo, 'utf8')))).join('\n');
        if (!css.includes('font-display: swap') && !css.includes('font-display:swap')) {
          throw new Error('La tipografía publicada no declara font-display: swap.');
        }
        if (!css.includes('.woff2')) throw new Error('No se publicó el woff2 de Inter.');
        if (css.includes('fonts.googleapis.com')) throw new Error('El CSS publicado pide Google Fonts.');
        const csp = politicaCsp();
        const robots = process.env.PREVIEW === '1' ? '\n  X-Robots-Tag: noindex, nofollow' : '';
        const encabezados = [
          '/*',
          '  X-Content-Type-Options: nosniff',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  X-Frame-Options: DENY',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
          '  Strict-Transport-Security: max-age=31536000',
          `  Content-Security-Policy: ${csp}`,
          `  Reporting-Endpoints: ${ENCABEZADO_INFORMES}${robots}`,
          '',
          '/_astro/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
          '/chat.js',
          '  Cache-Control: public, max-age=3600',
          '',
          '/brand/*',
          '  Cache-Control: public, max-age=604800',
          '',
          '/favicon.ico',
          '  Content-Type: image/png',
          '  Cache-Control: public, max-age=604800',
          '',
        ].join('\n');
        await writeFile(path.join(raiz, '_headers'), encabezados);
        if (process.env.PREVIEW === '1') {
          const robotsTxt = await readFile(path.join(raiz, 'robots.txt'), 'utf8');
          if (!robotsTxt.includes('Disallow: /')) throw new Error('En vista previa, robots.txt debe incluir Disallow: /.');
        }
      },
    },
  };
}

function enlaceExterno(etiqueta: string) {
  const href = etiqueta.match(/\bhref="(https?:\/\/[^"]+)"/);
  if (!href) return etiqueta;
  const sinRel = etiqueta.replace(/\srel="[^"]*"/, '');
  const relPrevio = etiqueta.match(/\srel="([^"]*)"/)?.[1] ?? '';
  const rel = new Set(relPrevio.split(/\s+/).filter(Boolean));
  rel.add('noopener');
  rel.add('noreferrer');
  return sinRel.replace(/>$/, ` rel="${[...rel].join(' ')}">`);
}

export default defineConfig({
  site: sitio,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'directory',
    inlineStylesheets: 'never',
  },
  integrations: [revisarPublicacion()],
});
