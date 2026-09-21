/* Movimento Betel — comportamentos da pagina */
(function () {
  'use strict';

  var nav = document.querySelector('.nav');
  var menu = document.querySelector('.nav__menu');

  /* fundo da navegacao ao rolar */
  function aoRolar() {
    if (!nav) return;
    nav.classList.toggle('fixa', window.scrollY > 40);
  }
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });

  /* menu mobile */
  if (menu && nav) {
    menu.addEventListener('click', function () {
      var aberta = nav.classList.toggle('aberta');
      menu.setAttribute('aria-expanded', String(aberta));
      if (aberta) nav.classList.add('fixa');
      else aoRolar();
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('aberta');
        menu.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* revelar blocos ao entrar na tela */
  var alvos = document.querySelectorAll('.revela');
  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    alvos.forEach(function (el) { el.classList.add('visivel'); });
    return;
  }
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('visivel');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  alvos.forEach(function (el) { obs.observe(el); });
})();
