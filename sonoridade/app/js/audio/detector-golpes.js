// Acha cada batida (golpe da mão nas cordas) no som que chega, e dá um palpite do sentido da mão.
// Classe pura (sem Web Audio): roda dentro do AudioWorklet (golpes-worklet.js) e também em teste.
//
// Golpe: a energia do "ataque" (diferença entre amostras vizinhas, que realça o estalo da palheta)
// sobe de repente bem acima do que soava 13 a 32 ms antes — funciona mesmo com o acorde anterior soando.
// Sentido: descendo, a mão pega primeiro as cordas graves; subindo, primeiro as agudas. Mede QUANDO o som
// novo aparece em cada faixa (grave: até ~160 Hz, as cordas de baixo; agudo: ~250–650 Hz, as de cima),
// descontando o que já soava antes do golpe. `sentido` = atraso do agudo em relação ao grave (ms):
// positivo = grave veio antes = "para baixo". A tela compara com os outros golpes do próprio aluno.

const L = 16;                         // blocos guardados (~43 ms em 48 kHz)

export class DetectorGolpes {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.sensib = 1;                  // 0.7 (menos sensível) a 1.45 (mais)
    this.intervaloMin = 0.075;        // dois golpes nunca ficam mais perto que isso; a tela ajusta pelo BPM
    this.anterior = 0;
    this.piso = 1e-6;                 // ruído de fundo
    this.ultimoGolpe = -1;
    // históricos circulares: energia de ataque, faixa grave e faixa aguda
    this.hAt = new Float32Array(L); this.hG = new Float32Array(L); this.hA = new Float32Array(L);
    this.hi = 0;                      // próxima posição a escrever
    // filtros de uma pole
    const a = (f) => 1 - Math.exp(-2 * Math.PI * f / sampleRate);
    this.aGrave = a(160); this.aMeio = a(250); this.aAgudo = a(650);
    this.zg = 0; this.zg2 = 0; this.zm = 0; this.za = 0;
    this.medindo = null;              // golpe aberto, medindo o sentido
    this.nivel = 0;
  }

  // valor guardado i blocos atrás (0 = o bloco atual, depois de escrito)
  atras(h, i) { return h[(this.hi - 1 - i + L * 2) % L]; }

  // bloco: Float32Array (128 amostras no AudioWorklet); t0 = tempo (s) da primeira amostra. Devolve golpes prontos.
  processar(bloco, t0) {
    let eAtaque = 0, eGrave = 0, eAgudo = 0, eTotal = 0;
    let ant = this.anterior, zg = this.zg, zg2 = this.zg2, zm = this.zm, za = this.za;
    for (let i = 0; i < bloco.length; i++) {
      const x = bloco[i];
      const d = x - ant; ant = x;
      eAtaque += d * d;
      eTotal += x * x;
      zg += this.aGrave * (x - zg); zg2 += this.aGrave * (zg - zg2);   // passa-baixa de 2 polos
      zm += this.aMeio * (x - zm);
      za += this.aAgudo * (x - za);
      const ag = za - zm;             // faixa ~250–650 Hz
      eGrave += zg2 * zg2;
      eAgudo += ag * ag;
    }
    this.anterior = ant; this.zg = zg; this.zg2 = zg2; this.zm = zm; this.za = za;
    const n = bloco.length;
    eAtaque /= n; eGrave /= n; eAgudo /= n; eTotal /= n;
    this.nivel = Math.max(this.nivel * 0.9, Math.sqrt(eTotal));

    // guarda o bloco atual nos históricos
    this.hAt[this.hi] = eAtaque; this.hG[this.hi] = eGrave; this.hA[this.hi] = eAgudo;
    this.hi = (this.hi + 1) % L;

    const prontos = [];
    // golpe aberto: soma quando o som NOVO (acima do que já soava) aparece em cada faixa
    if (this.medindo) {
      this.somar(eGrave, eAgudo);
      if (this.medindo.q >= 24) {      // ~64 ms depois do golpe
        const m = this.medindo;
        const ms = (n / this.sr) * 1000;
        const sentido = m.sg > 0 && m.sa > 0 ? (m.sat / m.sa - m.sgt / m.sg) * ms : null;
        prontos.push({ t: m.t, forca: m.forca, sentido });
        this.medindo = null;
      }
    }

    // ruído de fundo: segue rápido para baixo, bem devagar para cima (tocando sem parar ele não sobe até o som do violão)
    this.piso = eAtaque < this.piso ? this.piso * 0.7 + eAtaque * 0.3 : this.piso * 0.9997 + eAtaque * 0.0003;
    // agora (média dos últimos 3 blocos, ~8 ms) contra o que soava antes (13 a 32 ms atrás)
    let agora = 0, antes = 0;
    for (let i = 0; i <= 2; i++) agora += this.atras(this.hAt, i);
    for (let i = 5; i <= 12; i++) antes += this.atras(this.hAt, i);
    agora /= 3; antes /= 8;
    const subida = agora / (antes + this.piso * 2 + 1e-9);
    if (subida > 1.6 / this.sensib && agora > this.piso * (4 / this.sensib) && agora > 2e-7 / this.sensib
      && (this.ultimoGolpe < 0 || t0 - this.ultimoGolpe >= this.intervaloMin) && !this.medindo) {
      this.ultimoGolpe = t0;
      let preG = 0, preA = 0;
      for (let i = 5; i <= 12; i++) { preG += this.atras(this.hG, i); preA += this.atras(this.hA, i); }
      this.medindo = { t: t0 - 2 * n / this.sr, forca: Math.sqrt(agora), q: 0, preG: preG / 8, preA: preA / 8, sg: 0, sgt: 0, sa: 0, sat: 0 };
      // o golpe já vinha subindo: entram os 2 blocos anteriores e o atual
      for (let i = 2; i >= 0; i--) this.somar(this.atras(this.hG, i), this.atras(this.hA, i));
    }
    return prontos;
  }

  somar(eGrave, eAgudo) {
    const m = this.medindo;
    const dg = Math.max(0, eGrave - m.preG), da = Math.max(0, eAgudo - m.preA);
    m.sg += dg; m.sgt += dg * m.q; m.sa += da; m.sat += da * m.q;
    m.q++;
  }
}
