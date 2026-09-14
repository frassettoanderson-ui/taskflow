/* ============================================================================
   THE FARM 437 — céu animado (estrelas + estrela cadente) e lightbox da galeria
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---- Céu: estrelas piscando + estrelas cadentes ------------------------ */
  document.querySelectorAll('[data-sky]').forEach(function (sky) {
    // (estrelas rodam mesmo com prefers-reduced-motion — pedido do cliente)
    var top = parseFloat(sky.getAttribute('data-sky-top') || '0');     // faixa vertical útil (%)
    var bottom = parseFloat(sky.getAttribute('data-sky-bottom') || '55');

    // estrelas que piscam (só na faixa escura do céu)
    for (var i = 0; i < 34; i++) {
      var s = document.createElement('i');
      s.className = 'tf-sky__twinkle';
      s.style.left = rand(2, 98) + '%';
      s.style.top = rand(top, bottom) + '%';
      s.style.setProperty('--dur', rand(2.6, 6) + 's');
      s.style.setProperty('--delay', rand(0, 6) + 's');
      s.style.setProperty('--peak', rand(.4, 1).toFixed(2));
      var sz = Math.random() < .2 ? 3 : 2;
      s.style.width = s.style.height = sz + 'px';
      sky.appendChild(s);
    }

    // estrela cadente: UMA por vez, ciclo fixo de 3 s (cruza em ~1,2 s, pausa o resto),
    // re-sorteando posição/ângulo/direção a cada volta.
    function sortear(el) {
      var toRight = Math.random() < .7;
      el.style.left = (toRight ? rand(2, 50) : rand(50, 98)) + '%';
      el.style.top = rand(top + 1, Math.max(top + 6, bottom * .55)) + '%';
      el.style.setProperty('--ang', ((toRight ? 1 : -1) * rand(12, 34)).toFixed(1) + 'deg');
      el.style.setProperty('--flip', toRight ? '1' : '-1');
      el.style.setProperty('--dist', Math.round(rand(700, 1200)) + 'px');
      el.style.setProperty('--tail', Math.round(rand(300, 480)) + 'px');
      el.classList.toggle('tf-sky__shoot--big', Math.random() < .3);
    }
    var st = document.createElement('i');
    st.className = 'tf-sky__shoot';
    sortear(st);
    st.addEventListener('animationiteration', function () { sortear(this); });
    sky.appendChild(st);
  });

  /* ---- Vídeo aéreo: toca só quando visível; botão de tela cheia ---------- */
  var video = document.getElementById('tfVideo');
  if (video) {
    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
          else video.pause();
        });
      }, { threshold: 0.35 }).observe(video);
    }
    var fullBtn = document.querySelector('[data-video-full]');
    if (fullBtn) {
      fullBtn.addEventListener('click', function () {
        var p = video.play(); if (p && p.catch) p.catch(function () {});
        if (video.requestFullscreen) video.requestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iOS Safari
      });
      document.addEventListener('fullscreenchange', function () {
        video.controls = document.fullscreenElement === video;
      });
    }
  }

  /* ---- Lightbox das galerias -------------------------------------------- */
  var lb = document.getElementById('tfLightbox');
  if (lb) {
    var img = lb.querySelector('img');
    var count = lb.querySelector('.tf-lb__count');
    var list = [], idx = 0;
    function show(i) {
      idx = (i + list.length) % list.length;
      img.src = list[idx];
      count.textContent = (idx + 1) + ' / ' + list.length;
    }
    function open(group, i) {
      list = Array.prototype.map.call(document.querySelectorAll('[data-lb="' + group + '"]'), function (a) { return a.getAttribute('href'); });
      if (!list.length) return;
      show(i);
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() { lb.classList.remove('is-open'); document.body.style.overflow = ''; }
    document.querySelectorAll('[data-lb]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var group = a.getAttribute('data-lb');
        var i = parseInt(a.getAttribute('data-lb-i') || '0', 10);
        open(group, i);
      });
    });
    lb.querySelector('.tf-lb__prev').addEventListener('click', function () { show(idx - 1); });
    lb.querySelector('.tf-lb__next').addEventListener('click', function () { show(idx + 1); });
    lb.querySelector('.tf-lb__close').addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    // swipe no celular
    var tx = null;
    lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
    });
  }
})();
