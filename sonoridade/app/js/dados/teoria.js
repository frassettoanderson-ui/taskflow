// Teoria para as cifras: ler o símbolo do acorde (do jeito que se escreve no Brasil),
// transpor de tom e achar uma posição no violão para QUALQUER acorde — o dicionário de
// acordes.js só tem os mais comuns; o resto é calculado procurando a posição mais confortável.

import { ACORDES } from './acordes.js';

const LETRA = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOME_PT = ['Dó', 'Dó sustenido', 'Ré', 'Mi bemol', 'Mi', 'Fá', 'Fá sustenido', 'Sol', 'Sol sustenido', 'Lá', 'Si bemol', 'Si'];
const NOME_PT_BEMOL = { 1: 'Ré bemol', 6: 'Sol bemol', 8: 'Lá bemol' };
// nome dos tons como costuma aparecer em cifra
const TONS_MAIORES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const TONS_MENORES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

const ABERTAS = [40, 45, 50, 55, 59, 64]; // 6ª → 1ª

export function classe(nota) {
  const m = /^([A-G])([#b]?)$/.exec(nota || '');
  if (!m) return null;
  return (LETRA[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}

// "F7M(2)/C" → { raiz: 'F', resto: '7M(2)', baixo: 'C' }
const FORMA = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/;
export function separar(simbolo) {
  const m = FORMA.exec(String(simbolo).trim());
  if (!m) return null;
  return { raiz: m[1], resto: m[2], baixo: m[3] || null };
}
export const ehAcorde = (s) => {
  const p = separar(s);
  return !!p && /^[\dmMajdinsugo°ø+#b()/,.\-]*$/.test(p.resto);
};

// ---------- tom ----------
export function usaBemol(tom) {
  const p = separar(tom);
  if (!p) return false;
  if (p.raiz.includes('b')) return true;
  return ['F', 'Dm', 'Gm', 'Cm', 'Fm'].includes(p.raiz + (p.resto.startsWith('m') ? 'm' : ''));
}

export function transporTom(tom, n) {
  const p = separar(tom);
  if (!p || !n) return tom;
  const c = (classe(p.raiz) + n + 120) % 12;
  return p.resto.startsWith('m') ? TONS_MENORES[c] : TONS_MAIORES[c];
}

// distância em semitons de um tom para outro (−5…+6, o caminho mais curto)
export function distancia(de, para) {
  const a = classe(separar(de)?.raiz), b = classe(separar(para)?.raiz);
  if (a === null || b === null) return 0;
  const d = (b - a + 12) % 12;
  return d > 6 ? d - 12 : d;
}

export function transporAcorde(simbolo, n, bemol = false) {
  if (!n) return simbolo;
  const p = separar(simbolo);
  if (!p) return simbolo;
  const nomes = bemol ? BEMOIS : SUSTENIDOS;
  const mover = (nota) => nomes[(classe(nota) + n + 120) % 12];
  return mover(p.raiz) + p.resto + (p.baixo ? `/${mover(p.baixo)}` : '');
}

// ---------- notas do acorde ----------
// Devolve os intervalos (semitons a partir da raiz) e quais são obrigatórios.
// Notação brasileira: 9 sozinho = com nona (sem sétima), 7M = sétima maior, 4 = suspenso de quarta,
// 2 = suspenso de segunda, (…) = notas acrescentadas, ° = diminuto, 5 = só raiz e quinta.
export function intervalos(resto) {
  let r = resto.replace(/\s/g, '').replace(/add/g, '').replace(/sus/g, '');
  const parenteses = [];
  r = r.replace(/\(([^)]*)\)/g, (_, dentro) => { parenteses.push(...dentro.split(/[/,]/)); return ''; });

  let terca = 4, quinta = 7, setima = null;
  const extras = new Set();
  let quintaObrigatoria = false;
  let soQuinta = false;

  if (/^5$/.test(r)) { soQuinta = true; r = ''; }
  if (/^(°|º|dim)/.test(r)) { terca = 3; quinta = 6; quintaObrigatoria = true; r = r.replace(/^(°|º|dim)/, ''); if (!r) setima = 9; }
  else if (/^ø/.test(r)) { terca = 3; quinta = 6; setima = 10; quintaObrigatoria = true; r = r.slice(1); }
  else if (/^(\+|aug)/.test(r)) { quinta = 8; quintaObrigatoria = true; r = r.replace(/^(\+|aug)/, ''); }
  else if (/^m(?!aj)/.test(r)) { terca = 3; r = r.slice(1); }

  // número principal
  const nucleo = (tok) => {
    if (/^(7M|maj7|M7|7\+)/.test(tok)) { setima = 11; return tok.replace(/^(7M|maj7|M7|7\+)/, ''); }
    if (/^13/.test(tok)) { setima = setima ?? 10; extras.add(9); return tok.slice(2); }
    if (/^11/.test(tok)) { setima = setima ?? 10; extras.add(5); return tok.slice(2); }
    if (/^9/.test(tok)) { extras.add(2); return tok.slice(1); }
    if (/^7/.test(tok)) { setima = 10; return tok.slice(1); }
    if (/^6/.test(tok)) { extras.add(9); return tok.slice(1); }
    if (/^4/.test(tok)) { terca = 5; return tok.slice(1); }
    if (/^2/.test(tok)) { terca = 2; return tok.slice(1); }
    return null;
  };
  for (let guarda = 0; r && guarda < 6; guarda++) {
    const sobra = nucleo(r);
    if (sobra === null) break;
    r = sobra.replace(/^[/,.\-]/, '');
  }
  // 7 com 9 ("G7 9") quando o 9 veio depois do 7 já foi tratado como acrescentado

  for (const tokBruto of parenteses) {
    const tok = tokBruto.trim();
    if (!tok) continue;
    if (tok === '4') terca = 5;
    else if (tok === '2' || tok === '9') extras.add(2);
    else if (tok === 'b9') extras.add(1);
    else if (tok === '#9') extras.add(3);
    else if (tok === '11') extras.add(5);
    else if (tok === '#11') extras.add(6);
    else if (tok === '13' || tok === '6') extras.add(9);
    else if (tok === 'b13') extras.add(8);
    else if (tok === 'b5' || tok === '5-') { quinta = 6; quintaObrigatoria = true; }
    else if (tok === '#5' || tok === '5+') { quinta = 8; quintaObrigatoria = true; }
    else if (tok === '7M') setima = 11;
    else if (tok === '7') setima = 10;
  }

  if (soQuinta) return { todos: [0, 7], obrigatorios: [0, 7], soQuinta: true };
  const todos = new Set([0, terca, quinta]);
  if (setima !== null) todos.add(setima);
  extras.forEach((x) => todos.add(x));
  const obrigatorios = [...todos].filter((x) => x !== 7 || quintaObrigatoria);
  return { todos: [...todos], obrigatorios, soQuinta: false };
}

// ---------- posição no violão ----------
const memoria = new Map();

// Acorde pronto para desenhar e tocar: { simbolo, nome, casas, dedos, pestana? }
export function posicao(simbolo) {
  if (memoria.has(simbolo)) return memoria.get(simbolo);
  let a = null;
  // no Brasil "D2" e "D9" costumam ser o mesmo desenho
  const apelido = simbolo.replace(/^([A-G][#b]?)2$/, '$19');
  if (ACORDES[simbolo]) a = { simbolo, ...ACORDES[simbolo] };
  else if (ACORDES[apelido]) a = { simbolo, ...ACORDES[apelido], nome: ACORDES[apelido].nome };
  else {
    const p = separar(simbolo);
    if (p) {
      const { todos, obrigatorios, soQuinta } = intervalos(p.resto);
      const raiz = classe(p.raiz);
      const baixo = p.baixo ? classe(p.baixo) : raiz;
      const achado = procurar(raiz, baixo, todos, obrigatorios, soQuinta);
      if (achado) a = { simbolo, nome: nomePt(p, soQuinta), ...achado };
    }
  }
  memoria.set(simbolo, a);
  return a;
}

function procurar(raiz, baixo, todos, obrigatorios, soQuinta) {
  const notas = new Set(todos.map((i) => (raiz + i) % 12));
  notas.add(baixo);
  const precisa = new Set(obrigatorios.map((i) => (raiz + i) % 12));
  precisa.add(baixo);

  let melhor = null, melhorPontos = Infinity;
  const casas = [0, 0, 0, 0, 0, 0];

  const avaliar = () => {
    const soam = [];
    for (let i = 0; i < 6; i++) if (casas[i] >= 0) soam.push(i);
    if (soam.length < (soQuinta ? 2 : 4)) return;
    if (soQuinta && soam.length > 4) return;
    // cordas que soam precisam estar juntas (no máximo um buraco no meio)
    const buracos = soam.at(-1) - soam[0] + 1 - soam.length;
    if (buracos > 1) return;
    const grave = soam[0];
    if ((ABERTAS[grave] + casas[grave]) % 12 !== baixo) return;
    const tem = new Set(soam.map((i) => (ABERTAS[i] + casas[i]) % 12));
    for (const n of precisa) if (!tem.has(n)) return;

    const presas = soam.filter((i) => casas[i] > 0);
    const fr = presas.map((i) => casas[i]);
    const min = fr.length ? Math.min(...fr) : 0;
    const max = fr.length ? Math.max(...fr) : 0;
    if (max - min > 3) return;

    // dedos: até 4; se passar, só com pestana na casa mais baixa
    let pestana = null;
    if (presas.length > 4) {
      const primeira = soam.find((i) => casas[i] === min);
      for (let i = primeira; i < 6; i++) if (casas[i] < min) return;   // corda solta/calada debaixo da pestana
      const fora = presas.filter((i) => casas[i] > min).length;
      if (1 + fora > 4) return;
      pestana = { casa: min, de: 6 - primeira, ate: 1 };
    }

    const soltas = soam.filter((i) => casas[i] === 0).length;
    const caladas = 6 - soam.length;
    let pontos;
    if (soQuinta) {
      // power chord: 2 ou 3 cordas graves juntas, sem corda solta lá em cima
      pontos = min * 0.6 + Math.abs(soam.length - 3) * 2 + buracos * 3 + (grave >= 2 ? 3 : 0) + (min >= 3 ? soltas * 1.5 : 0);
    } else {
      pontos = min * 0.9
        + caladas * 0.9 + buracos * 3
        + presas.length * 0.35
        + (pestana ? 2.5 : 0)
        + (min >= 4 ? soltas * 1.4 : 0)
        + (max - min) * 0.3
        + (grave >= 2 ? 0.8 : 0)
        + (tem.has((raiz + 7) % 12) ? 0 : 0.5)
        - soam.length * 0.3;
    }
    if (pontos < melhorPontos) {
      melhorPontos = pontos;
      melhor = { casas: casas.slice(), pestana };
    }
  };

  for (let ini = 1; ini <= 10; ini++) {
    const opcoes = ABERTAS.map((ab) => {
      const o = [-1];
      if (notas.has(ab % 12)) o.push(0);
      for (let f = ini; f <= ini + 3; f++) if (notas.has((ab + f) % 12)) o.push(f);
      return o;
    });
    const rec = (i) => {
      if (i === 6) { avaliar(); return; }
      for (const f of opcoes[i]) { casas[i] = f; rec(i + 1); }
    };
    rec(0);
  }
  if (!melhor) return null;
  return { casas: melhor.casas, dedos: dedos(melhor.casas, melhor.pestana), ...(melhor.pestana ? { pestana: melhor.pestana } : {}) };
}

// numera os dedos: pestana = 1; o resto em ordem de casa, da corda grave para a aguda
function dedos(casas, pestana) {
  const d = casas.map(() => 0);
  let lista = casas.map((f, i) => ({ f, i })).filter((x) => x.f > 0);
  let prox = 1;
  if (pestana) {
    lista.forEach((x) => { if (x.f === pestana.casa && 6 - x.i <= pestana.de) d[x.i] = 1; });
    lista = lista.filter((x) => d[x.i] === 0);
    prox = 2;
  }
  if (!lista.length) return d;
  const base = pestana ? pestana.casa : Math.min(...lista.map((x) => x.f));
  lista.sort((a, b) => a.f - b.f || a.i - b.i);
  lista.forEach((x, k) => {
    const sobram = lista.length - k - 1;
    let dedo = Math.max(prox, x.f - base + 1);
    dedo = Math.max(prox, Math.min(dedo, 4 - sobram));
    d[x.i] = dedo;
    prox = dedo + 1;
  });
  return d;
}

// nome por extenso, simples ("Dó com sexta e nona, baixo em Sol")
function nomePt(p, soQuinta) {
  const raiz = (n) => (n.includes('b') && NOME_PT_BEMOL[classe(n)]) || NOME_PT[classe(n)];
  const r = p.resto;
  const partes = [];
  let base = raiz(p.raiz);
  if (soQuinta) base += ' com quinta (power chord)';
  else if (/^(°|º|dim)/.test(r)) base += ' diminuto';
  else if (/^m(?!aj)/.test(r)) base += ' menor';
  else if (!/^(4|2|sus)|\(4|\/4/.test(r)) base += ' maior';
  const sem = r.replace(/^(m(?!aj)|°|º|dim)/, '');
  if (/7M|maj7/.test(sem)) partes.push('sétima maior');
  else if (/(^|[^1])7/.test(sem)) partes.push('sétima');
  if (/(^|\()6/.test(sem)) partes.push('sexta');
  if (/(^|[(/])(9|2)(?!\d)|^9/.test(sem) || /^2/.test(sem)) partes.push(/^2/.test(sem) ? 'segunda' : 'nona');
  if (/(^|[(/])4(?!\d)|^4/.test(sem)) partes.push('quarta');
  if (/11/.test(sem)) partes.push('décima primeira');
  if (/13/.test(sem)) partes.push('décima terceira');
  let nome = base + (partes.length ? ` com ${juntar(partes)}` : '');
  if (p.baixo) nome += `, baixo em ${raiz(p.baixo)}`;
  return nome;
}
function juntar(l) { return l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l.at(-1)}`; }
