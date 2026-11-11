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
