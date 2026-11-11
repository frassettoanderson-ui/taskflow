// Treino de batida: esteira com as setas chegando na linha (estilo jogo de ritmo),
// metrônomo, violão tocando junto e aviso de quando troca o acorde.
import { batida as acharBatida, PROGRESSOES, contagem } from '../dados/batidas.js';
import { acorde, GRUPOS } from '../dados/acordes.js';
import { braco, vibrar } from '../ui/braco.js';
import { barraTopo, lerQuery, esc, ICONES, ehDedilhado } from '../ui/comum.js';
import { passosHtml } from './batidas.js';
import * as som from '../audio/som.js';

const ACORDES_SOLO = GRUPOS[0].acordes; // primeiros acordes para o modo "um acorde só"

export function montar(el, id, query) {
  const b = acharBatida(id);
  if (!b) {
    el.innerHTML = `${barraTopo('Batidas', '#/batidas')}<p class="intro">Batida não encontrada.</p>`;
    return;
  }
  const q = lerQuery(query);
  const n = b.passos.length;
  // sequência montada na tela Sequências (?seq=G,D,Em,C)
  const minha = (q.seq || '').split(',').filter((s) => acorde(s));
  const conta = contagem(b);

  const st = {
    bpm: b.bpm,
    prog: minha.length ? 'minha' : q.acorde && acorde(q.acorde) ? 'um' : PROGRESSOES[0].id,
    unico: q.acorde && acorde(q.acorde) ? q.acorde : 'G',
    cpa: b.nivel === 1 ? 2 : 1,      // compassos por acorde
    violao: true,
    click: true,
    tocando: false,
    inicio: 0,
    proxPasso: 0,
    timer: 0,
    raf: 0,
    acordeMostrado: null,
  };

  const listaAcordes = () => (st.prog === 'um' ? [st.unico]
    : st.prog === 'minha' ? minha
    : PROGRESSOES.find((p) => p.id === st.prog).acordes);
  const acordeDoCompasso = (c) => { const l = listaAcordes(); return l[Math.floor(c / st.cpa) % l.length]; };
  const duracaoPasso = () => 60 / st.bpm / b.porTempo;

  el.innerHTML = `
    ${barraTopo(esc(b.nome), '#/batidas')}
    <p class="intro">${esc(b.dica)}</p>

    <section class="painel-acorde" id="painel">
      <div><div class="rotulo">Agora</div><div class="nome" id="agora"></div></div>
      <div class="prox"><div class="rotulo">Próximo</div><div class="nome" id="prox"></div></div>
      <div class="troca" aria-hidden="true"><i id="troca"></i></div>
      <div class="mini" id="mini"></div>
    </section>

    <section class="esteira-caixa">
      <canvas class="esteira" id="esteira"></canvas>
      <div class="contagem" id="contagem" hidden></div>
    </section>

    <div class="passos" id="passos">${passosHtml(b)}</div>

    <div class="controles">
      <div class="lado"><button class="redondo" id="menos" aria-label="Mais devagar">${ICONES.menos}</button></div>
      <button class="play" id="play" aria-label="Começar">${ICONES.play}</button>
      <div class="lado"><button class="redondo" id="mais" aria-label="Mais rápido">${ICONES.mais}</button></div>
    </div>
    <div class="bpm">
      <output id="bpm">${st.bpm}</output><small>batidas por minuto</small>
      <input type="range" id="bpmFaixa" min="40" max="140" step="1" value="${st.bpm}" aria-label="Velocidade">
    </div>

    <section class="secao">
      <h2>Acordes</h2>
      <div class="opcoes-linha" id="progs"></div>
      <div class="opcoes-linha" id="unicos"></div>
      <a class="botao largo" href="#/sequencias">Montar minha sequência</a>
    </section>

    <section class="secao">
      <h2>Trocar de acorde a cada</h2>
      <div class="segmentado" id="cpa">
        <button data-cpa="1">1 compasso</button>
        <button data-cpa="2">2 compassos</button>
      </div>
    </section>

    <section class="secao">
      <h2>Som</h2>
      <div class="segmentado">
        <button id="tViolao">Violão tocando</button>
        <button id="tClick">Metrônomo</button>
      </div>
      <div class="segmentado" id="timbre">
        ${Object.entries(som.TIMBRES).map(([k, v]) => `<button data-timbre="${k}">Cordas de ${v.nome.toLowerCase()}</button>`).join('')}
      </div>
    </section>
  `;

  const $ = (s) => el.querySelector(s);
  const canvas = $('#esteira');
  const g = canvas.getContext('2d');
  const passosEl = [...el.querySelectorAll('#passos .passo')];

  // ---------- opções ----------
  function desenharOpcoes() {
    const opcao = (id, nome, nota) =>
      `<button class="opcao-linha${st.prog === id ? ' ativo' : ''}" data-prog="${id}">${esc(nome)}<small>${esc(nota)}</small></button>`;
    $('#progs').innerHTML = (minha.length ? opcao('minha', minha.join(' '), 'sua sequência') : '')
      + PROGRESSOES.map((p) => opcao(p.id, p.acordes.join(' '), p.nota)).join('')
      + opcao('um', 'Um acorde só', 'para pegar o ritmo');
    const unicos = $('#unicos');
    unicos.hidden = st.prog !== 'um';
    const opcoes = ACORDES_SOLO.includes(st.unico) ? ACORDES_SOLO : [st.unico, ...ACORDES_SOLO];
    unicos.innerHTML = opcoes.map((s) => `<button class="opcao-linha${st.unico === s ? ' ativo' : ''}" data-unico="${esc(s)}">${esc(s)}</button>`).join('');
    el.querySelectorAll('#cpa button').forEach((x) => x.classList.toggle('ativo', Number(x.dataset.cpa) === st.cpa));
    $('#tViolao').classList.toggle('ativo', st.violao);
    $('#tClick').classList.toggle('ativo', st.click);
    el.querySelectorAll('#timbre button').forEach((x) => x.classList.toggle('ativo', x.dataset.timbre === som.timbreAtual()));
    som.preparar(listaAcordes().map(acorde));
    st.acordeMostrado = null;
    if (!st.tocando) atualizarPainel(0);
  }

  el.addEventListener('click', (e) => {
    const x = e.target.closest('button');
    if (!x) return;
    if (x.dataset.prog) st.prog = x.dataset.prog;
    else if (x.dataset.unico) st.unico = x.dataset.unico;
    else if (x.dataset.cpa) st.cpa = Number(x.dataset.cpa);
    else if (x.id === 'tViolao') st.violao = !st.violao;
    else if (x.id === 'tClick') st.click = !st.click;
    else if (x.dataset.timbre) som.definirTimbre(x.dataset.timbre);
    else return;
    desenharOpcoes();
  });

  // ---------- velocidade ----------
  function definirBpm(v) {
    v = Math.max(40, Math.min(140, Math.round(v)));
    if (st.tocando) {
      const agora = som.contexto().currentTime;
      const pos = (agora - st.inicio) / duracaoPasso();
      st.bpm = v;
      if (pos >= 0) st.inicio = agora - pos * duracaoPasso();
    } else {
      st.bpm = v;
    }
    $('#bpm').textContent = v;
    $('#bpmFaixa').value = v;
  }
  $('#menos').onclick = () => definirBpm(st.bpm - 5);
  $('#mais').onclick = () => definirBpm(st.bpm + 5);
  $('#bpmFaixa').oninput = (e) => definirBpm(Number(e.target.value));

  // ---------- tocar ----------
  function agendar() {
    const c = som.contexto();
    const dp = duracaoPasso();
    while (st.inicio + st.proxPasso * dp < c.currentTime + 0.12) {
      const k = st.proxPasso;
      const t = st.inicio + k * dp;
      const i = k % n;
      if (st.click && i % b.porTempo === 0) som.click(t, i === 0, 0.42);
      if (st.violao) {
        const a = acorde(acordeDoCompasso(Math.floor(k / n)));
        const p = b.passos[i];
        if (p === 'B' || p === 'C') {
          const direcao = p === 'B' ? 'baixo' : 'cima';
          som.batida(a, { direcao, quando: t, forca: p === 'B' ? 1 : 0.85 });
          // as cordas do mini braço vibram na hora em que a batida soa
          const espera = Math.max(0, (t - som.tempoAudio()) * 1000);
          setTimeout(() => { if (st.tocando) vibrar($('#mini'), a, { direcao }); }, espera);
        }
        else if (p === 'X') som.abafada(t, a);
        else if (ehDedilhado(p)) som.nota(a, p, { quando: t });
      }
      st.proxPasso++;
    }
  }

  async function comecar() {
    st.tocando = true;
    $('#play').innerHTML = ICONES.pausa;
    som.contexto();
    await som.preparar(listaAcordes().map(acorde));   // espera o som do violão chegar
    if (!st.tocando) return;
    const c = som.contexto();
    const tempo = 60 / st.bpm;
    st.inicio = c.currentTime + 0.15 + b.tempos * tempo;   // 1 compasso de contagem antes
    for (let t = 0; t < b.tempos; t++) som.click(c.currentTime + 0.15 + t * tempo, t === 0, 0.42);
    st.proxPasso = 0;
    st.tocando = true;
    st.acordeMostrado = null;
    agendar();
    st.timer = setInterval(agendar, 25);
    $('#play').innerHTML = ICONES.pausa;
    $('#play').setAttribute('aria-label', 'Parar');
  }

  function parar() {
    clearInterval(st.timer);
    st.tocando = false;
    som.silenciar();
    $('#play').innerHTML = ICONES.play;
    $('#play').setAttribute('aria-label', 'Começar');
    $('#contagem').hidden = true;
    passosEl.forEach((p) => p.classList.remove('agora'));
    st.acordeMostrado = null;
    atualizarPainel(0);
  }

  $('#play').onclick = () => (st.tocando ? parar() : comecar());

  // ---------- painel do acorde ----------
  function atualizarPainel(sAgora) {
    const s = Math.max(0, sAgora);
    const compasso = Math.floor(s / n);
    const bloco = Math.floor(compasso / st.cpa);
    const lista = listaAcordes();
    const atual = lista[bloco % lista.length];
    const proximo = lista.length > 1 ? lista[(bloco + 1) % lista.length] : atual;
    const fracao = st.tocando && sAgora >= 0 ? (s / n - bloco * st.cpa) / st.cpa : 0;
    $('#troca').style.width = `${(fracao * 100).toFixed(1)}%`;
    if (atual !== st.acordeMostrado) {
      st.acordeMostrado = atual;
      $('#agora').textContent = atual;
      $('#prox').textContent = proximo;
      $('#mini').innerHTML = braco(acorde(atual), { compacto: true });
    }
  }

  // ---------- esteira ----------
  let W = 0, H = 0;
  const ajustar = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const obs = new ResizeObserver(ajustar);
  obs.observe(canvas);
  ajustar();

  function seta(x, y, tam, tipo, alfa) {
    g.save();
    g.translate(x, y);
    g.globalAlpha = alfa;
    if (ehDedilhado(tipo)) {
      // dedilhado: bolinha com o número da corda (ou P de polegar), mais alta quanto mais fina a corda
      const r = tam * 0.34;
      const sobe = tipo === 'P' ? r * 0.9 : -(Number(tipo) - 2.5) * r * 0.55;
      g.translate(0, sobe);
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = tipo === 'P' ? '#e3ad45' : '#2a2a26';
      g.fill();
      g.fillStyle = tipo === 'P' ? '#191307' : '#f1ede4';
      g.font = `800 ${Math.round(r * 1.15)}px Archivo, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(tipo, 0, r * 0.06);
    } else if (tipo === 'X') {
      g.strokeStyle = '#d65f4b';
      g.lineWidth = tam * 0.14;
      g.lineCap = 'round';
      const r = tam * 0.3;
      g.beginPath(); g.moveTo(-r, -r); g.lineTo(r, r); g.moveTo(r, -r); g.lineTo(-r, r); g.stroke();
    } else {
      if (tipo === 'C') g.rotate(Math.PI);
      const s = tam;
      g.beginPath();
      g.moveTo(-s * 0.13, -s * 0.48);
      g.lineTo(s * 0.13, -s * 0.48);
      g.lineTo(s * 0.13, s * 0.02);
      g.lineTo(s * 0.34, s * 0.02);
      g.lineTo(0, s * 0.48);
      g.lineTo(-s * 0.34, s * 0.02);
      g.lineTo(-s * 0.13, s * 0.02);
      g.closePath();
      g.fillStyle = tipo === 'B' ? '#e3ad45' : '#f1ede4';
      g.fill();
    }
    g.restore();
  }

  function desenhar() {
    st.raf = requestAnimationFrame(desenhar);
    const dp = duracaoPasso();
    const sAgora = st.tocando ? (som.tempoAudio() - st.inicio) / dp : -n * 0.35;

    // contagem regressiva
    const cont = $('#contagem');
    if (st.tocando && sAgora < 0) {
      cont.hidden = false;
      cont.textContent = String(b.tempos + Math.floor(sAgora / b.porTempo) + 1);
    } else cont.hidden = true;

    atualizarPainel(sAgora);

    // passo atual na fileira de setas
    const atual = st.tocando && sAgora > -0.5 ? ((Math.round(sAgora) % n) + n) % n : -1;
    passosEl.forEach((p, i) => p.classList.toggle('agora', i === atual));

    // fundo
    g.clearRect(0, 0, W, H);
    const meio = H * 0.56;
    const alvoX = Math.max(56, W * 0.16);
    const px = Math.max(30, (W - alvoX) / (n * 1.1));
    const tam = Math.min(px * 0.78, 52);

    g.fillStyle = '#1a1a18';
    g.fillRect(0, meio - 32, W, 64);

    const k0 = Math.floor(sAgora - alvoX / px) - 1;
    const k1 = Math.ceil(sAgora + (W - alvoX) / px) + 1;
    g.textAlign = 'center';
    for (let k = Math.max(0, k0); k <= k1; k++) {
      const x = alvoX + (k - sAgora) * px;
      const i = k % n;
      const compasso = Math.floor(k / n);
      if (i % b.porTempo === 0) {
        g.fillStyle = i === 0 ? 'rgba(227,173,69,.6)' : 'rgba(241,237,228,.10)';
        g.fillRect(x - (i === 0 ? 1 : 0.5), 30, i === 0 ? 2 : 1, H - 52);
      }
      if (i === 0 && compasso % st.cpa === 0) {
        const nome = acordeDoCompasso(compasso);
        g.font = '800 16px Archivo, sans-serif';
        const larg = g.measureText(nome).width + 18;
        g.fillStyle = '#e3ad45';
        g.beginPath();
        g.roundRect(x + 4, 6, larg, 22, 5);
        g.fill();
        g.fillStyle = '#191307';
        g.textAlign = 'left';
        g.fillText(nome, x + 13, 22);
        g.textAlign = 'center';
      }
      g.font = `${i % b.porTempo === 0 ? '600 ' : ''}12px Archivo, sans-serif`;
      g.fillStyle = i % b.porTempo === 0 ? 'rgba(241,237,228,.75)' : 'rgba(153,148,138,.7)';
      g.fillText(conta[i], x, H - 8);

      const p = b.passos[i];
      if (p !== '-') {
        const passou = k < sAgora - 0.45;
        const perto = Math.abs(k - sAgora) < 0.45 && st.tocando;
        seta(x, meio, perto ? tam * 1.12 : tam, p, passou ? 0.22 : 1);
      }
    }

    // linha de acerto
    g.fillStyle = '#f2c766';
    g.fillRect(alvoX - 1.5, 26, 3, H - 46);
    g.beginPath();
    g.moveTo(alvoX - 7, 26); g.lineTo(alvoX + 7, 26); g.lineTo(alvoX, 34); g.closePath();
    g.fill();
  }
  desenhar();

  // ---------- teclado e saída ----------
  const tecla = (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); st.tocando ? parar() : comecar(); }
  };
  const visibilidade = () => { if (document.hidden && st.tocando) parar(); };
  document.addEventListener('keydown', tecla);
  document.addEventListener('visibilitychange', visibilidade);

  desenharOpcoes();

  return () => {
    clearInterval(st.timer);
    cancelAnimationFrame(st.raf);
    obs.disconnect();
    som.silenciar();
    document.removeEventListener('keydown', tecla);
    document.removeEventListener('visibilitychange', visibilidade);
  };
}
