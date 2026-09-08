/* ═══ Imersão Bravos ═══ */

// ── CONFIG ──────────────────────────────────────────────
// Link do checkout (Kiwify). Enquanto vazio, o botão manda pro WhatsApp.
const CHECKOUT_URL = '';
const WHATSAPP = '5548996642223';
const EVENTO = new Date(2026, 9, 17, 15, 0, 0); // 17/10/2026 15h (mês 0-based)
// ────────────────────────────────────────────────────────

if (location.search.includes('capture')) document.documentElement.classList.add('capture');

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

// CTAs → checkout ou WhatsApp
const fallback = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá! Quero garantir minha vaga na Imersão Bravos (17/10).')}`;
$$('[data-cta]').forEach(a => {
  if (CHECKOUT_URL) { a.href = CHECKOUT_URL; a.target = '_blank'; a.rel = 'noopener'; }
  else if (a.getAttribute('href') === '#') { a.href = fallback; a.target = '_blank'; a.rel = 'noopener'; }
});

// Nav sólida + CTA fixo após o hero
const nav = $('#nav'), ctaFixo = $('#cta-fixo'), hero = $('#topo');
const onScroll = () => {
  const y = window.scrollY;
  nav.classList.toggle('solid', y > 40);
  ctaFixo.classList.toggle('on', y > hero.offsetHeight * .8);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Reveal no scroll
$$('.timeline .reveal').forEach((el, i) => el.style.setProperty('--i', i));
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
$$('.reveal').forEach(el => io.observe(el));

// Contagem regressiva (opcional — só roda se o bloco existir na página)
const countdown = $('#countdown');
if (countdown) {
  const cd = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]'), s: $('[data-cd="s"]') };
  const pad = n => String(Math.max(0, n)).padStart(2, '0');
  const tick = () => {
    const diff = EVENTO - Date.now();
    if (diff <= 0) { countdown.innerHTML = '<div><b>É hoje</b><i>Te esperamos às 15h</i></div>'; return; }
    const s = Math.floor(diff / 1000);
    cd.d.textContent = pad(Math.floor(s / 86400));
    cd.h.textContent = pad(Math.floor(s / 3600) % 24);
    cd.m.textContent = pad(Math.floor(s / 60) % 60);
    cd.s.textContent = pad(s % 60);
    setTimeout(tick, 1000);
  };
  tick();
}

$('#ano').textContent = new Date().getFullYear();
