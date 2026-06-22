/* ============================================================================
   AUTOLAR — interações de front-end (vanilla JS, sem dependências)
   ========================================================================== */
(function () {
  'use strict';

  /* ---- Menu mobile (drawer) ---------------------------------------------- */
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var open = mainNav.classList.toggle('is-open');
      navToggle.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---- Filtros mobile (abre/fecha sidebar) ------------------------------- */
  var fToggle = document.querySelector('.filters-toggle');
  var filters = document.querySelector('.filters');
  if (fToggle && filters) {
    fToggle.addEventListener('click', function () {
      filters.classList.toggle('is-open');
    });
  }

  /* ---- Categorias: setas de rolagem -------------------------------------- */
  document.querySelectorAll('[data-cats]').forEach(function (wrap) {
    var track = wrap.querySelector('.cats-track');
    wrap.querySelectorAll('[data-cats-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.getAttribute('data-cats-nav') === 'next' ? 1 : -1;
        if (track) track.scrollBy({ left: dir * 320, behavior: 'smooth' });
      });
    });
  });

  /* ---- Galeria de detalhe ------------------------------------------------ */
  var gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    var mainImg = gallery.querySelector('[data-gallery-main]');
    var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('[data-gallery-thumb]'));
    var idx = 0;
    function show(i) {
      if (!thumbs.length) return;
      idx = (i + thumbs.length) % thumbs.length;
      var src = thumbs[idx].getAttribute('data-full') || thumbs[idx].src;
      if (mainImg) mainImg.src = src;
      thumbs.forEach(function (t, k) { t.classList.toggle('is-active', k === idx); });
    }
    thumbs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });
    var prev = gallery.querySelector('[data-gallery-prev]');
    var next = gallery.querySelector('[data-gallery-next]');
    if (prev) prev.addEventListener('click', function () { show(idx - 1); });
    if (next) next.addEventListener('click', function () { show(idx + 1); });
    show(0);
  }

  /* ---- Máscaras simples (telefone / moeda) ------------------------------- */
  function maskPhone(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) return v.replace(/(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3').replace(/-$/, '');
    if (v.length > 2) return v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    if (v.length > 0) return v.replace(/(\d{0,2})/, '($1');
    return v;
  }
  document.querySelectorAll('[data-mask="phone"]').forEach(function (el) {
    el.addEventListener('input', function () { el.value = maskPhone(el.value); });
  });

  function maskMoney(v) {
    v = v.replace(/\D/g, '');
    if (!v) return '';
    return new Intl.NumberFormat('pt-BR').format(parseInt(v, 10));
  }
  document.querySelectorAll('[data-mask="money"]').forEach(function (el) {
    el.addEventListener('input', function () { el.value = maskMoney(el.value); });
  });

  /* ---- Revelar ao rolar -------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- Confirmação de exclusão (admin) ----------------------------------- */
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    el.addEventListener('submit', function (e) {
      if (!window.confirm(el.getAttribute('data-confirm'))) e.preventDefault();
    });
    el.addEventListener('click', function (e) {
      if (el.tagName === 'A' && !window.confirm(el.getAttribute('data-confirm'))) e.preventDefault();
    });
  });
})();
