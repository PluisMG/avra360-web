import { build } from 'esbuild';

await build({
  entryPoints: ['src/cliente/chat.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'public/chat.js',
});
