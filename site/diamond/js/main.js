/* ═══ Conferência Diamond ═══ */

const WHATSAPP = '5548996642223';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

// ── HERO: a árvore floresce com o scroll (sequência de frames em canvas) ──
(function () {
  const hero = $('#topo'), stick = $('.hero-stick', hero), canvas = $('#hero-canvas'), fallback = $('#hero-fallback');
  const title = $('#hero-title');
  if (!hero || !canvas) return;
  const N = 60;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const portrait = matchMedia('(max-aspect-ratio: 4/5)').matches;
  const set = portrait ? 'm' : 'w';
  const src = i => `img/frames/${set}/f_${String(i + 1).padStart(3, '0')}.webp`;
  const frames = new Array(N).fill(null);
  const ctx = canvas.getContext('2d', { alpha: false });
  let current = 0, drawn = -1, raf = 0;

  const ready = i => frames[i] && frames[i].complete && frames[i].naturalWidth > 0;
  const nearest = i => { for (let k = i; k >= 0; k--) if (ready(k)) return k; return -1; };

  // em telas paisagem, reserva uma faixa no topo (papel) pro título não cair em cima da copa
  // o vídeo novo já tem papel de sobra em cima; só reserva faixa em telas ultra-largas
  const headroom = a => a >= 2.3 ? .06 : 0;
  let topStops = null; // cores amostradas da linha de cima do 1º frame → preenchimento sem emenda
  function amostrarTopo(img) {
    try {
      const n = 12, c = document.createElement('canvas'); c.width = n; c.height = 1;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, img.naturalWidth, Math.max(1, Math.round(img.naturalHeight * .01)), 0, 0, n, 1);
      const d = x.getImageData(0, 0, n, 1).data;
      topStops = []; for (let i = 0; i < n; i++) topStops.push(`rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})`);
    } catch { topStops = null; }
  }
  // círculo do sol dentro do frame (medido nos frames): topo em fração da altura, raio em fração da largura
  const SUN = portrait ? { cx: .5, top: .173, r: .48 } : { cx: .5, top: .50, r: .265 };
  let geom = null; // posição do frame no canvas (px do canvas) → usado pra alinhar o arco ao sol
  let dpr = 1;
  function paint(img) {
    const cw = canvas.width, ch = canvas.height, iw = img.naturalWidth, ih = img.naturalHeight;
    const a = cw / ch, head = Math.round(ch * headroom(a));
    let s = Math.max(cw / iw, (ch - head) / ih), w = iw * s, h = ih * s;
    let x = (cw - w) / 2, y = head;
    if (head > 0) {
      if (topStops) {
        const g = ctx.createLinearGradient(0, 0, cw, 0);
        topStops.forEach((c, i) => g.addColorStop(i / (topStops.length - 1), c));
        ctx.fillStyle = g;
      } else ctx.fillStyle = '#F0D6C4';
      ctx.fillRect(0, 0, cw, head + 2);
    } else { y = (ch - h) / 2; }
    ctx.drawImage(img, x, y, w, h);
    const g2 = { s, x, y, iw, ih };
    if (!geom || geom.s !== s || geom.x !== x || geom.y !== y) { geom = g2; layoutHero(); }
  }

  // posiciona o texto curvo acompanhando o sol e garante que o título fique acima dele
  const arc = $('#hero-arc'), arcPath = arc && arc.querySelector('#arco'), arcTxt = arc && arc.querySelector('.arc-txt'), arcRef = arc && arc.querySelector('.arc-ref');
  const top = $('#hero-top');
  function layoutHero() {
    if (!arc || !geom) return;
    const W = stick.clientWidth, H = stick.clientHeight;
    const sc = geom.s / dpr;                                   // px do frame → px CSS
    const ox = geom.x / dpr, oy = geom.y / dpr;
    const cx = ox + SUN.cx * geom.iw * sc;
    const sunR = SUN.r * geom.iw * sc;
    const cy = oy + SUN.top * geom.ih * sc + sunR;
    arc.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // onde termina o bloco título+eyebrow (medido com o tamanho natural)
    if (title) title.style.fontSize = '';
    const sr = stick.getBoundingClientRect();
    const tr = top ? top.getBoundingClientRect() : sr;
    const topo = tr.top - sr.top, base = tr.bottom - sr.top;

    // fonte proporcional ao sol; no desktop o texto fica logo FORA do disco (halo);
    // no celular o sol é enorme e começa no topo, então o arco fica concêntrico mas POR DENTRO do disco, abaixo do título
    let f = Math.max(14, Math.min(portrait ? 24 : 36, sunR * (portrait ? .082 : .095)));
    let R, alpha, len;
    const maxA = portrait ? 1.7 : 1.25;                        // meio-ângulo máximo (~97° / ~72°)
    for (let i = 0; i < 5; i++) {
      R = sunR + f * .55;
      if (portrait) R = Math.max(sunR * .5, Math.min(R, cy - base - f * 1.15 - 6));
      arcTxt.style.fontSize = f + 'px';
      arcTxt.style.letterSpacing = (f * .26) + 'px';
      arcPath.setAttribute('d', `M ${cx - 4000} ${cy} A 4000 4000 0 0 1 ${cx + 4000} ${cy}`); // provisório, só pra medir
      len = arcTxt.getComputedTextLength();
      alpha = (len * 1.04) / (2 * R);
      if (alpha <= maxA) break;
      f = Math.max(13, f * (maxA / alpha) * .98);
    }
    const p = t => [cx + R * Math.sin(t), cy - R * Math.cos(t)];
    const [x1, y1] = p(-alpha), [x2, y2] = p(alpha);
    arcPath.setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R.toFixed(1)} ${R.toFixed(1)} 0 ${alpha > Math.PI / 2 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
    // referência bíblica logo abaixo do arco
    arcRef.style.fontSize = Math.max(10, f * .42) + 'px';
    arcRef.style.letterSpacing = (f * .14) + 'px';
    arcRef.setAttribute('x', cx.toFixed(1));
    arcRef.setAttribute('y', (cy - R + f * 1.15).toFixed(1));

    // desktop: se o título invadir o arco, reduz o título
    if (!portrait && top && title) {
      const limite = cy - R - f * 1.05 - 6;
      if (base > limite && base > topo) {
        const fs = parseFloat(getComputedStyle(title).fontSize);
        const k = Math.max(.45, (limite - topo) / (base - topo));
        title.style.fontSize = (fs * k).toFixed(1) + 'px';
      }
    }
  }
  function draw(force) {
    const k = nearest(current);
    if (k < 0 || (k === drawn && !force)) return;
    paint(frames[k]); drawn = k;
    if (fallback && !fallback.hidden) fallback.hidden = true;
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(stick.clientWidth * dpr);
    canvas.height = Math.round(stick.clientHeight * dpr);
    geom = null;
    draw(true);
  }

  // carrega o 1º frame já; o resto em fila (4 por vez), na ordem
  function load(i) {
    return new Promise(res => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { frames[i] = img; if (i <= current && i > drawn) draw(); res(); };
      img.onerror = res;
      img.src = src(i);
    });
  }
  async function loadAll() {
    await load(0); if (frames[0]) amostrarTopo(frames[0]); draw(true);
    let next = 1;
    const worker = async () => { while (next < N) { const i = next++; await load(i); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    draw(true);
  }

  function progress() {
    const rect = hero.getBoundingClientRect();
    const total = hero.offsetHeight - stick.offsetHeight;
    return total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
  }
  function tick() {
    raf = 0;
    const p = reduce ? 1 : progress();
    current = Math.round(p * (N - 1));
    draw();
    hero.classList.toggle('done', p > .85);
    if (title) title.style.transform = `scale(${1 - p * .05}) translateY(${p * -8}px)`;
  }
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };

  if (reduce) { hero.style.height = '100vh'; current = N - 1; }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { resize(); onScroll(); });
  resize();
  loadAll();
  tick();
})();

// ── nav sólida + CTA fixo ──
const nav = $('#nav'), ctaFixo = $('#cta-fixo');
const onScrollUi = () => {
  const y = window.scrollY;
  if (nav) nav.classList.toggle('solid', y > 60);
  // CTA flutuante entra depois do hero (não tem mais barra fixa no topo)
  if (ctaFixo) ctaFixo.classList.toggle('on', y > window.innerHeight * 1.6);
};
window.addEventListener('scroll', onScrollUi, { passive: true });
onScrollUi();

// ── reveal ──
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
$$('.reveal').forEach(el => io.observe(el));

$('#ano').textContent = new Date().getFullYear();

// ── inscrição com pagamento (Mercado Pago) ──
(function () {
  const pay = $('#pay');
  if (!pay) return;
  const API = 'api';
  const fallback = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Quero garantir minha vaga na Conferência Diamond (23 e 24/10).')}`;
  let enabled = false, poll = null, grupoLink = '';

  $$('[data-cta]').forEach(a => { if (a.getAttribute('href') === '#') { a.href = fallback; a.target = '_blank'; a.rel = 'noopener'; } });

  fetch(API + '/config').then(r => r.json()).then(c => {
    enabled = !!c.enabled;
    if (c.valorCartao) {
      const v = Number(c.valorCartao).toFixed(2).replace('.', ',');
      const txt = 'No cartão: R$ ' + v + (c.maxParcelas > 1 ? ' · em até ' + c.maxParcelas + 'x' : '') + ' (taxas da operadora inclusas)';
      const nota = $('.pay-cartao-nota'); if (nota) { nota.textContent = txt; nota.hidden = false; }
      const pc = $('#preco-cartao'); if (pc) { pc.textContent = txt; pc.hidden = false; }
    }
  }).catch(() => {});

  const steps = $$('.pay-step', pay);
  const show = name => { pay.hidden = false; document.body.style.overflow = 'hidden'; steps.forEach(s => s.hidden = s.dataset.step !== name); };
  const close = () => { pay.hidden = true; document.body.style.overflow = ''; if (poll) clearInterval(poll); };

  $$('[data-cta]').forEach(a => a.addEventListener('click', e => {
    if (!enabled) return; // pagamento ainda não configurado → segue pro WhatsApp / âncora
    e.preventDefault();
    $('.pay-erro').hidden = true;
    show('form');
  }));
  pay.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pay.hidden) close(); });

  if (new URLSearchParams(location.search).get('pagamento') === 'falhou') {
    show('form');
    const er = $('.pay-erro');
    er.textContent = 'O cartão não foi aprovado. Tente outro cartão — ou pague pelo PIX, que é aprovado na hora.';
    er.hidden = false;
    history.replaceState(null, '', location.pathname);
  }

  const form = $('#pay-form');
  const erro = $('.pay-erro');
  const setLoading = (btn, on, txt) => { btn.disabled = on; btn.dataset._t = btn.dataset._t || btn.textContent; btn.textContent = on ? (txt || 'Processando…') : btn.dataset._t; };
  const dados = () => ({ nome: form.nome.value, whatsapp: form.whatsapp.value, email: form.email.value });
  const valida = () => {
    if (form.nome.value.trim().length < 3) return 'Digite seu nome completo.';
    if (form.whatsapp.value.replace(/\D/g, '').length < 10) return 'WhatsApp inválido (com DDD).';
    if (!/.+@.+\..+/.test(form.email.value)) return 'E-mail inválido.';
    return null;
  };

  // máscara simples do WhatsApp
  form.whatsapp.addEventListener('input', () => {
    let d = form.whatsapp.value.replace(/\D/g, '').slice(0, 11);
    form.whatsapp.value = d.length <= 2 ? d : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  });

  const confirmar = s => {
    clearInterval(poll);
    const g = $('#pay-grupo');
    grupoLink = s.grupo || grupoLink;
    if (grupoLink) { g.href = grupoLink; g.hidden = false; }
    else { g.href = fallback; g.textContent = 'Falar no WhatsApp'; }
    show('ok');
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = valida(); if (v) { erro.textContent = v; erro.hidden = false; return; }
    erro.hidden = true;
    const btn = $('[data-pix]', form); setLoading(btn, true, 'Gerando PIX…');
    try {
      const r = await fetch(API + '/inscrever', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados()) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detalhe || 'Não foi possível gerar o PIX.');
      $('.pay-qr').src = 'data:image/png;base64,' + d.qr_code_base64;
      $('.pay-copy').dataset.code = d.qr_code || '';
      show('pix');
      poll = setInterval(async () => {
        const s = await fetch(API + '/status/' + d.id).then(r => r.json()).catch(() => ({}));
        if (s.status === 'approved') confirmar(s);
      }, 3500);
    } catch (err) { erro.textContent = err.message; erro.hidden = false; }
    finally { setLoading(btn, false); }
  });

  $('[data-cartao]', form).addEventListener('click', async () => {
    const v = valida(); if (v) { erro.textContent = v; erro.hidden = false; return; }
    erro.hidden = true;
    const btn = $('[data-cartao]', form); setLoading(btn, true, 'Abrindo…');
    try {
      const r = await fetch(API + '/cartao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados()) });
      const d = await r.json();
      if (!r.ok || !d.init_point) throw new Error('Não foi possível abrir o cartão.');
      location.href = d.init_point;
    } catch (err) { erro.textContent = err.message; erro.hidden = false; setLoading(btn, false); }
  });

  $('.pay-copy').addEventListener('click', function () {
    const code = this.dataset.code || '';
    navigator.clipboard.writeText(code).then(() => {
      this.classList.add('copiado'); const t = this.textContent; this.textContent = 'Código copiado ✓';
      setTimeout(() => { this.classList.remove('copiado'); this.textContent = t; }, 2000);
    });
  });
})();
