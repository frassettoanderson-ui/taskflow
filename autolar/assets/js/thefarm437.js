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

    // estrela cadente: cruza a área escura em intervalos aleatórios
    function shoot() {
      var el = document.createElement('i');
      el.className = 'tf-sky__shoot';
      var angle = rand(14, 34);                      // graus (descendo p/ direita)
      var fromLeft = Math.random() < .5;
      var startX = fromLeft ? rand(4, 40) : rand(30, 70);
      var startY = rand(top + 2, Math.max(top + 6, bottom * .55));
      var dist = rand(420, 820);
      var dur = rand(900, 1500);
      el.style.left = startX + '%';
      el.style.top = startY + '%';
      el.style.setProperty('--tail', rand(160, 300) + 'px');
      sky.appendChild(el);
      var anim = el.animate([
        { transform: 'rotate(' + angle + 'deg) translateX(0)', opacity: 0 },
        { transform: 'rotate(' + angle + 'deg) translateX(' + (dist * .12) + 'px)', opacity: 1, offset: .12 },
        { transform: 'rotate(' + angle + 'deg) translateX(' + (dist * .8) + 'px)', opacity: .9, offset: .8 },
        { transform: 'rotate(' + angle + 'deg) translateX(' + dist + 'px)', opacity: 0 }
      ], { duration: dur, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
      anim.onfinish = function () { el.remove(); };
      schedule();
    }
    function schedule() {
      var wait = rand(3800, 8500);
      setTimeout(function () { if (document.hidden) { schedule(); return; } shoot(); }, wait);
    }
    setTimeout(shoot, 1600); // primeira logo após o hero aparecer
  });

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
