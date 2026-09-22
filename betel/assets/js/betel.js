/* Movimento Betel — comportamentos da pagina */
(function () {
  'use strict';

  /* Quem pede "reduzir movimento" no sistema perde so as animacoes que rodam
     sozinhas (entrada do hero, no CSS). Os reveals e a vinha so andam quando a
     pessoa rola a pagina, entao ficam ligados — e o cliente quer ve-los. */
  var nav = document.querySelector('.nav');
  var menu = document.querySelector('.nav__menu');

  /* ---------- navegacao ---------- */
  function navAoRolar() {
    if (!nav) return;
    nav.classList.toggle('fixa', window.scrollY > 40);
  }
  if (menu && nav) {
    menu.addEventListener('click', function () {
      var aberta = nav.classList.toggle('aberta');
      menu.setAttribute('aria-expanded', String(aberta));
      if (aberta) nav.classList.add('fixa');
      else navAoRolar();
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('aberta');
        menu.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- revelar blocos ao entrar na tela ---------- */
  var alvos = document.querySelectorAll('.revela');
  if (!('IntersectionObserver' in window)) {
    alvos.forEach(function (el) { el.classList.add('visivel'); });
  } else {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visivel');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    alvos.forEach(function (el) { obs.observe(el); });
  }

  /* ---------- vinha: brotos que crescem junto com o scroll ----------
     Cada secao ganha uma vinha desenhada em SVG num dos lados. O caule e um
     caminho com stroke-dasharray; conforme a secao atravessa a janela, o
     progresso (0..1) e suavizado e escrito em --p: o caule se desenha
     (dashoffset) e cada folha/flor, que tem um --t (posicao ao longo do
     caule), cresce quando o caule passa por ela. Rolar para cima desfaz. */
  var NS = 'http://www.w3.org/2000/svg';
  var XL = 'http://www.w3.org/1999/xlink';
  var LARG = 320;

  /* gerador pseudoaleatorio com semente: a mesma secao sempre da a mesma vinha */
  function semente(n) {
    var s = n * 9301 + 49297;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function el(nome, attrs, pai) {
    var e = document.createElementNS(NS, nome);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }
  function uso(href, attrs, pai) {
    var u = el('use', attrs, pai);
    u.setAttribute('href', href);
    u.setAttributeNS(XL, 'xlink:href', href);
    return u;
  }

  function plantar(secao, indice) {
    var antiga = secao.querySelector(':scope > .vinha');
    if (antiga) antiga.remove();

    var h = secao.offsetHeight;
    var lado = indice % 2 === 0 ? 'dir' : 'esq';
    var rnd = semente(indice + 7);
    /* mais estreita em telas medias, para nao entrar por baixo da coluna de texto */
    var larg = window.innerWidth < 760 ? 200 : window.innerWidth < 1240 ? 250 : LARG;

    var svg = el('svg', {
      'class': 'vinha vinha--' + lado,
      viewBox: '0 0 ' + larg + ' ' + h,
      width: larg, height: h,
      'aria-hidden': 'true', focusable: 'false'
    });
    svg.style.setProperty('--p', '0');

    /* caule: curvas suaves descendo, serpenteando de um lado para o outro */
    var meio = larg * 0.4, amp = larg * 0.2;
    var y = -20, x = meio + (rnd() - 0.5) * amp;
    var d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
    var passo = 240 + rnd() * 80;
    var dir = rnd() > 0.5 ? 1 : -1;
    while (y < h + 20) {
      var y2 = y + passo;
      var x2 = meio + dir * amp * (0.55 + rnd() * 0.45);
      var cx1 = x + dir * amp * 0.9, cy1 = y + passo * 0.35;
      var cx2 = x2 - dir * amp * 0.9, cy2 = y2 - passo * 0.35;
      d += ' C' + cx1.toFixed(1) + ' ' + cy1.toFixed(1) + ',' + cx2.toFixed(1) + ' ' + cy2.toFixed(1) + ',' + x2.toFixed(1) + ' ' + y2.toFixed(1);
      x = x2; y = y2; dir = -dir;
      passo = 220 + rnd() * 110;
    }
    var caule = el('path', { 'class': 'vinha__caule', d: d }, svg);
    var L = caule.getTotalLength();
    caule.style.strokeDasharray = L;
    caule.style.strokeDashoffset = L;

    /* folhas, flores e botoes ao longo do caule */
    var dist = 46 + rnd() * 30, n = 0;
    while (dist < L - 30) {
      var p1 = caule.getPointAtLength(dist);
      var p2 = caule.getPointAtLength(Math.min(L, dist + 3));
      var ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
      var ladoFolha = n % 2 === 0 ? 1 : -1;
      var t = dist / L;

      var g = el('g', { 'class': 'vinha__broto', transform: 'translate(' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) + ')' }, svg);
      g.style.setProperty('--t', t.toFixed(4));

      var florAqui = n % 7 === 4;
      var botaoAqui = !florAqui && n % 5 === 2;

      if (florAqui) {
        var tamF = 38 + rnd() * 30;
        var gf = el('g', { 'class': 'vinha__esc vinha__esc--flor', transform: 'rotate(' + (rnd() * 360).toFixed(0) + ')' }, g);
        uso('#lg-flor', { x: -tamF / 2, y: -tamF / 2, width: tamF, height: tamF, 'class': 'vinha__flor' }, gf);
      } else {
        var comp = 32 + rnd() * 26;
        /* a folha aponta para fora do caule, inclinada para a frente do crescimento */
        var rot = ang + ladoFolha * (48 + rnd() * 26);
        var gr = el('g', { transform: 'rotate(' + rot.toFixed(1) + ')' }, g);
        var ge = el('g', { 'class': 'vinha__esc' }, gr);
        uso('#lg-folha', { x: 0, y: -comp * 0.34 * 0.59, width: comp, height: comp * 0.34, 'class': 'vinha__folha' }, ge);
        if (botaoAqui) {
          /* o botao nasce do mesmo no, apontando para o lado oposto da folha */
          var tamB = 9 + rnd() * 6;
          var gb0 = el('g', { transform: 'rotate(' + (ang - ladoFolha * (70 + rnd() * 20) - 90).toFixed(1) + ')' }, g);
          var gb = el('g', { 'class': 'vinha__esc vinha__esc--botao' }, gb0);
          uso('#lg-botao', { x: -tamB * 0.75 / 2, y: 0, width: tamB * 0.75, height: tamB, 'class': 'vinha__botao' }, gb);
        }
      }
      n++;
      dist += 44 + rnd() * 30;
    }

    secao.insertBefore(svg, secao.firstChild);
    return { secao: secao, svg: svg, caule: caule, L: L, atual: 0, alvo: 0 };
  }

  var secoes = Array.prototype.slice.call(document.querySelectorAll('.hero, .secao'));
  var vinhas = [];
  function plantarTodas() {
    vinhas = secoes.map(function (s, i) { return plantar(s, i); });
  }
  plantarTodas();

  function progressoDe(v) {
    var r = v.secao.getBoundingClientRect();
    var aj = window.innerHeight;
    /* 0 quando o topo da secao encosta na base da janela;
       1 quando a base da secao chega a 40% da janela */
    var p = (aj - r.top) / (r.height + aj * 0.6);
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  var rodando = false;
  function quadro() {
    var pendente = false;
    /* aba oculta: o navegador entrega ~1 quadro/s, entao nao ha o que suavizar */
    var passo = document.hidden ? 1 : 0.18;
    for (var i = 0; i < vinhas.length; i++) {
      var v = vinhas[i];
      var delta = v.alvo - v.atual;
      if (Math.abs(delta) < 0.0015) { v.atual = v.alvo; }
      else { v.atual += delta * passo; pendente = true; }
      v.svg.style.setProperty('--p', v.atual.toFixed(4));
      v.caule.style.strokeDashoffset = (v.L * (1 - v.atual)).toFixed(1);
    }
    if (pendente) window.requestAnimationFrame(quadro);
    else rodando = false;
  }
  function medir() {
    navAoRolar();
    for (var i = 0; i < vinhas.length; i++) vinhas[i].alvo = progressoDe(vinhas[i]);
    if (!rodando) { rodando = true; window.requestAnimationFrame(quadro); }
  }

  var esperaRedimensionar;
  window.addEventListener('scroll', medir, { passive: true });
  document.addEventListener('visibilitychange', medir);
  window.addEventListener('resize', function () {
    clearTimeout(esperaRedimensionar);
    esperaRedimensionar = setTimeout(function () { plantarTodas(); medir(); }, 180);
  });
  /* alturas mudam quando fontes e fotos terminam de carregar */
  window.addEventListener('load', function () { plantarTodas(); medir(); });
  medir();
})();
