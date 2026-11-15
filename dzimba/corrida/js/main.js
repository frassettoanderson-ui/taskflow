/* Curso Treinamento de Corrida de Rua · D'Zimba (v2)
   Rolar = correr. Animações com GSAP + ScrollTrigger (sem GSAP a página aparece inteira, parada).
   Inscrição e pagamento pelo Mercado Pago via api/. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var temGsap = !!(window.gsap && window.ScrollTrigger);
  if (!temGsap) doc.classList.remove('anima');
  var anima = doc.classList.contains('anima');

  var API = 'api/';
  var ZAP = 'https://wa.me/5548999474500?text=';
  var CURSO = new Date('2026-12-12T15:00:00-03:00').getTime();
  var cfg = { enabled: false }, voltouFalha = /[?&]pagamento=falhou/.test(location.search);

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var brl = function (v) { return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var desktop = function () { return matchMedia('(min-width: 901px)').matches; };

  /* ---------- topo + barra de ritmo ---------- */
  var topo = $('.topo'), barra = $('#ritmo-barra'), ultimoY = 0;
  function aoRolar() {
    var y = window.scrollY, max = doc.scrollHeight - innerHeight;
    barra.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    topo.classList.toggle('solido', y > 40);
    topo.classList.toggle('some', y > innerHeight && y > ultimoY + 4);
    if (y < ultimoY - 4 || y < innerHeight) topo.classList.remove('some');
    ultimoY = y;
  }
  window.addEventListener('scroll', aoRolar, { passive: true }); aoRolar();

  /* ---------- cronômetro até a largada ---------- */
  var crono = $('#cronometro');
  function tique() {
    var falta = CURSO - Date.now();
    if (falta <= 0) { crono.hidden = true; return; }
    var dois = function (n) { return String(n).padStart(2, '0'); };
    $('[data-c=d]', crono).textContent = Math.floor(falta / 864e5);
    $('[data-c=h]', crono).textContent = dois(Math.floor(falta / 36e5) % 24);
    $('[data-c=m]', crono).textContent = dois(Math.floor(falta / 6e4) % 60);
    $('[data-c=s]', crono).textContent = dois(Math.floor(falta / 1e3) % 60);
  }
  tique(); setInterval(tique, 1000);

  /* ---------- manifesto: quebra em palavras (acendem com a rolagem) ---------- */
  var manifesto = $('#manifesto');
  (function quebrar(el) {
    $$('*', el).concat([el]).forEach(function (no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (t) {
        if (t.nodeType !== 3 || !t.textContent.trim()) return;
        var frag = document.createDocumentFragment();
        t.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          var s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s);
        });
        no.replaceChild(frag, t);
      });
    });
  })(manifesto);

  /* ---------- parciais: qual tópico está no centro da tela ---------- */
  var splits = $$('.split'), fotos = $$('.parciais__fotos img'), visor = $('#visor-n');
  function ativar(i) {
    splits.forEach(function (s, k) { s.classList.toggle('ativa', k === i); });
    fotos.forEach(function (f, k) { f.classList.toggle('ativa', k === i); });
    visor.textContent = String(i + 1).padStart(2, '0');
  }
  if ('IntersectionObserver' in window) {
    var ioS = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) ativar(splits.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    splits.forEach(function (s) { ioS.observe(s); });
  }

  /* ---------- percurso: o corredor anda pela rota ---------- */
  var rota = $('#rota'), corredor = $('#corredor'), mapa = $('.mapa'), svg = $('.mapa__svg');
  var chegada = $('.ponto--chegada'), largada = $('.ponto--largada');
  var compRota = rota.getTotalLength();
  rota.style.strokeDasharray = compRota;
  function posicionar(p) {
    rota.style.strokeDashoffset = compRota * (1 - p);
    var pt = rota.getPointAtLength(compRota * p);
    var r = svg.getBoundingClientRect(), m = mapa.getBoundingClientRect();
    corredor.style.transform = 'translate(' + (r.left - m.left + pt.x * r.width / 1000) + 'px,' + (r.top - m.top + pt.y * r.height / 420) + 'px)';
    if (chegada) chegada.classList.toggle('chegou', p > .97);
  }
  posicionar(anima ? 0 : 1);
  window.addEventListener('resize', function () { if (!anima) posicionar(1); });

  /* ---------- nome ao vivo no número de peito e no certificado ---------- */
  var campoNome = $('#vaga-nome'), peitoNome = $('#peito-nome'), certNome = $('#cert-nome');
  function titulo(s) {
    return s.toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\s(D[aeo]s?|E)\s/g, function (m) { return m.toLowerCase(); });
  }
  function ajustarCert() {
    certNome.style.fontSize = '';
    var tam = parseFloat(getComputedStyle(certNome).fontSize), guarda = 0;
    while (certNome.scrollWidth > certNome.clientWidth && tam > 8 && guarda++ < 40) { tam -= .5; certNome.style.fontSize = tam + 'px'; }
  }
  function nomeAoVivo() {
    var n = campoNome.value.replace(/\s+/g, ' ').trim();
    peitoNome.textContent = n || 'Seu nome'; peitoNome.classList.toggle('vazio', !n);
    certNome.textContent = n ? titulo(n) : 'Seu nome'; certNome.classList.toggle('vazio', !n);
    ajustarCert();
  }
  campoNome.addEventListener('input', nomeAoVivo);
  nomeAoVivo(); window.addEventListener('resize', ajustarCert);

  // certificado inclina levemente com o mouse
  var cert = $('#cert');
  if (matchMedia('(hover: hover)').matches && anima) {
    cert.addEventListener('mousemove', function (e) {
      var r = cert.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      cert.style.transform = 'perspective(1200px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 8) + 'deg)';
    });
    cert.addEventListener('mouseleave', function () { cert.style.transform = ''; });
  }

  /* =========================================================
     ANIMAÇÕES (GSAP)
     ========================================================= */
  if (anima) {
    gsap.registerPlugin(ScrollTrigger);

    // largada do herói
    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.hero__foto img', { scale: 1.25, duration: 2.2, ease: 'power2.out' }, 0)
      .from('.hero__logo', { y: -30, autoAlpha: 0, duration: .9 }, .15)
      .from('.hero__pre', { y: 20, autoAlpha: 0, duration: .7 }, .35)
      .from('.hero__palavra', { yPercent: 115, skewX: -12, duration: 1.1, stagger: .12 }, .4)
      .from('.hero__mao', { scale: .6, rotate: -12, autoAlpha: 0, duration: .7, ease: 'back.out(2.2)' }, .95)
      .from('.cronometro', { y: 20, autoAlpha: 0, duration: .7 }, 1.1)
      .from('.hero .btn--xl', { y: 24, autoAlpha: 0, duration: .7 }, 1.2)
      .from('.hero__faixa li', { y: 24, autoAlpha: 0, duration: .6, stagger: .08 }, 1.25);

    // herói sai devagar (parallax)
    gsap.to('.hero__foto img', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__conteudo', { yPercent: -18, autoAlpha: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    // manifesto: as palavras acendem conforme rola
    gsap.to('.manifesto__txt .w', { opacity: 1, stagger: .1, ease: 'none',
      scrollTrigger: { trigger: '.manifesto', start: 'top 75%', end: 'bottom 60%', scrub: true } });
    gsap.from('.manifesto__sub', { y: 30, autoAlpha: 0, duration: .8, scrollTrigger: { trigger: '.manifesto__sub', start: 'top 90%' } });

    // títulos entram de baixo
    $$('.titulo, .palestrante__nome, .final__titulo').forEach(function (t) {
      gsap.from(t, { y: 70, autoAlpha: 0, skewY: 3, duration: 1, ease: 'power4.out', scrollTrigger: { trigger: t, start: 'top 88%' } });
    });

    // percurso: fixa a seção e o corredor percorre a rota
    var mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', function () {
      chegada.classList.remove('chegou');
      var st = { v: 0 };
      gsap.timeline({
        scrollTrigger: { trigger: '.percurso', start: 'top top', end: '+=140%', pin: '.percurso__palco', scrub: .6, anticipatePin: 1 }
      })
        .from(largada, { x: -60, autoAlpha: 0, duration: .15 }, 0)
        .to(st, { v: 1, duration: 1, ease: 'none', onUpdate: function () { posicionar(st.v); } }, .1)
        .from(chegada, { x: 60, autoAlpha: .15, duration: .15 }, .95);
      return function () { posicionar(1); };
    });
    mm.add('(max-width: 900px)', function () {
      posicionar(1);
      gsap.from('.ponto', { y: 50, autoAlpha: 0, stagger: .2, duration: .8, scrollTrigger: { trigger: '.mapa', start: 'top 80%' } });
    });

    // palestrante
    gsap.from('.palestrante__pre', { y: 20, autoAlpha: 0, duration: .6, scrollTrigger: { trigger: '.palestrante', start: 'top 70%' } });
    gsap.from('.credenciais li', { y: 40, autoAlpha: 0, stagger: .12, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: '.credenciais', start: 'top 88%' } });

    // número de peito chega girando, certificado sobe
    gsap.from('.peito', { y: 120, rotate: -18, autoAlpha: 0, duration: 1.2, ease: 'power4.out', scrollTrigger: { trigger: '.vaga__grade', start: 'top 80%' } });
    gsap.from('.vaga__form > *', { y: 30, autoAlpha: 0, stagger: .08, duration: .7, scrollTrigger: { trigger: '.vaga__grade', start: 'top 75%' } });
    gsap.from('.cert', { y: 90, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.cert', start: 'top 90%' } });

    // perguntas e chegada
    gsap.from('.faq details', { y: 24, autoAlpha: 0, stagger: .07, duration: .6, scrollTrigger: { trigger: '.faq', start: 'top 85%' } });
    gsap.fromTo('.final__foto', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.final__mao, .final .btn', { y: 30, autoAlpha: 0, stagger: .15, duration: .8, scrollTrigger: { trigger: '.final', start: 'top 60%' } });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  /* =========================================================
     INSCRIÇÃO / PAGAMENTO
     ========================================================= */
  function aplicarConfig() {
    if (!cfg.enabled) {
      // pagamento ainda não ligado: os botões levam para o WhatsApp (com o nome, se já escreveu)
      $$('[data-cta]').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
      $('#cta-principal span').textContent = 'Quero me inscrever pelo WhatsApp';
      return;
    }
    $('#valor-num').textContent = brl(cfg.valor);
    $('#vaga-preco').hidden = false; $('#vaga-nota').hidden = false;
    $('#preco-pix').textContent = 'R$ ' + brl(cfg.valor);
    $('#preco-cartao').textContent = 'R$ ' + brl(cfg.valorCartao) + (cfg.maxParcelas > 1 ? ' · até ' + cfg.maxParcelas + 'x' : '');
    if (cfg.esgotado) {
      $$('[data-cta]').forEach(function (a) { a.querySelector('span').textContent = 'Vagas esgotadas'; a.removeAttribute('href'); a.style.pointerEvents = 'none'; a.style.opacity = '.5'; });
    } else if (cfg.restantes != null && cfg.restantes <= 20) {
      var v = $('#vagas'); v.textContent = cfg.restantes === 1 ? 'resta 1 vaga!' : 'restam ' + cfg.restantes + ' vagas'; v.hidden = false;
    }
  }
  fetch(API + 'config').then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .catch(function () { return { enabled: false }; })
    .then(function (c) {
      cfg = c || { enabled: false }; aplicarConfig();
      if (voltouFalha && cfg.enabled) { abrir(); mostraErro('O pagamento no cartão não foi aprovado. Tente de novo ou pague no PIX.'); }
    });

  var pay = $('#pay'), form = $('#pay-form'), erro = $('.pay__erro', pay), poll = null, ultimoFoco = null;
  function passo(nome) { $$('.pay__passo', pay).forEach(function (p) { p.hidden = p.dataset.step !== nome; }); }
  function abrir() {
    ultimoFoco = document.activeElement;
    if (campoNome.value.trim() && !form.nome.value) form.nome.value = campoNome.value.trim();
    passo('form'); erro.hidden = true; pay.hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(function () { (form.nome.value ? form.whatsapp : form.nome).focus(); }, 60);
  }
  function fechar() { pay.hidden = true; document.body.style.overflow = ''; clearInterval(poll); if (ultimoFoco) ultimoFoco.focus(); }

  document.addEventListener('click', function (e) {
    var cta = e.target.closest('[data-cta]');
    if (cta) {
      if (cfg.esgotado) { e.preventDefault(); return; }
      if (cfg.enabled) {
        e.preventDefault();
        // botões de cima levam até o número de peito; o do próprio número abre o pagamento
        if (cta.id === 'cta-principal' || $('#vaga').getBoundingClientRect().top < innerHeight * .5) abrir();
        else { $('#vaga').scrollIntoView({ behavior: anima ? 'smooth' : 'auto' }); setTimeout(function () { campoNome.focus({ preventScroll: true }); }, 900); }
      } else {
        var n = campoNome.value.trim();
        cta.href = ZAP + encodeURIComponent('Olá! Quero me inscrever no Curso Treinamento de Corrida de Rua do dia 12/12.' + (n ? ' Meu nome: ' + n + '.' : ''));
      }
      return;
    }
    if (e.target.closest('[data-close]')) fechar();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pay.hidden) fechar(); });
  campoNome.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#cta-principal').click(); } });

  form.whatsapp.addEventListener('input', function () {
    var d = this.value.replace(/\D/g, '').slice(0, 11), r = d;
    if (d.length > 2) r = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) r = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
    this.value = r;
  });
  form.nome.addEventListener('input', function () { campoNome.value = this.value; nomeAoVivo(); });

  function dados() {
    var nivel = $('input[name=nivel]:checked', form);
    return { nome: form.nome.value.trim(), whatsapp: form.whatsapp.value, email: form.email.value.trim(), nivel: nivel ? nivel.value : '' };
  }
  function mostraErro(t) { erro.textContent = t; erro.hidden = false; }
  function validar(d) {
    $$('input', form).forEach(function (i) { i.classList.remove('invalido'); });
    var falha = null;
    if (d.nome.split(/\s+/).length < 2) falha = [form.nome, 'Escreva o nome completo, do jeito que vai sair no certificado.'];
    else if (d.whatsapp.replace(/\D/g, '').length < 10) falha = [form.whatsapp, 'Confira o WhatsApp com DDD.'];
    else if (!/.+@.+\..+/.test(d.email)) falha = [form.email, 'Confira o e-mail.'];
    if (!falha) return true;
    falha[0].classList.add('invalido'); falha[0].focus(); mostraErro(falha[1]); return false;
  }
  function ocupado(sim) { $$('button', form).forEach(function (b) { b.disabled = sim; }); }
  function post(rota, corpo) {
    return fetch(API + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      .then(function (r) { return r.json().then(function (j) { j._ok = r.ok; return j; }); });
  }
  function falhou(j) {
    if (j && j.error === 'esgotado') return 'As vagas acabaram.';
    if (j && j.error === 'dados_invalidos') return 'Confira os dados e tente de novo.';
    return 'Não deu para gerar o pagamento agora. Tente de novo em instantes.';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault(); erro.hidden = true;
    var d = dados(); if (!validar(d)) return;
    ocupado(true);
    post('inscrever', d).then(function (j) {
      ocupado(false);
      if (!j._ok || !j.qr_code) { mostraErro(falhou(j)); return; }
      $('.pay__qr', pay).src = 'data:image/png;base64,' + j.qr_code_base64;
      var copiar = $('.pay__copiar', pay);
      copiar.textContent = 'Copiar código PIX';
      copiar.onclick = function () {
        var ok = function () { copiar.textContent = 'Código copiado ✓'; };
        if (navigator.clipboard) navigator.clipboard.writeText(j.qr_code).then(ok, function () { prompt('Copie o código:', j.qr_code); });
        else prompt('Copie o código:', j.qr_code);
      };
      passo('pix');
      clearInterval(poll);
      poll = setInterval(function () {
        fetch(API + 'status/' + j.id).then(function (r) { return r.json(); }).then(function (s) {
          if (s.status !== 'approved') return;
          clearInterval(poll);
          var g = $('#pay-grupo');
          if (s.grupo) { g.href = s.grupo; g.hidden = false; }
          passo('ok');
        }).catch(function () {});
      }, 4000);
    }).catch(function () { ocupado(false); mostraErro(falhou()); });
  });

  $('[data-cartao]', form).addEventListener('click', function () {
    erro.hidden = true;
    var d = dados(); if (!validar(d)) return;
    ocupado(true);
    post('cartao', d).then(function (j) {
      if (!j._ok || !j.init_point) { ocupado(false); mostraErro(falhou(j)); return; }
      location.href = j.init_point;
    }).catch(function () { ocupado(false); mostraErro(falhou()); });
  });
})();
