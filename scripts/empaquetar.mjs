import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const ejecutar = promisify(execFile);
const store = process.env.AGENT_STORE ?? '/cursor/stores/self';

await ejecutar('npm', ['run', 'build'], {
  env: { ...process.env, PREVIEW: '1' },
});

await mkdir(store, { recursive: true });
await build({
  entryPoints: ['worker/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: path.join(store, 'worker.mjs'),
  external: ['cloudflare:workers'],
  loader: { '.txt': 'text' },
});

const config = await readFile('worker-config.json', 'utf8');
await writeFile(path.join(store, 'worker-config.json'), config.endsWith('\n') ? config : `${config}\n`);
await ejecutar('tar', ['-czf', path.join(store, 'dist.tar.gz'), 'dist']);
