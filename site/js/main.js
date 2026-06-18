// ── Ano no rodapé ──
document.getElementById('ano').textContent = new Date().getFullYear();

// ── Nav: fundo ao rolar + menu mobile ──
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 30);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const burger = document.getElementById('nav-burger');
burger.addEventListener('click', () => nav.classList.toggle('open'));
document.querySelectorAll('#nav-links a').forEach((a) =>
  a.addEventListener('click', () => nav.classList.remove('open'))
);

// ── Reveal no scroll (IntersectionObserver) ──
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ── Contadores animados ──
const animarContador = (el) => {
  const alvo = Number(el.dataset.count) || 0;
  const dur = 1600;
  const t0 = performance.now();
  const sufixo = alvo >= 100 ? '+' : '';
  const passo = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(alvo * eased) + (p === 1 ? sufixo : '');
    if (p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
};
const ioCount = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { animarContador(e.target); ioCount.unobserve(e.target); }
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach((el) => ioCount.observe(el));

// ── Galeria Bento + Lightbox com dock ──
const GALERIA = [
  { url: 'img/IMG_4195.JPG', t: 'Adoração',    d: 'Mãos levantadas em entrega',     cls: 'b1' },
  { url: 'img/IMG_4196.JPG', t: 'Comunhão',    d: 'Juntos, somos uma família',      cls: 'b2' },
  { url: 'img/IMG_4236.JPG', t: 'Louvor',      d: 'Uma só voz pra exaltar a Deus',  cls: 'b3' },
  { url: 'img/IMG_4270.JPG', t: 'Celebração',  d: 'Cada culto, uma festa',          cls: 'b4' },
  { url: 'img/IMG_5138.JPG', t: 'Oração',      d: 'Buscando a presença de Deus',    cls: 'b5' },
  { url: 'img/IMG_6147.JPG', t: 'Família',     d: 'Há lugar pra você aqui',         cls: 'b6' },
];
const bento = document.getElementById('bento');
if (bento) {
  bento.innerHTML = GALERIA.map((g, i) =>
    `<button class="bento-item ${g.cls} reveal" data-i="${i}" style="background-image:url('${g.url}')" aria-label="${g.t}">
       <span class="bento-cap"><strong>${g.t}</strong><small>${g.d}</small></span>
     </button>`).join('');
  bento.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  const lb = document.createElement('div');
  lb.className = 'lb';
  lb.innerHTML = `
    <div class="lb-stage">
      <button class="lb-close" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <img class="lb-img" alt="" />
      <div class="lb-cap"><strong></strong><small></small></div>
    </div>
    <div class="lb-dock"></div>`;
  document.body.appendChild(lb);

  const img = lb.querySelector('.lb-img');
  const capT = lb.querySelector('.lb-cap strong');
  const capD = lb.querySelector('.lb-cap small');
  const dock = lb.querySelector('.lb-dock');
  dock.innerHTML = GALERIA.map((g, i) =>
    `<button class="lb-thumb" data-i="${i}" style="background-image:url('${g.url}')" aria-label="${g.t}"></button>`).join('');

  let cur = 0;
  const show = (i) => {
    cur = (i + GALERIA.length) % GALERIA.length;
    const g = GALERIA[cur];
    img.src = g.url; img.alt = g.t;
    capT.textContent = g.t; capD.textContent = g.d;
    dock.querySelectorAll('.lb-thumb').forEach((t, k) => t.classList.toggle('active', k === cur));
  };
  const abrir = (i) => { show(i); lb.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const fechar = () => { lb.classList.remove('open'); document.body.style.overflow = ''; };

  bento.querySelectorAll('.bento-item').forEach((b) => b.addEventListener('click', () => abrir(Number(b.dataset.i))));
  dock.querySelectorAll('.lb-thumb').forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.i))));
  lb.querySelector('.lb-close').addEventListener('click', fechar);
  lb.addEventListener('click', (e) => { if (e.target === lb) fechar(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') fechar();
    else if (e.key === 'ArrowRight') show(cur + 1);
    else if (e.key === 'ArrowLeft') show(cur - 1);
  });
}

// ── Zoom Parallax (colagem que dá zoom no scroll) ──
const zp = document.querySelector('.zoom-parallax');
if (zp && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const els = zp.querySelectorAll('.zp-el');
  const title = zp.querySelector('.zp-title');
  const maxScales = [4, 5, 6, 5, 6, 8, 9];
  let ticking = false;
  const update = () => {
    const rect = zp.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    let p = total > 0 ? -rect.top / total : 0;
    p = Math.max(0, Math.min(1, p));
    els.forEach((el, i) => {
      const m = maxScales[i % maxScales.length];
      el.style.transform = `scale(${1 + p * (m - 1)})`;
    });
    if (title) title.style.opacity = String(Math.max(0, 1 - p * 2.5));
    ticking = false;
  };
  const onScrollZP = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  update();
  window.addEventListener('scroll', onScrollZP, { passive: true });
  window.addEventListener('resize', update);
}

// ── Parallax sutil no hero ──
const heroBg = document.querySelector('[data-parallax]');
if (heroBg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y < window.innerHeight) heroBg.style.transform = `translateY(${y * 0.18}px) scale(1.05)`;
  }, { passive: true });
}
