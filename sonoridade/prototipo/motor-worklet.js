// Sonoridade — motor de áudio (Fase 0)
// Roda dentro de um AudioWorklet (thread de áudio). Faz três coisas:
//   1. mistura as faixas do VS com o ganho de cada uma (todas na mesma amostra = sincronia perfeita);
//   2. muda a velocidade sem mudar o tom (WSOLA sobre a mistura);
//   3. muda o tom (reamostragem depois do WSOLA).
// Loop e mudanças de ganho passam pela sobreposição das janelas, então não estalam.

const N = 2048;          // tamanho da janela (~46 ms a 44,1 kHz)
const HS = N / 2;        // salto de síntese (50% de sobreposição: Hann soma 1)
const TOL = 512;         // quanto o WSOLA pode deslocar a janela para achar o melhor encaixe
const M = 1024;          // trecho usado para comparar formas de onda
const CAP = 32768;       // tamanho do buffer circular de saída

const JANELA = new Float32Array(N);
for (let n = 0; n < N; n++) JANELA[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N);

class MotorSonoridade extends AudioWorkletProcessor {
  constructor() {
    super();
    this.faixas = [];               // [{ L: Int16Array, R: Int16Array|null }]
    this.ganhos = new Float32Array(0);
    this.comp = 0;                  // duração em frames
    this.tocando = false;

    this.vel = 1;                   // velocidade (0,5 a 1,2)
    this.razao = 1;                 // razão de tom (2^(semitons/12))
    this.loop = { ativo: false, a: 0, b: 0 };

    this.pos = 0;                   // posição de análise (frames, fracionária)
    this.ultimo = -HS;              // início do último segmento usado
    this.salto = true;              // próximo quadro começa exatamente em this.pos

    this.acL = new Float32Array(N); this.acR = new Float32Array(N);
    this.segL = new Float32Array(N); this.segR = new Float32Array(N);
    this.monoNat = new Float32Array(M);
    this.monoCand = new Float32Array(2 * TOL + M);

    this.fL = new Float32Array(CAP); this.fR = new Float32Array(CAP);
    this.fEsc = 0;                  // amostras escritas (contador contínuo)
    this.fLei = 0;                  // posição de leitura (fracionária)

    this.blocos = 0;
    this.port.onmessage = (e) => this.mensagem(e.data);
  }

  mensagem(m) {
    switch (m.tipo) {
      case 'carregar':
        this.faixas = m.faixas.map((f) => ({
          L: new Int16Array(f.L),
          R: f.R ? new Int16Array(f.R) : null,
        }));
        this.comp = m.comp;
        this.ganhos = new Float32Array(this.faixas.length).fill(1);
        this.irPara(0);
        break;
      case 'ganhos': this.ganhos = Float32Array.from(m.valores); break;
      case 'tocar': if (this.comp) this.tocando = true; break;
      case 'pausar': this.tocando = false; break;
      case 'buscar': this.irPara(Math.round(m.segundos * sampleRate)); break;
      case 'velocidade': this.vel = m.valor; break;
      case 'tom': this.razao = Math.pow(2, m.semitons / 12); break;
      case 'loop': {
        this.loop = {
          ativo: m.ativo,
          a: Math.round(m.a * sampleRate),
          b: Math.round(m.b * sampleRate),
        };
        if (this.loop.ativo && this.loop.b > this.loop.a && this.pos >= this.loop.b) this.irPara(this.loop.a);
        break;
      }
    }
  }

  irPara(frame) {
    this.pos = Math.max(0, Math.min(frame, this.comp - 1));
    this.salto = true;
    this.fLei = this.fEsc;          // descarta o que estava na fila: resposta imediata
    this.posta();
  }

  // Mistura estéreo das faixas no trecho [inicio, inicio+n)
  mixar(inicio, n, L, R) {
    L.fill(0, 0, n); R.fill(0, 0, n);
    const k0 = Math.max(0, -inicio);
    const k1 = Math.min(n, this.comp - inicio);
    if (k1 <= k0) return;
    const esc = 1 / 32768;
    for (let t = 0; t < this.faixas.length; t++) {
      const g = this.ganhos[t] * esc;
      if (g <= 1e-9) continue;
      const fL = this.faixas[t].L;
      const fR = this.faixas[t].R || fL;
      const lim = Math.min(k1, fL.length - inicio);
      for (let k = k0; k < lim; k++) {
        const i = inicio + k;
        L[k] += fL[i] * g;
        R[k] += fR[i] * g;
      }
    }
  }

  // Mistura mono (L+R) — só para comparar formas de onda no WSOLA
  mixarMono(inicio, n, out) {
    out.fill(0, 0, n);
    const k0 = Math.max(0, -inicio);
    const k1 = Math.min(n, this.comp - inicio);
    if (k1 <= k0) return;
    for (let t = 0; t < this.faixas.length; t++) {
      const g = this.ganhos[t];
      if (g <= 1e-9) continue;
      const fL = this.faixas[t].L;
      const fR = this.faixas[t].R || fL;
      const lim = Math.min(k1, fL.length - inicio);
      for (let k = k0; k < lim; k++) {
        const i = inicio + k;
        out[k] += (fL[i] + fR[i]) * g;
      }
    }
  }

  // Correlação normalizada entre o "encaixe natural" e o candidato deslocado em d
  correlacao(d, passo) {
    let c = 0, e = 1e-9;
    const nat = this.monoNat, cand = this.monoCand;
    for (let k = 0; k < M; k += passo) {
      const v = cand[d + k];
      c += nat[k] * v;
      e += v * v;
    }
    return c / Math.sqrt(e);
  }

  gerarQuadro() {
    const s = this.vel / this.razao;  // quanto de entrada se consome por amostra de saída do WSOLA
    const alvo = Math.round(this.pos);
    let escolhido;

    if (this.salto) {
      escolhido = alvo;
      this.salto = false;
    } else if (Math.abs(s - 1) < 1e-6) {
      escolhido = this.ultimo + HS;   // continuidade perfeita: saída = entrada
    } else {
      const nat = this.ultimo + HS;
      this.mixarMono(nat, M, this.monoNat);
      this.mixarMono(alvo - TOL, 2 * TOL + M, this.monoCand);
      // busca grossa (passo 4), depois refino (passo 1) em volta do melhor
      let melhor = TOL, mv = this.correlacao(TOL, 4);
      for (let d = 0; d <= 2 * TOL; d += 4) {
        const c = this.correlacao(d, 4);
        if (c > mv) { mv = c; melhor = d; }
      }
      let fino = melhor, mf = this.correlacao(melhor, 2);
      for (let d = Math.max(0, melhor - 3); d <= Math.min(2 * TOL, melhor + 3); d++) {
        const c = this.correlacao(d, 2);
        if (c > mf) { mf = c; fino = d; }
      }
      escolhido = alvo - TOL + fino;
    }

    this.mixar(escolhido, N, this.segL, this.segR);
    const acL = this.acL, acR = this.acR;
    for (let n = 0; n < N; n++) {
      acL[n] += this.segL[n] * JANELA[n];
      acR[n] += this.segR[n] * JANELA[n];
    }
    for (let n = 0; n < HS; n++) {
      const i = (this.fEsc + n) % CAP;
      this.fL[i] = acL[n];
      this.fR[i] = acR[n];
    }
    this.fEsc += HS;
    acL.copyWithin(0, HS); acL.fill(0, N - HS);
    acR.copyWithin(0, HS); acR.fill(0, N - HS);

    this.ultimo = escolhido;
    this.pos += HS * s;

    const lp = this.loop;
    if (lp.ativo && lp.b > lp.a && this.pos >= lp.b) {
      this.pos = lp.a + (this.pos - lp.b);
      this.salto = true;
    }
    if (this.pos >= this.comp) {
      this.tocando = false;
      this.pos = 0;
      this.salto = true;
      this.port.postMessage({ tipo: 'fim' });
    }
  }

  posta() {
    this.port.postMessage({ tipo: 'pos', segundos: Math.max(0, this.ultimo) / sampleRate });
  }

  process(_entradas, saidas) {
    const out = saidas[0];
    const L = out[0];
    const R = out[1] || out[0];
    const n = L.length;

    if (!this.tocando || !this.comp) {
      L.fill(0); if (R !== L) R.fill(0);
      return true;
    }

    const r = this.razao;
    while (this.fEsc - Math.floor(this.fLei) < n * r + 4) {
      this.gerarQuadro();
      if (!this.tocando) break;
    }

    for (let i = 0; i < n; i++) {
      if (this.fEsc - Math.floor(this.fLei) < 2) { L[i] = 0; R[i] = 0; continue; }
      const i0 = Math.floor(this.fLei);
      const fr = this.fLei - i0;
      const a = i0 % CAP, b = (i0 + 1) % CAP;
      L[i] = this.fL[a] + (this.fL[b] - this.fL[a]) * fr;
      R[i] = this.fR[a] + (this.fR[b] - this.fR[a]) * fr;
      this.fLei += r;
    }

    if (++this.blocos % 16 === 0) this.posta();
    return true;
  }
}

registerProcessor('motor-sonoridade', MotorSonoridade);
