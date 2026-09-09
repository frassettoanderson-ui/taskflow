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

/* ── inscrição com pagamento (Mercado Pago) ── */
(function () {
  const pay = $('#pay');
  if (!pay) return;
  const API = 'api';
  let enabled = false, poll = null;

  fetch(API + '/config').then(r => r.json()).then(c => {
    enabled = !!c.enabled;
    const nota = $('.pay-cartao-nota');
    if (nota && c.valorCartao) {
      const v = Number(c.valorCartao).toFixed(2).replace('.', ',');
      nota.textContent = 'No cartão: R$ ' + v + ' · em até ' + (c.maxParcelas || 3) + 'x';
      nota.hidden = false;
    }
  }).catch(() => {});

  const steps = $$('.pay-step', pay);
  const show = name => { pay.hidden = false; document.body.style.overflow = 'hidden'; steps.forEach(s => s.hidden = s.dataset.step !== name); };
  const close = () => { pay.hidden = true; document.body.style.overflow = ''; if (poll) clearInterval(poll); };

  // intercepta os CTAs: se o pagamento está ativo, abre o modal; senão mantém o fallback (WhatsApp/checkout)
  $$('[data-cta]').forEach(a => a.addEventListener('click', e => {
    if (!enabled) return; // deixa o href (WhatsApp) agir
    e.preventDefault();
    $('.pay-erro').hidden = true;
    show('form');
  }));

  pay.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });

  // voltou do cartão recusado → reabre o formulário explicando o que fazer
  if (new URLSearchParams(location.search).get('pagamento') === 'falhou') {
    show('form');
    const er = $('.pay-erro');
    er.textContent = 'O cartão não foi aprovado. Tente entrar na sua conta do Mercado Pago antes de pagar, use outro cartão — ou pague pelo PIX, que é aprovado na hora.';
    er.hidden = false;
    history.replaceState(null, '', location.pathname);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pay.hidden) close(); });

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
        if (s.status === 'approved') {
          clearInterval(poll);
          const g = $('#pay-grupo');
          if (s.grupo) g.href = s.grupo; else { g.href = fallback; g.textContent = 'Falar no WhatsApp'; }
          show('ok');
        }
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
