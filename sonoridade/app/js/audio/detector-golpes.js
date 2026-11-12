// Acha cada batida (golpe da mão nas cordas) no som que chega, e dá um palpite do sentido da mão.
// Classe pura (sem Web Audio): roda dentro do AudioWorklet (golpes-worklet.js) e também em teste.
//
// Golpe: a energia do "ataque" (diferença entre amostras vizinhas, que realça o estalo da palheta)
// sobe de repente bem acima do que soava 13 a 32 ms antes — funciona mesmo com o acorde anterior soando.
// Sentido: descendo, a mão pega primeiro as cordas graves; subindo, primeiro as agudas. Nos primeiros
// milissegundos do golpe a proporção grave/agudo é diferente — vira um número (`sentido`):
// maior = mais "para baixo". O número sozinho não decide; a tela compara com os outros golpes do aluno.

export class DetectorGolpes {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.sensib = 1;                  // 0.7 (menos sensível) a 1.45 (mais)
    this.anterior = 0;
    this.hist = new Float32Array(16); // energia de ataque dos últimos blocos (~43 ms)
    this.hi = 0;
    this.piso = 1e-6;                 // ruído de fundo
    this.ultimoGolpe = -1;
    this.intervaloMin = 0.075;        // dois golpes nunca ficam mais perto que isso; a tela ajusta pelo BPM
    // filtros de uma pole para separar grave e agudo
    this.aGrave = 1 - Math.exp(-2 * Math.PI * 220 / sampleRate);
    this.aAgudo = 1 - Math.exp(-2 * Math.PI * 1800 / sampleRate);
    this.zGrave = 0; this.zAgudo = 0;
    this.medindo = null;              // golpe aberto, juntando grave/agudo para o palpite do sentido
    this.nivel = 0;
  }

  // bloco: Float32Array (128 amostras no AudioWorklet); t0 = tempo (s) da primeira amostra. Devolve golpes prontos.
  processar(bloco, t0) {
    let eAtaque = 0, eGrave = 0, eAgudo = 0, eTotal = 0;
    let ant = this.anterior, zg = this.zGrave, za = this.zAgudo;
    for (let i = 0; i < bloco.length; i++) {
      const x = bloco[i];
      const d = x - ant; ant = x;
      eAtaque += d * d;
      eTotal += x * x;
      zg += this.aGrave * (x - zg);
      za += this.aAgudo * (x - za);
      const ag = x - za;              // o que sobra acima de ~1,8 kHz
      eGrave += zg * zg;
      eAgudo += ag * ag;
    }
    this.anterior = ant; this.zGrave = zg; this.zAgudo = za;
    const n = bloco.length;
    eAtaque /= n; eGrave /= n; eAgudo /= n; eTotal /= n;
    this.nivel = Math.max(this.nivel * 0.9, Math.sqrt(eTotal));

    const prontos = [];
    // fecha a medida do sentido do golpe aberto
    if (this.medindo) {
      const m = this.medindo;
      if (m.q < 6) { m.gA += eGrave; m.aA += eAgudo; } else { m.gB += eGrave; m.aB += eAgudo; }
      m.q++;
      if (m.q >= 18) {                // ~48 ms depois do golpe
        const eps = 1e-12;
        const inicio = Math.log((m.gA + eps) / (m.aA + eps));
        const depois = Math.log((m.gB + eps) / (m.aB + eps));
        prontos.push({ t: m.t, forca: m.forca, sentido: inicio + (inicio - depois) });
        this.medindo = null;
      }
    }

    // ruído de fundo: segue rápido para baixo, bem devagar para cima (tocando sem parar ele não sobe até o som do violão)
    this.piso = eAtaque < this.piso ? this.piso * 0.7 + eAtaque * 0.3 : this.piso * 0.9997 + eAtaque * 0.0003;
    // agora (média dos últimos 3 blocos, ~8 ms) contra o que soava antes (13 a 32 ms atrás)
    const h = this.hist, L = h.length;
    h[this.hi] = eAtaque;
    let agora = 0, antes = 0;
    for (let i = 0; i <= 2; i++) agora += h[(this.hi - i + L) % L];
    for (let i = 5; i <= 12; i++) antes += h[(this.hi - i + L) % L];
    this.hi = (this.hi + 1) % L;
    agora /= 3; antes /= 8;
    const subida = agora / (antes + this.piso * 2 + 1e-9);
    if (subida > 1.6 / this.sensib && agora > this.piso * (4 / this.sensib) && agora > 2e-7 / this.sensib
      && (this.ultimoGolpe < 0 || t0 - this.ultimoGolpe >= this.intervaloMin) && !this.medindo) {
      this.ultimoGolpe = t0;
      this.medindo = { t: t0 - 2 * bloco.length / this.sr, forca: Math.sqrt(agora), q: 1, gA: eGrave, aA: eAgudo, gB: 0, aB: 0 };
    }
    return prontos;
  }
}
