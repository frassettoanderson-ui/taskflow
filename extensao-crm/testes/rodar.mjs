// Monta os testes com o simulador no lugar do WhatsApp e da IA, e roda no Node.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const saida = path.join(aqui, '.saida', 'atendimento.mjs');

// chrome.storage em memória + window = globalThis
const CHROME_FALSO = `
globalThis.window = globalThis;
const __dados = {}; const __ouv = new Set();
globalThis.chrome = {
  storage: {
    local: {
      async get(k) { const ks = typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(__dados); const r = {}; for (const x of ks) if (x in __dados) r[x] = structuredClone(__dados[x]); return r; },
      async set(o) { const mud = {}; for (const [k, v] of Object.entries(o)) { mud[k] = { newValue: v }; __dados[k] = structuredClone(v); } __ouv.forEach((f) => f(mud, 'local')); },
      async remove(k) { delete __dados[k]; },
    },
    onChanged: { addListener: (f) => __ouv.add(f), removeListener: (f) => __ouv.delete(f) },
  },
  runtime: { sendMessage: async () => ({}) },
};
`;

const simulador = {
  name: 'simulador',
  setup(b) {
    b.onResolve({ filter: /^\.\/(wa|iaCliente)$/ }, () => ({ path: path.join(aqui, 'simulador.ts') }));
  },
};

await build({
  entryPoints: [path.join(aqui, 'atendimento.teste.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: saida,
  plugins: [simulador],
  banner: { js: CHROME_FALSO },
  logLevel: 'error',
});

execFileSync(process.execPath, [saida], { stdio: 'inherit', cwd: path.dirname(saida) });
