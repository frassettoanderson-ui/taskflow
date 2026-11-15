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

  /* ---------- percurso: o corredor anda pela rota no mapa real ---------- */
  var rota = $('#rota'), corredor = $('#corredor'), mapa = $('.mapa'), kmNum = $('#km-num');
  var etapaA = $('.etapa--largada'), etapaB = $('.etapa--chegada');
  var compRota = rota.getTotalLength(), DIST = 4.47;      // km reais (OSRM a pé)
  var kms = $$('.km').map(function (g) { return { el: g, f: Number(g.dataset.km) / DIST }; });
  rota.style.strokeDasharray = compRota;
  function posicionar(p) {
    p = Math.max(0, Math.min(1, p));
    rota.style.strokeDashoffset = compRota * (1 - p);
    var pt = rota.getPointAtLength(compRota * p);
    corredor.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
    kms.forEach(function (k) { k.el.classList.toggle('on', p >= k.f - .005); });
    kmNum.textContent = (DIST * p).toFixed(1).replace('.', ',');
    mapa.classList.toggle('chegou', p > .985);
    etapaA.classList.toggle('on', p < .985);
    etapaB.classList.toggle('on', p > .985);
  }
  posicionar(anima ? 0 : 1);

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

  /* ---------- foto do Marcos: some sozinha enquanto não houver o arquivo ---------- */
  var fotoM = $('#marcos-foto'), imgM = fotoM && $('img', fotoM);
  if (imgM) {
    var semFoto = function () { fotoM.remove(); if (anima) ScrollTrigger.refresh(); };
    var comFoto = function () { $('.palestrante').classList.add('tem-foto'); if (anima) ScrollTrigger.refresh(); };
    imgM.loading = 'eager';
    if (imgM.complete) { imgM.naturalWidth ? comFoto() : semFoto(); }
    else { imgM.addEventListener('load', comFoto); imgM.addEventListener('error', semFoto); }
  }

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

    // percurso: no computador a seção fica fixa e o corredor percorre a rota; no celular desenha ao passar
    var mm = gsap.matchMedia(), st = { v: 0 };
    var andar = function () { posicionar(st.v); };
    mm.add('(min-width: 901px)', function () {
      st.v = 0; posicionar(0);
      gsap.timeline({ scrollTrigger: { trigger: '.percurso', start: 'top top', end: '+=150%', pin: '.percurso__palco', scrub: .6, anticipatePin: 1 } })
        .from('.etapa', { y: 60, stagger: .05, duration: .12 }, 0)
        .to(st, { v: 1, duration: 1, ease: 'none', onUpdate: andar }, .12)
        .to({}, { duration: .12 });
      return function () { posicionar(1); };
    });
    mm.add('(max-width: 900px)', function () {
      st.v = 0; posicionar(0);
      gsap.to(st, { v: 1, ease: 'none', onUpdate: andar, scrollTrigger: { trigger: '.mapa', start: 'top 80%', end: 'bottom 70%', scrub: .5 } });
      gsap.from('.etapa', { y: 40, autoAlpha: 0, stagger: .15, duration: .7, clearProps: 'opacity,visibility,transform', scrollTrigger: { trigger: '.etapas', start: 'top 88%' } });
    });

    // palestrante
    gsap.from('.palestrante__pre', { y: 20, autoAlpha: 0, duration: .6, scrollTrigger: { trigger: '.palestrante', start: 'top 70%' } });
    gsap.from('.palestrante__intro', { y: 30, autoAlpha: 0, duration: .8, scrollTrigger: { trigger: '.palestrante__intro', start: 'top 90%' } });
    gsap.from('.palestrante__foto', { y: 80, rotate: -9, autoAlpha: 0, duration: 1.1, ease: 'power4.out', scrollTrigger: { trigger: '.palestrante__corpo', start: 'top 85%' } });
    gsap.from('.credenciais li', { y: 40, autoAlpha: 0, stagger: .12, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: '.credenciais', start: 'top 88%' } });
    // a pista da trajetória acende conforme rola, e cada marco entra na sua vez
    gsap.fromTo('.trajetoria__pista', { '--prog': 0 }, { '--prog': 1, ease: 'none', scrollTrigger: { trigger: '.trajetoria__pista', start: 'top 80%', end: 'bottom 55%', scrub: .5 } });
    gsap.from('.trajetoria__pista li', { y: 30, autoAlpha: 0, stagger: .14, duration: .7, ease: 'power3.out', scrollTrigger: { trigger: '.trajetoria__pista', start: 'top 82%' } });
    gsap.from('.ingresso', { y: 80, autoAlpha: 0, duration: 1, ease: 'power4.out', scrollTrigger: { trigger: '.ingresso', start: 'top 88%' } });
    gsap.from('.marca', { y: 50, autoAlpha: 0, stagger: .15, duration: .9, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: '.marcas', start: 'top 88%' } });
    gsap.from('.cota', { y: 70, autoAlpha: 0, stagger: .14, duration: .9, ease: 'power4.out', clearProps: 'transform', scrollTrigger: { trigger: '.cotas__lista', start: 'top 85%' } });
    gsap.from('.cotas__titulo', { y: 60, autoAlpha: 0, skewY: 3, duration: 1, ease: 'power4.out', scrollTrigger: { trigger: '.cotas__titulo', start: 'top 88%' } });

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
  var pay = $('#pay'), form = $('#pay-form'), erro = $('.pay__erro', pay), poll = null, ultimoFoco = null;
  function aplicarConfig() {
    // preço: sempre visível (vem do servidor)
    if (cfg.valor) {
      var v = brl(cfg.valor).split(',');
      $('#valor-num').textContent = v[0]; $('#valor-cent').textContent = ',' + v[1];
    }
    if (!cfg.enabled) {
      // pagamento online ainda não ligado: o checkout envia a inscrição pelo WhatsApp da academia
      $('#valor-forma').textContent = 'no PIX ou no cartão';
      $('#ingresso-seg').textContent = 'A inscrição vai direto para o WhatsApp da academia';
      $('[data-pix]', form).hidden = true; $('[data-cartao]', form).hidden = true;
      $('[data-zap]', form).hidden = false; $('#pay-aviso').hidden = false;
      if (cfg.valor) $('#preco-zap').textContent = 'R$ ' + brl(cfg.valor);
      return;
    }
    $('#preco-pix').textContent = 'R$ ' + brl(cfg.valor);
    $('#preco-cartao').textContent = 'R$ ' + brl(cfg.valorCartao) + (cfg.maxParcelas > 1 ? ' · até ' + cfg.maxParcelas + 'x' : '');
    var c = $('#valor-cartao');
    c.textContent = 'ou R$ ' + brl(cfg.valorCartao) + ' no cartão' + (cfg.maxParcelas > 1 ? ', em até ' + cfg.maxParcelas + 'x' : '') + ' (com a taxa da operadora)';
    c.hidden = false;
    if (cfg.esgotado) {
      $$('[data-cta]').forEach(function (a) { a.querySelector('span').textContent = 'Vagas esgotadas'; a.removeAttribute('href'); a.style.pointerEvents = 'none'; a.style.opacity = '.5'; });
    } else if (cfg.restantes != null && cfg.restantes <= 20) {
      var r = $('#vagas'); r.textContent = cfg.restantes === 1 ? 'resta 1 vaga!' : 'restam ' + cfg.restantes + ' vagas'; r.hidden = false;
    }
  }
  fetch(API + 'config').then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .catch(function () { return { enabled: false }; })
    .then(function (c) {
      cfg = c || { enabled: false }; aplicarConfig();
      if (voltouFalha && cfg.enabled) { abrir(); mostraErro('O pagamento no cartão não foi aprovado. Tente de novo ou pague no PIX.'); }
    });

  function passo(nome) { $$('.pay__passo', pay).forEach(function (p) { p.hidden = p.dataset.step !== nome; }); }
  function abrir() {
    ultimoFoco = document.activeElement;
    if (campoNome.value.trim() && !form.nome.value) form.nome.value = titulo(campoNome.value.replace(/\s+/g, ' ').trim());
    passo('form'); erro.hidden = true; pay.hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(function () { (form.nome.value ? form.whatsapp : form.nome).focus(); }, 60);
  }
  function fechar() { pay.hidden = true; document.body.style.overflow = ''; clearInterval(poll); if (ultimoFoco) ultimoFoco.focus(); }

  document.addEventListener('click', function (e) {
    var cta = e.target.closest('[data-cta]');
    if (cta) {
      e.preventDefault();
      if (!cfg.esgotado) abrir();   // todo botão "Garantir" abre o checkout
      return;
    }
    if (e.target.closest('[data-close]')) fechar();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pay.hidden) fechar(); });
  campoNome.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); abrir(); } });

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

  var NIVEIS = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };
  function enviarZap() {
    erro.hidden = true;
    var d = dados(); if (!validar(d)) return;
    var txt = 'Olá! Quero garantir minha vaga no *Curso Treinamento de Corrida de Rua* (12/12).\n\n' +
      'Nome: ' + d.nome + '\nWhatsApp: ' + d.whatsapp + '\nE-mail: ' + d.email + (d.nivel ? '\nNível: ' + NIVEIS[d.nivel] : '') +
      (cfg.valor ? '\n\nValor: R$ ' + brl(cfg.valor) : '');
    window.open(ZAP + encodeURIComponent(txt), '_blank', 'noopener');
  }
  $('[data-zap]', form).addEventListener('click', enviarZap);

  form.addEventListener('submit', function (e) {
    e.preventDefault(); erro.hidden = true;
    if (!cfg.enabled) { enviarZap(); return; }
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
