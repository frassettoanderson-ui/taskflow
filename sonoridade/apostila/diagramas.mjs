// Desenhos da apostila em SVG (vetor: fica nítido impresso e no PDF).
// Convenções (iguais às do app): braço deitado = visto de quem toca (6ª corda em cima, casa 1 à esquerda);
// diagrama de acorde = em pé, como em toda cifra (6ª corda à esquerda, pestana do violão em cima).

const TINTA = '#1d1a15';
const APAGADO = '#8a8170';
const LINHA = '#3a342a';
const OURO = '#b07d22';
const OURO_CLARO = '#e3ad45';
const PAPEL = '#fbf8f1';
const FONTE = "Archivo, sans-serif";

export const NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOMES_PT = { C: 'Dó', 'C#': 'Dó#', D: 'Ré', 'D#': 'Ré#', E: 'Mi', F: 'Fá', 'F#': 'Fá#', G: 'Sol', 'G#': 'Sol#', A: 'Lá', 'A#': 'Lá#', B: 'Si' };
// cordas soltas, da 6ª para a 1ª
export const CORDAS = ['E', 'A', 'D', 'G', 'B', 'E'];
export const nota = (corda, casa) => NOTAS[(NOTAS.indexOf(CORDAS[6 - corda]) + casa) % 12];

const t = (x, y, txt, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${o.f || FONTE}" font-size="${o.s || 11}" font-weight="${o.w || 600}" fill="${o.c || TINTA}" text-anchor="${o.a || 'middle'}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.st ? ` font-stretch="${o.st}"` : ''} dominant-baseline="${o.b || 'middle'}">${txt}</text>`;

// ---------- diagrama de acorde (em pé) ----------
// casas: 6 valores da 6ª para a 1ª ('x' = não toca, 0 = solta, n = casa); dedos: idem (número do dedo ou '')
// pestana: { casa, de, ate, dedo } (de/ate = número da corda, ex.: 6 a 1)
export function acorde({ casas, dedos = [], pestana = null, inicio = 1, trastes = 5, l = 112, destaque = [] }) {
  const pad = 18, esp = (l - pad * 2) / 5, alt = 21, topo = 30;
  const x = (i) => pad + i * esp;               // i = 0 → 6ª corda
  const y = (n) => topo + n * alt;
  const H = topo + trastes * alt + 10;
  let s = `<svg viewBox="0 0 ${l} ${H}" width="${l}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  // trastes
  for (let n = 0; n <= trastes; n++) s += `<line x1="${x(0)}" x2="${x(5)}" y1="${y(n)}" y2="${y(n)}" stroke="${LINHA}" stroke-width="${n === 0 && inicio === 1 ? 5 : 1.1}" stroke-linecap="square"/>`;
  // cordas (6ª mais grossa)
  for (let i = 0; i < 6; i++) s += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(0)}" y2="${y(trastes)}" stroke="${LINHA}" stroke-width="${1.6 - i * 0.16}"/>`;
  if (inicio > 1) s += t(x(0) - 10, y(0.5), `${inicio}ª`, { s: 10, w: 700, a: 'end', c: OURO });
  // x e o em cima
  casas.forEach((c, i) => {
    if (c === 'x') s += t(x(i), topo - 11, '×', { s: 13, w: 500, c: APAGADO });
    else if (c === 0) s += `<circle cx="${x(i)}" cy="${topo - 11}" r="4.2" fill="none" stroke="${TINTA}" stroke-width="1.3"/>`;
  });
  // pestana
  if (pestana) {
    const r = pestana.casa - inicio + 1;
    const i1 = 6 - pestana.de, i2 = 6 - pestana.ate;
    s += `<rect x="${x(i1) - 8}" y="${y(r - 0.5) - 8}" width="${x(i2) - x(i1) + 16}" height="16" rx="8" fill="${TINTA}"/>`;
    s += t((x(i1) + x(i2)) / 2, y(r - 0.5) + 0.5, pestana.dedo, { s: 10, w: 700, c: PAPEL });
  }
  casas.forEach((c, i) => {
    if (c === 'x' || c === 0 || c == null) return;
    const corda = 6 - i;
    if (pestana && c === pestana.casa && corda <= pestana.de && corda >= pestana.ate) return;
    const r = c - inicio + 1;
    const dest = destaque.includes(corda);
    s += `<circle cx="${x(i)}" cy="${y(r - 0.5)}" r="8" fill="${dest ? OURO : TINTA}"/>`;
    if (dedos[i]) s += t(x(i), y(r - 0.5) + 0.5, dedos[i], { s: 10, w: 700, c: PAPEL });
  });
  return s + '</svg>';
}

// diagrama vazio para o aluno desenhar
export const acordeVazio = (l = 112) => acorde({ casas: [null, null, null, null, null, null], l });

// ---------- braço deitado ----------
// marcas: [{ corda, casa, txt, cor: 'tinta'|'ouro'|'claro', dedo }]
export function braco({ ate = 12, marcas = [], nomes = true, numeros = true, w = 680, notasSoltas = false, rotuloCordas = 'nome' }) {
  const esq = nomes ? 58 : 14, dir = 10, topo = 16, esp = 22;
  const zero = notasSoltas ? 30 : 0;           // coluna da corda solta (antes da pestana)
  const larg = (w - esq - dir - zero) / ate;
  const X = (casa) => (casa === 0 ? esq + zero / 2 : esq + zero + (casa - 0.5) * larg);
  const Y = (corda) => topo + (corda - 1) * esp;  // corda 1 embaixo? não: 6ª em cima
  const Yc = (corda) => topo + (6 - corda) * esp;
  const H = topo + 5 * esp + (numeros ? 30 : 14);
  let s = `<svg viewBox="0 0 ${w} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`;
  const x0 = esq + zero, x1 = w - dir;
  s += `<rect x="${x0}" y="${topo - 9}" width="${x1 - x0}" height="${5 * esp + 18}" fill="#efe6d4" rx="2"/>`;
  // bolinhas do braço
  [3, 5, 7, 9, 15].filter((c) => c <= ate).forEach((c) => (s += `<circle cx="${X(c)}" cy="${topo + 2.5 * esp}" r="4.5" fill="#d9ccb0"/>`));
  if (ate >= 12) [1.5, 3.5].forEach((k) => (s += `<circle cx="${X(12)}" cy="${topo + k * esp}" r="4.5" fill="#d9ccb0"/>`));
  for (let c = 1; c <= ate; c++) s += `<line x1="${x0 + c * larg}" x2="${x0 + c * larg}" y1="${topo - 9}" y2="${topo + 5 * esp + 9}" stroke="#a89a7c" stroke-width="1.6"/>`;
  s += `<rect x="${x0 - 3}" y="${topo - 10}" width="6" height="${5 * esp + 20}" fill="${LINHA}" rx="1"/>`;
  for (let corda = 6; corda >= 1; corda--) {
    s += `<line x1="${notasSoltas ? esq + 4 : x0}" x2="${x1}" y1="${Yc(corda)}" y2="${Yc(corda)}" stroke="#6b604c" stroke-width="${0.9 + (corda - 1) * 0.28}"/>`;
    if (nomes) {
      const n = CORDAS[6 - corda];
      const rot = rotuloCordas === 'nome' ? `${corda}ª · ${NOMES_PT[n]}` : `${corda}ª`;
      s += t(esq - (notasSoltas ? 4 : 8), Yc(corda), rot, { s: 10, w: 700, a: 'end' });
    }
  }
  if (numeros) for (let c = 1; c <= ate; c++) s += t(X(c), topo + 5 * esp + 22, c, { s: 10, w: 700, c: [3, 5, 7, 9, 12, 15].includes(c) ? OURO : APAGADO });
  if (numeros && notasSoltas) s += t(X(0), topo + 5 * esp + 22, '0', { s: 10, w: 700, c: APAGADO });
  for (const m of marcas) {
    const cx = X(m.casa), cy = Yc(m.corda);
    const cor = m.cor === 'ouro' ? OURO : m.cor === 'claro' ? '#fff' : TINTA;
    const corT = m.cor === 'claro' ? TINTA : PAPEL;
    const r = m.r || 9;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cor}"${m.cor === 'claro' ? ` stroke="${LINHA}" stroke-width="1"` : ''}/>`;
    if (m.txt !== undefined) s += t(cx, cy + 0.5, m.txt, { s: m.s || (String(m.txt).length > 2 ? 7.6 : 9), w: 700, c: corT });
  }
  return s + '</svg>';
}

// mapa de todas as notas, casa 0 a 12
export function mapaNotas({ ate = 12, vazio = [], realce = null } = {}) {
  const marcas = [];
  for (let corda = 1; corda <= 6; corda++) for (let casa = 0; casa <= ate; casa++) {
    const n = nota(corda, casa);
    if (vazio.includes(corda) && casa > 0) { marcas.push({ corda, casa, cor: 'claro', txt: '' }); continue; }
    const natural = !n.includes('#');
    const cor = realce ? (n === realce ? 'ouro' : 'claro') : natural ? 'tinta' : 'claro';
    marcas.push({ corda, casa, cor, txt: realce && n !== realce ? '' : n, r: 9 });
  }
  return braco({ ate, marcas, notasSoltas: true, rotuloCordas: 'num' });
}

// ---------- teclado de uma oitava (para ver tom e semitom) ----------
export function teclado({ w = 560 } = {}) {
  const brancas = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
  const lb = w / brancas.length, H = 150;
  let s = `<svg viewBox="0 0 ${w} ${H + 46}" width="100%" xmlns="http://www.w3.org/2000/svg">`;
  brancas.forEach((n, i) => {
    const sem = (n === 'E' || n === 'B');
    s += `<rect x="${i * lb + 1}" y="1" width="${lb - 2}" height="${H}" rx="4" fill="#fff" stroke="${LINHA}" stroke-width="1.2"/>`;
    s += t(i * lb + lb / 2, H - 30, n, { s: 15, w: 800 });
    s += t(i * lb + lb / 2, H - 13, NOMES_PT[n], { s: 10, w: 600, c: APAGADO });
  });
  const pretas = { 0: 'C#', 1: 'D#', 3: 'F#', 4: 'G#', 5: 'A#' };
  Object.entries(pretas).forEach(([i, n]) => {
    const x = (+i + 1) * lb - lb * 0.3;
    s += `<rect x="${x}" y="1" width="${lb * 0.6}" height="${H * 0.58}" rx="3" fill="${TINTA}"/>`;
    s += t(x + lb * 0.3, H * 0.58 - 26, n, { s: 11, w: 800, c: OURO_CLARO });
    s += t(x + lb * 0.3, H * 0.58 - 12, NOMES_PT[n], { s: 8, w: 600, c: '#cfc6b4' });
  });
  // marcação Mi–Fá e Si–Dó
  [[2, 3], [6, 7]].forEach(([a]) => {
    const x = (a + 1) * lb;
    s += `<path d="M${x - lb * 0.42} ${H + 12} q${lb * 0.42} 14 ${lb * 0.84} 0" fill="none" stroke="${OURO}" stroke-width="2"/>`;
    s += t(x, H + 36, 'meio tom', { s: 10, w: 700, c: OURO });
  });
  return s + '</svg>';
}

// ---------- batida: 8 espaços (1 e 2 e 3 e 4 e) ----------
// padrao: 8 caracteres: B = bate para baixo, C = bate para cima, b/c = a mão passa no ar sem tocar
export function batida(padrao, { w = 520 } = {}) {
  const cont = ['1', 'e', '2', 'e', '3', 'e', '4', 'e'];
  const lc = w / 8, H = 104;
  let s = `<svg viewBox="0 0 ${w} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 0; i < 8; i++) {
    const cx = i * lc + lc / 2;
    const forte = i % 2 === 0;
    if (forte) s += `<rect x="${i * lc + 2}" y="0" width="${lc * 2 - 4}" height="${H}" rx="6" fill="${i % 4 === 0 ? '#f1e8d6' : '#f6efe2'}"/>`;
    const p = padrao[i];
    const baixo = p === 'B' || p === 'b';
    const toca = p === 'B' || p === 'C';
    const cor = toca ? TINTA : '#cbbf a5'.replace(' ', '');
    if (p && p !== '-') {
      const y1 = baixo ? 14 : 66, y2 = baixo ? 66 : 14;
      s += `<line x1="${cx}" x2="${cx}" y1="${y1}" y2="${baixo ? y2 - 9 : y2 + 9}" stroke="${cor}" stroke-width="${toca ? 5 : 3}" stroke-linecap="round"${toca ? '' : ' stroke-dasharray="2 5"'}/>`;
      s += baixo
        ? `<path d="M${cx - 10} ${y2 - 12} L${cx} ${y2 + 2} L${cx + 10} ${y2 - 12} Z" fill="${cor}"/>`
        : `<path d="M${cx - 10} ${y2 + 12} L${cx} ${y2 - 2} L${cx + 10} ${y2 + 12} Z" fill="${cor}"/>`;
    }
    s += t(cx, 88, cont[i], { s: forte ? 15 : 12, w: forte ? 800 : 600, c: forte ? TINTA : APAGADO });
  }
  return s + '</svg>';
}

// ---------- pulsos do metrônomo ----------
export function pulsos({ w = 560, bpm = 60, segundos = 4 } = {}) {
  const H = 70, esq = 10, dir = 10, larg = w - esq - dir;
  let s = `<svg viewBox="0 0 ${w} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`;
  s += `<line x1="${esq}" x2="${w - dir}" y1="34" y2="34" stroke="#cdbf9f" stroke-width="2"/>`;
  for (let k = 0; k <= segundos; k++) {
    const x = esq + (k / segundos) * larg;
    s += `<line x1="${x}" x2="${x}" y1="28" y2="40" stroke="${APAGADO}" stroke-width="1"/>`;
    s += t(x, 58, `${k} s`, { s: 9, w: 600, c: APAGADO });
  }
  const n = Math.floor((bpm / 60) * segundos);
  for (let k = 0; k < n; k++) {
    const x = esq + ((k * 60) / bpm / segundos) * larg;
    const um = k % 4 === 0;
    s += `<circle cx="${x + 6}" cy="34" r="${um ? 8 : 5.5}" fill="${um ? OURO : TINTA}"/>`;
    s += t(x + 6, 12, (k % 4) + 1, { s: 10, w: 800, c: um ? OURO : TINTA });
  }
  return s + '</svg>';
}

// ---------- escada dos graus (escala maior) ----------
export function escada(notas, { w = 600, titulo = '' } = {}) {
  const passos = ['T', 'T', 'S', 'T', 'T', 'T', 'S'];
  const H = 200, lb = (w - 20) / 8, base = 196;
  let s = `<svg viewBox="0 0 ${w} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`;
  let alt = 0;
  for (let i = 0; i < 8; i++) {
    const x = 10 + i * lb;
    const h = 58 + alt;
    s += `<rect x="${x + 3}" y="${base - h}" width="${lb - 6}" height="${h}" rx="5" fill="${i === 0 || i === 7 ? TINTA : '#efe6d4'}"/>`;
    s += t(x + lb / 2, base - h + 16, i === 7 ? '1' : i + 1, { s: 15, w: 800, c: i === 0 || i === 7 ? OURO_CLARO : OURO });
    s += t(x + lb / 2, base - h + 34, NOMES_PT[notas[i]] || notas[i], { s: 11, w: 700, c: i === 0 || i === 7 ? PAPEL : TINTA });
    s += t(x + lb / 2, base - h + 48, `(${notas[i]})`, { s: 9, w: 600, c: i === 0 || i === 7 ? '#cfc6b4' : APAGADO });
    if (i < 7) {
      const pas = passos[i];
      s += t(x + lb, base - h - 12 - (pas === 'T' ? 8 : 4), pas === 'T' ? 'tom' : 'semitom', { s: 8.5, w: 700, c: pas === 'S' ? OURO : APAGADO });
      alt += pas === 'T' ? 14 : 7;
    }
  }
  if (titulo) s += t(10, 12, titulo, { s: 12, w: 800, a: 'start' });
  return s + '</svg>';
}

// ---------- violão com as partes (esquemático, em pé) ----------
export function violao({ numerado = false } = {}) {
  const W = 520, H = 720, cx = 260;
  const nut = 118, ponte = 600, escalaFim = 420;
  const L = ponte - nut;
  const traste = (n) => nut + L * (1 - Math.pow(2, -n / 12));
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`;
  // corpo
  s += `<path d="M${cx},330 C${cx + 70},330 ${cx + 100},360 ${cx + 95},410 C${cx + 90},447 ${cx + 66},460 ${cx + 68},482 C${cx + 72},508 ${cx + 125},522 ${cx + 125},585 C${cx + 125},652 ${cx + 72},688 ${cx},688 C${cx - 72},688 ${cx - 125},652 ${cx - 125},585 C${cx - 125},522 ${cx - 72},508 ${cx - 68},482 C${cx - 66},460 ${cx - 90},447 ${cx - 95},410 C${cx - 100},360 ${cx - 70},330 ${cx},330 Z" fill="#e9d3a8" stroke="${LINHA}" stroke-width="2.4"/>`;
  s += `<path d="M${cx},338 C${cx + 64},338 ${cx + 92},366 ${cx + 87},410 C${cx + 82},447 ${cx + 58},462 ${cx + 60},482 C${cx + 64},510 ${cx + 117},524 ${cx + 117},585 C${cx + 117},646 ${cx + 68},680 ${cx},680 C${cx - 68},680 ${cx - 117},646 ${cx - 117},585 C${cx - 117},524 ${cx - 64},510 ${cx - 60},482 C${cx - 58},462 ${cx - 82},447 ${cx - 87},410 C${cx - 92},366 ${cx - 64},338 ${cx},338 Z" fill="none" stroke="#b9925a" stroke-width="1"/>`;
  // boca
  s += `<circle cx="${cx}" cy="462" r="38" fill="#2a2119"/><circle cx="${cx}" cy="462" r="44" fill="none" stroke="#9c7440" stroke-width="3"/><circle cx="${cx}" cy="462" r="49" fill="none" stroke="#9c7440" stroke-width="1"/>`;
  // braço + escala
  s += `<rect x="${cx - 22}" y="${nut - 2}" width="44" height="${escalaFim - nut}" fill="#4a3424" stroke="${LINHA}" stroke-width="1.6"/>`;
  for (let n = 1; n <= 19; n++) { const y = traste(n); if (y < escalaFim - 2) s += `<line x1="${cx - 22}" x2="${cx + 22}" y1="${y}" y2="${y}" stroke="#d8d0c0" stroke-width="1.6"/>`; }
  [3, 5, 7, 9].forEach((n) => (s += `<circle cx="${cx}" cy="${(traste(n) + traste(n - 1)) / 2}" r="3" fill="#efe6d4"/>`));
  [[-8], [8]].forEach(([d]) => (s += `<circle cx="${cx + d}" cy="${(traste(12) + traste(11)) / 2}" r="3" fill="#efe6d4"/>`));
  // cabeça (mão)
  s += `<path d="M${cx - 24},${nut} L${cx - 34},22 Q${cx},10 ${cx + 34},22 L${cx + 24},${nut} Z" fill="#4a3424" stroke="${LINHA}" stroke-width="2"/>`;
  s += `<rect x="${cx - 10}" y="34" width="20" height="70" rx="3" fill="#2a2119"/>`;
  [44, 66, 88].forEach((y) => {
    s += `<rect x="${cx - 58}" y="${y - 5}" width="20" height="10" rx="4" fill="#cfc6b4" stroke="${LINHA}" stroke-width="1"/>`;
    s += `<rect x="${cx + 38}" y="${y - 5}" width="20" height="10" rx="4" fill="#cfc6b4" stroke="${LINHA}" stroke-width="1"/>`;
  });
  // pestana (nut)
  s += `<rect x="${cx - 24}" y="${nut - 4}" width="48" height="7" fill="#f4efe4" stroke="${LINHA}" stroke-width="1"/>`;
  // cavalete + rastilho
  s += `<rect x="${cx - 52}" y="${ponte - 10}" width="104" height="24" rx="5" fill="#3a281b"/>`;
  s += `<rect x="${cx - 36}" y="${ponte - 3}" width="72" height="4" fill="#f4efe4"/>`;
  // cordas
  for (let i = 0; i < 6; i++) {
    const xa = cx - 17 + i * 6.8, xb = cx - 25 + i * 10;
    s += `<line x1="${xa}" x2="${xb}" y1="${nut}" y2="${ponte + 6}" stroke="#d9d4ca" stroke-width="${1.6 - i * 0.18}"/>`;
  }
  // rótulos: [texto, x do ponto, y do ponto, lado]
  const R = [
    ['Mão (cabeça)', cx - 30, 40, 'e'],
    ['Tarraxas', cx + 56, 66, 'd'],
    ['Pestana (nut)', cx - 24, nut, 'e'],
    ['Trastes', cx + 22, traste(4), 'd'],
    ['Casa', cx - 20, (traste(2) + traste(1)) / 2, 'e'],
    ['Braço / escala', cx - 22, traste(8), 'e'],
    ['Marcações', cx + 4, (traste(7) + traste(6)) / 2, 'd'],
    ['Boca', cx + 38, 462, 'd'],
    ['Tampo', cx - 105, 560, 'e'],
    ['Cavalete', cx + 52, ponte + 6, 'd'],
    ['Rastilho', cx - 36, ponte - 1, 'e'],
    ['Cordas', cx + 18, 520, 'd'],
    ['Corpo (caixa)', cx + 112, 640, 'd'],
  ];
  R.forEach(([txt, px, py, lado], k) => {
    const lx = lado === 'e' ? 120 : W - 120;
    s += `<polyline points="${px},${py} ${lado === 'e' ? lx + 10 : lx - 10},${py} " fill="none" stroke="${OURO}" stroke-width="1"/>`;
    s += `<circle cx="${px}" cy="${py}" r="2.6" fill="${OURO}"/>`;
    const rot = numerado ? `${k + 1}` : txt;
    if (numerado) {
      s += `<circle cx="${lado === 'e' ? lx : lx}" cy="${py}" r="10" fill="${TINTA}"/>` + t(lx, py + 0.5, rot, { s: 10, w: 800, c: PAPEL });
      s += `<line x1="${lado === 'e' ? lx - 14 : lx + 14}" x2="${lado === 'e' ? 8 : W - 8}" y1="${py + 8}" y2="${py + 8}" stroke="#cdbf9f" stroke-width="1"/>`;
    } else s += t(lado === 'e' ? lx + 4 : lx - 4, py, rot, { s: 12.5, w: 700, a: lado === 'e' ? 'end' : 'start' });
  });
  return s + '</svg>';
}

// ---------- mão esquerda (dedos numerados) ----------
export function mao() {
  const W = 300, H = 270;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`;
  const pele = '#efd9bb', borda = LINHA;
  // palma
  s += `<path d="M92,150 Q88,250 150,256 Q222,258 226,170 L226,140 L92,140 Z" fill="${pele}" stroke="${borda}" stroke-width="2"/>`;
  // dedos: [x, topo, largura, número, nome]
  const D = [[100, 62, 30, 1, 'indicador'], [134, 40, 30, 2, 'médio'], [168, 52, 30, 3, 'anelar'], [200, 86, 26, 4, 'mínimo']];
  D.forEach(([x, y, l, n]) => {
    s += `<rect x="${x}" y="${y}" width="${l}" height="${160 - y}" rx="${l / 2}" fill="${pele}" stroke="${borda}" stroke-width="2"/>`;
    s += `<circle cx="${x + l / 2}" cy="${y - 18}" r="12" fill="${TINTA}"/>` + t(x + l / 2, y - 17.5, n, { s: 13, w: 800, c: OURO_CLARO });
  });
  // polegar
  s += `<path d="M96,196 Q60,186 40,150 Q32,134 46,128 Q58,124 70,140 Q86,160 104,166" fill="${pele}" stroke="${borda}" stroke-width="2"/>`;
  s += `<circle cx="34" cy="108" r="12" fill="${APAGADO}"/>` + t(34, 108.5, 'P', { s: 12, w: 800, c: PAPEL });
  // tampa as emendas
  s += `<rect x="96" y="138" width="128" height="26" fill="${pele}"/>`;
  s += t(160, 205, 'mão esquerda', { s: 11, w: 700, c: '#a2876a' });
  return s + '</svg>';
}

// ---------- metrônomo (ícone) ----------
export function metronomo(l = 120) {
  return `<svg viewBox="0 0 120 150" width="${l}" xmlns="http://www.w3.org/2000/svg">
    <path d="M42 12 L78 12 L104 140 L16 140 Z" fill="${TINTA}"/>
    <path d="M47 20 L73 20 L94 124 L26 124 Z" fill="#2c2720"/>
    <line x1="60" y1="118" x2="80" y2="30" stroke="${OURO_CLARO}" stroke-width="3" stroke-linecap="round"/>
    <rect x="70" y="62" width="14" height="10" rx="2" transform="rotate(13 77 67)" fill="${OURO_CLARO}"/>
    <circle cx="60" cy="118" r="5" fill="${OURO_CLARO}"/>
    <rect x="16" y="136" width="88" height="8" rx="2" fill="${LINHA}"/>
  </svg>`;
}
