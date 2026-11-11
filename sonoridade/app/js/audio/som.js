// Som do violão a partir de notas GRAVADAS (uma amostra por nota), tocadas corda a corda
// como numa batida de verdade. Se a internet falhar, cai para o violão sintetizado.
//
// Amostras: soundfont MusyngKite (licença CC BY-SA 3.0), servidas pelo projeto
// gleitz/midi-js-soundfonts. Para funcionar offline no futuro, copiar as notas usadas para app/sons/.

const ABERTAS = [40, 45, 50, 55, 59, 64]; // Mi2 Lá2 Ré3 Sol3 Si3 Mi4 (6ª → 1ª)
const NOMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const BASE = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/';
export const TIMBRES = {
  aco: { nome: 'Aço', pasta: 'acoustic_guitar_steel-mp3' },
  nailon: { nome: 'Náilon', pasta: 'acoustic_guitar_nylon-mp3' },
};

let ctx = null;
let entrada = null;
let tocando = null;
const amostras = new Map();      // `${timbre}:${midi}` → Promise<AudioBuffer|null>
const sinteticas = new Map();

function lerTimbre() {
  try { return localStorage.getItem('sonoridade.timbre') || 'aco'; } catch { return 'aco'; }
}
let timbre = lerTimbre();
export const timbreAtual = () => timbre;
export function definirTimbre(t) {
  if (!TIMBRES[t]) return;
  timbre = t;
  try { localStorage.setItem('sonoridade.timbre', t); } catch { /* sem armazenamento: tudo bem */ }
}

export function contexto() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    // um pouco de "sala" para não soar seco demais
    const seco = ctx.createGain(); seco.gain.value = 1;
    const sala = ctx.createConvolver(); sala.buffer = respostaSala(ctx);
    const molhado = ctx.createGain(); molhado.gain.value = 0.16;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 2.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    entrada = ctx.createGain();
    entrada.connect(seco).connect(comp);
    entrada.connect(sala).connect(molhado).connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// reverb curto de sala pequena (ruído com decaimento), gerado na hora
function respostaSala(c) {
  const dur = 0.9, n = Math.floor(c.sampleRate * dur);
  const b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
  }
  return b;
}

export function tempoAudio() {
  const c = contexto();
  return c.currentTime - (c.outputLatency || c.baseLatency || 0);
}

const nomeNota = (midi) => `${NOMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
// acorde.transpor (opcional): semitons a somar em tudo — capotraste (+) e afinação mais baixa (−)
const notasDo = (acorde) => acorde.casas.map((casa, i) => (casa < 0 ? null : ABERTAS[i] + casa + (acorde.transpor || 0)));

const prontas = new Map();       // mesma chave → AudioBuffer (ou null se falhou)

function carregar(midi, t = timbre) {
  const chave = `${t}:${midi}`;
  if (!amostras.has(chave)) {
    const c = contexto();
    const p = fetch(`${BASE}${TIMBRES[t].pasta}/${nomeNota(midi)}.mp3`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => c.decodeAudioData(ab))
      .catch(() => null)
      .then((b) => { prontas.set(chave, b); return b; });
    amostras.set(chave, p);
  }
  return amostras.get(chave);
}

// Uma nota solta pelo número MIDI (afinador, exercícios). baixo: true usa o baixo elétrico gravado.
const PASTA_BAIXO = 'electric_bass_finger-mp3';
const amostrasBaixo = new Map();
function carregarBaixo(midi) {
  if (!amostrasBaixo.has(midi)) {
    const c = contexto();
    amostrasBaixo.set(midi, fetch(`${BASE}${PASTA_BAIXO}/${nomeNota(midi)}.mp3`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => c.decodeAudioData(ab))
      .catch(() => null));
  }
  return amostrasBaixo.get(midi);
}
export async function tocarMidi(midi, { quando = 0, forca = 0.9, baixo = false } = {}) {
  const c = contexto();
  const buf = (await (baixo ? carregarBaixo(midi) : carregar(midi))) || sintetica(midi);
  const t = Math.max(quando || 0, c.currentTime + 0.01);
  calarAnterior(t, 0.04);
  const g = c.createGain();
  g.connect(entrada);
  tocando = g;
  tocarNota(buf, t, forca, g);
}
export const prepararMidi = (lista, { baixo = false } = {}) => Promise.all(lista.map((m) => (baixo ? carregarBaixo(m) : carregar(m))));

// Baixa antes as notas dos acordes (chamar ao abrir a tela)
export function preparar(acordes) {
  const lista = Array.isArray(acordes) ? acordes : [acordes];
  return Promise.all(lista.flatMap((a) => notasDo(a).filter((m) => m !== null).map((m) => carregar(m))));
}

// buffer pronto agora (ou o sintetizado, se a amostra não carregou)
function bufferJa(midi) {
  const chave = `${timbre}:${midi}`;
  if (prontas.has(chave)) return prontas.get(chave);
  carregar(midi);
  return null;
}

function calarAnterior(t, rapidez = 0.03) {
  if (!tocando) return;
  tocando.gain.cancelScheduledValues(t);
  tocando.gain.setTargetAtTime(0, t, rapidez);
}

function tocarNota(buf, t, ganho, destino) {
  const c = contexto();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.002; // corda nunca está 100% igual
  const v = c.createGain();
  v.gain.value = ganho;
  src.connect(v).connect(destino);
  src.start(t);
}

// direcao: 'baixo' (6ª → 1ª, cheia) ou 'cima' (1ª → 4ª, mais leve e brilhante)
export function batida(acorde, { direcao = 'baixo', quando = 0, forca = 1 } = {}) {
  const c = contexto();
  const t = Math.max(quando || 0, c.currentTime + 0.01);
  calarAnterior(t);
  const g = c.createGain();
  g.gain.value = forca;
  g.connect(entrada);
  tocando = g;

  const notas = notasDo(acorde);
  const ordem = direcao === 'cima' ? [5, 4, 3, 2] : [0, 1, 2, 3, 4, 5];
  // a palheta acelera ao atravessar as cordas: espaço entre cordas diminui um pouco
  let atraso = 0;
  let passo = direcao === 'cima' ? 0.011 : 0.016;
  let k = 0;
  for (const i of ordem) {
    const m = notas[i];
    if (m === null) continue;
    const buf = bufferJa(m) || sintetica(m);
    const peso = direcao === 'cima'
      ? 0.55 + (i === 5 ? 0.15 : 0)                  // subida: agudas na frente
      : 0.78 + (k === 0 ? 0.12 : 0) + (i >= 4 ? -0.08 : 0);
    tocarNota(buf, t + atraso + Math.random() * 0.003, peso * (0.9 + Math.random() * 0.1), g);
    atraso += passo;
    passo *= 0.9;
    k++;
  }
}

// Corda por corda, da mais grave para a mais aguda
export function dedilhar(acorde, intervalo = 0.34) {
  const c = contexto();
  const t = c.currentTime + 0.03;
  calarAnterior(t);
  const g = c.createGain();
  g.connect(entrada);
  tocando = g;
  let k = 0;
  notasDo(acorde).forEach((m) => {
    if (m === null) return;
    tocarNota(bufferJa(m) || sintetica(m), t + k * intervalo, 0.85, g);
    k++;
  });
  return k * intervalo;
}

// Uma corda só, para dedilhado no tempo: corda 1..6, ou 'P' = polegar no baixo do acorde.
// As notas do mesmo acorde continuam soando juntas; quando o acorde muda, o anterior é abafado.
let dedilhando = null;   // { chave, ganho }
export function nota(acorde, corda, { quando = 0, forca = 0.85 } = {}) {
  const c = contexto();
  const t = Math.max(quando || 0, c.currentTime + 0.01);
  const notas = notasDo(acorde);
  let i = corda === 'P' ? notas.findIndex((m) => m !== null) : 6 - Number(corda);
  if (i < 0 || i > 5) return;
  if (notas[i] === null) {
    // corda calada neste acorde: usa a vizinha mais aguda que soa
    i = notas.findIndex((m, k) => k > i && m !== null);
    if (i < 0) return;
  }
  const chave = `${acorde.casas.join(',')}:${acorde.transpor || 0}`;
  if (!dedilhando || dedilhando.chave !== chave || tocando !== dedilhando.ganho) {
    calarAnterior(t, 0.04);
    const g = c.createGain();
    g.connect(entrada);
    tocando = g;
    dedilhando = { chave, ganho: g };
  }
  const peso = corda === 'P' ? forca : forca * 0.8;
  tocarNota(bufferJa(notas[i]) || sintetica(notas[i]), t, peso * (0.92 + Math.random() * 0.08), dedilhando.ganho);
}

// Abafada: a palma bate nas cordas — "tchá" curto que corta o que estava soando
let ruido = null;
export function abafada(quando = 0, acorde = null) {
  const c = contexto();
  const t = Math.max(quando || 0, c.currentTime + 0.01);
  calarAnterior(t, 0.008);
  if (!ruido) {
    ruido = c.createBuffer(1, Math.floor(c.sampleRate * 0.09), c.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.014));
  }
  const src = c.createBufferSource();
  src.buffer = ruido;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = 0.75;
  src.connect(f).connect(g).connect(entrada);
  src.start(t);
  // um resto de nota das cordas graves, bem curto (é o que dá o "corpo" da abafada)
  if (acorde) {
    const tom = c.createGain();
    tom.gain.setValueAtTime(0.5, t);
    tom.gain.setTargetAtTime(0, t + 0.01, 0.012);
    tom.connect(entrada);
    notasDo(acorde).slice(0, 4).forEach((m, i) => {
      if (m === null) return;
      tocarNota(bufferJa(m) || sintetica(m), t + i * 0.004, 0.6, tom);
    });
  }
}

export function silenciar() {
  if (!ctx) return;
  calarAnterior(ctx.currentTime, 0.05);
}

export function click(quando, forte = false, volume = 0.5) {
  const c = contexto();
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = forte ? 1760 : 1180;
  g.gain.setValueAtTime(0, quando);
  g.gain.linearRampToValueAtTime(volume * (forte ? 1 : 0.7), quando + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.05);
  o.connect(g).connect(c.destination);
  o.start(quando);
  o.stop(quando + 0.06);
}

// ---------- reserva: violão sintetizado (Karplus-Strong), usado só se a amostra não carregar ----------
function sintetica(midi) {
  if (sinteticas.has(midi)) return sinteticas.get(midi);
  const c = contexto();
  const sr = c.sampleRate;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const n = Math.floor(sr * 3);
  const buf = c.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);
  const p = Math.max(2, Math.round(sr / freq - 0.5));
  const linha = new Float32Array(p);
  for (let i = 0; i < p; i++) linha[i] = Math.random() * 2 - 1;
  for (let k = 0; k < 2; k++) for (let i = 1; i < p; i++) linha[i] = (linha[i] + linha[i - 1]) * 0.5;
  const fator = Math.pow(0.5, 1 / (freq * 1.1));
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = linha[idx], b = linha[(idx + 1) % p];
    out[i] = a * 0.3;
    linha[idx] = (a + b) * 0.5 * fator;
    idx = (idx + 1) % p;
  }
  sinteticas.set(midi, buf);
  return buf;
}
