/* Curso Treinamento de Corrida de Rua · inscrição e pagamento (Mercado Pago via api/) */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var API = 'api/';
  var ZAP = 'https://wa.me/5548999474500?text=' + encodeURIComponent('Olá! Quero me inscrever no Curso Treinamento de Corrida de Rua do dia 12/12.');
  var CURSO = new Date('2026-12-12T15:00:00-03:00').getTime();
  var cfg = { enabled: false }, voltouFalha = false;

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var brl = function (v) { return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  /* ---------- topo sólido ao rolar ---------- */
  var topo = $('.topo');
  var aoRolar = function () { topo.classList.toggle('solido', window.scrollY > 40); };
  window.addEventListener('scroll', aoRolar, { passive: true }); aoRolar();

  /* ---------- contagem regressiva ---------- */
  var cont = $('#contagem');
  function tique() {
    var falta = CURSO - Date.now();
    if (falta <= 0) { cont.hidden = true; return; }
    var d = Math.floor(falta / 864e5), h = Math.floor(falta / 36e5) % 24, m = Math.floor(falta / 6e4) % 60, s = Math.floor(falta / 1e3) % 60;
    var dois = function (n) { return String(n).padStart(2, '0'); };
    $('[data-c=d]', cont).textContent = d;
    $('[data-c=h]', cont).textContent = dois(h);
    $('[data-c=m]', cont).textContent = dois(m);
    $('[data-c=s]', cont).textContent = dois(s);
  }
  tique(); setInterval(tique, 1000);

  /* ---------- revelar ao rolar ---------- */
  var revelas = $$('.revela');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var irmaos = $$('.revela', e.target.parentNode), i = irmaos.indexOf(e.target);
        e.target.style.transitionDelay = Math.max(0, i) * 80 + 'ms';
        e.target.classList.add('visto'); io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    revelas.forEach(function (el) { io.observe(el); });
  } else revelas.forEach(function (el) { el.classList.add('visto'); });

  /* ---------- config do pagamento ---------- */
  function aplicarConfig() {
    if (!cfg.enabled) {
      // sem pagamento ligado: os botões levam para o WhatsApp da academia
      $$('[data-cta]').forEach(function (a) { a.href = ZAP; a.target = '_blank'; a.rel = 'noopener'; });
      $('#cta-principal').textContent = 'Quero me inscrever pelo WhatsApp';
      $('.ingresso__seg').textContent = 'A academia confirma a inscrição e o pagamento por lá.';
      return;
    }
    $('#valor-num').textContent = brl(cfg.valor);
    $('#valor').hidden = false; $('#valor-nota').hidden = false;
    $('#preco-pix').textContent = '· R$ ' + brl(cfg.valor);
    var parc = cfg.maxParcelas > 1 ? ' · até ' + cfg.maxParcelas + 'x' : '';
    $('#preco-cartao').textContent = '· R$ ' + brl(cfg.valorCartao) + parc;
    if (cfg.esgotado) {
      $$('[data-cta]').forEach(function (a) { a.textContent = 'Vagas esgotadas'; a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); a.style.pointerEvents = 'none'; a.style.opacity = '.5'; });
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

  /* ---------- modal ---------- */
  var pay = $('#pay'), form = $('#pay-form'), erro = $('.pay__erro', pay), poll = null, ultimoFoco = null;
  function passo(nome) { $$('.pay__passo', pay).forEach(function (p) { p.hidden = p.dataset.step !== nome; }); }
  function abrir() {
    ultimoFoco = document.activeElement;
    passo('form'); erro.hidden = true; pay.hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(function () { form.nome.focus(); }, 50);
  }
  function fechar() {
    pay.hidden = true; document.body.style.overflow = ''; clearInterval(poll);
    if (ultimoFoco) ultimoFoco.focus();
  }
  document.addEventListener('click', function (e) {
    var cta = e.target.closest('[data-cta]');
    if (cta && cfg.enabled && !cfg.esgotado) { e.preventDefault(); abrir(); return; }
    if (e.target.closest('[data-close]')) fechar();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pay.hidden) fechar(); });

  // máscara do WhatsApp
  form.whatsapp.addEventListener('input', function () {
    var d = this.value.replace(/\D/g, '').slice(0, 11), r = d;
    if (d.length > 2) r = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) r = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
    this.value = r;
  });

  function dados() {
    var nivel = $('input[name=nivel]:checked', form);
    return { nome: form.nome.value.trim(), whatsapp: form.whatsapp.value, email: form.email.value.trim(), nivel: nivel ? nivel.value : '' };
  }
  function validar(d) {
    $$('input', form).forEach(function (i) { i.classList.remove('invalido'); });
    var falha = null;
    if (d.nome.split(/\s+/).length < 2) falha = [form.nome, 'Escreva o nome completo, do jeito que vai sair no certificado.'];
    else if (d.whatsapp.replace(/\D/g, '').length < 10) falha = [form.whatsapp, 'Confira o WhatsApp com DDD.'];
    else if (!/.+@.+\..+/.test(d.email)) falha = [form.email, 'Confira o e-mail.'];
    if (!falha) return true;
    falha[0].classList.add('invalido'); falha[0].focus(); mostraErro(falha[1]); return false;
  }
  function mostraErro(t) { erro.textContent = t; erro.hidden = false; }
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

  // PIX
  form.addEventListener('submit', function (e) {
    e.preventDefault(); erro.hidden = true;
    var d = dados(); if (!validar(d)) return;
    ocupado(true);
    post('inscrever', d).then(function (j) {
      ocupado(false);
      if (!j._ok || !j.qr_code) { mostraErro(falhou(j)); return; }
      var img = $('.pay__qr', pay);
      img.src = 'data:image/png;base64,' + j.qr_code_base64;
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

  // cartão → Checkout Pro do Mercado Pago
  $('[data-cartao]', form).addEventListener('click', function () {
    erro.hidden = true;
    var d = dados(); if (!validar(d)) return;
    ocupado(true);
    post('cartao', d).then(function (j) {
      if (!j._ok || !j.init_point) { ocupado(false); mostraErro(falhou(j)); return; }
      location.href = j.init_point;
    }).catch(function () { ocupado(false); mostraErro(falhou()); });
  });

  // voltou do cartão com falha
  voltouFalha = /[?&]pagamento=falhou/.test(location.search);
})();
