// Exporta a cifra principal de cada música em linhas, com o número (k) de cada acorde
// igual ao da tela (telas/cifra.js → htmlCifra).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const app = process.argv[2];
const saida = process.argv[3];
const { ler } = await import(pathToFileURL(`${app}/js/dados/cifras.js`).href);
const { tipoParte } = await import(pathToFileURL(`${app}/js/dados/ritmos.js`).href);
const musicas = JSON.parse(readFileSync(`${app}/dados-teste/cifras-teste.json`, 'utf8'));

const out = {};
for (const m of musicas) {
  let k = 0;
  let secao = 'Intro';
  let parte = 'intro';
  const linhas = [];
  for (const b of ler(m.cifra)) {
    if (b.tipo === 'secao') {
      if (!/^(tab|dedilhado)\b/i.test(b.nome)) { secao = b.nome; parte = tipoParte(b.nome); }
      continue;
    }
    if (b.tipo !== 'linha') continue;
    const acordes = [];
    let texto = '';
    for (const p of b.partes) {
      if (p.acorde) acordes.push({ k: k++, acorde: p.acorde, pos: texto.length });
      texto += b.soAcordes ? '' : p.texto;
    }
    if (!acordes.length && !texto.trim()) continue;
    linhas.push({ secao, parte, texto: texto.trim() ? texto : '', acordes, soAcordes: !!b.soAcordes });
  }
  out[m.id] = { tom: m.tom, forma: m.forma, capo: m.capo || 0, afinacao: m.afinacao, total: k, linhas };
}
writeFileSync(saida, JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([id, x]) => `${id}: ${x.total} acordes, ${x.linhas.length} linhas, tom ${x.tom}, capo ${x.capo}, ${x.afinacao}`).join('\n'));
