// Desenha o braço do violão com a posição de cada dedo do acorde.
//  - deitado (horizontal): como se olhasse o violão na mão de quem está à sua frente:
//    6ª corda (a mais grossa) em cima e a 1ª casa à direita. Telas largas e painel compacto
//  - em pé (vertical): como diagrama de cifra, 6ª corda à esquerda e a pestana do violão em cima — celular

import { NOMES_CORDAS } from '../dados/acordes.js';

let seq = 0;

export function braco(a, { compacto = false, orientacao = 'auto' } = {}) {
  const vertical = orientacao === 'vertical' || (orientacao === 'auto' && !compacto && window.innerWidth < 600);
  return vertical ? desenhar(a, layoutVertical(), false) : desenhar(a, layoutHorizontal(compacto), compacto);
}

function layoutHorizontal(compacto) {
  // compacto: proporção mais "gorda" para os dedos não ficarem minúsculos no celular
  const W = compacto ? 600 : 1000, H = compacto ? 260 : 320;
  const ini = compacto ? 58 : 126, fim = W - (compacto ? 14 : 18);
  const c0 = compacto ? 30 : 42, gap = (H - c0 - (compacto ? 40 : 58)) / 5;
  return {
    W, H, vertical: false, ini, fim, gap,
    cruz: (n) => c0 + (6 - n) * gap,                 // corda 6 em cima
    pt: (ao, cr) => [W - ao, cr],                    // espelhado: 1ª casa à direita
    rotuloCasa: (meio) => [W - meio, H - (compacto ? 8 : 16)],
    rotuloCorda: (n) => (compacto ? null : [W - 10, c0 + (6 - n) * gap + 6, 'end']),
    marcaXO: (n, nut) => [W - (ini - (nut ? (compacto ? 30 : 34) : (compacto ? 22 : 26))), c0 + (6 - n) * gap],
    dedo: compacto ? 17 : 24,
    fonte: compacto ? { corda: 18, casa: 18, num: 19 } : { corda: 22, casa: 20, num: 24 },
  };
}

function layoutVertical() {
  const W = 560, H = 700;
  const esq = 112, dir = 58;
  const gap = (W - esq - dir) / 5;
  const ini = 96, fim = H - 64;
  return {
    W, H, vertical: true, ini, fim, gap,
    cruz: (n) => esq + (6 - n) * gap,               // corda 6 à esquerda
    pt: (ao, cr) => [cr, ao],
    rotuloCasa: (meio) => [36, meio + 9],
    rotuloCorda: (n) => [esq + (6 - n) * gap, H - 22, 'middle'],
    marcaXO: (n, nut) => [esq + (6 - n) * gap, ini - (nut ? 40 : 30)],
    dedo: 32,
    fonte: { corda: 26, casa: 24, num: 30 },
  };
}

function desenhar(a, L, compacto) {
  const id = `b${++seq}`;
  const casasVisiveis = 5;
  const apertadas = a.casas.filter((c) => c > 0);
  const maior = apertadas.length ? Math.max(...apertadas) : 0;
  const inicio = maior <= 5 ? 1 : Math.min(...apertadas, a.pestana?.casa ?? 99);
  const nut = inicio === 1;
  const larg = (L.fim - L.ini) / casasVisiveis;
  const meioCasa = (casa) => L.ini + (casa - inicio + 0.5) * larg;
  const idx = (n) => 6 - n;
  const espessura = [1.6, 2.1, 2.8, 3.6, 4.4, 5.2];
  const ao0 = L.ini - (nut ? 10 : 0);
  const crMin = Math.min(L.cruz(1), L.cruz(6));
  const crMax = Math.max(L.cruz(1), L.cruz(6));
  const margem = L.gap * 0.55;

  // retângulo alinhado aos eixos (ao = ao longo das cordas, cr = através)
  const ret = (ao1, ao2, cr1, cr2, extra) => {
    const [xa, ya] = L.pt(ao1, cr1);
    const [xb, yb] = L.pt(ao2, cr2);
    return `<rect x="${Math.min(xa, xb)}" y="${Math.min(ya, yb)}" width="${Math.abs(xb - xa)}" height="${Math.abs(yb - ya)}" ${extra}/>`;
  };
  const linha = (ao1, cr1, ao2, cr2, extra) => {
    const [x1, y1] = L.pt(ao1, cr1);
    const [x2, y2] = L.pt(ao2, cr2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
  };
  const circ = (ao, cr, r, extra) => {
    const [x, y] = L.pt(ao, cr);
    return `<circle cx="${x}" cy="${y}" r="${r}" ${extra}/>`;
  };

  const s = [];
  s.push(`<svg class="braco${compacto ? ' compacto' : ''}${L.vertical ? ' vertical' : ''}" viewBox="0 0 ${L.W} ${L.H}" role="img" aria-label="Braço do violão com o acorde ${a.simbolo}">`);

  // madeira: foto real do braço (jacarandá + trastes), recortada para 5 casas iguais.
  // Os trastes da foto caem exatamente em ini + i * larg; as cordas são desenhadas por cima.
  s.push(ret(ao0, L.fim, crMin - margem, crMax + margem, 'rx="4" fill="#24150e"'));
  {
    const [xa, ya] = L.pt(L.ini, crMin - margem);
    const [xb, yb] = L.pt(L.fim, crMax + margem);
    s.push(`<image href="img/braco-${L.vertical ? 'v' : 'h'}.webp" x="${Math.min(xa, xb)}" y="${Math.min(ya, yb)}" width="${Math.abs(xb - xa)}" height="${Math.abs(yb - ya)}" preserveAspectRatio="none"/>`);
  }

  // marcações de madrepérola
  const entre = (n1, n2) => (L.cruz(n1) + L.cruz(n2)) / 2;
  const perola = 'fill="#ece4d3" opacity=".85"';
  for (let casa = inicio; casa < inicio + casasVisiveis; casa++) {
    const m = meioCasa(casa);
    if ([3, 5, 7, 9, 15].includes(casa)) s.push(circ(m, entre(3, 4), compacto ? 8 : 10, perola));
    else if (casa === 12) {
      s.push(circ(m, entre(2, 3), 9, perola));
      s.push(circ(m, entre(4, 5), 9, perola));
    }
  }

  // pestana do violão (nut), em osso
  if (nut) s.push(ret(L.ini - 12, L.ini + 3, crMin - margem, crMax + margem, 'rx="2" fill="#e9e0c9"'));

  // número das casas
  for (let casa = inicio; casa < inicio + casasVisiveis; casa++) {
    const [x, y] = L.rotuloCasa(meioCasa(casa));
    s.push(`<text x="${x}" y="${y}" class="b-casa" font-size="${L.fonte.casa}" text-anchor="middle">${casa}ª</text>`);
  }

  // cordas, nome das cordas, X e O
  // Cada corda é um <g class="corda"> separado para poder vibrar (ver vibrar()).
  const corda = (n, calada) => {
    const e = espessura[n - 1] * (L.vertical ? 1.25 : 1.05);
    const c = L.cruz(n);
    const casa = a.casas[idx(n)];
    // parte que vibra: do traste apertado (ou da pestana do violão) até o fim do desenho
    const aoPreso = casa > 0 ? L.ini + (casa - inicio + 1) * larg : L.ini;
    const [x0, y0] = L.pt(ao0, c);
    const [x1, y1] = L.pt(Math.max(aoPreso, L.ini), c);
    const [x2, y2] = L.pt(L.fim, c);
    const nrm = L.vertical ? [1, 0] : [0, 1];
    const pontos = `data-p="${x0},${y0},${x1},${y1},${x2},${y2}" data-n="${nrm}"`;
    const reta = `d="M${x0} ${y0}L${x1} ${y1}L${x2} ${y2}"`;
    const enrolada = n >= 4;
    const desl = (k) => `transform="translate(${nrm[0] * k} ${nrm[1] * k})"`;
    const partes = [
      `<path class="c-linha" ${reta} ${desl(e * 0.9)} fill="none" stroke="#000" stroke-opacity=".45" stroke-width="${e}"/>`,
      `<path class="c-fuso" d="" fill="${enrolada ? '#d9b77c' : '#f0f0ec'}" fill-opacity="0"/>`,
      `<path class="c-linha" ${reta} fill="none" stroke="${enrolada ? '#b8955c' : '#d9d9d6'}" stroke-width="${e}"/>`,
      enrolada
        ? `<path class="c-linha" ${reta} fill="none" stroke="#6e5530" stroke-width="${e}" stroke-dasharray="1 ${(e * 0.45).toFixed(2)}"/>`
        : `<path class="c-linha" ${reta} ${desl(-e * 0.22)} fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="${(e * 0.35).toFixed(2)}"/>`,
    ];
    return `<g class="corda" data-corda="${n}" data-e="${e}" ${pontos} opacity="${calada ? 0.35 : 1}">${partes.join('')}</g>`;
  };

  for (let n = 1; n <= 6; n++) {
    const casa = a.casas[idx(n)];
    const calada = casa < 0;
    s.push(corda(n, calada));
    const r = L.rotuloCorda(n);
    if (r) {
      s.push(L.vertical
        ? `<text x="${r[0]}" y="${r[1]}" class="b-nome" font-size="${L.fonte.corda}" text-anchor="middle"><tspan class="b-nota">${NOMES_CORDAS[idx(n)]}</tspan></text>`
        : `<text x="${r[0]}" y="${r[1]}" class="b-nome" font-size="${L.fonte.corda}" text-anchor="${r[2]}">${n}ª <tspan class="b-nota">${NOMES_CORDAS[idx(n)]}</tspan></text>`);
    }
    const [xm, ym] = L.marcaXO(n, nut);
    if (calada) s.push(`<g class="b-x" transform="translate(${xm} ${ym})"><path d="M-10 -10 L10 10 M10 -10 L-10 10"/></g>`);
    else if (casa === 0) s.push(`<circle class="b-o" cx="${xm}" cy="${ym}" r="11"/>`);
  }

  // pestana do acorde
  let atraso = 0;
  const p = a.pestana;
  if (p) {
    const m = meioCasa(p.casa);
    const c1 = Math.min(L.cruz(p.ate), L.cruz(p.de)) - L.dedo + 2;
    const c2 = Math.max(L.cruz(p.ate), L.cruz(p.de)) + L.dedo - 2;
    const [tx, ty] = L.pt(m, (c1 + c2) / 2);
    s.push(`<g class="b-dedo" style="animation-delay:${atraso}ms">
      ${ret(m - L.dedo + 4, m + L.dedo - 4, c1, c2, `rx="${L.dedo - 4}" fill="#e3ad45"`)}
      <text x="${tx}" y="${ty + L.fonte.num * 0.34}" class="b-num" font-size="${L.fonte.num}" text-anchor="middle">1</text>
    </g>`);
    atraso += 70;
  }

  // dedos
  for (let n = 6; n >= 1; n--) {
    const casa = a.casas[idx(n)];
    const dedo = a.dedos[idx(n)];
    if (casa <= 0) continue;
    if (p && casa === p.casa && dedo === 1 && n <= p.de && n >= p.ate) continue;
    const [x, y] = L.pt(meioCasa(casa), L.cruz(n));
    s.push(`<g class="b-dedo" style="animation-delay:${atraso}ms">
      <circle cx="${x}" cy="${y}" r="${L.dedo}" fill="#e3ad45"/>
      <text x="${x}" y="${y + L.fonte.num * 0.34}" class="b-num" font-size="${L.fonte.num}" text-anchor="middle">${dedo || ''}</text>
    </g>`);
    atraso += 70;
  }

  s.push('</svg>');
  return s.join('');
}

// Faz as cordas que soam vibrarem, na ordem da palhetada.
// A corda vira um arco preso no traste e na ponta, que vai e volta cada vez menos;
// em volta dela, um "fuso" claro mostra o espaço que a corda varre, como o olho vê uma corda vibrando.
//  direcao 'baixo': 6ª → 1ª; 'cima': 1ª → 4ª; passo = intervalo entre cordas (ms)
const vibrando = new Map();   // elemento <g> → instante de início (ms)
let quadro = 0;

function animar(agora) {
  quadro = 0;
  for (const [g, t0] of vibrando) {
    const t = (agora - t0) / 1000;
    if (t < 0) { quadro = quadro || requestAnimationFrame(animar); continue; }
    const e = Number(g.dataset.e);
    const amp = (10 + e * 3) * Math.exp(-t / 0.9);       // abertura do "fuso"
    const fim = amp < 0.4 || !g.isConnected;
    const d = fim ? 0 : amp * Math.sin(2 * Math.PI * 7 * t);
    desenharCorda(g, d, fim ? 0 : amp);
    if (fim) vibrando.delete(g);
  }
  if (vibrando.size && !quadro) quadro = requestAnimationFrame(animar);
}

function desenharCorda(g, d, envelope) {
  const [x0, y0, x1, y1, x2, y2] = g.dataset.p.split(',').map(Number);
  const [nx, ny] = g.dataset.n.split(',').map(Number);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const ctrl = (k) => `${mx + nx * 2 * k} ${my + ny * 2 * k}`;       // controle em 2x → pico = k
  const caminho = (k) => `M${x0} ${y0}L${x1} ${y1}Q${ctrl(k)} ${x2} ${y2}`;
  g.querySelectorAll('.c-linha').forEach((p) => p.setAttribute('d', caminho(d)));
  // o borrão: o espaço que a corda varre indo e voltando
  const fuso = g.querySelector('.c-fuso');
  if (fuso) {
    fuso.setAttribute('d', envelope ? `M${x1} ${y1}Q${ctrl(envelope)} ${x2} ${y2}Q${ctrl(-envelope)} ${x1} ${y1}Z` : '');
    fuso.setAttribute('fill-opacity', envelope ? Math.min(0.32, envelope / 40).toFixed(3) : '0');
  }
}

export function vibrar(raiz, a, { direcao = 'baixo', atraso = 0, passo = 12 } = {}) {
  if (!raiz || !a) return;
  const ordem = direcao === 'cima' ? [1, 2, 3, 4] : [6, 5, 4, 3, 2, 1];
  const tocadas = ordem.filter((n) => a.casas[6 - n] >= 0);
  const agora = performance.now();
  raiz.querySelectorAll('svg.braco').forEach((svg) => {
    tocadas.forEach((n, k) => {
      const g = svg.querySelector(`.corda[data-corda="${n}"]`);
      if (g) vibrando.set(g, agora + atraso + k * passo);
    });
  });
  if (!quadro) quadro = requestAnimationFrame(animar);
}
