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

  /* ---------- jardim: ramos da marca que surgem conforme a pagina rola ----------
     Para cada .jardim medimos o progresso da secao na janela (0 = topo da
     secao encostando na base da janela, 1 = base da secao a 40% da janela),
     suavizamos e escrevemos em --p. O resto e CSS: cada .broto cresce quando
     --p passa do seu --t. Rolar para cima desfaz. */
  var jardins = Array.prototype.map.call(document.querySelectorAll('.jardim'), function (j) {
    return { el: j, secao: j.parentElement, atual: 0, alvo: 0 };
  });

  function progressoDe(j) {
    var r = j.secao.getBoundingClientRect();
    var aj = window.innerHeight;
    var p = (aj - r.top) / (r.height + aj * 0.6);
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  /* por do sol: a marca do hero afunda no horizonte conforme a pagina rola.
     0 no topo da pagina, 1 quando ja se rolou 55% da altura do hero. */
  var hero = document.querySelector('.hero');
  var mov = document.querySelector('.hero__mov');
  var sol = { atual: 0, alvo: 0 };
  function afundar() {
    if (!hero) return 0;
    var v = window.scrollY / (hero.offsetHeight * 0.55);
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    return v * v * (3 - 2 * v);           /* suaviza as pontas */
  }

  var rodando = false;
  function quadro() {
    var pendente = false;
    /* aba oculta: o navegador entrega ~1 quadro/s, entao nao ha o que suavizar */
    var passo = document.hidden ? 1 : 0.16;
    for (var i = 0; i < jardins.length; i++) {
      var j = jardins[i];
      var delta = j.alvo - j.atual;
      if (Math.abs(delta) < 0.0015) { j.atual = j.alvo; }
      else { j.atual += delta * passo; pendente = true; }
      j.el.style.setProperty('--p', j.atual.toFixed(4));
    }
    if (mov) {
      var d = sol.alvo - sol.atual;
      if (Math.abs(d) < 0.0015) { sol.atual = sol.alvo; }
      else { sol.atual += d * Math.max(passo, 0.22); pendente = true; }
      mov.style.setProperty('--afunda', sol.atual.toFixed(4));
    }
    if (pendente) window.requestAnimationFrame(quadro);
    else rodando = false;
  }
  function medir() {
    navAoRolar();
    for (var i = 0; i < jardins.length; i++) jardins[i].alvo = progressoDe(jardins[i]);
    sol.alvo = afundar();
    if (!rodando) { rodando = true; window.requestAnimationFrame(quadro); }
  }

  window.addEventListener('scroll', medir, { passive: true });
  window.addEventListener('resize', medir);
  document.addEventListener('visibilitychange', medir);
  window.addEventListener('load', medir);
  medir();
})();
