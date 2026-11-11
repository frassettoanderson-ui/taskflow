// Exercícios: lista (#/exercicios) e cada exercício (#/exercicios/<id>).
//   troca   — troca de acordes em 1 minuto (conta quantas trocas, guarda o recorde de cada par)
//   aranha  — cromática 1-2-3-4 com metrônomo, mostrando o dedo da vez no braço
//   notas   — notas no braço: acertar o nome (tocando no botão ou tocando no instrumento, pelo microfone)
//   ouvido  — ouvir um acorde e dizer se é maior, menor ou com sétima
import { posicao } from '../dados/teoria.js';
import { braco, vibrar } from '../ui/braco.js';
import { barraTopo, esc, guardar, ler, ICONES } from '../ui/comum.js';
import * as som from '../audio/som.js';
import { microfonePossivel, ligarMicrofone, midiDe } from '../audio/microfone.js';

const ABERTAS = [40, 45, 50, 55, 59, 64];             // 6ª → 1ª
const midiDa = (corda, casa) => ABERTAS[6 - corda] + casa;
const NOTAS = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
const LETRAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NATURAIS = [0, 2, 4, 5, 7, 9, 11];
const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];

const EXERCICIOS = [
  { id: 'troca', nome: 'Troca de acordes', resumo: 'Quantas trocas você faz em 1 minuto? O jeito mais rápido de destravar a mão esquerda.', icone: 'troca' },
  { id: 'aranha', nome: 'Aranha (cromática)', resumo: 'Dedos 1, 2, 3 e 4, uma casa cada, corda por corda, no tempo do metrônomo.', icone: 'aranha' },
  { id: 'notas', nome: 'Notas no braço', resumo: 'Que nota é essa? Responda tocando no botão ou tocando no instrumento.', icone: 'notas' },
  { id: 'ouvido', nome: 'Ouvido', resumo: 'O app toca um acorde: é maior, menor ou com sétima?', icone: 'ouvido' },
  // mora em tela própria; aparece aqui na lista
  { id: 'sequencias', href: '#/sequencias', nome: 'Sequências', resumo: 'Monte sequências com os acordes de cada tom e treine com a batida.', icone: 'sequencias' },
];
const ICONE = {
  troca: '<svg viewBox="0 0 64 64" class="icone"><rect x="6" y="14" width="20" height="36" rx="3"/><rect x="38" y="14" width="20" height="36" rx="3"/><path d="M28 26h8M32 22l4 4-4 4M36 40h-8M32 36l-4 4 4 4"/></svg>',
  aranha: '<svg viewBox="0 0 64 64" class="icone"><path d="M6 16h52M6 28h52M6 40h52M6 52h52M18 10v48M30 10v48M42 10v48"/><circle class="cheio" cx="12" cy="16" r="4"/><circle class="cheio" cx="24" cy="28" r="4"/><circle class="cheio" cx="36" cy="40" r="4"/><circle class="cheio" cx="48" cy="52" r="4"/></svg>',
  notas: '<svg viewBox="0 0 64 64" class="icone"><path d="M6 18h52M6 32h52M6 46h52M22 12v40M40 12v40"/><circle class="cheio" cx="31" cy="32" r="7"/><path d="M50 8v10M45 13h10" /></svg>',
  sequencias: '<svg viewBox="0 0 64 64" class="icone"><rect x="4" y="22" width="14" height="20" rx="2"/><rect x="25" y="22" width="14" height="20" rx="2"/><rect x="46" y="22" width="14" height="20" rx="2"/><path d="M18 32h7M39 32h7"/></svg>',
  ouvido: '<svg viewBox="0 0 64 64" class="icone"><path d="M22 40c0-6 4-8 4-14a10 10 0 0 1 20 0c0 8-8 10-8 18a6 6 0 0 1-12 0"/><path d="M34 26a3 3 0 0 1 3 3"/><path d="M10 22c2 2 2 8 0 10M4 18c4 4 4 14 0 18"/></svg>',
};

export function montar(el, id) {
  if (!id) return lista(el);
  const ex = EXERCICIOS.find((x) => x.id === id && !x.href);
  if (!ex) { el.innerHTML = `${barraTopo('Exercícios', '#/exercicios')}<p class="intro">Exercício não encontrado.</p>`; return; }
  return ({ troca, aranha, notas, ouvido })[id](el, ex);
}

function lista(el) {
  const recordes = ler('exercicios.recordes', {});
  const extra = {
    troca: () => { const v = Object.values(recordes.troca || {}); return v.length ? `Recorde: ${Math.max(...v)} trocas` : ''; },
    aranha: () => (recordes.aranha ? `Mais rápido: ${recordes.aranha} bpm` : ''),
    notas: () => (recordes.notas ? `Melhor sequência: ${recordes.notas}` : ''),
    ouvido: () => (recordes.ouvido ? `Melhor sequência: ${recordes.ouvido}` : ''),
    sequencias: () => '',
  };
  el.innerHTML = `
    ${barraTopo('Exercícios')}
    <p class="intro">Poucos minutos por dia, todo dia. Comece pela troca de acordes.</p>
    <nav class="ex-lista">
      ${EXERCICIOS.map((x) => `<a class="ex-cartao" href="${x.href || `#/exercicios/${x.id}`}">
        ${ICONE[x.icone]}
        <h2>${esc(x.nome)}</h2>
        <p>${esc(x.resumo)}</p>
        ${extra[x.id]() ? `<span class="ex-recorde">${esc(extra[x.id]())}</span>` : ''}
      </a>`).join('')}
    </nav>`;
}

const recorde = (chave, valor, sub = null) => {
  const r = ler('exercicios.recordes', {});
  let antes;
  if (sub) { r[chave] = r[chave] || {}; antes = r[chave][sub] || 0; if (valor > antes) r[chave][sub] = valor; }
  else { antes = r[chave] || 0; if (valor > antes) r[chave] = valor; }
  guardar('exercicios.recordes', r);
  return antes;
};
const lerRecorde = (chave, sub = null) => { const r = ler('exercicios.recordes', {}); return (sub ? r[chave]?.[sub] : r[chave]) || 0; };

// ---------- braço pequeno (deitado: 6ª em cima, casa 1 à esquerda) ----------
function bracinho({ inicio = 1, casas = 5, marcas = [] }) {
  const W = 600, H = 210, x0 = 56, x1 = 588, y0 = 26, y1 = 184;
  const larg = (x1 - x0) / casas;
  const yc = (corda) => y0 + ((corda - 1) * (y1 - y0)) / 5;     // 1ª embaixo
  const ycorda = (corda) => yc(7 - corda);                           // 6ª em cima
  const xcasa = (casa) => (casa === 0 ? x0 - 28 : x0 + (casa - inicio + 0.5) * larg);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="bracinho" aria-hidden="true">`;
  s += `<rect x="${x0}" y="${y0 - 8}" width="${x1 - x0}" height="${y1 - y0 + 16}" rx="4" class="bc-madeira"/>`;
  for (let i = 0; i <= casas; i++) s += `<line x1="${x0 + i * larg}" y1="${y0 - 8}" x2="${x0 + i * larg}" y2="${y1 + 8}" class="${i === 0 && inicio === 1 ? 'bc-pestana' : 'bc-traste'}"/>`;
  for (let i = 0; i < casas; i++) {
    const c = inicio + i;
    if ([3, 5, 7, 9, 15].includes(c)) s += `<circle cx="${x0 + (i + 0.5) * larg}" cy="${(y0 + y1) / 2}" r="6" class="bc-ponto"/>`;
    if (c === 12) { s += `<circle cx="${x0 + (i + 0.5) * larg}" cy="${yc(2.5)}" r="6" class="bc-ponto"/><circle cx="${x0 + (i + 0.5) * larg}" cy="${yc(4.5)}" r="6" class="bc-ponto"/>`; }
    s += `<text x="${x0 + (i + 0.5) * larg}" y="${H - 2}" class="bc-casa">${c}ª</text>`;
  }
  for (let c = 1; c <= 6; c++) s += `<line x1="${x0}" y1="${ycorda(c)}" x2="${x1}" y2="${ycorda(c)}" class="bc-corda" style="stroke-width:${1.2 + (c - 1) * 0.45}"/>`;
  for (const m of marcas) {
    const x = xcasa(m.casa), y = ycorda(m.corda);
    s += `<g class="bc-marca ${m.classe || ''}" data-m="${m.id ?? ''}"><circle cx="${x}" cy="${y}" r="17"/>${m.texto ? `<text x="${x}" y="${y + 7}">${esc(m.texto)}</text>` : ''}</g>`;
  }
  return `${s}</svg>`;
}

// ---------- 1. troca de acordes em 1 minuto ----------
const PARES = [['G', 'C'], ['C', 'D'], ['G', 'D'], ['Em', 'C'], ['Am', 'D'], ['D', 'A'], ['E', 'A'], ['Am', 'E'], ['C', 'Am'], ['G', 'Em'], ['D', 'Em'], ['A', 'E']];
function troca(el, ex) {
  const st = { par: ler('exercicios.par', 'G-C'), contando: false, n: 0, fim: 0, timer: 0, metro: ler('exercicios.metro', false) };
  if (!PARES.some((p) => p.join('-') === st.par)) st.par = 'G-C';
  el.innerHTML = `
    ${barraTopo(esc(ex.nome), '#/exercicios')}
    <p class="intro">Faça o acorde, toque uma vez, troque para o outro. Cada troca, um toque no botão grande. Não precisa correr: limpo vale mais que rápido.</p>
    <div class="opcoes-linha" id="pares"></div>
    <div class="ex-par" id="par"></div>
    <div class="ex-placar">
      <div><span class="rotulo">Tempo</span><b id="tempo">1:00</b></div>
      <div><span class="rotulo">Trocas</span><b id="n">0</b></div>
      <div><span class="rotulo">Recorde</span><b id="rec">–</b></div>
    </div>
    <button class="ex-tecla" id="tecla">Começar</button>
    <div class="segmentado"><button id="metro" aria-pressed="false">Metrônomo a 60 bpm</button></div>
    <p class="ex-resultado" id="resultado" aria-live="polite" hidden></p>
  `;
  const $ = (s) => el.querySelector(s);
  const par = () => st.par.split('-');

  function desenhar() {
    $('#pares').innerHTML = PARES.map((p) => `<button class="opcao-linha${p.join('-') === st.par ? ' ativo' : ''}" data-par="${p.join('-')}">${p.join(' e ')}</button>`).join('');
    $('#par').innerHTML = par().map((s) => `<button class="ex-acorde" data-ouvir="${s}"><span class="mural-sim">${s}</span>${braco(posicao(s), { orientacao: 'vertical' })}</button>`).join('');
    const r = lerRecorde('troca', st.par);
    $('#rec').textContent = r || '–';
    $('#metro').classList.toggle('ativo', st.metro);
    $('#metro').setAttribute('aria-pressed', String(st.metro));
    som.preparar(par().map(posicao));
  }
  let metroT = 0, proxClick = 0;
  function metronomo() {
    const c = som.contexto();
    while (proxClick < c.currentTime + 0.12) { som.click(proxClick, false, 0.35); proxClick += 1; }
  }
  function comecar() {
    st.contando = true; st.n = 0;
    st.fim = performance.now() + 60000;
    $('#n').textContent = '0';
    $('#resultado').hidden = true;
    $('#tecla').textContent = 'Troquei';
    $('#tecla').classList.add('valendo');
    if (st.metro) { proxClick = som.contexto().currentTime + 0.05; metroT = setInterval(metronomo, 25); }
    st.timer = setInterval(() => {
      const falta = Math.max(0, st.fim - performance.now());
      $('#tempo').textContent = `0:${String(Math.ceil(falta / 1000)).padStart(2, '0')}`.replace('0:60', '1:00');
      if (!falta) terminar();
    }, 100);
  }
  function terminar(cancelado = false) {
    clearInterval(st.timer); clearInterval(metroT);
    st.contando = false;
    $('#tecla').textContent = 'De novo';
    $('#tecla').classList.remove('valendo');
    $('#tempo').textContent = '1:00';
    if (cancelado) return;
    const antes = recorde('troca', st.n, st.par);
    som.click(som.contexto().currentTime + 0.02, true, 0.5);
    $('#resultado').hidden = false;
    $('#resultado').innerHTML = st.n > antes
      ? `<b>${st.n} trocas: recorde novo!</b> Antes era ${antes || 'nenhum'}.`
      : `<b>${st.n} trocas.</b> Seu recorde neste par é ${antes}.`;
    $('#rec').textContent = Math.max(st.n, antes) || '–';
  }
  function bater() {
    if (!st.contando) { comecar(); return; }
    st.n++;
    $('#n').textContent = st.n;
    const s = par()[st.n % 2 ? 1 : 0];
    el.querySelectorAll('.ex-acorde').forEach((x) => x.classList.toggle('agora', x.dataset.ouvir === s));
  }
  el.addEventListener('click', (e) => {
    const x = e.target.closest('button');
    if (!x) return;
    if (x.id === 'tecla') { bater(); return; }
    if (x.dataset.par && !st.contando) { st.par = x.dataset.par; guardar('exercicios.par', st.par); desenhar(); return; }
    if (x.dataset.ouvir) { const a2 = posicao(x.dataset.ouvir); som.batida(a2); vibrar(x, a2, { atraso: 30 }); return; }
    if (x.id === 'metro') { st.metro = !st.metro; guardar('exercicios.metro', st.metro); desenhar(); }
  });
  const tecla = (e) => { if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); bater(); } };
  document.addEventListener('keydown', tecla);
  desenhar();
  return () => { terminar(true); document.removeEventListener('keydown', tecla); };
}

// ---------- 2. aranha ----------
function aranha(el, ex) {
  const pref = ler('exercicios.aranha', {});
  const st = { bpm: pref.bpm || 60, casa: pref.casa || 1, porClique: pref.porClique || 1, ouvir: pref.ouvir ?? true, tocando: false };
  const salvar = () => guardar('exercicios.aranha', { bpm: st.bpm, casa: st.casa, porClique: st.porClique, ouvir: st.ouvir });
  // sobe da 6ª à 1ª (dedos 1-2-3-4) e desce da 1ª à 6ª (4-3-2-1)
  const passos = () => {
    const p = [];
    for (let c = 6; c >= 1; c--) for (let d = 0; d < 4; d++) p.push({ corda: c, casa: st.casa + d, dedo: d + 1 });
    for (let c = 1; c <= 6; c++) for (let d = 3; d >= 0; d--) p.push({ corda: c, casa: st.casa + d, dedo: d + 1 });
    return p;
  };
  el.innerHTML = `
    ${barraTopo(esc(ex.nome), '#/exercicios')}
    <p class="intro">Um dedo por casa: indicador na primeira, médio na segunda, anelar na terceira, mínimo na quarta. Sobe da 6ª corda até a 1ª e volta. Dedo colado no traste e polegar atrás do braço.</p>
    <section class="ex-palco" id="palco"></section>
    <div class="ex-agora"><span id="dedo">Dedo –</span><span id="onde"></span></div>
    <div class="ex-ajustes">
      <div class="cf-controle">
        <span class="cf-rotulo">Velocidade</span>
        <div class="cf-passo">
          <button class="redondo" data-acao="bpm-" aria-label="Mais devagar">${ICONES.menos}</button>
          <output id="bpm"></output>
          <button class="redondo" data-acao="bpm+" aria-label="Mais rápido">${ICONES.mais}</button>
        </div>
        <span class="cf-volta" id="porCliqueTxt"></span>
      </div>
      <div class="cf-controle">
        <span class="cf-rotulo">Começar na casa</span>
        <div class="cf-passo">
          <button class="redondo" data-acao="casa-" aria-label="Casa anterior">${ICONES.menos}</button>
          <output id="casa"></output>
          <button class="redondo" data-acao="casa+" aria-label="Próxima casa">${ICONES.mais}</button>
        </div>
        <span class="cf-volta">mais para o meio é mais fácil</span>
      </div>
    </div>
    <div class="segmentado" id="clique">
      <button data-clique="1">1 nota por clique</button>
      <button data-clique="2">2 notas por clique</button>
    </div>
    <div class="segmentado"><button id="ouvir" aria-pressed="true">Ouvir as notas</button></div>
    <button class="botao principal largo" id="play">${ICONES.play}<span>Começar</span></button>
    <p class="ex-resultado" id="resultado" hidden></p>
  `;
  const $ = (s) => el.querySelector(s);
  const j = { vez: 0, timer: 0, raf: 0, idx: 0, prox: 0, agenda: [], voltas: 0 };

  function desenhar(atual = -1) {
    const lista = passos();
    const a = lista[atual];
    $('#palco').innerHTML = bracinho({
      inicio: Math.max(1, st.casa - (st.casa > 1 ? 1 : 0)), casas: 5,
      marcas: a ? [1, 2, 3, 4].map((d) => ({ corda: a.corda, casa: st.casa + d - 1, texto: String(d), classe: d === a.dedo ? 'bc-agora' : 'bc-apagada' }))
        : [1, 2, 3, 4].map((d) => ({ corda: 6, casa: st.casa + d - 1, texto: String(d) })),
    });
    $('#bpm').textContent = `${st.bpm} bpm`;
    $('#casa').textContent = `${st.casa}ª`;
    $('#porCliqueTxt').textContent = st.porClique === 2 ? 'duas notas a cada clique' : 'uma nota a cada clique';
    el.querySelectorAll('#clique button').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.clique) === st.porClique));
    $('#ouvir').classList.toggle('ativo', st.ouvir);
    $('#ouvir').setAttribute('aria-pressed', String(st.ouvir));
    if (a) { $('#dedo').textContent = `Dedo ${a.dedo}`; $('#onde').textContent = `${a.corda}ª corda, ${a.casa}ª casa`; }
    else { $('#dedo').textContent = 'Dedo –'; $('#onde').textContent = ''; }
  }

  function agendar() {
    if (!st.tocando) return;
    const c = som.contexto();
    const lista = passos();
    const passo = 60 / st.bpm / st.porClique;
    while (j.prox < c.currentTime + 0.12) {
      const i = j.idx % lista.length;
      if (j.idx % st.porClique === 0) som.click(j.prox, i === 0, 0.42);
      if (st.ouvir) som.tocarMidi(midiDa(lista[i].corda, lista[i].casa), { quando: j.prox, forca: 0.55 });
      j.agenda.push([j.prox, i]);
      j.idx++;
      j.prox += passo;
      if (i === lista.length - 1) j.voltas++;
    }
  }
  function acompanhar() {
    if (!st.tocando) return;
    j.raf = requestAnimationFrame(acompanhar);
    const agora = som.tempoAudio();
    let atual = -1;
    while (j.agenda.length && j.agenda[0][0] <= agora) atual = j.agenda.shift()[1];
    if (atual >= 0) desenhar(atual);
  }
  async function comecar() {
    st.tocando = true;
    const vez = ++j.vez;
    clearInterval(j.timer);
    $('#play').innerHTML = `${ICONES.pausa}<span>Parar</span>`;
    $('#resultado').hidden = true;
    await som.prepararMidi([...new Set(passos().map((p) => midiDa(p.corda, p.casa)))]);
    if (!st.tocando || vez !== j.vez) return;
    const c = som.contexto();
    // 4 cliques de contagem
    const t0 = c.currentTime + 0.1;
    for (let k = 0; k < 4; k++) som.click(t0 + k * 60 / st.bpm, k === 0, 0.42);
    Object.assign(j, { idx: 0, prox: t0 + 4 * 60 / st.bpm, agenda: [], voltas: 0 });
    agendar();
    j.timer = setInterval(agendar, 25);
    j.raf = requestAnimationFrame(acompanhar);
  }
  function parar() {
    if (!st.tocando) return;
    st.tocando = false;
    clearInterval(j.timer); cancelAnimationFrame(j.raf);
    som.silenciar();
    $('#play').innerHTML = `${ICONES.play}<span>Começar</span>`;
    if (j.voltas > 0) {
      const antes = recorde('aranha', st.bpm);
      $('#resultado').hidden = false;
      $('#resultado').innerHTML = `${j.voltas} ${j.voltas > 1 ? 'voltas completas' : 'volta completa'} a ${st.bpm} bpm.${st.bpm > antes ? ' <b>Mais rápido até agora!</b>' : ''} Quando ficar limpo, suba 5 bpm.`;
    }
    desenhar();
  }
  el.addEventListener('click', (e) => {
    const x = e.target.closest('button');
    if (!x) return;
    const acao = x.dataset.acao;
    if (x.id === 'play') { st.tocando ? parar() : comecar(); return; }
    if (acao === 'bpm-' || acao === 'bpm+') st.bpm = Math.max(30, Math.min(200, st.bpm + (acao === 'bpm+' ? 5 : -5)));
    else if (acao === 'casa-' || acao === 'casa+') { st.casa = Math.max(1, Math.min(12, st.casa + (acao === 'casa+' ? 1 : -1))); parar(); }
    else if (x.dataset.clique) st.porClique = Number(x.dataset.clique);
    else if (x.id === 'ouvir') st.ouvir = !st.ouvir;
    else return;
    salvar();
    if (!st.tocando) desenhar();
    else { $('#bpm').textContent = `${st.bpm} bpm`; el.querySelectorAll('#clique button').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.clique) === st.porClique)); $('#ouvir').classList.toggle('ativo', st.ouvir); }
  });
  desenhar();
  return () => { parar(); };
}

// ---------- 3. notas no braço ----------
const NIVEIS = [
  { id: 'soltas', nome: 'Cordas soltas', ate: 0 },
  { id: 'ate3', nome: 'Até a 3ª casa', ate: 3 },
  { id: 'ate5', nome: 'Até a 5ª casa', ate: 5 },
  { id: 'ate12', nome: 'Braço inteiro', ate: 12 },
];
function notas(el, ex) {
  const pref = ler('exercicios.notas', {});
  const st = {
    nivel: NIVEIS.some((n) => n.id === pref.nivel) ? pref.nivel : 'soltas',
    sust: pref.sust ?? false,
    modo: 'botao', alvo: null, acertos: 0, total: 0, seq: 0, travado: false, mic: null, raf: 0, hist: [], ok: 0,
    vivo: true, ligando: false, proxima: 0,
  };
  const salvar = () => guardar('exercicios.notas', { nivel: st.nivel, sust: st.sust });
  el.innerHTML = `
    ${barraTopo(esc(ex.nome), '#/exercicios')}
    <div class="opcoes-linha" id="niveis">${NIVEIS.map((n) => `<button class="opcao-linha" data-nivel="${n.id}">${n.nome}</button>`).join('')}</div>
    <div class="segmentado" id="modo">
      <button data-modo="botao">No botão</button>
      <button data-modo="mic">Tocando (microfone)</button>
    </div>
    <section class="ex-palco" id="palco"></section>
    <p class="ex-pergunta" id="pergunta" aria-live="polite"></p>
    <div class="ex-respostas" id="respostas"></div>
    <div class="ex-placar">
      <div><span class="rotulo">Acertos</span><b id="acertos">0/0</b></div>
      <div><span class="rotulo">Sequência</span><b id="seq">0</b></div>
      <div><span class="rotulo">Recorde</span><b id="rec">${lerRecorde('notas') || '–'}</b></div>
    </div>
    <div class="segmentado"><button id="sust" aria-pressed="false">Incluir sustenidos (#)</button></div>
    <p class="af-aviso" id="aviso" hidden></p>
  `;
  const $ = (s) => el.querySelector(s);
  const nivel = () => NIVEIS.find((n) => n.id === st.nivel);

  function nova() {
    clearTimeout(st.proxima);
    const ate = nivel().ate;
    let corda, casa, m;
    do {
      corda = 1 + Math.floor(Math.random() * 6);
      casa = Math.floor(Math.random() * (ate + 1));
      m = midiDa(corda, casa);
    } while ((!st.sust && !NATURAIS.includes(m % 12)) || (st.alvo && st.alvo.m === m && st.alvo.corda === corda));
    st.alvo = { corda, casa, m };
    st.travado = false;
    desenhar();
  }
  function desenhar(resposta = null) {
    const a = st.alvo;
    const inicio = a.casa <= 4 ? 1 : a.casa - 2;
    const certo = resposta === null ? '' : resposta ? ' bc-certo' : ' bc-errado';
    $('#palco').innerHTML = bracinho({ inicio, casas: 5, marcas: [{ corda: a.corda, casa: a.casa, texto: resposta === null ? '?' : LETRAS[a.m % 12], classe: `bc-agora${certo}` }] });
    $('#pergunta').innerHTML = st.modo === 'mic'
      ? `Toque esta nota: <b>${a.corda}ª corda, ${a.casa ? `${a.casa}ª casa` : 'solta'}</b>${resposta === null ? '' : ` · era <b>${NOTAS[a.m % 12]}</b>`}`
      : `Que nota é esta? <span>${a.corda}ª corda, ${a.casa ? `${a.casa}ª casa` : 'solta'}</span>`;
    const opcoes = st.sust ? [...Array(12).keys()] : NATURAIS;
    $('#respostas').hidden = st.modo === 'mic';
    $('#respostas').innerHTML = opcoes.map((n) => `<button class="ex-resposta${resposta !== null && n === a.m % 12 ? ' certa' : ''}" data-nota="${n}"><b>${NOTAS[n]}</b><small>${LETRAS[n]}</small></button>`).join('');
    $('#acertos').textContent = `${st.acertos}/${st.total}`;
    $('#seq').textContent = st.seq;
    el.querySelectorAll('#niveis button').forEach((b) => b.classList.toggle('ativo', b.dataset.nivel === st.nivel));
    el.querySelectorAll('#modo button').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === st.modo));
    $('#sust').classList.toggle('ativo', st.sust);
    $('#sust').setAttribute('aria-pressed', String(st.sust));
  }
  function responder(nota, botao = null) {
    if (st.travado) return;
    st.travado = true;
    const acertou = nota === st.alvo.m % 12;
    st.total++;
    if (acertou) {
      st.acertos++; st.seq++;
      if (st.seq > recorde('notas', st.seq)) $('#rec').textContent = st.seq;
    } else st.seq = 0;
    if (st.modo === 'botao') som.tocarMidi(st.alvo.m, { forca: 0.8 });
    desenhar(acertou);
    if (botao && !acertou) el.querySelector(`[data-nota="${nota}"]`)?.classList.add('errada');
    st.proxima = setTimeout(nova, acertou ? 900 : 1900);
  }

  // responder tocando: ouve o microfone e confere a nota (a altura exata, não só o nome)
  function lerMic(t) {
    if (!st.mic) return;
    st.raf = requestAnimationFrame(lerMic);
    if (st.travado) return;
    const { f } = st.mic.ler();
    if (!f) { st.hist = []; st.ok = 0; return; }
    st.hist.push(Math.round(midiDe(f)));
    if (st.hist.length > 4) st.hist.shift();
    if (st.hist.length < 4 || new Set(st.hist).size !== 1) return;
    const m = st.hist[0];
    if (m === st.alvo.m) { st.hist = []; responder(m % 12); }
    else if (m % 12 === st.alvo.m % 12 && !el.querySelector('.ex-quase')) $('#pergunta').insertAdjacentHTML('beforeend', ' <small class="ex-quase">nome certo, oitava errada</small>');
  }
  async function modoMic() {
    if (!microfonePossivel()) {
      $('#aviso').innerHTML = 'O microfone só funciona em endereço seguro (https). Abra por <a href="https://sonoridade.89-117-79-163.sslip.io/app/#/exercicios/notas">sonoridade.89-117-79-163.sslip.io</a>.';
      $('#aviso').hidden = false;
      st.modo = 'botao';
      desenhar();
      return;
    }
    if (st.ligando) return;
    st.ligando = true;
    try {
      const mic = await ligarMicrofone();
      st.ligando = false;
      // saiu da tela ou voltou para "no botão" enquanto pedia a permissão
      if (!st.vivo || st.modo !== 'mic') { mic.desligar(); return; }
      desligarMic();
      st.mic = mic;
      $('#aviso').hidden = true;
      st.raf = requestAnimationFrame(lerMic);
    } catch (e) {
      st.ligando = false;
      if (!st.vivo) return;
      $('#aviso').textContent = 'Não deu para ligar o microfone. Libere a permissão do site e tente de novo.';
      $('#aviso').hidden = false;
      st.modo = 'botao';
      desenhar();
    }
  }
  function desligarMic() { cancelAnimationFrame(st.raf); st.mic?.desligar(); st.mic = null; }

  el.addEventListener('click', (e) => {
    const x = e.target.closest('button');
    if (!x) return;
    if (x.dataset.nota !== undefined) { responder(Number(x.dataset.nota), x); return; }
    if (x.dataset.nivel) { st.nivel = x.dataset.nivel; salvar(); preparar(); nova(); return; }
    if (x.id === 'sust') { st.sust = !st.sust; salvar(); nova(); return; }
    if (x.dataset.modo && x.dataset.modo !== st.modo) {
      st.modo = x.dataset.modo;
      if (st.modo === 'mic') modoMic(); else desligarMic();
      desenhar();
    }
  });
  // baixa antes as notas do nível escolhido, para a resposta soar na hora
  const preparar = () => {
    const ate = nivel().ate;
    som.prepararMidi([...new Set(Array.from({ length: 6 }, (_, i) => Array.from({ length: ate + 1 }, (__, c) => midiDa(i + 1, c))).flat())]);
  };
  preparar();
  nova();
  return () => { st.vivo = false; clearTimeout(st.proxima); desligarMic(); };
}

// ---------- 4. ouvido ----------
const TIPOS_OUVIDO = [
  { id: 'maior', nome: 'Maior', dica: 'alegre, aberto', sufixo: '' },
  { id: 'menor', nome: 'Menor', dica: 'triste, fechado', sufixo: 'm' },
  { id: 'setima', nome: 'Com sétima', dica: 'pede para resolver', sufixo: '7' },
];
const RAIZES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb', 'F#'];
function ouvido(el, ex) {
  const st = { nivel: ler('exercicios.ouvido', 2), atual: null, travado: false, acertos: 0, total: 0, seq: 0, vivo: true, proxima: 0 };
  el.innerHTML = `
    ${barraTopo(esc(ex.nome), '#/exercicios')}
    <p class="intro">Ouça o acorde e responda. Maior soa alegre e aberto; menor, triste e fechado; com sétima fica "pendurado", pedindo para ir para outro acorde.</p>
    <div class="segmentado" id="nivel">
      <button data-nivel="2">Maior ou menor</button>
      <button data-nivel="3">Maior, menor ou com sétima</button>
    </div>
    <button class="ex-tecla" id="ouvirDeNovo">${ICONES.som}<span>Ouvir</span></button>
    <div class="ex-respostas grandes" id="respostas"></div>
    <p class="ex-pergunta" id="revela" aria-live="polite"></p>
    <div class="ex-placar">
      <div><span class="rotulo">Acertos</span><b id="acertos">0/0</b></div>
      <div><span class="rotulo">Sequência</span><b id="seq">0</b></div>
      <div><span class="rotulo">Recorde</span><b id="rec">${lerRecorde('ouvido') || '–'}</b></div>
    </div>
  `;
  const $ = (s) => el.querySelector(s);
  const tipos = () => TIPOS_OUVIDO.slice(0, st.nivel);
  function tocar() { const a = posicao(st.atual.sim); som.batida(a); }
  function nova(tocarJa = true) {
    clearTimeout(st.proxima);
    let t, r;
    do { t = sorteio(tipos()); r = sorteio(RAIZES); } while (st.atual && st.atual.sim === r + t.sufixo);
    st.atual = { tipo: t.id, sim: r + t.sufixo };
    st.travado = false;
    $('#revela').textContent = '';
    desenhar();
    const vez = st.atual;
    som.preparar([posicao(st.atual.sim)]).then(() => { if (tocarJa && st.vivo && st.atual === vez) tocar(); });
  }
  function desenhar(resp = null) {
    $('#respostas').innerHTML = tipos().map((t) => `<button class="ex-resposta${resp && t.id === st.atual.tipo ? ' certa' : ''}${resp && resp === t.id && resp !== st.atual.tipo ? ' errada' : ''}" data-tipo="${t.id}"><b>${t.nome}</b><small>${t.dica}</small></button>`).join('');
    el.querySelectorAll('#nivel button').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.nivel) === st.nivel));
    $('#acertos').textContent = `${st.acertos}/${st.total}`;
    $('#seq').textContent = st.seq;
  }
  function responder(tipo) {
    if (st.travado) return;
    st.travado = true;
    const ok = tipo === st.atual.tipo;
    st.total++;
    if (ok) { st.acertos++; st.seq++; if (st.seq > recorde('ouvido', st.seq)) $('#rec').textContent = st.seq; } else st.seq = 0;
    desenhar(tipo);
    $('#revela').innerHTML = `${ok ? 'Isso!' : 'Não foi dessa vez.'} Era <b>${esc(st.atual.sim)}</b> (${esc(posicao(st.atual.sim).nome.toLowerCase())}).`;
    st.proxima = setTimeout(() => nova(), ok ? 1400 : 2600);
  }
  el.addEventListener('click', (e) => {
    const x = e.target.closest('button');
    if (!x) return;
    if (x.id === 'ouvirDeNovo') { if (!st.atual) nova(); else tocar(); return; }
    if (x.dataset.tipo) { if (st.atual) responder(x.dataset.tipo); return; }
    if (x.dataset.nivel) { st.nivel = Number(x.dataset.nivel); guardar('exercicios.ouvido', st.nivel); nova(); }
  });
  // não toca sozinho ao abrir: o navegador só libera som depois de um toque
  st.atual = null;
  desenhar();
  $('#respostas').innerHTML = '<p class="ex-dica-inicio">Toque em "Ouvir" para começar.</p>';
  return () => { st.vivo = false; clearTimeout(st.proxima); som.silenciar(); };
}
