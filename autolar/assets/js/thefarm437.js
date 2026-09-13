/* ============================================================================
   THE FARM 437 — céu animado (estrelas + estrela cadente) e lightbox da galeria
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---- Céu: estrelas piscando + estrelas cadentes ------------------------ */
  document.querySelectorAll('[data-sky]').forEach(function (sky) {
    if (reduce) return;
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

    // estrelas cadentes: uma a cada ~1 s, em posições/ângulos variados; de vez em quando uma "grande"
    function shoot() {
      var el = document.createElement('i');
      el.className = 'tf-sky__shoot' + (Math.random() < .25 ? ' tf-sky__shoot--big' : '');
      var toRight = Math.random() < .7;                 // maioria cai para a direita
      var angle = (toRight ? 1 : -1) * rand(12, 38);    // graus (positivo = desce p/ direita)
      var startX = toRight ? rand(2, 55) : rand(45, 98);
      var startY = rand(top + 1, Math.max(top + 6, bottom * .6));
      var dist = rand(520, 1100);
      var dur = rand(700, 1300);
      el.style.left = startX + '%';
      el.style.top = startY + '%';
      el.style.setProperty('--tail', rand(220, 420) + 'px');
      sky.appendChild(el);
      // rotate(angle) alinha o eixo X com a trajetória; scaleX(-1) espelha a cauda quando vai p/ a esquerda
      var base = 'rotate(' + angle + 'deg)' + (toRight ? '' : ' scaleX(-1)');
      var anim = el.animate([
        { transform: base + ' translateX(0)', opacity: 0 },
        { transform: base + ' translateX(' + (dist * .1) + 'px)', opacity: 1, offset: .1 },
        { transform: base + ' translateX(' + (dist * .78) + 'px)', opacity: .95, offset: .78 },
        { transform: base + ' translateX(' + dist + 'px)', opacity: 0 }
      ], { duration: dur, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
      anim.onfinish = function () { el.remove(); };
      schedule();
    }
    function schedule() {
      var wait = rand(700, 1500);
      setTimeout(function () { if (document.hidden) { schedule(); return; } shoot(); }, wait);
    }
    setTimeout(shoot, 900); // primeira logo após o hero aparecer
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
