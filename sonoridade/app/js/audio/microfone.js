// Microfone: liga, lê o som e acha a frequência da nota que está soando (YIN).
// Só funciona em endereço seguro (https ou localhost): é regra dos navegadores.
import { contexto } from './som.js';

export const microfonePossivel = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);

export async function ligarMicrofone() {
  const c = contexto();
  if (c.state !== 'running') await c.resume();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const fonte = c.createMediaStreamSource(stream);
  const analisador = c.createAnalyser();
  analisador.fftSize = 4096;
  fonte.connect(analisador);
  const buf = new Float32Array(analisador.fftSize);
  return {
    // frequência agora (Hz) e volume (0 a 1), ou { f: null } se não há nota clara
    ler() {
      analisador.getFloatTimeDomainData(buf);
      let rms = 0;
      for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / buf.length);
      return { f: rms < 0.006 ? null : detectarFrequencia(buf, c.sampleRate), volume: Math.min(1, rms * 12) };
    },
    desligar() {
      stream.getTracks().forEach((t) => t.stop());
      try { fonte.disconnect(); } catch { /* já desligado */ }
    },
  };
}

// YIN: acha o período fundamental. 30 Hz a 1100 Hz cobre baixo (até Drop D), violão e guitarra.
export function detectarFrequencia(buf, sr) {
  const W = 2048;
  const tauMin = Math.floor(sr / 1100);
  const tauMax = Math.min(Math.floor(sr / 30), buf.length - W - 1);
  const d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i += 2) { const x = buf[i] - buf[i + tau]; s += x * x; }
    d[tau] = s;
  }
  let soma = 0;
  d[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) { soma += d[tau]; d[tau] = soma ? (d[tau] * tau) / soma : 1; }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < 0.12) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 1) return null;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1] ?? b;
  const den = a + c - 2 * b;
  const ajuste = den ? (a - c) / (2 * den) : 0;
  return sr / (tau + ajuste);
}

export const midiDe = (f) => 69 + 12 * Math.log2(f / 440);
const NOMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
const LETRAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const nomeMidi = (m) => NOMES[((m % 12) + 12) % 12];
export const letraMidi = (m) => `${LETRAS[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

// Ouvir golpes (exercício de ritmo): microfone → AudioWorklet que acha cada batida.
// aoGolpe({ t, forca, sentido }) com t no relógio do AudioContext; aoNivel(0..1) para o medidor.
// fonte (opcional): outro nó de áudio no lugar do microfone (usado para testar).
let workletPronto = null;
export async function ouvirGolpes({ aoGolpe, aoNivel, fonte = null }) {
  const c = contexto();
  if (c.state !== 'running') await c.resume();
  if (!workletPronto) workletPronto = c.audioWorklet.addModule(new URL('./golpes-worklet.js', import.meta.url));
  await workletPronto;
  let stream = null;
  let origem = fonte;
  if (!origem) {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    origem = c.createMediaStreamSource(stream);
  }
  const no = new AudioWorkletNode(c, 'ouvido-golpes', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
  no.port.onmessage = (e) => {
    if (e.data.tipo === 'golpe') aoGolpe?.(e.data);
    else if (e.data.tipo === 'nivel') aoNivel?.(Math.min(1, e.data.nivel * 8));
  };
  origem.connect(no);
  // o worklet só roda ligado a uma saída: vai para um ganho zerado
  const mudo = c.createGain(); mudo.gain.value = 0;
  no.connect(mudo).connect(c.destination);
  return {
    sensibilidade(v) { no.port.postMessage({ sensib: v }); },
    // menor distância entre dois golpes (s): uns 45% do passo da batida
    intervalo(s) { no.port.postMessage({ intervalo: s }); },
    // atraso do microfone até o worklet (estimado), para comparar com o que o aluno ouviu
    atrasoEntrada: stream ? 0.012 : 0,
    desligar() {
      stream?.getTracks().forEach((t) => t.stop());
      try { origem.disconnect(no); } catch { /* já desligado */ }
      try { no.disconnect(); mudo.disconnect(); } catch { /* já desligado */ }
      no.port.onmessage = null;
    },
  };
}
