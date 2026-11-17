// Gera testes/.saida/previa.html para ver a interface num navegador comum.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(aqui, 'previa.tsx')],
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.css': 'text' },
  outfile: path.join(aqui, '.saida', 'previa.js'),
  plugins: [{ name: 'simulador', setup: (b) => b.onResolve({ filter: /^\.\/(wa|iaCliente)$/ }, () => ({ path: path.join(aqui, 'simulador.ts') })) }],
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'error',
});
writeFileSync(path.join(aqui, '.saida', 'previa.html'), '<!doctype html><meta charset="utf-8"><title>Prévia CRM</title><body style="margin:0;height:100vh"><script src="previa.js"></script>');
console.log('ok:', path.join(aqui, '.saida', 'previa.html'));
