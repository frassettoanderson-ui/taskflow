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

// ── Parallax sutil no hero ──
const heroBg = document.querySelector('[data-parallax]');
if (heroBg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y < window.innerHeight) heroBg.style.transform = `translateY(${y * 0.18}px) scale(1.05)`;
  }, { passive: true });
}
