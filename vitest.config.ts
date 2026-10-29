import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          PREVIEW: '1',
          CHAT_ACTIVO: '1',
          ALMACENAMIENTO_ACTIVO: '0',
          AVISO_APROBADO: '0',
          PUBLIC_TURNSTILE_SITE_KEY: 'site-key-de-prueba',
          AVRA_WEBHOOK_URL: 'https://webhook.test/avra',
          AVRA_WEBHOOK_KEY: 'llave-webhook-de-prueba',
          AVRA_REPLY_SIGNING_SECRET: 'secreto-de-firma-de-prueba',
          TURNSTILE_SECRET_KEY: 'secreto-turnstile-de-prueba',
        },
      },
    }),
  ],
  test: {
    include: ['worker/**/*.test.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
