import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import type { AstroIntegration } from 'astro';
import { defineConfig, envField } from 'astro/config';
import { politicaCsp } from './src/config/csp';

const sitio = resolverSitio(process.env.SITE ?? 'https://mktcreativa.example');

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
        const inicio = paginas.find((archivo) => path.resolve(archivo) === path.join(raiz, 'index.html'));
        if (!inicio) {
          throw new Error(`No se encontró index.html en ${raiz} para calcular la CSP.`);
        }

        let jsonLd = '';
        for (const archivo of paginas) {
          const html = await readFile(archivo, 'utf8');
          const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
          for (const script of scripts) {
            const atributos = script[1] ?? '';
            const cuerpo = script[2] ?? '';
            const esJsonLd = /type="application\/ld\+json"/.test(atributos);
            const esExterno = /\bsrc=/.test(atributos);
            if (esExterno) continue;
            if (!esJsonLd) {
              throw new Error(`Hay un script en línea no permitido en ${archivo}. La CSP solo admite el JSON-LD.`);
            }
            if (!jsonLd) jsonLd = cuerpo;
            else if (cuerpo !== jsonLd) {
              throw new Error('El JSON-LD cambió entre páginas y el hash de la CSP dejaría de coincidir.');
            }
          }
          if (/<style[\s>]/i.test(html)) {
            throw new Error(`Hay un <style> en ${archivo}. El build deja el CSS en archivos para poder usar style-src 'self'.`);
          }
        }

        if (!jsonLd) throw new Error('No se encontró el JSON-LD.');
        const hash = createHash('sha256').update(jsonLd, 'utf8').digest('base64');
        const csp = politicaCsp({
          hash,
          accionFormulario: process.env.PUBLIC_MAILERLITE_FORM_ACTION,
        });

        const cuerpo = [
          '/*',
          '  X-Content-Type-Options: nosniff',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  X-Frame-Options: DENY',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
          `  Content-Security-Policy: ${csp}`,
          '',
          '/_astro/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
          '/scripts/*',
          '  Cache-Control: public, max-age=86400',
          '',
        ].join('\n');

        await writeFile(path.join(raiz, '_headers'), cuerpo, 'utf8');
      },
    },
  };
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
        return true;
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
      PUBLIC_MAILERLITE_FORM_ACTION: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
      PUBLIC_MAILERLITE_EMAIL_FIELD: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
      PUBLIC_MAILERLITE_NAME_FIELD: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
      PUBLIC_MAILERLITE_CONSENT_FIELD: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
      PUBLIC_GA4_ID: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_META_PIXEL_ID: envField.string({ context: 'server', access: 'public', optional: true }),
    },
  },
});
