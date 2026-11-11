// Ferramentas: lista (#/ferramentas) e metrônomo (#/ferramentas/metronomo).
// O afinador continua na rota própria (#/afinador) e volta para cá.
import { barraTopo, guardar, ler, ICONES } from '../ui/comum.js';
import * as som from '../audio/som.js';

const ICONE = {
  afinador: `<svg class="icone" viewBox="0 0 64 64"><path d="M8 44a24 24 0 0 1 48 0"/><path d="M32 44L42 24"/><circle class="cheio" cx="32" cy="44" r="3.5"/><path d="M14 34l3 2M50 34l-3 2M32 20v4"/></svg>`,
  metronomo: `<svg class="icone" viewBox="0 0 64 64"><path d="M22 56h20l-6-46h-8z"/><path d="M18 56h28"/><path d="M32 44l12-26"/><circle class="cheio" cx="40" cy="27" r="3.5"/></svg>`,
};
const LISTA = [
  { href: '#/afinador', nome: 'Afinador', resumo: 'Violão, guitarra e baixo, pelo microfone', icone: 'afinador' },
  { href: '#/ferramentas/metronomo', nome: 'Metrônomo', resumo: 'Tempo, compasso, acento e bater no tempo', icone: 'metronomo' },
];

export function montar(el, id) {
  if (id === 'metronomo') return metronomo(el);
  el.innerHTML = `
    ${barraTopo('Ferramentas')}
    <p class="intro">O que todo músico deixa por perto na hora de estudar.</p>
    <nav class="ex-lista">
      ${LISTA.map((x) => `<a class="ex-cartao" href="${x.href}">${ICONE[x.icone]}<h2>${x.nome}</h2><p>${x.resumo}</p></a>`).join('')}
    </nav>`;
}

// ---------- metrônomo ----------
const COMPASSOS = [
  { id: '2', nome: '2/4', tempos: 2, sub: 1 },
  { id: '3', nome: '3/4', tempos: 3, sub: 1 },
  { id: '4', nome: '4/4', tempos: 4, sub: 1 },
  { id: '6', nome: '6/8', tempos: 6, sub: 1 },
];

function metronomo(el) {
  const st = {
    bpm: ler('metronomo.bpm', 80),
    compasso: ler('metronomo.compasso', '4'),
    acento: ler('metronomo.acento', true),
    tocando: false, timer: 0, prox: 0, tempo: 0, marcas: [], toques: [],
  };
  const comp = () => COMPASSOS.find((c) => c.id === st.compasso) || COMPASSOS[2];
  const salvar = () => { guardar('metronomo.bpm', st.bpm); guardar('metronomo.compasso', st.compasso); guardar('metronomo.acento', st.acento); };

  el.innerHTML = `
    ${barraTopo('Metrônomo', '#/ferramentas')}
    <div class="mt-tempos" id="tempos" aria-hidden="true"></div>
    <div class="mt-bpm">
      <button class="redondo" id="menos" aria-label="Mais devagar">${ICONES.menos || '−'}</button>
      <output id="bpm" aria-live="polite"></output>
      <button class="redondo" id="mais" aria-label="Mais rápido">${ICONES.mais || '+'}</button>
    </div>
    <p class="mt-rotulo">batidas por minuto</p>
    <input class="mt-faixa" id="faixa" type="range" min="40" max="220" step="1" aria-label="Batidas por minuto">
    <div class="acoes"><button class="botao principal" id="play"></button><button class="botao" id="bater">Bater no tempo</button></div>
    <div class="opcoes-linha" id="compassos">
      ${COMPASSOS.map((c) => `<button class="opcao-linha" data-c="${c.id}">${c.nome}</button>`).join('')}
    </div>
    <div class="segmentado"><button id="acento" aria-pressed="false">Acento no 1º tempo</button></div>
  `;
  const $ = (s) => el.querySelector(s);

  function desenhar() {
    $('#bpm').textContent = st.bpm;
    $('#faixa').value = st.bpm;
    $('#tempos').innerHTML = Array.from({ length: comp().tempos }, (_, i) => `<span class="mt-tempo${i === 0 && st.acento ? ' forte' : ''}"></span>`).join('');
    el.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('ativo', b.dataset.c === st.compasso));
    $('#acento').classList.toggle('ativo', st.acento);
    $('#acento').setAttribute('aria-pressed', String(st.acento));
    $('#play').innerHTML = st.tocando ? `${ICONES.pausa}<span>Parar</span>` : `${ICONES.play}<span>Tocar</span>`;
  }

  // agenda os cliques um pouco à frente, no relógio do áudio (não atrasa se a tela engasgar)
  function agendar() {
    if (!st.tocando) return;
    const c = som.contexto();
    while (st.prox < c.currentTime + 0.12) {
      const i = st.tempo % comp().tempos;
      const forte = i === 0 && st.acento;
      som.click(st.prox, forte, 0.6);
      const atraso = Math.max(0, (st.prox - c.currentTime) * 1000);
      st.marcas.push(setTimeout(() => acender(i), atraso));
      st.prox += 60 / st.bpm;
      st.tempo++;
    }
    if (st.marcas.length > 40) st.marcas = st.marcas.slice(-20);
  }
  function acender(i) {
    el.querySelectorAll('.mt-tempo').forEach((t, k) => t.classList.toggle('agora', k === i));
  }
  async function tocar() {
    if (st.tocando) { parar(); return; }
    const c = som.contexto();
    try { await c.resume(); } catch { /* segue */ }
    st.tocando = true;
    st.tempo = 0;
    st.prox = c.currentTime + 0.08;
    clearInterval(st.timer);
    st.timer = setInterval(agendar, 25);
    agendar();
    desenhar();
  }
  function parar() {
    st.tocando = false;
    clearInterval(st.timer);
    st.marcas.forEach(clearTimeout);
    st.marcas = [];
    el.querySelectorAll('.mt-tempo').forEach((t) => t.classList.remove('agora'));
    desenhar();
  }
  const mudarBpm = (v) => {
    st.bpm = Math.max(40, Math.min(220, Math.round(v)));
    salvar();
    $('#bpm').textContent = st.bpm;
    $('#faixa').value = st.bpm;
  };

  // bater no tempo: média dos últimos toques (até 6), zera se parar mais de 2 s
  function bater() {
    const agora = performance.now();
    if (st.toques.length && agora - st.toques.at(-1) > 2000) st.toques = [];
    st.toques.push(agora);
    st.toques = st.toques.slice(-6);
    if (st.toques.length >= 2) {
      const d = (st.toques.at(-1) - st.toques[0]) / (st.toques.length - 1);
      mudarBpm(60000 / d);
    }
  }

  el.addEventListener('click', (e) => {
    const x = e.target.closest('button');
    if (!x) return;
    if (x.id === 'play') tocar();
    else if (x.id === 'menos') mudarBpm(st.bpm - 1);
    else if (x.id === 'mais') mudarBpm(st.bpm + 1);
    else if (x.id === 'bater') bater();
    else if (x.id === 'acento') { st.acento = !st.acento; salvar(); desenhar(); }
    else if (x.dataset.c) { st.compasso = x.dataset.c; st.tempo = 0; salvar(); desenhar(); }
  });
  $('#faixa').addEventListener('input', (e) => mudarBpm(Number(e.target.value)));
  const tecla = (e) => {
    if (e.code === 'Space') { e.preventDefault(); tocar(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') mudarBpm(st.bpm + 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') mudarBpm(st.bpm - 1);
  };
  document.addEventListener('keydown', tecla);
  const visibilidade = () => { if (document.hidden && st.tocando) parar(); };
  document.addEventListener('visibilitychange', visibilidade);

  desenhar();
  return () => {
    parar();
    document.removeEventListener('keydown', tecla);
    document.removeEventListener('visibilitychange', visibilidade);
  };
}
