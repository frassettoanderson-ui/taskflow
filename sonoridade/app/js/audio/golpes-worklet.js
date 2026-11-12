// AudioWorklet: ouve o microfone e avisa a tela de cada golpe (tempo no relógio do áudio + palpite do sentido).
import { DetectorGolpes } from './detector-golpes.js';

class OuvidoGolpes extends AudioWorkletProcessor {
  constructor() {
    super();
    this.det = new DetectorGolpes(sampleRate);
    this.contaNivel = 0;
    this.port.onmessage = (e) => {
      if (e.data?.sensib) this.det.sensib = e.data.sensib;
      if (e.data?.intervalo) this.det.intervaloMin = e.data.intervalo;
    };
  }

  process(entradas) {
    const canal = entradas[0]?.[0];
    if (!canal) return true;
    const t0 = currentFrame / sampleRate;
    for (const g of this.det.processar(canal, t0)) this.port.postMessage({ tipo: 'golpe', ...g });
    if (++this.contaNivel >= 16) {          // nível do microfone ~20 vezes por segundo
      this.contaNivel = 0;
      this.port.postMessage({ tipo: 'nivel', nivel: this.det.nivel });
    }
    return true;
  }
}

registerProcessor('ouvido-golpes', OuvidoGolpes);
