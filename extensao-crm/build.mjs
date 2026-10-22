// Build da extensão: esbuild gera cada parte como IIFE em dist/ (carregar no Chrome como "sem compactação").
// Uso: node build.mjs          (build único)
//      node build.mjs --watch  (recompila ao salvar; depois é só clicar em ↻ no card da extensão)
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const dist = 'dist';

rmSync(dist, { recursive: true, force: true });
mkdirSync(`${dist}/vendor`, { recursive: true });
cpSync('public', dist, { recursive: true });
// wa-js (WPPConnect, Apache-2.0): camada que conversa com o WhatsApp Web por dentro
cpSync('node_modules/@wppconnect/wa-js/dist/wppconnect-wa.js', `${dist}/vendor/wa-js.js`);

const opcoes = {
  entryPoints: {
    bridge: 'src/bridge/index.ts',
    content: 'src/content/index.tsx',
    background: 'src/background/index.ts',
  },
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome114',
  jsx: 'automatic',
  loader: { '.css': 'text', '.woff2': 'dataurl' },
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
};

if (watch) {
  const ctx = await esbuild.context(opcoes);
  await ctx.watch();
} else {
  await esbuild.build(opcoes);
}
