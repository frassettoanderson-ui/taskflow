// Cifras das músicas e a leitura do texto delas.
//
// PROVISÓRIO: as músicas de teste foram copiadas do Cifra Club (uso pessoal) e ficam em
// app/dados-teste/cifras-teste.json, FORA do git. Depois vem a importação por link/texto.
//
// Formato do texto (parecido com ChordPro):
//   {secao: Refrão}            começo de uma parte
//   Que me f[C6(9)]ez ...      acorde entre colchetes, em cima da sílaba que vem depois
//   [G9] [C6(9)]               linha só de acordes
//   {tab} ... {/tab}           tablatura, mostrada como está

import { ehAcorde } from './teoria.js';

export const ESTILOS = [
  { id: 'todos', nome: 'Todas' },
  { id: 'louvor', nome: 'Louvor' },
  { id: 'hino', nome: 'Hinos' },
];

let lista = null;
export function carregar() {
  if (!lista) {
    lista = fetch('dados-teste/cifras-teste.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return lista;
}

// Quando cada acorde toca na gravação original (medido no áudio): { id: { ate, eventos: [[seg, k], ...] } }
// k = posição do acorde na versão principal da cifra. "ate" = até onde o mapa vai.
let sinc = null;
export async function sincronia(id) {
  if (!sinc) sinc = fetch('dados-teste/sincronia.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return (await sinc)[id] || null;
}

export async function musica(id) {
  return (await carregar()).find((m) => m.id === id) || null;
}

// versão escolhida: { tom, forma, capo, cifra }
export function versao(m, qual) {
  if (qual === 'simplificada' && m.simplificada) return m.simplificada;
  return { tom: m.tom, forma: m.forma, capo: m.capo || 0, cifra: m.cifra };
}

// Texto → blocos:
//  { tipo: 'secao', nome }
//  { tipo: 'tab', linhas: [] }
//  { tipo: 'linha', partes: [{ acorde, texto }], soAcordes }
//  { tipo: 'vazia' }
export function ler(texto) {
  const blocos = [];
  let tab = null;
  for (const bruta of String(texto || '').split('\n')) {
    const linha = bruta.replace(/\s+$/, '');
    if (tab) {
      if (linha.trim() === '{/tab}') { blocos.push(tab); tab = null; }
      else tab.linhas.push(linha);
      continue;
    }
    if (linha.trim() === '{tab}') { tab = { tipo: 'tab', linhas: [] }; continue; }
    const secao = /^\{secao:\s*(.*)\}$/.exec(linha.trim());
    if (secao) { blocos.push({ tipo: 'secao', nome: secao[1] }); continue; }
    if (!linha.trim()) { blocos.push({ tipo: 'vazia' }); continue; }

    // "( G9 C6(9) G9/B )": linha só de acordes, escrita sem colchetes
    const solta = /^\s*\(\s*(.+?)\s*\)\s*$/.exec(linha);
    if (solta && !linha.includes('[')) {
      const toks = solta[1].split(/\s+/);
      if (toks.every(ehAcorde)) {
        blocos.push({ tipo: 'linha', soAcordes: true, partes: toks.map((t) => ({ acorde: t, texto: '' })) });
        continue;
      }
    }

    const pedacos = linha.split(/\[([^\]]+)\]/);
    const partes = [{ acorde: null, texto: pedacos[0] }];
    for (let i = 1; i < pedacos.length; i += 2) {
      const ac = pedacos[i];
      const depois = pedacos[i + 1] ?? '';
      if (ehAcorde(ac)) partes.push({ acorde: ac, texto: depois });
      else partes.at(-1).texto += `[${ac}]${depois}`;   // colchete que não é acorde
    }
    const limpa = partes.filter((p) => p.acorde || p.texto);
    blocos.push({
      tipo: 'linha',
      partes: limpa,
      soAcordes: limpa.some((p) => p.acorde) && limpa.every((p) => !p.texto.trim()),
    });
  }
  if (tab) blocos.push(tab);
  // tira linhas vazias repetidas
  return blocos.filter((b, i) => !(b.tipo === 'vazia' && (i === 0 || blocos[i - 1].tipo === 'vazia' || blocos[i - 1].tipo === 'secao')));
}
