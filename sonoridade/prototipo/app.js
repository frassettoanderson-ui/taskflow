// Sonoridade — protótipo da Fase 0
// Carrega um VS (uma faixa por instrumento), toca tudo sincronizado num AudioWorklet
// e testa: mixer, modo progressivo, loop, velocidade, tom e afinador pelo microfone.

const PASTA = 'vs/sublime-meia-noite/';
const NOTAS = ['Dó', 'Dó#', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Fá#', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];
const CIFRA = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

const ETAPAS = {
  1: { volume: 80, mudo: false, vel: 70 },
  2: { volume: 80, mudo: false, vel: 85 },
  3: { volume: 35, mudo: false, vel: 100 },
  4: { volume: 80, mudo: true, vel: 100 },
};

const $ = (id) => document.getElementById(id);
const estado = {
  musica: null,
  faixas: [],          // { id, nome, cor, volume, mudo, solo }
  ctx: null,
  motor: null,
  duracao: 0,
  posicao: 0,
  tocando: false,
  arrastando: false,
  instrumento: null,
  etapa: null,
  vel: 100,
  semitons: 0,
  loop: { a: null, b: null, ativo: false },
  diag: {},
};

// ---------- utilidades ----------
const mmss = (s) => {
  s = Math.max(0, s);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const mb = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`;
const ganhoDeVolume = (v) => Math.pow(v / 100, 2) * 1.6; // curva perceptiva; 80 ≈ 1,0

function diag(chave, valor) {
  estado.diag[chave] = valor;
  $('diag').innerHTML = Object.entries(estado.diag)
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

// ---------- música ----------
async function iniciar() {
  const r = await fetch(PASTA + 'musica.json');
  estado.musica = await r.json();
  const m = estado.musica;
  $('titulo').textContent = m.titulo;
  $('detalhes').textContent = `${nomeTom(0)} · ${m.bpm} BPM · ${m.faixas.length} faixas`;
  $('capa').src = PASTA + m.capa;
  $('valTom').textContent = nomeTom(0);
  diag('Navegador', navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90));
  diag('AudioWorklet', 'AudioWorkletNode' in window ? 'disponível' : 'NÃO disponível (precisa de HTTPS)');
}

function nomeTom(semitons) {
  const base = CIFRA[estado.musica?.tom] ?? 0;
  return NOTAS[(((base + semitons) % 12) + 12) % 12];
}

async function carregar() {
  const btn = $('btnCarregar');
  btn.disabled = true;
  btn.textContent = 'Carregando…';
  const t0 = performance.now();

  estado.ctx = new AudioContext({ latencyHint: 'interactive' });
  await estado.ctx.audioWorklet.addModule('motor-worklet.js');
  estado.motor = new AudioWorkletNode(estado.ctx, 'motor-sonoridade', { outputChannelCount: [2] });
  estado.motor.connect(estado.ctx.destination);
  estado.motor.port.onmessage = (e) => mensagemDoMotor(e.data);

  const prog = $('progresso');
  prog.hidden = false;
  prog.innerHTML = estado.musica.faixas.map((f) =>
    `<div class="item" id="p-${f.id}"><span>${f.nome}</span><span class="barrinha"><i></i></span><span>0%</span></div>`).join('');

  // baixa e decodifica as faixas em paralelo (no máximo 3 de cada vez para não travar celular fraco)
  const resultados = new Array(estado.musica.faixas.length);
  let proxima = 0, bytesBaixados = 0;
  async function trabalhador() {
    while (proxima < estado.musica.faixas.length) {
      const i = proxima++;
      const f = estado.musica.faixas[i];
      const dados = await baixar(PASTA + f.arquivo, (p) => marcar(f.id, p * 0.8, `${Math.round(p * 100)}%`));
      bytesBaixados += dados.byteLength;
      marcar(f.id, 0.85, 'abrindo');
      const buf = await estado.ctx.decodeAudioData(dados);
      resultados[i] = paraInt16(buf);
      marcar(f.id, 1, resultados[i].R ? 'estéreo' : 'mono');
    }
  }
  await Promise.all([trabalhador(), trabalhador(), trabalhador()]);

  const comp = Math.max(...resultados.map((r) => r.L.length));
  const memoria = resultados.reduce((s, r) => s + r.L.byteLength + (r.R ? r.R.byteLength : 0), 0);
  const transferir = [];
  resultados.forEach((r) => { transferir.push(r.L.buffer); if (r.R) transferir.push(r.R.buffer); });
  estado.motor.port.postMessage({
    tipo: 'carregar',
    comp,
    faixas: resultados.map((r) => ({ L: r.L.buffer, R: r.R ? r.R.buffer : null })),
  }, transferir);

  estado.duracao = comp / estado.ctx.sampleRate;
  estado.faixas = estado.musica.faixas.map((f) => ({ ...f, volume: f.volume ?? 80, mudo: false, solo: false }));

  const segundos = ((performance.now() - t0) / 1000).toFixed(1);
  diag('Carregamento', `${segundos} s`);
  diag('Baixado', mb(bytesBaixados));
  diag('Memória das faixas', mb(memoria));
  diag('Faixas mono / estéreo', `${resultados.filter((r) => !r.R).length} / ${resultados.filter((r) => r.R).length}`);
  diag('Taxa de amostragem', `${estado.ctx.sampleRate} Hz`);
  diag('Latência de saída', `${Math.round(((estado.ctx.baseLatency || 0) + (estado.ctx.outputLatency || 0)) * 1000)} ms`);

  btn.hidden = true;
  setTimeout(() => { prog.hidden = true; }, 1200);
  $('tTotal').textContent = mmss(estado.duracao);
  $('barra').max = estado.duracao.toFixed(2);
  $('estudio').hidden = false;
  montarMixer();
  enviarGanhos();
  atualizarEtapas();
}

function marcar(id, fracao, texto) {
  const el = document.getElementById(`p-${id}`);
  if (!el) return;
  el.querySelector('i').style.width = `${Math.round(fracao * 100)}%`;
  el.lastElementChild.textContent = texto;
}

async function baixar(url, aoProgredir) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar ${url}`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body || !total) return r.arrayBuffer();
  const leitor = r.body.getReader();
  const partes = [];
  let recebido = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    recebido += value.length;
    aoProgredir(recebido / total);
  }
  const tudo = new Uint8Array(recebido);
  let o = 0;
  for (const p of partes) { tudo.set(p, o); o += p.length; }
  return tudo.buffer;
}

// Converte para 16 bits (metade da memória) e guarda só um canal quando L e R são iguais.
function paraInt16(buf) {
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  let mono = !R;
  if (R) {
    let dif = 0, soma = 1e-12;
    for (let i = 0; i < L.length; i += 64) { const d = L[i] - R[i]; dif += d * d; soma += L[i] * L[i] + R[i] * R[i]; }
    mono = dif / soma < 1e-4;
  }
  const conv = (canal) => {
    const out = new Int16Array(canal.length);
    for (let i = 0; i < canal.length; i++) {
      const v = canal[i];
      out[i] = v >= 1 ? 32767 : v <= -1 ? -32768 : Math.round(v * 32767);
    }
    return out;
  };
  if (mono) {
    if (!R) return { L: conv(L), R: null };
    const m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = (L[i] + R[i]) * 0.5;
    return { L: conv(m), R: null };
  }
  return { L: conv(L), R: conv(R) };
}

// ---------- motor ----------
function mensagemDoMotor(m) {
  if (m.tipo === 'pos') {
    estado.posicao = m.segundos;
    if (!estado.arrastando) {
      $('barra').value = m.segundos.toFixed(2);
      $('tAtual').textContent = mmss(m.segundos);
    }
  } else if (m.tipo === 'fim') {
    estado.tocando = false;
    $('btnTocar').textContent = '▶';
    $('btnTocar').setAttribute('aria-label', 'Tocar');
  }
}

const enviar = (msg) => estado.motor?.port.postMessage(msg);

function enviarGanhos() {
  const algumSolo = estado.faixas.some((f) => f.solo);
  const valores = estado.faixas.map((f) => {
    if (f.mudo) return 0;
    if (algumSolo && !f.solo) return 0;
    return ganhoDeVolume(f.volume);
  });
  enviar({ tipo: 'ganhos', valores });
  document.querySelectorAll('.faixa').forEach((el, i) => el.classList.toggle('silenciada', valores[i] === 0));
}

async function tocarOuPausar() {
  if (!estado.motor) return;
  if (estado.ctx.state !== 'running') await estado.ctx.resume();
  estado.tocando = !estado.tocando;
  enviar({ tipo: estado.tocando ? 'tocar' : 'pausar' });
  $('btnTocar').textContent = estado.tocando ? '❚❚' : '▶';
  $('btnTocar').setAttribute('aria-label', estado.tocando ? 'Pausar' : 'Tocar');
}

function buscar(segundos) {
  segundos = Math.max(0, Math.min(segundos, estado.duracao - 0.1));
  estado.posicao = segundos;
  enviar({ tipo: 'buscar', segundos });
  $('barra').value = segundos.toFixed(2);
  $('tAtual').textContent = mmss(segundos);
}

function definirVelocidade(pct) {
  estado.vel = pct;
  $('vel').value = pct;
  $('valVel').textContent = `${pct}%`;
  enviar({ tipo: 'velocidade', valor: pct / 100 });
}

function definirTom(semitons) {
  estado.semitons = Math.max(-4, Math.min(4, semitons));
  $('valTom').textContent = nomeTom(estado.semitons);
  const s = estado.semitons;
  $('avisoTom').textContent = s === 0 ? 'original' : `${s > 0 ? '+' : '−'}${Math.abs(s) / 2} tom${Math.abs(s) > 2 ? 's' : ''}`;
  enviar({ tipo: 'tom', semitons: estado.semitons });
}

// ---------- mixer ----------
function montarMixer() {
  const mixer = $('mixer');
  mixer.innerHTML = '';
  estado.faixas.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'faixa';
    el.dataset.id = f.id;
    el.innerHTML = `
      <span class="cor" style="background:${f.cor}"></span>
      <span class="nome">${f.nome}<small hidden>você</small></span>
      <button class="ms" data-acao="mudo" title="Desligar">M</button>
      <button class="ms" data-acao="solo" title="Só esta">S</button>
      <input type="range" min="0" max="100" value="${f.volume}" aria-label="Volume ${f.nome}">`;
    el.querySelector('[data-acao=mudo]').onclick = () => { f.mudo = !f.mudo; pintarFaixa(i); enviarGanhos(); estado.etapa = null; atualizarEtapas(); };
    el.querySelector('[data-acao=solo]').onclick = () => { f.solo = !f.solo; pintarFaixa(i); enviarGanhos(); };
    el.querySelector('input').oninput = (e) => { f.volume = Number(e.target.value); enviarGanhos(); };
    mixer.appendChild(el);
  });
}

function pintarFaixa(i) {
  const f = estado.faixas[i];
  const el = $('mixer').children[i];
  el.querySelector('[data-acao=mudo]').classList.toggle('mudo-on', f.mudo);
  el.querySelector('[data-acao=solo]').classList.toggle('solo-on', f.solo);
  el.querySelector('input').value = f.volume;
  const sua = f.id === estado.instrumento;
  el.classList.toggle('sua', sua);
  el.querySelector('small').hidden = !sua;
}

// ---------- instrumento e modo progressivo ----------
function escolherInstrumento(inst) {
  // devolve o instrumento anterior ao normal
  const anterior = estado.faixas.find((f) => f.id === estado.instrumento);
  if (anterior) { anterior.mudo = false; anterior.volume = 80; }
  estado.instrumento = estado.instrumento === inst ? null : inst;
  estado.etapa = null;
  document.querySelectorAll('#instrumentos button').forEach((b) => b.classList.toggle('ativo', b.dataset.inst === estado.instrumento));
  estado.faixas.forEach((_, i) => pintarFaixa(i));
  enviarGanhos();
  atualizarEtapas();
}

function aplicarEtapa(n) {
  const f = estado.faixas.find((x) => x.id === estado.instrumento);
  if (!f) return;
  const e = ETAPAS[n];
  f.volume = e.volume;
  f.mudo = e.mudo;
  estado.etapa = n;
  definirVelocidade(e.vel);
  estado.faixas.forEach((_, i) => pintarFaixa(i));
  enviarGanhos();
  atualizarEtapas();
}

function atualizarEtapas() {
  const tem = !!estado.instrumento;
  document.querySelectorAll('#etapas button').forEach((b) => {
    b.disabled = !tem;
    b.classList.toggle('ativo', Number(b.dataset.etapa) === estado.etapa);
  });
  const nome = { violao: 'violão', guitarra: 'guitarra', baixo: 'baixo' }[estado.instrumento];
  $('dicaEtapa').textContent = !tem
    ? 'Escolha o seu instrumento para usar as etapas.'
    : estado.etapa === 4
      ? `Agora é você: o ${nome} saiu do VS.`
      : `Suba de etapa quando se sentir seguro no ${nome}.`;
}

// ---------- loop ----------
function marcarLoop(ponto) {
  estado.loop[ponto] = estado.posicao;
  const { a, b } = estado.loop;
  if (a !== null && b !== null && b <= a) estado.loop[ponto === 'a' ? 'b' : 'a'] = null;
  if (estado.loop.a !== null && estado.loop.b !== null) {
    estado.loop.ativo = true;
  }
  desenharLoop();
}

function alternarLoop() {
  if (estado.loop.a === null || estado.loop.b === null) return;
  estado.loop.ativo = !estado.loop.ativo;
  desenharLoop();
}

function desenharLoop() {
  const { a, b, ativo } = estado.loop;
  const completo = a !== null && b !== null;
  $('btnA').classList.toggle('ativo', a !== null);
  $('btnB').classList.toggle('ativo', b !== null);
  $('btnLoop').disabled = !completo;
  $('btnLoop').textContent = ativo ? 'Loop ligado' : 'Loop desligado';
  $('btnLoop').classList.toggle('ativo', ativo);
  const faixa = $('faixaLoop');
  if (completo) {
    faixa.hidden = false;
    faixa.style.left = `${(a / estado.duracao) * 100}%`;
    faixa.style.width = `${((b - a) / estado.duracao) * 100}%`;
    faixa.style.opacity = ativo ? 1 : 0.35;
    $('infoLoop').textContent = `Trecho ${mmss(a)} → ${mmss(b)}`;
  } else {
    faixa.hidden = true;
    $('infoLoop').textContent = a !== null ? `Início em ${mmss(a)}. Agora marque o fim.` : 'Marque o início e o fim do trecho enquanto a música toca.';
  }
  enviar({ tipo: 'loop', ativo: ativo && completo, a: a ?? 0, b: b ?? 0 });
  if (ativo && completo && estado.posicao > b) buscar(a);
}

// ---------- afinador ----------
const afinador = { ligado: false, analisador: null, buf: null, ultimo: 0, stream: null };

async function alternarMic() {
  if (afinador.ligado) {
    afinador.stream.getTracks().forEach((t) => t.stop());
    afinador.ligado = false;
    $('btnMic').textContent = 'Ligar microfone';
    $('nota').textContent = '—';
    $('freq').textContent = 'Toque uma corda perto do microfone';
    return;
  }
  try {
    if (!estado.ctx) estado.ctx = new AudioContext({ latencyHint: 'interactive' });
    if (estado.ctx.state !== 'running') await estado.ctx.resume();
    afinador.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const fonte = estado.ctx.createMediaStreamSource(afinador.stream);
    afinador.analisador = estado.ctx.createAnalyser();
    afinador.analisador.fftSize = 4096;
    afinador.buf = new Float32Array(afinador.analisador.fftSize);
    fonte.connect(afinador.analisador);
    afinador.ligado = true;
    $('btnMic').textContent = 'Desligar microfone';
    requestAnimationFrame(lerMic);
  } catch (e) {
    $('freq').textContent = `Microfone indisponível: ${e.message}`;
  }
}

function lerMic(t) {
  if (!afinador.ligado) return;
  requestAnimationFrame(lerMic);
  if (t - afinador.ultimo < 90) return; // ~11 leituras por segundo
  afinador.ultimo = t;
  afinador.analisador.getFloatTimeDomainData(afinador.buf);
  const f = detectarFrequencia(afinador.buf, estado.ctx.sampleRate);
  if (!f) return;
  const midi = 69 + 12 * Math.log2(f / 440);
  const n = Math.round(midi);
  const cents = Math.round((midi - n) * 100);
  $('nota').textContent = `${NOTAS[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
  $('freq').textContent = `${f.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents} cents`;
  $('agulha').style.left = `calc(${50 + cents}% - 2px)`;
}

// YIN simplificado: acha o período fundamental (40 Hz a 1000 Hz cobre baixo, violão e guitarra)
function detectarFrequencia(buf, sr) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / buf.length) < 0.008) return null;

  const W = 2048;
  const tauMin = Math.floor(sr / 1000);
  const tauMax = Math.min(Math.floor(sr / 40), buf.length - W - 1);
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i += 2) { const x = buf[i] - buf[i + tau]; s += x * x; }
    d[tau] = s;
  }
  // diferença normalizada cumulativa
  let soma = 0;
  d[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) { soma += d[tau]; d[tau] = soma ? (d[tau] * tau) / soma : 1; }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < 0.15) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // interpolação parabólica
  const a = d[tau - 1], b = d[tau], c = d[tau + 1] ?? b;
  const den = a + c - 2 * b;
  const ajuste = den ? (a - c) / (2 * den) : 0;
  return sr / (tau + ajuste);
}

// ---------- eventos ----------
$('btnCarregar').onclick = () => carregar().catch((e) => {
  $('btnCarregar').disabled = false;
  $('btnCarregar').textContent = 'Tentar de novo';
  diag('Erro', e.message);
  console.error(e);
});
$('btnTocar').onclick = tocarOuPausar;
$('btnVoltar').onclick = () => buscar(estado.posicao - 5);
$('btnAvancar').onclick = () => buscar(estado.posicao + 5);
$('barra').oninput = (e) => { estado.arrastando = true; $('tAtual').textContent = mmss(Number(e.target.value)); };
$('barra').onchange = (e) => { estado.arrastando = false; buscar(Number(e.target.value)); };
$('vel').oninput = (e) => { definirVelocidade(Number(e.target.value)); estado.etapa = null; atualizarEtapas(); };
$('tomMenos').onclick = () => definirTom(estado.semitons - 1);
$('tomMais').onclick = () => definirTom(estado.semitons + 1);
$('btnA').onclick = () => marcarLoop('a');
$('btnB').onclick = () => marcarLoop('b');
$('btnLoop').onclick = alternarLoop;
$('btnMic').onclick = alternarMic;
document.querySelectorAll('#instrumentos button').forEach((b) => { b.onclick = () => escolherInstrumento(b.dataset.inst); });
document.querySelectorAll('#etapas button').forEach((b) => { b.onclick = () => aplicarEtapa(Number(b.dataset.etapa)); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && estado.motor) { e.preventDefault(); tocarOuPausar(); }
});

iniciar();
