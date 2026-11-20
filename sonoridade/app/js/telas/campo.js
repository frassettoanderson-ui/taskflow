// Campo harmônico: os sete acordes que "moram" num tom, nascidos da escala.
// Por enquanto só Dó maior (só notas naturais, o mais fácil de enxergar). Mostra a escala (tom/semitom),
// como cada acorde nasce pulando notas, os 7 graus com desenho e som, e as sequências mais usadas em louvor.
import { SEQUENCIAS_MAIOR } from '../dados/campo.js';
import { posicao } from '../dados/teoria.js';
import { braco, vibrar } from '../ui/braco.js';
import { barraTopo, esc, ICONES } from '../ui/comum.js';
import * as som from '../audio/som.js';

const NOMES_PT = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };
const TONS = {
  C: {
    nome: 'Dó maior',
    escala: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    midis: [48, 50, 52, 53, 55, 57, 59, 60],     // Dó grave até o Dó de cima
    acordes: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
  },
};
const PASSOS = ['T', 'T', '½', 'T', 'T', 'T', '½'];   // fórmula da escala maior
const GRAUS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const TIPO = ['maior', 'menor', 'menor', 'maior', 'maior', 'menor', 'diminuto'];
const FUNCAO = ['Casa', 'Caminho', 'Caminho', 'Afasta', 'Tensão', 'Casa menor', 'Tensão (raro)'];
// o cálculo automático transforma "dim" em diminuto com sétima; no campo é a tríade (Si, Ré, Fá)
const DIM = { Bdim: { simbolo: 'B°', nome: 'Si diminuto', casas: [-1, 2, 3, 4, 3, -1], dedos: [0, 1, 2, 4, 3, 0] } };
const pos = (s) => DIM[s] || posicao(s);
const mostrar = (s) => (DIM[s] ? DIM[s].simbolo : s);

export function montar(el) {
  const t = TONS.C;
  const st = { vez: 0 };
  const notasDo = (i) => [0, 2, 4].map((k) => t.escala[(i + k) % 7]);

  el.innerHTML = `
    ${barraTopo('Campo harmônico', '#/acordes')}
    <header class="ch-cabeca">
      <h2>${esc(t.nome)}</h2>
      <p>Os sete acordes que combinam entre si nesse tom. Começamos por Dó: só notas naturais, nenhum sustenido.</p>
    </header>

    <section class="ch-bloco">
      <h3>1. A escala</h3>
      <div class="ch-escala" id="escala">
        ${t.escala.concat(t.escala[0]).map((n, i) => `
          ${i ? `<span class="ch-passo${PASSOS[i - 1] === '½' ? ' meio' : ''}">${PASSOS[i - 1]}</span>` : ''}
          <button class="ch-nota" data-escala="${i}"><b>${NOMES_PT[n]}</b><small>${n}</small></button>`).join('')}
      </div>
      <p class="ch-texto"><strong>T</strong> (tom) = duas casas no braço. <strong>½</strong> (meio tom) = uma casa só. Essa fórmula, T T ½ T T T ½, é a mesma em qualquer escala maior.</p>
      <div class="ch-acoes"><button class="botao" id="ouvirEscala">${ICONES.play}<span>Ouvir a escala</span></button></div>
    </section>

    <section class="ch-bloco">
      <h3>2. Como nasce cada acorde</h3>
      <p class="ch-texto">Pegue uma nota da escala, pule a próxima, pegue a seguinte, pule de novo e pegue mais uma. Três notas: um acorde.</p>
      <div class="ch-pulo" id="pulo"></div>
    </section>

    <section class="ch-bloco">
      <h3>3. Os sete acordes</h3>
      <p class="ch-texto">Toque num acorde para ouvir. O número é o grau: o lugar dele dentro do tom.</p>
      <div class="mural ch-graus" id="graus">
        ${t.acordes.map((s, i) => {
          const a = pos(s);
          return `<div class="mural-cartao ch-grau${i === 6 ? ' raro' : ''}" data-sim="${esc(s)}">
            <button class="mural-tocar" data-tocar="${esc(s)}" aria-label="Ouvir ${esc(mostrar(s))}">
              <span class="mural-grau">${GRAUS[i]}<small>${esc(FUNCAO[i])}</small></span>
              <span class="mural-sim">${esc(mostrar(s))}</span>
              <span class="ch-tipo">${TIPO[i]}</span>
              <span class="ch-notas">${notasDo(i).map((n) => NOMES_PT[n]).join(' · ')}</span>
              ${braco(a, { orientacao: 'vertical' })}
            </button>
            ${i === 6 ? '<span class="ch-raro">Quase não aparece em louvor</span>' : `<a class="mural-abrir" href="#/acordes/todos/${encodeURIComponent(s)}">Detalhes ${ICONES.avancar}</a>`}
          </div>`;
        }).join('')}
      </div>
      <p class="ch-regra">maior · menor · menor · maior · maior · menor · diminuto<small>Essa ordem vale para todo tom maior. Sabendo a escala, você monta o campo de qualquer tom.</small></p>
      <p class="ch-texto">Lá menor (vi) é o <strong>relativo</strong> de Dó maior: usa as mesmas notas, só que começando do Lá. Por isso soa como "a casa triste".</p>
    </section>

    <section class="ch-bloco">
      <h3>4. Sequências que mais aparecem</h3>
      <div class="ch-seqs">
        ${SEQUENCIAS_MAIOR.map((q, k) => {
          const lista = q.graus.map((g) => t.acordes[g]);
          return `<div class="ch-seq" data-seq="${k}">
            <div class="ch-seq-topo">
              <strong>${esc(q.nome)}</strong>
              <span class="ch-seq-acordes">${lista.map((s) => `<i>${esc(mostrar(s))}</i>`).join('')}</span>
              <small>${esc(q.dica)}</small>
            </div>
            <div class="ch-seq-acoes">
              <button class="botao principal" data-ouvir="${k}" aria-label="Ouvir ${esc(q.nome)}">${ICONES.play}<span>Ouvir</span></button>
              <a class="botao" href="#/batidas/balada?seq=${encodeURIComponent(lista.join(','))}">Treinar</a>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);

  // ---------- como nasce: escolhe o grau e mostra as notas pegas e puladas ----------
  let grauPulo = 0;
  function desenharPulo() {
    const pegas = [0, 2, 4].map((k) => (grauPulo + k) % 7);
    $('#pulo').innerHTML = `
      <div class="ch-pulo-linha">
        ${Array.from({ length: 7 }, (_, k) => {
          const i = (grauPulo + k) % 7;
          const pega = pegas.includes(i) && k <= 4;
          return `<span class="ch-pulo-nota${pega ? ' pega' : k <= 4 ? ' pulada' : ''}">${NOMES_PT[t.escala[i]]}</span>`;
        }).join('')}
      </div>
      <p class="ch-pulo-res">${notasDo(grauPulo).map((n) => NOMES_PT[n]).join(' + ')} = <b>${esc(mostrar(t.acordes[grauPulo]))}</b></p>
      <div class="opcoes-linha ch-pulo-graus">
        ${GRAUS.map((g, i) => `<button class="opcao-linha${i === grauPulo ? ' ativo' : ''}" data-pulo="${i}">${g}</button>`).join('')}
      </div>`;
  }

  // ---------- tocar ----------
  function tocar(s, quando = 0) {
    const a = pos(s);
    if (!a) return;
    som.batida(a, { quando });
    const card = el.querySelector(`.ch-grau[data-sim="${CSS.escape(s)}"]`);
    const atraso = quando ? Math.max(0, (quando - som.tempoAudio()) * 1000) : 30;
    if (card) {
      setTimeout(() => {
        card.classList.remove('soando'); void card.offsetWidth; card.classList.add('soando');
        vibrar(card, a, { atraso: 0 });
      }, atraso);
    }
  }

  async function ouvirEscala() {
    const vez = ++st.vez;
    await som.prepararMidi(t.midis);
    if (vez !== st.vez) return;
    const botoes = [...el.querySelectorAll('.ch-nota')];
    t.midis.forEach((m, i) => {
      setTimeout(() => {
        if (vez !== st.vez) return;
        som.tocarMidi(m);
        botoes.forEach((b, j) => b.classList.toggle('soando', j === i));
        if (i === t.midis.length - 1) setTimeout(() => botoes[i].classList.remove('soando'), 700);
      }, i * 420);
    });
  }

  async function ouvirSeq(k) {
    const lista = SEQUENCIAS_MAIOR[k].graus.map((g) => t.acordes[g]);
    const vez = ++st.vez;
    await som.preparar(lista.map(pos));
    if (vez !== st.vez) return;
    const linha = el.querySelector(`.ch-seq[data-seq="${k}"]`);
    el.querySelectorAll('.ch-seq').forEach((x) => x.classList.toggle('tocando', x === linha));
    const itens = [...linha.querySelectorAll('.ch-seq-acordes i')];
    const inicio = som.contexto().currentTime + 0.1;
    lista.forEach((s, j) => {
      for (let b = 0; b < 2; b++) {
        const quando = inicio + j * 1.7 + b * 0.85;
        setTimeout(() => {
          if (vez !== st.vez) return;
          tocar(s, quando);
          if (b === 0) itens.forEach((x, n) => x.classList.toggle('agora', n === j));
        }, Math.max(0, (quando - som.contexto().currentTime - 0.15) * 1000));
      }
    });
    setTimeout(() => {
      if (vez !== st.vez) return;
      linha.classList.remove('tocando'); itens.forEach((x) => x.classList.remove('agora'));
    }, (lista.length * 1.7 + 0.6) * 1000);
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tocar) { st.vez++; tocar(b.dataset.tocar); return; }
    if (b.dataset.escala !== undefined) {
      st.vez++;
      const i = +b.dataset.escala;
      som.tocarMidi(t.midis[i]);
      b.classList.remove('soando'); void b.offsetWidth; b.classList.add('soando');
      return;
    }
    if (b.id === 'ouvirEscala') { ouvirEscala(); return; }
    if (b.dataset.pulo !== undefined) {
      grauPulo = +b.dataset.pulo; desenharPulo();
      st.vez++; tocar(t.acordes[grauPulo]);
      return;
    }
    if (b.dataset.ouvir !== undefined) ouvirSeq(+b.dataset.ouvir);
  });

  desenharPulo();
  som.preparar(t.acordes.map(pos));
  som.prepararMidi(t.midis);

  return () => { st.vez++; som.silenciar(); };
}
