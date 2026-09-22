/* Movimento Betel — comportamentos da pagina */
(function () {
  'use strict';

  var reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.querySelector('.nav');
  var menu = document.querySelector('.nav__menu');

  /* fundo da navegacao ao rolar */
  function navAoRolar() {
    if (!nav) return;
    nav.classList.toggle('fixa', window.scrollY > 40);
  }

  /* menu mobile */
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
  if (!('IntersectionObserver' in window) || reduzMovimento) {
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

  /* ---------- jardim: ramos e flores que nascem conforme a pagina rola ----------
     Para cada secao com .jardim, calculamos o progresso dela na tela (0 quando o
     topo encosta na base da janela, 1 quando a secao ja passou ~60% da altura
     da janela). Cada .broto tem um data-inicio; ao ultrapassar, ele "nasce"
     (classe .nasceu) e fica assim — nao volta pra semente ao rolar pra cima. */
  var jardins = [];
  document.querySelectorAll('.jardim').forEach(function (j) {
    var secao = j.parentElement;
    var brotos = Array.prototype.map.call(j.querySelectorAll('.broto'), function (b) {
      return { el: b, inicio: parseFloat(b.getAttribute('data-inicio') || '0.2'), nasceu: false };
    });
    jardins.push({ secao: secao, brotos: brotos, completo: false });
  });

  if (reduzMovimento) {
    jardins.forEach(function (j) {
      j.brotos.forEach(function (b) { b.el.classList.add('nasceu'); });
    });
  }

  var agendado = false;
  function atualizar() {
    agendado = false;
    navAoRolar();
    if (reduzMovimento) return;

    var alturaJanela = window.innerHeight;
    var baseJanela = window.scrollY + alturaJanela;

    for (var i = 0; i < jardins.length; i++) {
      var j = jardins[i];
      if (j.completo) continue;
      var r = j.secao.getBoundingClientRect();
      var topo = r.top + window.scrollY;
      var progresso = (baseJanela - topo) / (r.height + alturaJanela * 0.6);
      if (progresso <= 0) continue;

      var restantes = 0;
      for (var k = 0; k < j.brotos.length; k++) {
        var b = j.brotos[k];
        if (b.nasceu) continue;
        if (progresso >= b.inicio) {
          b.nasceu = true;
          b.el.classList.add('nasceu');
        } else {
          restantes++;
        }
      }
      if (restantes === 0) j.completo = true;
    }
  }
  function aoRolar() {
    if (agendado) return;
    agendado = true;
    window.requestAnimationFrame(atualizar);
  }

  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', aoRolar);
  atualizar();
})();
