// Acordes: um mural. Cada cartão já mostra o desenho do braço; tocar no cartão faz o acorde soar
// (e as cordas do desenho vibrarem). No topo, um campo para escrever QUALQUER acorde e ver na hora
// onde vão os dedos. "Por tom" mostra o campo harmônico com os graus e toca a sequência mais usada.
import { GRUPOS, TONS, GRAUS, FUNCAO_GRAU } from '../dados/acordes.js';
import { posicao, ehAcorde } from '../dados/teoria.js';
import { braco, vibrar } from '../ui/braco.js';
import { barraTopo, lerQuery, esc, ICONES } from '../ui/comum.js';
import * as som from '../audio/som.js';

const EXEMPLOS = ['C6(9)', 'F#m7', 'D/F#', 'E7(4/9)', 'Bb7M'];
// I V vi IV: a sequência que mais aparece em louvor
const SEQUENCIA = [0, 4, 5, 3];

export function montar(el, query) {
  const q = lerQuery(query);
  const st = {
    modo: q.tom ? 'tom' : 'tipo',
    tom: TONS.some((t) => t.id === q.tom) ? q.tom : 'G',
    tocandoTom: 0,
  };

  el.innerHTML = `
    ${barraTopo('Acordes')}

    <section class="qualquer">
      <label class="busca qualquer-campo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
        <input id="busca" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false"
          placeholder="Procurar qualquer acorde" aria-label="Escreva um acorde">
      </label>
      <div class="qualquer-exemplos" id="exemplos">
        ${EXEMPLOS.map((x) => `<button class="opcao-linha" data-exemplo="${esc(x)}">${esc(x)}</button>`).join('')}
      </div>
      <div class="qualquer-resultado" id="resultado" hidden></div>
    </section>

    <div class="segmentado" id="modo">
      <button data-modo="tipo">Por tipo</button>
      <button data-modo="tom">Por tom</button>
    </div>
    <div id="corpo"></div>
  `;
  const $ = (s) => el.querySelector(s);

  // ---------- um cartão do mural ----------
  const cartao = (sim, extra = '', consulta = '') => {
    const a = posicao(sim);
    if (!a) return '';
    return `<div class="mural-cartao" data-sim="${esc(sim)}">
      <button class="mural-tocar" data-tocar="${esc(sim)}" aria-label="Ouvir ${esc(sim)}">
        ${extra}
        <span class="mural-sim">${esc(sim)}</span>
        <span class="mural-ext">${esc(a.nome)}</span>
        ${braco(a, { orientacao: 'vertical' })}
      </button>
      <a class="mural-abrir" href="#/acordes/${encodeURIComponent(sim)}${consulta ? `?${consulta}` : ''}" aria-label="Detalhes de ${esc(sim)}">
        Detalhes ${ICONES.avancar}
      </a>
    </div>`;
  };

  function tocar(sim, cartaoEl, quando = 0) {
    const a = posicao(sim);
    if (!a) return;
    som.batida(a, { quando });
    const atraso = quando ? Math.max(0, (quando - som.tempoAudio()) * 1000) : 30;
    if (cartaoEl) {
      setTimeout(() => {
        cartaoEl.classList.remove('soando');
        void cartaoEl.offsetWidth;      // reinicia a animação
        cartaoEl.classList.add('soando');
        vibrar(cartaoEl, a, { atraso: 0 });
      }, atraso);
    }
  }

  // ---------- por tipo: todos os grupos numa página só ----------
  let espiao = null;
  function desenharTipo() {
    $('#corpo').innerHTML = `
      <nav class="mural-indice" id="indice">
        ${GRUPOS.map((g, i) => `<a href="#" data-ir="${g.id}"${i === 0 ? ' class="ativo"' : ''}>${esc(g.nome)}</a>`).join('')}
      </nav>
      ${GRUPOS.map((g) => `
        <section class="mural-grupo" id="g-${g.id}" data-grupo="${g.id}">
          <header class="mural-cabeca">
            <h2>${esc(g.nome)}</h2>
            <p>${esc(g.dica)}</p>
          </header>
          <div class="mural">${g.acordes.map((s) => cartao(s, '', `lista=${g.id}`)).join('')}</div>
        </section>`).join('')}
      <p class="creditos">Toque no cartão para ouvir. Em "Detalhes", as dicas e o acorde corda por corda.</p>
    `;
    // o índice de cima acompanha o grupo que está na tela
    espiao?.disconnect();
    const links = [...el.querySelectorAll('#indice a')];
    espiao = new IntersectionObserver((itens) => {
      itens.forEach((it) => {
        if (!it.isIntersecting) return;
        links.forEach((l) => l.classList.toggle('ativo', l.dataset.ir === it.target.dataset.grupo));
        const ativo = links.find((l) => l.classList.contains('ativo'));
        const indice = $('#indice');
        if (ativo && indice) indice.scrollTo({ left: ativo.offsetLeft - (indice.clientWidth - ativo.offsetWidth) / 2, behavior: 'smooth' });
        history.replaceState(null, '', `#/acordes?lista=${it.target.dataset.grupo}`);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    el.querySelectorAll('.mural-grupo').forEach((s) => espiao.observe(s));
  }

  // ---------- por tom: campo harmônico ----------
  function desenharTom() {
    espiao?.disconnect();
    const t = TONS.find((x) => x.id === st.tom);
    const seq = SEQUENCIA.map((i) => t.acordes[i]);
    $('#corpo').innerHTML = `
      <div class="opcoes-linha" id="tons">
        ${TONS.map((x) => `<button class="opcao-linha${x.id === st.tom ? ' ativo' : ''}" data-tom="${x.id}">${x.nome}<small>${x.id}</small></button>`).join('')}
      </div>
      <p class="dica-grupo">Os 6 acordes que mais aparecem num louvor em ${esc(t.nome)}. O número é o grau: a "função" do acorde dentro do tom.</p>
      <div class="mural mural-tom">
        ${t.acordes.map((s, i) => cartao(s, `<span class="mural-grau">${GRAUS[i]}<small>${esc(FUNCAO_GRAU[i])}</small></span>`, `tom=${t.id}`)).join('')}
      </div>
      <div class="tom-ouvir">
        <button class="botao principal" id="ouvirTom">${ICONES.play}<span>Ouvir ${seq.join(' ')}</span></button>
        <a class="botao" href="#/batidas/balada?seq=${encodeURIComponent(seq.join(','))}">Treinar com batida</a>
      </div>
      <p class="tom-legenda">I V vi IV: a sequência que mais aparece em louvor.</p>
    `;
    history.replaceState(null, '', `#/acordes?tom=${t.id}`);
  }

  function desenhar() {
    el.querySelectorAll('#modo button').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === st.modo));
    st.tocandoTom++;
    if (st.modo === 'tipo') desenharTipo(); else desenharTom();
  }

  // toca I V vi IV marcando cada cartão
  async function ouvirTom() {
    const t = TONS.find((x) => x.id === st.tom);
    const vez = ++st.tocandoTom;
    const lista = SEQUENCIA.map((i) => t.acordes[i]);
    await som.preparar(lista.map(posicao));
    if (vez !== st.tocandoTom) return;
    const inicio = som.contexto().currentTime + 0.1;
    lista.forEach((s, k) => {
      const card = el.querySelector(`.mural-tom .mural-cartao[data-sim="${CSS.escape(s)}"]`);
      for (let b = 0; b < 2; b++) {
        const quando = inicio + k * 1.7 + b * 0.85;
        setTimeout(() => { if (vez === st.tocandoTom) tocar(s, card, quando); }, Math.max(0, (quando - som.contexto().currentTime - 0.15) * 1000));
      }
    });
  }

  // ---------- qualquer acorde ----------
  function normalizar(txt) {
    let s = txt.trim().replace(/\s+/g, '');
    if (!s) return '';
    s = s[0].toUpperCase() + s.slice(1);
    // baixo trocado também com letra maiúscula: d/f# → D/F#
    s = s.replace(/\/([a-g])/, (_, n) => `/${n.toUpperCase()}`);
    // "B" minúsculo depois da nota vira bemol: Bb, Eb...
    return s.replace(/^([A-G])B(?=$|[^a-z])/, '$1b');
  }
  function mostrarBusca(txt) {
    const s = normalizar(txt);
    const caixa = $('#resultado');
    if (!s) { caixa.hidden = true; return; }
    caixa.hidden = false;
    const a = ehAcorde(s) ? posicao(s) : null;
    if (!a) {
      caixa.innerHTML = `<p class="qualquer-nada">Ainda não reconheço "${esc(s)}". Tente algo como G, Am7, C6(9) ou D/F#.</p>`;
      return;
    }
    som.preparar([a]);
    caixa.innerHTML = `
      <div class="qualquer-cartao mural-cartao" data-sim="${esc(s)}">
        <div class="qualquer-topo">
          <span class="mural-sim">${esc(s)}</span>
          <span class="mural-ext">${esc(a.nome)}</span>
        </div>
        ${braco(a, { compacto: window.innerWidth < 600, orientacao: 'horizontal' })}
        <div class="acoes">
          <button class="botao principal" data-tocar="${esc(s)}">${ICONES.som}<span>Ouvir</span></button>
          <a class="botao" href="#/acordes/${encodeURIComponent(s)}">Detalhes</a>
        </div>
      </div>`;
  }
  $('#busca').addEventListener('input', (e) => mostrarBusca(e.target.value));

  // ---------- cliques ----------
  el.addEventListener('click', (e) => {
    const x = e.target.closest('button, a[data-ir]');
    if (!x) return;
    if (x.dataset.ir) {
      e.preventDefault();
      el.querySelector(`#g-${x.dataset.ir}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (x.dataset.tocar) { tocar(x.dataset.tocar, x.closest('.mural-cartao')); return; }
    if (x.dataset.exemplo) { $('#busca').value = x.dataset.exemplo; mostrarBusca(x.dataset.exemplo); return; }
    if (x.id === 'ouvirTom') { ouvirTom(); return; }
    if (x.dataset.modo) { if (x.dataset.modo === st.modo) return; st.modo = x.dataset.modo; desenhar(); return; }
    if (x.dataset.tom) { st.tom = x.dataset.tom; desenhar(); }
  });

  desenhar();
  // som dos acordes já baixando, para o primeiro toque soar gravado
  som.preparar(GRUPOS.flatMap((g) => g.acordes).map(posicao).filter(Boolean));
  // voltando de um acorde: rola até o grupo de onde saiu
  if (st.modo === 'tipo' && q.lista && q.lista !== GRUPOS[0].id) {
    requestAnimationFrame(() => el.querySelector(`#g-${q.lista}`)?.scrollIntoView({ block: 'start' }));
  }

  return () => { espiao?.disconnect(); st.tocandoTom++; som.silenciar(); };
}
