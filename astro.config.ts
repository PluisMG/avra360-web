import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import type { AstroIntegration } from 'astro';
import { defineConfig, envField } from 'astro/config';
import { clasificarReporteCsp, encabezadoReportingEndpoints, politicaCsp } from './src/config/csp';
import { mapaLastmodBoletin } from './src/config/ediciones-sitemap';
import { revisarDirectorioPublico } from './src/config/publicacion';

const sitio = resolverSitio(process.env.SITE ?? 'https://mktcreativa.example');
const directorioBoletin = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src/content/boletin');

let cacheLastmod: Promise<Map<string, string>> | undefined;
function fechasDeEdiciones() {
  cacheLastmod ??= mapaLastmodBoletin(directorioBoletin);
  return cacheLastmod;
}

function resolverSitio(valor: string) {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('SITE debe ser una URL absoluta, por ejemplo https://tu-dominio.mx');
  }
  if (url.username || url.password) {
    throw new Error('SITE no debe incluir usuario ni contraseña.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('SITE debe usar http o https.');
  }
  return url.origin;
}

async function listarHtml(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const archivos: string[] = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) archivos.push(...(await listarHtml(ruta)));
    else if (entrada.name.endsWith('.html')) archivos.push(ruta);
  }
  return archivos;
}

function encabezadosCloudflare(): AstroIntegration {
  return {
    name: 'encabezados-cloudflare',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const raiz = path.resolve(fileURLToPath(dir));
        const paginas = await listarHtml(raiz);
        for (const archivo of paginas) {
          const html = await readFile(archivo, 'utf8');
          const ajustado = html.replace(/<a\b[^>]*>/g, enlaceExterno);
          if (ajustado !== html) await writeFile(archivo, ajustado);
        }
        const inicio = paginas.find((archivo) => path.resolve(archivo) === path.join(raiz, 'index.html'));
        if (!inicio) {
          throw new Error(`No se encontró index.html en ${raiz} para calcular la CSP.`);
        }

        const cuerposJsonLd = new Set<string>();
        for (const archivo of paginas) {
          const html = await readFile(archivo, 'utf8');
          const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
          for (const script of scripts) {
            const atributos = script[1] ?? '';
            const cuerpo = script[2] ?? '';
            const esJsonLd = /type=["']application\/ld\+json["']/.test(atributos);
            const esExterno = /\bsrc=/.test(atributos);
            if (esExterno) continue;
            if (!esJsonLd) {
              throw new Error(`Hay un script en línea no permitido en ${archivo}. La CSP solo admite el JSON-LD.`);
            }
            if (!cuerpo.trim()) throw new Error(`JSON-LD vacío en ${archivo}.`);
            try {
              JSON.parse(cuerpo);
            } catch {
              throw new Error(`El JSON-LD de ${archivo} no se puede leer como JSON.`);
            }
            if (cuerpo.includes('{{')) throw new Error(`El JSON-LD de ${archivo} trae un marcador {{.`);
            cuerposJsonLd.add(cuerpo);
          }
          if (/<style[\s>]/i.test(html)) {
            throw new Error(`Hay un <style> en ${archivo}. El build deja el CSS en archivos para poder usar style-src 'self'.`);
          }
        }

        if (cuerposJsonLd.size === 0) throw new Error('No se encontró el JSON-LD.');
        const scriptConsent = await readFile(path.join(raiz, 'scripts/consentimiento.js'));
        const hashConsent = createHash('sha256').update(scriptConsent).digest('base64');
        const htmlInicio = await readFile(inicio, 'utf8');
        if (!htmlInicio.includes(`integrity="sha256-${hashConsent}"`)) {
          throw new Error('El integrity del script de consentimiento no coincide con el archivo publicado.');
        }
        const hashes = [
          ...[...cuerposJsonLd].map((cuerpo) => createHash('sha256').update(cuerpo, 'utf8').digest('base64')),
          hashConsent,
        ];
        const reporte = clasificarReporteCsp(process.env.CSP_REPORT_URL);
        if (!reporte.lista && reporte.motivo === 'url-invalida') {
          throw new Error('CSP_REPORT_URL debe ser una URL https absoluta, sin usuario ni contraseña.');
        }
        const csp = politicaCsp({
          hashes,
          reporte: reporte.lista ? reporte.url : undefined,
        });

        const lineasEncabezado = [
          '/*',
          '  X-Content-Type-Options: nosniff',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  X-Frame-Options: DENY',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
          '  Strict-Transport-Security: max-age=31536000',
          `  Content-Security-Policy: ${csp}`,
        ];
        if (reporte.lista) {
          lineasEncabezado.push(`  Reporting-Endpoints: ${encabezadoReportingEndpoints(reporte.url)}`);
        }
        const cuerpo = [
          ...lineasEncabezado,
          '',
          '/favicon.ico',
          '  Content-Type: image/png',
          '',
          '/_astro/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
          '/scripts/*',
          '  Cache-Control: public, max-age=86400',
          '',
        ].join('\n');

        await writeFile(path.join(raiz, '_headers'), cuerpo, 'utf8');

        const indice = path.join(raiz, 'sitemap-index.xml');
        const mapa = await readFile(indice).catch(() => {
          throw new Error('No se encontró sitemap-index.xml para publicar /sitemap.xml.');
        });
        await writeFile(path.join(raiz, 'sitemap.xml'), mapa);

        const hallazgos = await revisarDirectorioPublico(raiz);
        if (hallazgos.length > 0) {
          throw new Error(`El build público incluye texto que no debe publicarse:\n${hallazgos.join('\n')}`);
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
  const rel = new Set(relPrevio.split(/\s+/).filter((valor) => valor && valor !== 'nofollow'));
  rel.add('noopener');
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
  integrations: [
    sitemap({
      filter: (pagina) => {
        const url = new URL(pagina);
        if (url.pathname.endsWith('.xml') || url.pathname.endsWith('.txt')) return false;
        if (url.pathname.includes('/404')) return false;
        if (url.pathname.includes('/boletin/ejemplo-')) return false;
        if (url.pathname.includes('/aviso-de-privacidad')) return false;
        if (url.pathname.includes('/boletin/enviado')) return false;
        if (url.pathname.includes('/boletin/confirmada')) return false;
        if (url.pathname.includes('/boletin/enlace-no-valido')) return false;
        if (url.pathname.includes('/boletin/baja-confirmada')) return false;
        return true;
      },
      async serialize(item) {
        const mapa = await fechasDeEdiciones();
        const ruta = new URL(item.url).pathname.replace(/\/$/, '') || '/';
        const fecha = mapa.get(ruta);
        if (!fecha) return item;
        return { ...item, lastmod: fecha };
      },
    }),
    encabezadosCloudflare(),
  ],
  env: {
    schema: {
      PREVIEW: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_MOSTRAR_EDICION_EJEMPLO: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
      BOLETIN_ACTIVO: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_GA4_ID: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_META_PIXEL_ID: envField.string({ context: 'server', access: 'public', optional: true }),
    },
  },
});
