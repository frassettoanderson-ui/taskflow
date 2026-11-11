// Cifras: biblioteca no padrão da tela inicial (estúdio ao fundo, cartões com foto).
// Ordem: atalhos (Tocadas por último, Novidades, Mais tocadas) → carrossel de categorias → busca → lista.
// A busca filtra a cada letra por nome, artista ou trecho da letra; sem filtro, a lista vem
// com as últimas tocadas/abertas primeiro.
// Tocar na capa toca a prévia (30 s do refrão, já cortada com fade em dados-teste/previas/<id>.m4a,
// feita por _ferramentas/previas.py) ali mesmo, sem abrir nada.
import { carregar } from '../dados/cifras.js';
import { ritmoDe } from '../dados/ritmos.js';
import { barraTopo, esc, ler, guardar, ICONES } from '../ui/comum.js';

const V = 'v=1';
const PASSO_CARROSSEL = 3200;   // ms entre um avanço e outro
const PAUSA_CARROSSEL = 6000;   // depois que a pessoa mexe, espera isso para voltar a rolar
const DESLIZE = 'transform .75s cubic-bezier(.65, 0, .35, 1)';

const ATALHOS = [
  { id: 'ultimas', nome: 'Tocadas por último', foto: 'ultimas' },
  { id: 'novidades', nome: 'Novidades', foto: 'novidades' },
  { id: 'mais', nome: 'Mais tocadas', foto: 'mais-tocadas' },
];
// id = campo "estilo" da música; categoria ainda sem música aparece como "Em breve"
const CATEGORIAS = [
  { id: 'louvor', nome: 'Louvor', foto: 'louvor' },
  { id: 'hino', nome: 'Hinos', foto: 'hinos' },
  { id: 'sertanejo', nome: 'Sertanejo', foto: 'sertanejo' },
  { id: 'rock', nome: 'Rock', foto: 'rock' },
  { id: 'mpb', nome: 'MPB', foto: 'mpb' },
  { id: 'pop', nome: 'Pop', foto: 'pop' },
  { id: 'samba', nome: 'Samba', foto: 'samba' },
  { id: 'pagode', nome: 'Pagode', foto: 'pagode' },
  { id: 'forro', nome: 'Forró', foto: 'forro' },
  { id: 'bossa-nova', nome: 'Bossa Nova', foto: 'bossa-nova' },
  { id: 'axe', nome: 'Axé', foto: 'axe' },
  { id: 'reggae', nome: 'Reggae', foto: 'reggae' },
  { id: 'blues', nome: 'Blues', foto: 'blues' },
  { id: 'jazz', nome: 'Jazz', foto: 'jazz' },
  { id: 'country', nome: 'Country', foto: 'country' },
  { id: 'internacional', nome: 'Internacional', foto: 'internacional' },
  { id: 'classico', nome: 'Clássico', foto: 'classico' },
  { id: 'infantil', nome: 'Infantil', foto: 'infantil' },
];

const sem = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// letra sem acordes nem marcações, uma linha por item (para buscar trecho)
const letraDe = (m) => String(m.cifra || m.simplificada?.cifra || '').split('\n')
  .filter((l) => !/^\s*\{/.test(l))
  .map((l) => l.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim())
  .filter((l) => /\p{L}{2}/u.test(l));

// marca as palavras buscadas no texto original (com acento); devolve HTML já escapado
function destacar(texto, palavras) {
  const orig = String(texto ?? '');
  if (!palavras.length) return esc(orig);
  let norm = '';
  const pos = [];                       // pos[i] = índice no original do i-ésimo caractere normalizado
  for (let i = 0; i < orig.length; i++) {
    const n = sem(orig[i]);
    for (let k = 0; k < n.length; k++) { norm += n[k]; pos.push(i); }
  }
  const marcas = new Array(orig.length).fill(false);
  for (const w of palavras) {
    let i = norm.indexOf(w);
    while (i >= 0) {
      for (let k = i; k < i + w.length; k++) marcas[pos[k]] = true;
      i = norm.indexOf(w, i + w.length);
    }
  }
  let html = '';
  let aberto = false;
  for (let i = 0; i < orig.length; i++) {
    if (marcas[i] && !aberto) { html += '<mark>'; aberto = true; }
    if (!marcas[i] && aberto) { html += '</mark>'; aberto = false; }
    html += esc(orig[i]);
  }
  return html + (aberto ? '</mark>' : '');
}

// trecho de até ~70 caracteres em volta da primeira palavra achada
function recortar(linha, palavras) {
  if (linha.length <= 70) return linha;
  const n = sem(linha);
  const achou = palavras.map((w) => n.indexOf(w)).filter((x) => x >= 0);
  const ini = Math.max(0, (achou.length ? Math.min(...achou) : 0) - 25);
  return `${ini > 0 ? '…' : ''}${linha.slice(ini, ini + 70).trim()}${ini + 70 < linha.length ? '…' : ''}`;
}

// versões que a música tem: completa (cifra principal) e/ou simplificada
function versoes(m) {
  const v = [];
  if (m.cifra) v.push({ nome: 'Completa', tom: m.tom });
  if (m.simplificada?.cifra) v.push({ nome: 'Simplificada', tom: m.simplificada.tom || m.tom });
  return v;
}

export function montar(el) {
  let modo = null;          // atalho escolhido
  let categoria = null;     // categoria escolhida
  let busca = '';
  let musicas = null;
  const recentes = () => ler('cifras.recentes', []);

  el.classList.add('app-larga');
  const cartao = (c, tipo, copia = false) => `
    <button class="cb-cartao ${tipo}" data-${tipo}="${c.id}" type="button" aria-pressed="false"${copia ? ' aria-hidden="true" tabindex="-1"' : ''}>
      <img src="img/cifras/${c.foto}.webp?${V}" alt="" draggable="false">
      <span class="cb-nome">${c.nome}</span>
    </button>`;

  el.innerHTML = `
    <div class="ini-fundo" aria-hidden="true"><img src="img/inicio/estudio.webp?v=3" alt=""></div>
    ${barraTopo('Cifras')}
    <nav class="cb-atalhos" aria-label="Atalhos">${ATALHOS.map((c) => cartao(c, 'atalho')).join('')}</nav>
    <div class="cb-carrossel" id="carrossel">
      <button class="cb-seta esq" id="setaEsq" type="button" aria-label="Categorias anteriores">${ICONES.voltar}</button>
      <div class="cb-janela">
        <nav class="cb-categorias" id="categorias" aria-label="Categorias">${[0, 1, 2].map((v) => CATEGORIAS.map((c) => cartao(c, 'categoria', v !== 1)).join('')).join('')}</nav>
      </div>
      <button class="cb-seta dir" id="setaDir" type="button" aria-label="Próximas categorias">${ICONES.avancar}</button>
    </div>
    <div class="cb-marca-busca" id="marcaBusca"></div>
    <div class="cb-busca-faixa">
      <label class="busca cb-busca">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
        <input type="search" id="busca" placeholder="Música, artista ou trecho da letra" autocomplete="off" aria-label="Buscar por música, artista ou trecho da letra">
        <button class="cb-limpar" id="limpar" type="button" aria-label="Limpar busca" hidden>${ICONES.fechar}</button>
      </label>
    </div>
    <section class="cb-secao">
      <div class="cb-cabeca">
        <h2 id="tituloLista" aria-live="polite">Todas as músicas</h2>
        <button class="cb-todas" id="todas" type="button" hidden>Ver todas</button>
      </div>
      <div id="lista"></div>
    </section>
    <p class="creditos">Cifras de teste copiadas do Cifra Club, só para uso pessoal.</p>
  `;
  const $ = (s) => el.querySelector(s);

  const linha = (m, trecho, palavras) => {
    const tem = ritmoDe(m.id)?.yt;
    const capa = `<img class="musica-capa" src="${esc(m.capa || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
    const vs = versoes(m);
    return `<div class="musica${tocando?.id === m.id ? ' ouvindo' : ''}" data-id="${esc(m.id)}">
    ${tem ? `<button class="musica-ouvir" data-ouvir="${esc(m.id)}" aria-label="Ouvir a prévia de ${esc(m.titulo)}">
      ${capa}<span class="musica-play">${ICONES.play}${ICONES.pausa}</span><i class="musica-anel"></i>
    </button>` : capa}
    <a class="musica-link" href="#/cifras/${encodeURIComponent(m.id)}">
      <span class="musica-texto">
        <span class="musica-nome">${destacar(m.titulo, palavras)}</span>
        <span class="musica-artista">${destacar(m.artista, palavras)}</span>
        ${trecho ? `<span class="musica-trecho">${destacar(trecho, palavras)}</span>` : ''}
        <span class="musica-versoes">${vs.map((v) => `<span class="versao">${v.nome}${vs.length > 1 && v.tom !== m.tom ? ` · ${esc(v.tom)}` : ''}</span>`).join('')}</span>
      </span>
      <span class="musica-tom" aria-label="Tom ${esc(m.tom)}"><small>Tom</small><b>${esc(m.tom)}</b></span>
    </a>
    </div>`;
  };

  // categoria sem nenhuma música: escurecida, sem clique, com "Em breve"
  function marcarEmBreve() {
    const tem = new Set(musicas.map((m) => m.estilo));
    el.querySelectorAll('[data-categoria]').forEach((b) => {
      const breve = !tem.has(b.dataset.categoria);
      b.classList.toggle('embreve', breve);
      b.setAttribute('aria-disabled', String(breve));
      if (breve && !b.querySelector('.cb-breve')) b.insertAdjacentHTML('beforeend', '<span class="cb-breve">Em breve</span>');
    });
  }

  // lista: categoria → atalho (recorte e ordem) → busca (filtra a cada letra)
  function desenhar() {
    el.querySelectorAll('[data-atalho]').forEach((b) => { const s = b.dataset.atalho === modo; b.classList.toggle('ativo', s); b.setAttribute('aria-pressed', String(s)); });
    el.querySelectorAll('[data-categoria]').forEach((b) => { const s = b.dataset.categoria === categoria; b.classList.toggle('ativo', s); b.setAttribute('aria-pressed', String(s)); });
    $('#limpar').hidden = !busca;
    $('#todas').hidden = !modo && !categoria;
    if (musicas === null) return;      // ainda carregando
    if (!musicas.length) {
      $('#lista').innerHTML = '<p class="vazio-lista">As cifras de teste não estão nesta cópia do app.</p>';
      return;
    }
    const rec = recentes();
    let base = musicas.filter((m) => !categoria || m.estilo === categoria);
    if (modo === 'ultimas') base = rec.map((id) => base.find((m) => m.id === id)).filter(Boolean);
    else if (modo === 'novidades') base = [...base].reverse();     // as últimas que entraram no arquivo
    else if (modo === 'mais') base = [...base];                    // ordem do ranking de origem
    else base = [...rec.map((id) => base.find((m) => m.id === id)).filter(Boolean), ...base.filter((m) => !rec.includes(m.id))];

    const palavras = sem(busca).split(/\s+/).filter(Boolean);
    let itens = base.map((m) => ({ m, trecho: '' }));
    if (palavras.length) {
      itens = [];
      for (const m of base) {
        const titulo = sem(m.titulo);
        const cab = `${titulo} ${sem(m.artista)}`;
        const letra = m._letra || (m._letra = letraDe(m));
        const tudo = `${cab} ${sem(letra.join(' '))}`;
        if (!palavras.every((w) => tudo.includes(w))) continue;
        let trecho = '';
        let nota = 0;                                   // 0 = no nome, 1 = nome + artista, 2 = na letra
        if (!palavras.every((w) => cab.includes(w))) {
          let melhor = -1;
          for (const l of letra) {
            const n = sem(l);
            const q = palavras.filter((w) => n.includes(w)).length;
            if (q > melhor) { melhor = q; trecho = l; }
          }
          trecho = recortar(trecho, palavras);
          nota = 2;
        } else if (!palavras.every((w) => titulo.includes(w))) nota = 1;
        itens.push({ m, trecho, nota });
      }
      itens.sort((a, b) => a.nota - b.nota);
    }

    const nomes = [ATALHOS.find((a) => a.id === modo)?.nome, CATEGORIAS.find((c) => c.id === categoria)?.nome].filter(Boolean);
    $('#tituloLista').textContent = palavras.length
      ? `${itens.length} ${itens.length === 1 ? 'música encontrada' : 'músicas encontradas'}`
      : nomes.join(' · ') || 'Todas as músicas';
    const vazio = palavras.length ? 'Nada encontrado. Tente outra parte do nome, do artista ou da letra.'
      : modo === 'ultimas' ? 'Você ainda não tocou nenhuma música.' : 'Nenhuma música aqui ainda.';
    $('#lista').innerHTML = itens.length
      ? `<div class="lista-musicas">${itens.map((x) => linha(x.m, x.trecho, palavras)).join('')}</div>`
      : `<p class="vazio-lista">${vazio}</p>`;
    marcar();
  }

  // ---------- prévia (só áudio, toca ali mesmo) ----------
  // Cada prévia tem o seu <audio> passando por um ganho do Web Audio: pausar, continuar e trocar de
  // música fazem fade (no iPhone o volume do <audio> não muda por código, o ganho muda).
  // Ao trocar, a anterior vai sumindo enquanto a nova já começa (a nova já tem fade in no arquivo).
  const FADE_SAI = 0.45;      // s
  const FADE_ENTRA = 0.3;     // s, ao continuar depois de pausar
  let ctxPrevia = null;
  let tocando = null;         // { id, audio, ganho, pausado, carregando }
  let quadro = 0;
  const contextoPrevia = () => {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!ctxPrevia && C) ctxPrevia = new C();
    if (ctxPrevia?.state === 'suspended') ctxPrevia.resume().catch(() => {});
    return ctxPrevia;
  };
  const marcar = () => el.querySelectorAll('.musica').forEach((x) => {
    const eu = x.dataset.id === tocando?.id;
    x.classList.toggle('ouvindo', eu);
    x.classList.toggle('pausado', eu && tocando.pausado);
    x.classList.toggle('carregando', eu && tocando.carregando);
    if (!eu) x.style.removeProperty('--prog');
  });
  // anel dourado em volta da capa mostra quanto da prévia já tocou
  function andar() {
    cancelAnimationFrame(quadro);
    const a = tocando?.audio;
    const linhaAtual = tocando && el.querySelector(`.musica[data-id="${CSS.escape(tocando.id)}"]`);
    if (linhaAtual && a?.duration) linhaAtual.style.setProperty('--prog', String(a.currentTime / a.duration));
    if (tocando && !tocando.pausado) quadro = requestAnimationFrame(andar);
  }
  // leva o volume até "alvo" em "seg" segundos
  function volume(t, alvo, seg) {
    if (t.ganho) {
      const g = t.ganho.gain;
      const agora = ctxPrevia.currentTime;
      g.cancelScheduledValues(agora);
      g.setValueAtTime(g.value, agora);
      g.linearRampToValueAtTime(alvo, agora + seg);
    } else {
      const de = t.audio.volume;
      const ini = performance.now();
      const passo = () => {
        const k = Math.min(1, (performance.now() - ini) / (seg * 1000));
        t.audio.volume = de + (alvo - de) * k;
        if (k < 1) requestAnimationFrame(passo);
      };
      passo();
    }
    return new Promise((r) => setTimeout(r, seg * 1000 + 30));
  }
  function novoTocador(id) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = `dados-teste/previas/${encodeURIComponent(id)}.m4a`;
    const t = { id, audio, ganho: null, pausado: false, carregando: true };
    const c = contextoPrevia();
    if (c) {
      try {
        const fonte = c.createMediaElementSource(audio);
        t.ganho = c.createGain();
        fonte.connect(t.ganho).connect(c.destination);
      } catch { t.ganho = null; }
    }
    audio.addEventListener('playing', () => { if (tocando !== t) return; t.carregando = false; marcar(); andar(); });
    audio.addEventListener('ended', () => { if (tocando !== t) return; tocando = null; cancelAnimationFrame(quadro); marcar(); });
    audio.addEventListener('error', () => {
      if (tocando !== t) return;
      const x = el.querySelector(`.musica[data-id="${CSS.escape(id)}"] .musica-ouvir`);
      tocando = null;
      marcar();
      if (x) { x.classList.add('falhou'); x.setAttribute('aria-label', 'Prévia indisponível'); }
    });
    return t;
  }
  // some com fade e libera o arquivo
  function largar(t) {
    volume(t, 0, FADE_SAI).then(() => { t.audio.pause(); t.audio.removeAttribute('src'); t.audio.load(); });
  }
  function pausar(t) {
    t.pausado = true;
    marcar();
    volume(t, 0, FADE_SAI).then(() => { if (t.pausado) t.audio.pause(); });
  }
  function continuar(t) {
    t.pausado = false;
    if (t.ganho) t.ganho.gain.setValueAtTime(0, ctxPrevia.currentTime); else t.audio.volume = 0;
    contextoPrevia();
    t.audio.play().catch(() => {});
    volume(t, 1, FADE_ENTRA);
    marcar();
    andar();
  }
  function parar() {
    if (tocando) largar(tocando);
    cancelAnimationFrame(quadro);
    tocando = null;
    marcar();
  }
  function ouvir(id) {
    if (tocando?.id === id) {
      if (tocando.pausado) continuar(tocando);
      else pausar(tocando);
      return;
    }
    parar();
    tocando = novoTocador(id);
    tocando.audio.play().catch(() => { /* erro tratado em "error" */ });
    // ouvir a prévia também conta como "tocada por último" (a lista só reordena na próxima vez)
    guardar('cifras.recentes', [id, ...recentes().filter((x) => x !== id)].slice(0, 10));
    marcar();
  }

  // ---------- carrossel de categorias: infinito ----------
  // A fileira tem 3 cópias das categorias; mostramos a do meio e, ao passar do fim (ou do começo),
  // pulamos sem animação para o mesmo cartão na cópia do meio. Anda por transform (liso), não por rolagem.
  const trilho = $('#categorias');
  const N = CATEGORIAS.length;
  let pos = N;              // índice do primeiro cartão visível
  let auto = 0;
  let parado = 0;           // até quando fica parado depois que a pessoa mexeu
  let arrasto = null;       // { x, base, moveu }
  const passo = () => {
    const c = trilho.children[0];
    return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(trilho).columnGap || '0') : 200;
  };
  const colocar = (x, animado) => {
    trilho.style.transition = animado ? DESLIZE : 'none';
    trilho.style.transform = `translate3d(${x}px, 0, 0)`;
  };
  const ir = (i, animado = true) => { pos = i; colocar(-pos * passo(), animado); };
  trilho.addEventListener('transitionend', (e) => {
    if (e.target !== trilho) return;
    if (pos >= 2 * N) ir(pos - N, false);
    else if (pos < N) ir(pos + N, false);
  });
  const segurar = () => { parado = Date.now() + PAUSA_CARROSSEL; };
  auto = setInterval(() => {
    if (Date.now() < parado || document.hidden || arrasto) return;
    ir(pos + 1);
  }, PASSO_CARROSSEL);
  $('#setaEsq').addEventListener('click', () => { segurar(); ir(pos - 1); });
  $('#setaDir').addEventListener('click', () => { segurar(); ir(pos + 1); });
  $('#carrossel').addEventListener('mouseenter', () => { parado = Infinity; });
  $('#carrossel').addEventListener('mouseleave', segurar);
  // arrastar com o dedo/mouse: a fileira segue o dedo e, ao soltar, encaixa no cartão mais perto
  trilho.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const m = new DOMMatrix(getComputedStyle(trilho).transform);
    arrasto = { x: e.clientX, base: m.m41, moveu: false, id: e.pointerId };
    colocar(m.m41, false);
    segurar();
  });
  trilho.addEventListener('pointermove', (e) => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    const dx = e.clientX - arrasto.x;
    if (!arrasto.moveu && Math.abs(dx) > 6) { arrasto.moveu = true; trilho.setPointerCapture(e.pointerId); trilho.classList.add('arrastando'); }
    if (arrasto.moveu) colocar(arrasto.base + dx, false);
  });
  const soltar = (e) => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    const { moveu, base } = arrasto;
    const dx = e.clientX - arrasto.x;
    arrasto = null;
    trilho.classList.remove('arrastando');
    if (!moveu) { ir(pos, true); return; }
    const p = passo();
    let alvo = Math.round(-(base + dx) / p);
    if (alvo === pos && Math.abs(dx) > p * 0.18) alvo += dx < 0 ? 1 : -1;   // um gesto curto já passa um cartão
    ir(alvo);
    // o clique que vem depois de arrastar não escolhe categoria
    trilho.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
    segurar();
  };
  trilho.addEventListener('pointerup', soltar);
  trilho.addEventListener('pointercancel', soltar);
  // tela mudou de tamanho: recalcula a posição sem animar
  const reposicionar = () => ir(pos, false);
  window.addEventListener('resize', reposicionar);
  requestAnimationFrame(() => ir(pos, false));

  el.addEventListener('click', (e) => {
    const ov = e.target.closest('[data-ouvir]');
    if (ov) { e.preventDefault(); ouvir(ov.dataset.ouvir); return; }
    if (e.target.closest('#limpar')) { busca = ''; $('#busca').value = ''; $('#busca').focus(); desenhar(); return; }
    if (e.target.closest('#todas')) { modo = null; categoria = null; desenhar(); return; }
    const at = e.target.closest('[data-atalho]');
    const ca = e.target.closest('[data-categoria]');
    if (!at && !ca) return;
    if (at) modo = modo === at.dataset.atalho ? null : at.dataset.atalho;
    if (ca && ca.classList.contains('embreve')) return;
    if (ca) categoria = categoria === ca.dataset.categoria ? null : ca.dataset.categoria;
    desenhar();
    // desce até a busca, para ver a lista que mudou
    $('.cb-busca-faixa').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#busca').addEventListener('input', (e) => { busca = e.target.value; desenhar(); });

  // a faixa da busca só escurece o fundo depois que gruda no topo
  const olho = new IntersectionObserver(([x]) => $('.cb-busca-faixa').classList.toggle('grudada', !x.isIntersecting));
  olho.observe($('#marcaBusca'));
  const esconder = () => { if (document.hidden && tocando && !tocando.pausado) pausar(tocando); };
  document.addEventListener('visibilitychange', esconder);

  desenhar();
  carregar().then((l) => { musicas = l; if (l.length) marcarEmBreve(); desenhar(); });
  return () => {
    olho.disconnect();
    clearInterval(auto);
    window.removeEventListener('resize', reposicionar);
    parar();
    setTimeout(() => ctxPrevia?.close().catch(() => {}), (FADE_SAI + 0.1) * 1000);
    document.removeEventListener('visibilitychange', esconder);
    el.classList.remove('app-larga');
  };
}
