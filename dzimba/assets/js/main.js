// Academia D'Zimba | interações e animações do site (v2)
(function () {
  'use strict';

  // ---- Modo campanha (opcional) ----
  // Troque para 'rosa' (outubro) ou 'azul' (novembro) para mudar a cor de destaque do site inteiro.
  // Deixe '' para o verde padrão. Com CAMPANHA_AUTO = true, o site troca sozinho em outubro e novembro.
  var CAMPANHA = '';
  var CAMPANHA_AUTO = false;

  // ---- Horários (hora de Brasília). Dia: 0 = domingo ... 6 = sábado ----
  var HORARIOS = {
    1: ['06:00', '22:00'], 2: ['06:00', '22:00'], 3: ['06:00', '22:00'],
    4: ['06:00', '22:00'], 5: ['06:00', '22:00'], 6: ['07:30', '11:30']
  };

  var html = document.documentElement;
  var agoraBR = horaBrasilia();

  if (CAMPANHA) html.setAttribute('data-campanha', CAMPANHA);
  else if (CAMPANHA_AUTO) {
    if (agoraBR.mes === 10) html.setAttribute('data-campanha', 'rosa');
    if (agoraBR.mes === 11) html.setAttribute('data-campanha', 'azul');
  }

  // ---- Banner do evento ----
  // Quando a landing do evento existir, coloque o endereço em EVENTO_URL (ex.: 'evento/').
  // Enquanto estiver vazio, o banner leva para o Instagram da academia.
  var EVENTO_URL = 'corrida/';
  var EVENTO_ESPERA = 4000; // milissegundos até o banner aparecer
  var aviso = document.getElementById('aviso');
  if (aviso) {
    var expirou = agoraBR.iso >= aviso.getAttribute('data-ate');
    var fechou = false;
    try { fechou = sessionStorage.getItem('dz-aviso-fechado') === '1'; } catch (e) {}
    if (EVENTO_URL) {
      var link = document.getElementById('aviso-link');
      link.href = EVENTO_URL; link.removeAttribute('target');
      document.getElementById('aviso-cta').firstChild.nodeValue = 'Garantir minha vaga ';
    }
    if (!expirou && !fechou) {
      setTimeout(function () {
        aviso.hidden = false;
        setTimeout(function () { aviso.classList.add('mostra'); }, 40);
      }, EVENTO_ESPERA);
    }
    document.getElementById('aviso-fechar').addEventListener('click', function () {
      aviso.classList.remove('mostra');
      setTimeout(function () { aviso.hidden = true; }, 500);
      try { sessionStorage.setItem('dz-aviso-fechado', '1'); } catch (e) {}
    });
  }

  // ---- Topo muda ao rolar + passarela lateral de progresso ----
  var topo = document.getElementById('topo');
  var trilho = document.getElementById('trilho');
  function aoRolar() {
    topo.classList.toggle('rolou', window.scrollY > 60);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    trilho.style.transform = 'scaleY(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
  }
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', aoRolar);

  // ---- Aberto agora / fechado ----
  var status = document.getElementById('status');
  var statusTopo = document.getElementById('status-topo');
  var dia = agoraBR.dia;
  var min = agoraBR.h * 60 + agoraBR.m;
  var hoje = HORARIOS[dia];

  document.querySelectorAll('.placar__linha').forEach(function (l) {
    if (l.getAttribute('data-dias').split(',').indexOf(String(dia)) > -1) l.classList.add('hoje');
  });

  if (hoje && min >= aMin(hoje[0]) && min < aMin(hoje[1])) {
    status.textContent = 'Aberto agora, fecha às ' + fmt(hoje[1]);
    status.className = 'status aberto';
    statusTopo.textContent = 'Aberto agora';
    statusTopo.classList.add('aberto');
  } else {
    var prox = proximaAbertura(dia, min);
    status.textContent = 'Fechado agora. Abre ' + prox;
    status.className = 'status fechado';
    statusTopo.textContent = 'Abre ' + prox;
  }

  function proximaAbertura(d, m) {
    if (HORARIOS[d] && m < aMin(HORARIOS[d][0])) return 'hoje às ' + fmt(HORARIOS[d][0]);
    for (var i = 1; i <= 7; i++) {
      var nd = (d + i) % 7;
      if (HORARIOS[nd]) {
        var quando = i === 1 ? 'amanhã' : ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][nd];
        return quando + ' às ' + fmt(HORARIOS[nd][0]);
      }
    }
    return '';
  }
  function aMin(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function fmt(t) { var p = t.split(':'); return (+p[0]) + 'h' + (p[1] === '00' ? '' : p[1]); }

  function horaBrasilia() {
    try {
      var partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit',
        year: 'numeric', month: '2-digit', day: '2-digit', hour12: false
      }).formatToParts(new Date());
      var o = {};
      partes.forEach(function (p) { o[p.type] = p.value; });
      var dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { dia: dias[o.weekday], h: +o.hour % 24, m: +o.minute, mes: +o.month, iso: o.year + '-' + o.month + '-' + o.day };
    } catch (e) {
      var d = new Date();
      var mm = ('0' + (d.getMonth() + 1)).slice(-2), dd = ('0' + d.getDate()).slice(-2);
      return { dia: d.getDay(), h: d.getHours(), m: d.getMinutes(), mes: d.getMonth() + 1, iso: d.getFullYear() + '-' + mm + '-' + dd };
    }
  }

  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();

  // ================= ANIMAÇÕES (GSAP + ScrollTrigger) =================
  if (!html.classList.contains('anima')) return;
  if (!window.gsap || !window.ScrollTrigger) { html.classList.remove('anima'); return; }

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);
  var ST = window.ScrollTrigger;

  // Entrada do herói
  var heroImg = document.querySelector('.hero__foto img');
  heroImg.classList.add('acende');
  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .to('.hero__onde', { opacity: 1, y: 0, duration: .6 }, .1)
    .to('.hero__titulo .linha > span', { y: 0, duration: 1.1, stagger: .1 }, .15)
    .fromTo('.hero__foto', { opacity: 0, y: 80, rotation: 5 }, { opacity: 1, y: 0, rotation: 0, duration: 1.3 }, .35)
    .fromTo('.hero__sub, .hero__acoes', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .8, stagger: .1 }, .8)
    .call(function () { heroImg.classList.add('aceso'); }, null, 1.2)
    .fromTo('.rabisco--hero', { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: .6, ease: 'back.out(2)' }, 1.9);

  // Herói ao rolar: a foto sobe mais devagar e a marca gigante desliza
  gsap.to('.hero__foto', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.fromTo('.hero__marca span', { xPercent: 6 }, { xPercent: -8, ease: 'none', scrollTrigger: { trigger: '.hero__marca', start: 'top bottom', end: 'bottom top', scrub: true } });

  // Fotos acendem (cinza → cor) quando entram na tela
  gsap.utils.toArray('.painel__foto img, .equipe__nitida').forEach(function (img) {
    img.classList.add('acende');
    ST.create({ trigger: img, start: 'top 70%', onEnter: function () { img.classList.add('aceso'); } });
  });

  // Números contando
  gsap.utils.toArray('.conta').forEach(function (el) {
    var ate = parseFloat(el.getAttribute('data-ate'));
    var casas = +(el.getAttribute('data-casas') || 0);
    var obj = { v: ate === 0 ? 9 : 0 };
    el.textContent = ate === 0 ? '9' : '0';
    gsap.to(obj, {
      v: ate, duration: 1.6, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: function () { el.textContent = obj.v.toFixed(casas).replace('.', ','); }
    });
  });

  // Títulos, blocos e textos sobem ao entrar
  gsap.utils.toArray('.titulo, .sobre, .voz, .aspas, .placar, .ferias, .local__orgulho, .local__mapa, .insta, .final h2, .equipe__txt > p, .turma__cab > p, .numero__rotulo').forEach(function (el) {
    gsap.from(el, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  // Placar: os números de LED "ligam"
  gsap.from('.led', { opacity: .1, duration: .12, repeat: 4, yoyo: true, stagger: .08, scrollTrigger: { trigger: '.placar', start: 'top 75%', once: true } });

  var mm = gsap.matchMedia();

  // ---- DESKTOP ----
  mm.add('(min-width: 761px)', function () {
    // Tour: a página trava e o espaço passa de lado
    var trilhoTour = document.getElementById('tour-trilho');
    var distancia = function () { return trilhoTour.scrollWidth - window.innerWidth; };
    var tween = gsap.to(trilhoTour, {
      x: function () { return -distancia(); }, ease: 'none',
      scrollTrigger: { trigger: '.tour', start: 'top top', end: function () { return '+=' + distancia(); }, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 }
    });
    // leve zoom em cada foto enquanto passa
    gsap.utils.toArray('.painel__foto img').forEach(function (img) {
      gsap.fromTo(img, { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });

    // Equipe: a foto abre como cortina e o fundo borrado anda devagar
    gsap.fromTo('.equipe__nitida', { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.4, ease: 'power4.inOut', scrollTrigger: { trigger: '.equipe__foto', start: 'top 70%', once: true } });
    gsap.fromTo('.equipe__borrao', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.equipe', start: 'top bottom', end: 'bottom top', scrub: true } });

    // Mural: as fotos começam empilhadas no meio e se espalham pelo mural
    var mural = document.getElementById('mural');
    var fotos = gsap.utils.toArray('.polaroid');
    var giros = [-14, 9, -6, 12, -10];
    gsap.from(fotos, {
      x: function (i, el) { var m = mural.getBoundingClientRect(), r = el.getBoundingClientRect(); return (m.left + m.width / 2) - (r.left + r.width / 2); },
      y: function (i, el) { var m = mural.getBoundingClientRect(), r = el.getBoundingClientRect(); return (m.top + m.height / 2) - (r.top + r.height / 2); },
      rotation: function (i) { return giros[i % giros.length]; },
      scale: .7, ease: 'power2.out', stagger: .04,
      scrollTrigger: { trigger: mural, start: 'top 80%', end: 'center 55%', scrub: 1, invalidateOnRefresh: true }
    });

    // Anilha rolando conforme a página desce
    gsap.fromTo('#anilha', { rotation: -200, x: 260 }, { rotation: 160, x: 0, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'bottom bottom', scrub: true } });

    // Marca do rodapé
    gsap.from('.rodape__marca', { yPercent: 40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.rodape', start: 'top bottom', end: 'top 40%', scrub: true } });
  });

  // ---- CELULAR ----
  mm.add('(max-width: 760px)', function () {
    gsap.utils.toArray('.polaroid').forEach(function (el, i) {
      gsap.from(el, { y: 80, rotation: i % 2 ? 10 : -10, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });
    gsap.from('.equipe__nitida', { scale: .85, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.equipe__foto', start: 'top 80%', once: true } });
    gsap.fromTo('#anilha', { rotation: -120 }, { rotation: 120, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  });

  // Menu de baixo marca a seção atual
  var links = Array.prototype.slice.call(document.querySelectorAll('.doca a[href^="#"]'));
  links.forEach(function (a) {
    var alvo = document.querySelector(a.getAttribute('href'));
    if (!alvo) return;
    ST.create({
      trigger: alvo, start: 'top 55%', end: 'bottom 55%',
      onToggle: function (s) { if (s.isActive) { links.forEach(function (l) { l.classList.remove('ativo'); }); a.classList.add('ativo'); } else a.classList.remove('ativo'); }
    });
  });

  // Recalcula depois que as fotos carregam (alturas mudam)
  window.addEventListener('load', function () { ST.refresh(); });
})();
