// Notas: o braço inteiro (corda solta até a casa 12) com o nome da nota em cada casa de cada corda.
// Tocar numa nota faz ela soar e acende todas as iguais no braço; a mesma altura exata ganha um anel.
// Mesma convenção dos desenhos de acorde (ui/braco.js):
//  - deitado (PC/tablet): 6ª corda em cima e a pestana do violão à direita, como olhando quem toca à sua frente
//  - em pé (celular): 6ª corda à esquerda e a pestana em cima, como diagrama de cifra
import { barraTopo, esc, ler, guardar } from '../ui/comum.js';
import * as som from '../audio/som.js';

const ABERTAS = [40, 45, 50, 55, 59, 64];            // 6ª → 1ª (Mi Lá Ré Sol Si Mi)
const CASAS = 12;
const NOMES = {
  pt: ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'],
  cifra: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
};
const NATURAL = [true, false, true, false, true, true, false, true, false, true, false, true];
const BOLINHAS = [3, 5, 7, 9];
// distância da pestana até cada traste, como no violão de verdade (cada casa ~6% menor que a anterior); casa 12 = 1
const D = (n) => (1 - 2 ** (-n / 12)) * 2;

export function montar(el) {
  const st = {
    nomes: ler('notas.nomes', 'pt'),
    sustenidos: ler('notas.sustenidos', true),
    sel: null,        // nota escolhida (0 a 11), acende todas as iguais
    exata: null,      // altura exata tocada (midi), ganha anel
  };

  el.classList.add('app-larga');
  el.innerHTML = `
    ${barraTopo('Notas', '#/acordes')}
    <p class="intro">A nota de cada casa, em cada corda. Toque numa nota para ouvir e ver onde mais ela aparece.</p>
    <div class="nt-controles">
      <div class="segmentado" id="nomes">
        <button data-nomes="pt">Dó Ré Mi</button>
        <button data-nomes="cifra">C D E</button>
      </div>
      <div class="segmentado" id="sust">
        <button data-sust="1">Com sustenidos</button>
        <button data-sust="0">Só naturais</button>
      </div>
    </div>
    <div class="nt-escolha" id="escolha"></div>
    <div class="nt-braco" id="braco"></div>
    <p class="nt-legenda" id="legenda"></p>
    <section class="nt-dicas">
      <div><strong>Casa 12</strong><span>É a corda solta de novo, uma oitava acima. Daí para frente o desenho se repete.</span></div>
      <div><strong>Mi–Fá e Si–Dó</strong><span>Não existe sustenido entre elas: de uma para a outra é só meio tom, uma casa.</span></div>
      <div><strong>Casa 5</strong><span>A casa 5 de uma corda é a mesma nota da próxima corda solta (6ª na casa 5 = Lá = 5ª solta). Só na 3ª corda é a casa 4. É assim que se afina de ouvido.</span></div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);

  const nomeDe = (pc) => NOMES[st.nomes][pc];
  let vertical = null;

  function desenharBraco() {
    vertical = window.innerWidth < 700;
    $('#braco').classList.toggle('em-pe', vertical);
    $('#braco').innerHTML = svgBraco(vertical);
  }

  function svgBraco(v) {
    // eixo "ao longo" do braço (casas) e eixo "através" (cordas), depois troca x/y conforme a orientação
    const W = v ? 400 : 1000, H = v ? 1000 : 330;
    const pestana = v ? 92 : W - 92;                     // posição da pestana no eixo ao longo
    const fimBraco = v ? H - 18 : 22;
    const comp = Math.abs(fimBraco - pestana);
    const sentido = v ? 1 : -1;                           // deitado: as casas crescem para a esquerda
    const traste = (n) => pestana + sentido * D(n) * comp;
    const solta = pestana - sentido * 46;                 // nota da corda solta, fora do braço
    const c0 = v ? 58 : 36, c5 = v ? W - 36 : H - 64;     // primeira e última corda no eixo através
    const gap = (c5 - c0) / 5;
    const corda = (i) => c0 + i * gap;                    // i = 0 → 6ª corda
    const P = (ao, at) => (v ? [at, ao] : [ao, at]);
    const r = v ? 20 : 19;

    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Braço do violão com as notas de cada casa">`;
    s += `<defs><linearGradient id="nt-madeira" ${v ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="0" y1="0" x2="0" y2="1"'}>
      <stop offset="0" stop-color="#2b1d13"/><stop offset=".5" stop-color="#22170f"/><stop offset="1" stop-color="#2b1d13"/></linearGradient></defs>`;
    // madeira
    const [mx, my] = P(Math.min(pestana, fimBraco), c0 - gap * 0.55);
    const [mw, mh] = v ? [c5 - c0 + gap * 1.1, comp] : [comp, c5 - c0 + gap * 1.1];
    s += `<rect class="nt-madeira" x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="url(#nt-madeira)" rx="3"/>`;
    // bolinhas de marcação
    const meio = (n) => (traste(n - 1) + traste(n)) / 2;
    BOLINHAS.forEach((n) => { const [x, y] = P(meio(n), corda(2.5)); s += `<circle class="nt-bolinha" cx="${x}" cy="${y}" r="7"/>`; });
    [1.5, 3.5].forEach((i) => { const [x, y] = P(meio(12), corda(i)); s += `<circle class="nt-bolinha" cx="${x}" cy="${y}" r="7"/>`; });
    // trastes e pestana
    for (let n = 0; n <= CASAS; n++) {
      const [x1, y1] = P(traste(n), c0 - gap * 0.55), [x2, y2] = P(traste(n), c5 + gap * 0.55);
      s += `<line class="${n === 0 ? 'nt-pestana' : 'nt-traste'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }
    // cordas (mais grossas embaixo do som)
    const esp = [3.4, 2.9, 2.4, 1.9, 1.5, 1.2];
    for (let i = 0; i < 6; i++) {
      const [x1, y1] = P(solta + sentido * r, corda(i)), [x2, y2] = P(fimBraco, corda(i));
      s += `<line class="nt-corda${i < 3 ? ' grossa' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${esp[i]}"/>`;
    }
    // número das casas
    for (let n = 0; n <= CASAS; n++) {
      const ao = n === 0 ? solta : meio(n);
      const [x, y] = v ? [16, ao + 5] : [ao, H - 18];
      const forte = n === 0 || BOLINHAS.includes(n) || n === 12;
      s += `<text class="nt-num${forte ? ' forte' : ''}" x="${x}" y="${y}" text-anchor="middle">${n === 0 ? 'solta' : n}</text>`;
    }
    // número das cordas
    for (let i = 0; i < 6; i++) {
      const [x, y] = v ? [corda(i), 18] : [W - 12, corda(i) + 5];
      s += `<text class="nt-cnum" x="${x}" y="${y}" text-anchor="${v ? 'middle' : 'end'}">${6 - i}ª</text>`;
    }
    // notas
    for (let i = 0; i < 6; i++) {
      for (let n = 0; n <= CASAS; n++) {
        const midi = ABERTAS[i] + n, pc = midi % 12;
        const nat = NATURAL[pc];
        if (!nat && !st.sustenidos) continue;
        const [x, y] = P(n === 0 ? solta : meio(n), corda(i));
        const cls = ['nt-nota', nat ? 'natural' : 'sust', n === 0 ? 'aberta' : '',
          st.sel === pc ? 'marcada' : '', st.exata === midi ? 'mesma' : ''].filter(Boolean).join(' ');
        const rr = nat ? r : r - 3;
        const nome = nomeDe(pc);
        s += `<g class="${cls}" data-midi="${midi}" tabindex="0" role="button" aria-label="${esc(nome)}, ${6 - i}ª corda, ${n === 0 ? 'solta' : `casa ${n}`}">
          <circle cx="${x}" cy="${y}" r="${rr}"/>
          <text x="${x}" y="${y + (nome.length > 3 ? 4.5 : 5)}" text-anchor="middle" font-size="${nome.length > 3 ? 12.5 : nat ? 15 : 13.5}">${esc(nome)}</text>
        </g>`;
      }
    }
    return `${s}</svg>`;
  }

  function desenharEscolha() {
    const lista = [...Array(12).keys()].filter((pc) => st.sustenidos || NATURAL[pc]);
    $('#escolha').innerHTML = lista.map((pc) =>
      `<button class="nt-chip${NATURAL[pc] ? '' : ' sust'}${st.sel === pc ? ' ativo' : ''}" data-pc="${pc}">${esc(nomeDe(pc))}</button>`).join('');
  }

  function desenharLegenda() {
    const L = $('#legenda');
    if (st.sel === null) { L.textContent = 'Escolha uma nota acima ou toque no braço.'; return; }
    const quantas = ABERTAS.reduce((t, a) => t + [...Array(CASAS + 1).keys()].filter((n) => (a + n) % 12 === st.sel).length, 0);
    L.innerHTML = `<strong>${esc(nomeDe(st.sel))}</strong> aparece ${quantas} vezes até a casa 12.`
      + (st.exata !== null ? ' Com anel: a mesma altura exata que você tocou, em outra corda.' : '');
  }

  function desenhar() {
    el.querySelectorAll('#nomes button').forEach((b) => b.classList.toggle('ativo', b.dataset.nomes === st.nomes));
    el.querySelectorAll('#sust button').forEach((b) => b.classList.toggle('ativo', (b.dataset.sust === '1') === st.sustenidos));
    desenharEscolha();
    desenharBraco();
    desenharLegenda();
  }

  function tocarNota(midi) {
    st.exata = midi; st.sel = midi % 12;
    som.tocarMidi(midi);
    desenhar();
    // a bolinha tocada pulsa
    el.querySelectorAll(`.nt-nota[data-midi="${midi}"]`).forEach((x) => x.classList.add('soando'));
  }

  el.addEventListener('click', (e) => {
    const nota = e.target.closest('.nt-nota');
    if (nota) { tocarNota(+nota.dataset.midi); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.nomes) { st.nomes = b.dataset.nomes; guardar('notas.nomes', st.nomes); desenhar(); return; }
    if (b.dataset.sust) {
      st.sustenidos = b.dataset.sust === '1'; guardar('notas.sustenidos', st.sustenidos);
      if (!st.sustenidos && st.sel !== null && !NATURAL[st.sel]) { st.sel = null; st.exata = null; }
      desenhar(); return;
    }
    if (b.dataset.pc) {
      const pc = +b.dataset.pc;
      if (st.sel === pc && st.exata === null) st.sel = null; else { st.sel = pc; st.exata = null; }
      // toca a nota na região do meio do braço (a da 4ª/3ª corda)
      if (st.sel !== null) som.tocarMidi(48 + ((pc - 48 % 12 + 12) % 12));
      desenhar();
    }
  });
  el.addEventListener('keydown', (e) => {
    const nota = e.target.closest?.('.nt-nota');
    if (nota && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tocarNota(+nota.dataset.midi); }
  });

  // virar o celular troca o desenho
  let espera = 0;
  const aoRedimensionar = () => {
    clearTimeout(espera);
    espera = setTimeout(() => { if ((window.innerWidth < 700) !== vertical) desenharBraco(); }, 150);
  };
  window.addEventListener('resize', aoRedimensionar);

  desenhar();
  som.prepararMidi([...Array(CASAS + 25).keys()].map((k) => 40 + k));

  return () => { el.classList.remove('app-larga'); window.removeEventListener('resize', aoRedimensionar); clearTimeout(espera); som.silenciar(); };
}
