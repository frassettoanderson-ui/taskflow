/* Kypá — demo de loja. Motion com GSAP; carrinho em localStorage (sem checkout real). */
(() => {
  const P = window.KYPA_PRODUTOS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const img = n => `assets/img/recortes/${n}.webp`;
  const foto = n => `assets/img/produtos/${n}.jpg`;
  const hasGsap = !!window.gsap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LINHAS = [
    { id: 'tutano', nome: 'Tutano', cor: '#F58233', para: 'Ressecados e danificados', desc: 'Semente de uva, óleo de mamona, vitamina E e colágeno. Nutrição profunda que transforma fios ásperos em fios sedosos.', trio: ['shampoo-tutano-300ml', 'mascara-tutano-250g', 'leave-in-tutano-200g'] },
    { id: 'forca-total', nome: 'Força Total', cor: '#F5AE1A', para: 'Fracos e com queda', desc: 'Fortalecimento e crescimento dos fios. Penetra na fibra capilar e devolve resistência a fios quebradiços.', trio: ['shampoo-forca-total-300ml', 'mascara-forca-total-250g', 'fortalecedor-forca-total-40ml'] },
    { id: 'jaborandi', nome: 'Jaborandi', cor: '#8FB800', para: 'Oleosos e com caspa', desc: 'Extratos vegetais e óleo de melaleuca para controlar a oleosidade e reduzir a queda desde a raiz.', trio: ['shampoo-jaborandi-300ml', 'condicionador-jaborandi-300ml', 'tonico-jaborandi-130ml'] },
    { id: 'mais-cachos', nome: 'Mais Cachos', cor: '#3FB8AC', para: 'Crespos e volumosos com frizz', desc: 'Reduz o volume, controla o frizz e devolve balanço natural a cachos e crespos. A antiga Volume Redux.', trio: ['shampoo-mais-cachos-300ml', 'mascara-mais-cachos-250g', 'leave-in-mais-cachos-200g'] },
    { id: 'mandioca', nome: 'Mandioca', cor: '#DC5E36', para: 'Ressecados e sem brilho', desc: 'Ação doadora de brilho e estímulo ao crescimento saudável. Maciez que se sente ao toque.', trio: ['shampoo-mandioca-300ml', 'mascara-mandioca-250g', 'reparador-mandioca-30ml'] },
    { id: 'queratina', nome: 'Queratina', cor: '#E8303F', para: 'Mistos e tingidos', desc: 'Reposição de queratina que blinda o fio e prolonga a cor. Proteção para cabelos quimicamente tratados.', trio: ['shampoo-queratina-300ml', 'mascara-queratina-250g', 'queratina-liquida-100ml'] },
    { id: 'matte-plus', nome: 'Matte Plus', cor: '#8C76C9', para: 'Loiros, grisalhos e mechados', desc: 'Neutraliza o amarelado, protege contra a oxidação química e realça o brilho do loiro.', trio: ['shampoo-matte-plus-300ml', 'mascara-matte-plus-250g'] },
    { id: 'revitalize', nome: 'Revitalize', cor: '#F2553A', para: 'Danificados e sem vida', desc: 'Reconstrução e ultra hidratação. Recupera fios fragilizados e devolve movimento natural.', trio: ['shampoo-revitalize-300ml', 'mascara-revitalize-250g', 'serum-revitalize-30ml'] },
    { id: 'ultra-liso', nome: 'Ultra Liso', cor: '#E3196F', para: 'Lisos e alinhados', desc: 'Alinhamento e liso absoluto. Hidrata, realinha e elimina o frizz para um liso que dura.', trio: ['shampoo-ultra-liso-300ml', 'mascara-ultra-liso-250g', 'fluido-ultra-liso-130ml'] },
    { id: 'cachos-leves', nome: 'Cachos + Leves', cor: '#12AEDD', para: 'Cacheados e finos', desc: 'Equilíbrio entre hidratação profunda e definição, sem pesar. Feita para cachos finos.', trio: ['shampoo-cachos-leves-300ml', 'condicionador-cachos-leves'] },
    { id: 'ultra-repair', nome: 'Ultra Repair', cor: '#8E97D6', para: 'Cuidados especiais', desc: 'Cauterização e reparo total para cabelos extremamente danificados. Densidade e brilho de volta.', trio: ['shampoo-ultra-repair-300ml', 'mascara-ultra-repair-250g', 'cauterizador-ultra-repair-130ml'] },
  ];
  const L = Object.fromEntries(LINHAS.map(l => [l.id, l]));
  const byId = Object.fromEntries(P.map(p => [p.id, p]));
  const cor = p => (L[p.linha] || {}).cor || '#6E9B22';
  const curto = t => (t && t.length > 70 ? '' : t);
  const setC = (el, c) => el.style.setProperty('--c', c);

  /* ---------------- HERO MOTION ---------------- */
  const stage = $('#heroStage'), prods = $('#heroProducts'), ghost = $('#heroGhost');
  const bandA = $('#bandA'), bandB = $('#bandB');
  const DUR = 4800;
  let hi = 0, timer, barTween;

  function heroImgs(l) {
    const cls = ['p-main', 'p-left', 'p-right'];
    // ordem: principal (frasco), máscara à frente-esquerda, terceiro à direita
    return l.trio.map((n, k) => {
      const el = new Image();
      el.src = img(n); el.alt = byId[P.find(p => p.img === n)?.id]?.nome || l.nome;
      el.className = cls[k]; el.decoding = 'async';
      const tall = () => el.naturalHeight / el.naturalWidth > 1.8 && el.classList.add('is-tall');
      el.complete ? tall() : el.onload = tall;
      return el;
    });
  }
  // pré-carrega tudo do hero
  LINHAS.forEach(l => l.trio.forEach(n => { const i = new Image(); i.src = img(n); }));

  function showLine(i, dir = 1, first = false) {
    hi = (i + LINHAS.length) % LINHAS.length;
    const l = LINHAS[hi];
    const root = document.documentElement;

    $('#heroNum').textContent = String(hi + 1).padStart(2, '0');
    $('#heroPara').textContent = l.para;
    $('#heroLinhaNome').textContent = l.nome;
    $('#heroVerLinha').onclick = e => { e.preventDefault(); selectLine(l.id); $('#linhas').scrollIntoView({ behavior: 'smooth' }); };

    const old = [...prods.children];
    const neu = heroImgs(l);

    if (!hasGsap || reduce) {
      root.style.setProperty('--c', l.cor);
      prods.replaceChildren(...neu); ghost.textContent = l.nome;
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    // saída dos frascos atuais
    if (old.length) tl.to(old, { y: -60, rotate: dir * -10, opacity: 0, duration: .45, stagger: .05, ease: 'power2.in', onComplete: () => old.forEach(o => o.remove()) }, 0);
    // faixa nova varre por cima da antiga (wipe diagonal)
    bandB.style.background = l.cor;
    tl.fromTo(bandB, { clipPath: dir > 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0% 0 0%)', duration: first ? .9 : .8, ease: 'expo.inOut' }, first ? 0 : .15)
      .add(() => { bandA.style.background = l.cor; gsap.set(bandB, { clipPath: 'inset(0 100% 0 0)' }); root.style.setProperty('--c', l.cor); });
    tl.add(() => root.style.setProperty('--c', l.cor), first ? 0 : .35);
    // palavra fantasma
    tl.to(ghost, { xPercent: dir * -12, opacity: 0, duration: .35, ease: 'power2.in' }, 0)
      .add(() => { ghost.textContent = l.nome; })
      .fromTo(ghost, { xPercent: dir * 14, opacity: 0 }, { xPercent: 0, opacity: .55, duration: 1.1, ease: 'expo.out' }, first ? .2 : .5);
    // entrada: cai com leve giro e assenta (back.out)
    prods.append(...neu);
    tl.fromTo(neu, { y: 140, opacity: 0, rotate: k => (k ? (k === 1 ? -14 : 12) : dir * 6) },
      { y: 0, opacity: 1, rotate: 0, duration: 1.05, ease: 'back.out(1.5)', stagger: { each: .09, from: 'start' } }, first ? .25 : .55);

    // barra de progresso
    barTween && barTween.kill();
    barTween = gsap.fromTo('#heroBar', { width: '0%' }, { width: '100%', duration: DUR / 1000, ease: 'none' });
  }
  function next(d = 1) { showLine(hi + d, d); restart(); }
  function restart() { clearInterval(timer); timer = setInterval(() => showLine(hi + 1, 1), DUR); }
  $('#heroNext').onclick = () => next(1);
  $('#heroPrev').onclick = () => next(-1);

  // flutuação sutil com o mouse (parallax)
  if (hasGsap && !reduce && matchMedia('(pointer:fine)').matches) {
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      gsap.to(prods, { x: x * 22, y: y * 14, duration: .8, ease: 'power2.out' });
      gsap.to(ghost, { x: x * -40, duration: 1, ease: 'power2.out' });
      gsap.to('.hero__band', { y: y * 16, duration: 1, ease: 'power2.out' });
    });
  }
  // pausa quando fora da tela
  new IntersectionObserver(([en]) => { en.isIntersecting ? restart() : clearInterval(timer); }).observe(stage);

  /* ---------------- faixa de necessidades ---------------- */
  const needs = LINHAS.map(l => `<button class="need" style="--nc:${l.cor}" data-l="${l.id}"><i></i>${l.para}<small>${l.nome}</small></button>`).join('');
  $('#needsTrack').innerHTML = needs + needs;
  $('#needsTrack').addEventListener('click', e => {
    const b = e.target.closest('.need'); if (!b) return;
    selectLine(b.dataset.l); $('#linhas').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------------- LOJA ---------------- */
  const TIPOS = [['todos', 'Tudo'], ['kit', 'Kits'], ['shampoo', 'Shampoo'], ['condicionador', 'Condicionador'], ['mascara', 'Máscara'], ['leave-in', 'Leave-in'], ['tratamento', 'Tratamento']];
  const tipoGrupo = t => ['reparador', 'finalizador', 'tonico'].includes(t) ? 'tratamento' : t;
  let curLine = 'tutano', curTipo = 'todos';

  $('#rail').innerHTML = LINHAS.map(l => `<button class="chip" role="tab" style="--cc:${l.cor}" data-l="${l.id}"><i></i>${l.nome}</button>`).join('');
  $('#rail').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) selectLine(b.dataset.l); });
  $('#filters').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; curTipo = b.dataset.t; renderGrid(); });

  function cardHTML(p) {
    const tag = p.tipo === 'kit' ? 'Kit' : p.de ? 'Oferta' : '';
    return `<article class="card" style="--pc:${cor(p)}">
      ${tag ? `<span class="card__tag">${tag}</span>` : ''}
      <div class="card__media${p.tipo === 'kit' ? ' card__media--kit' : ''}" data-qv="${p.id}"><img src="${p.tipo === 'kit' ? foto(p.img) : img(p.img)}" alt="${p.nome}" loading="lazy"></div>
      <span class="card__line">${(L[p.linha] || {}).nome || ''}</span>
      <h4 class="card__name">${p.nome}</h4>
      <p class="card__para">${curto(p.para) || 'Para cabelos ' + ((L[p.linha] || {}).para || '').toLowerCase()}</p>
      <p class="card__price">${p.de ? `<s>${brl(p.de)}</s>` : ''}${brl(p.preco)}</p>
      <button class="add" data-add="${p.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>Adicionar</span></button>
    </article>`;
  }

  function selectLine(id) {
    curLine = id; curTipo = 'todos';
    const l = L[id], sec = $('#linhas');
    setC(sec, l.cor);
    $$('.chip').forEach(c => c.classList.toggle('is-on', c.dataset.l === id));
    const chip = $(`.chip[data-l="${id}"]`), rail = $('#rail');
    if (chip) rail.scrollTo({ left: chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
    $('#lineName').textContent = l.nome;
    $('#linePara').textContent = 'Para cabelos ' + l.para.toLowerCase();
    $('#lineDesc').textContent = l.desc;
    const li = $('#lineImg'); li.src = img(l.trio[1] || l.trio[0]); li.alt = 'Linha ' + l.nome;
    if (hasGsap && !reduce) {
      gsap.fromTo('.line-hero__band', { scaleX: 0 }, { scaleX: 1, duration: .9, ease: 'expo.out' });
      gsap.fromTo(['#lineName', '#linePara', '#lineDesc'], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .07, ease: 'power3.out' });
      gsap.fromTo(li, { y: 60, rotate: 8, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, duration: 1, ease: 'back.out(1.4)' });
    }
    renderGrid();
  }

  function renderGrid() {
    const inLine = P.filter(p => p.linha === curLine);
    const tipos = TIPOS.filter(([t]) => t === 'todos' || inLine.some(p => tipoGrupo(p.tipo) === t));
    $('#filters').innerHTML = tipos.map(([t, n]) => `<button data-t="${t}" class="${t === curTipo ? 'is-on' : ''}">${n}</button>`).join('');
    const ord = { kit: 0, shampoo: 1, condicionador: 2, mascara: 3, 'leave-in': 4 };
    const list = inLine.filter(p => curTipo === 'todos' || tipoGrupo(p.tipo) === curTipo)
      .sort((a, b) => (ord[a.tipo] ?? 5) - (ord[b.tipo] ?? 5) || a.preco - b.preco);
    const g = $('#grid'); g.innerHTML = list.map(cardHTML).join('');
    if (hasGsap && !reduce) gsap.fromTo(g.children, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .05, ease: 'power3.out' });
  }

  /* ---------------- KITS ---------------- */
  const kits = P.filter(p => p.tipo === 'kit').sort((a, b) => a.preco - b.preco);
  $('#kitsTrack').innerHTML = kits.map(p => {
    const off = p.de ? Math.round((1 - p.preco / p.de) * 100) : 0;
    return `<article class="kit" style="--pc:${cor(p)}">
      <div class="kit__media" data-qv="${p.id}"><img src="${foto(p.img)}" alt="${p.nome}" loading="lazy">${off ? `<span class="kit__off">-${off}%</span>` : ''}</div>
      <div class="kit__body">
        <span class="card__line">Linha ${(L[p.linha] || {}).nome || ''}</span>
        <h4 class="kit__name">${p.nome.replace(/^Kit\s+/i, '')}</h4>
        <p class="kit__price">${p.de ? `<s>${brl(p.de)}</s>` : ''}${brl(p.preco)}</p>
        <button class="add" data-add="${p.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>Adicionar kit</span></button>
      </div>
    </article>`;
  }).join('');
  const kt = $('#kitsTrack');
  $('#kitsNext').onclick = () => kt.scrollBy({ left: kt.clientWidth * .8 });
  $('#kitsPrev').onclick = () => kt.scrollBy({ left: -kt.clientWidth * .8 });

  /* ---------------- DIAGNÓSTICO ---------------- */
  const ans = {};
  const MAPA = { queda: 'forca-total', oleoso: 'jaborandi', ressecado: 'tutano', brilho: 'mandioca', quimica: 'revitalize', tingido: 'queratina', amarelado: 'matte-plus' };
  function recomenda() {
    if (ans.queixa === 'frizz') return ans.fio === 'crespo' ? 'mais-cachos' : ans.fio === 'cacheado' ? 'cachos-leves' : 'ultra-liso';
    if (ans.queixa === 'quimica' && (ans.fio === 'liso' || ans.fio === 'ondulado')) return 'ultra-repair';
    return MAPA[ans.queixa];
  }
  function goStep(n) {
    $$('.quiz__step').forEach(s => s.classList.toggle('is-active', +s.dataset.step === n));
    $$('.quiz__dots i').forEach((d, k) => d.classList.toggle('is-on', k === n - 1));
  }
  $('#quizSteps').addEventListener('click', e => {
    const b = e.target.closest('.quiz__opts button'); if (!b) return;
    const q = b.parentElement.dataset.q;
    $$('button', b.parentElement).forEach(x => x.classList.remove('is-picked'));
    b.classList.add('is-picked'); ans[q] = b.dataset.v;
    setTimeout(() => q === 'fio' ? goStep(2) : showResult(), 260);
  });
  function showResult() {
    const l = L[recomenda()];
    const kit = P.filter(p => p.linha === l.id && p.tipo === 'kit').sort((a, b) => a.preco - b.preco)[0];
    const alvo = kit || P.find(p => p.linha === l.id && p.tipo === 'shampoo');
    $('.quiz__card').style.setProperty('--qc', l.cor);
    $('#quizResult').innerHTML = `<div class="result" style="--rc:${l.cor}">
      <div class="result__visual"><img src="${img(l.trio[0])}" alt="${l.nome}"></div>
      <div class="result__txt">
        <small>Sua linha ideal</small>
        <h3>${l.nome}</h3>
        <p>${l.desc}</p>
        <p class="result__price">${alvo.nome}<br>${alvo.de ? `<s>${brl(alvo.de)}</s>` : ''}<b>${brl(alvo.preco)}</b></p>
        <div class="result__actions">
          <button class="btn btn--solid" data-add="${alvo.id}">Levar ${kit ? 'o kit' : 'agora'}</button>
          <button class="btn btn--line" data-goline="${l.id}">Ver a linha</button>
          <button class="link-btn" data-restart>Refazer</button>
        </div>
      </div></div>`;
    goStep(3);
  }
  $('#quizResult').addEventListener('click', e => {
    if (e.target.closest('[data-restart]')) { Object.keys(ans).forEach(k => delete ans[k]); $$('.is-picked').forEach(b => b.classList.remove('is-picked')); $('.quiz__card').style.removeProperty('--qc'); goStep(1); }
    const g = e.target.closest('[data-goline]'); if (g) { selectLine(g.dataset.goline); $('#linhas').scrollIntoView({ behavior: 'smooth' }); }
  });

  /* ---------------- SACOLA ---------------- */
  const FRETE = 199.90;
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem('kypa-cart') || '{}'); } catch (e) { }
  const save = () => { try { localStorage.setItem('kypa-cart', JSON.stringify(cart)); } catch (e) { } };

  function renderCart() {
    const ids = Object.keys(cart).filter(id => byId[id]);
    const qtd = ids.reduce((s, id) => s + cart[id], 0);
    const sub = ids.reduce((s, id) => s + cart[id] * byId[id].preco, 0);
    const cc = $('#cartCount'); cc.textContent = qtd; cc.classList.toggle('has', qtd > 0);
    $('#subtotal').textContent = brl(sub);
    const falta = FRETE - sub;
    $('#shipText').innerHTML = sub === 0 ? `Frete grátis acima de <b>${brl(FRETE)}</b>` : falta > 0 ? `Faltam <b>${brl(falta)}</b> para o frete grátis` : `<b>Oba! Seu frete é grátis.</b>`;
    $('#shipBar').style.width = Math.min(100, sub / FRETE * 100) + '%';
    $('#drawerItems').innerHTML = ids.length ? ids.map(id => {
      const p = byId[id];
      return `<div class="item" style="--pc:${cor(p)}">
        <div class="item__img"><img src="${p.tipo === 'kit' ? foto(p.img) : img(p.img)}" alt=""></div>
        <div><p class="item__name">${p.nome}</p><p class="item__price">${brl(p.preco)}</p>
          <div class="qty"><button data-q="-1" data-id="${id}" aria-label="Menos">−</button><span>${cart[id]}</span><button data-q="1" data-id="${id}" aria-label="Mais">+</button></div></div>
        <button class="item__rm" data-rm="${id}">Remover</button></div>`;
    }).join('') : `<div class="empty"><b>Sua sacola está vazia</b>Que tal começar pelo diagnóstico capilar?</div>`;
    $('#checkout').disabled = !ids.length; $('#checkout').style.opacity = ids.length ? 1 : .4;
  }
  function add(id, fromEl) {
    cart[id] = (cart[id] || 0) + 1; save(); renderCart();
    const cc = $('#cartCount'); cc.classList.remove('bump'); void cc.offsetWidth; cc.classList.add('bump');
    toast(`${byId[id].nome} na sacola`);
    if (fromEl && fromEl.classList.contains('add')) {
      fromEl.classList.add('is-done'); const s = fromEl.querySelector('span'); const t = s && s.textContent;
      if (s) s.textContent = 'Adicionado';
      setTimeout(() => { fromEl.classList.remove('is-done'); if (s) s.textContent = t; }, 1400);
    }
    flyToCart(fromEl, byId[id]);
  }
  // mini motion: o produto "voa" até a sacola
  function flyToCart(fromEl, p) {
    if (!hasGsap || reduce || !fromEl) return;
    const src = fromEl.closest('.card,.kit,.result,.modal__box')?.querySelector('img'); if (!src) return;
    const a = src.getBoundingClientRect(), b = $('#btnCarrinho').getBoundingClientRect();
    const f = new Image(); f.src = img(p.img);
    Object.assign(f.style, { position: 'fixed', left: a.left + a.width / 2 - 40 + 'px', top: a.top + a.height / 2 - 50 + 'px', width: '80px', height: '100px', objectFit: 'contain', zIndex: 120, pointerEvents: 'none' });
    document.body.appendChild(f);
    gsap.timeline({ onComplete: () => f.remove() })
      .to(f, { x: b.left - a.left - a.width / 2 + 58, duration: .8, ease: 'power1.inOut' }, 0)
      .to(f, { y: b.top - a.top - a.height / 2 + 40, duration: .8, ease: 'back.in(1.6)' }, 0)
      .to(f, { scale: .2, opacity: .2, rotate: 25, duration: .8, ease: 'power2.in' }, 0);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-add]'); if (a) add(a.dataset.add, a);
    const q = e.target.closest('[data-qv]'); if (q) openQV(q.dataset.qv);
    const qb = e.target.closest('#drawerItems [data-q]');
    if (qb) { const id = qb.dataset.id; cart[id] += +qb.dataset.q; if (cart[id] <= 0) delete cart[id]; save(); renderCart(); }
    const rm = e.target.closest('[data-rm]'); if (rm) { delete cart[rm.dataset.rm]; save(); renderCart(); }
  });
  const drawer = $('#drawer'), scrim = $('#scrim');
  const openDrawer = () => { drawer.classList.add('is-on'); scrim.classList.add('is-on'); drawer.setAttribute('aria-hidden', 'false'); };
  const closeAll = () => { [drawer, scrim, $('#modal'), $('#search'), $('#mnav')].forEach(x => x.classList.remove('is-on')); drawer.setAttribute('aria-hidden', 'true'); };
  $('#btnCarrinho').onclick = openDrawer;
  $('#drawerClose').onclick = closeAll; scrim.onclick = closeAll;
  $('#checkout').onclick = () => toast('Demonstração — o checkout será integrado na versão final');
  document.addEventListener('keydown', e => e.key === 'Escape' && closeAll());

  /* ---------------- QUICK VIEW ---------------- */
  function openQV(id) {
    const p = byId[id], l = L[p.linha] || {};
    const kit = p.tipo === 'kit';
    $('#modalBox').style.setProperty('--pc', cor(p));
    $('#modalBox').innerHTML = `
      <button class="icon-btn qv__close" data-close aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="qv__media"><img src="${img(p.img)}" alt="${p.nome}"></div>
      <div class="qv__body">
        <span class="card__line">Linha ${l.nome || ''}</span>
        <h3>${p.nome}</h3>
        <p style="color:var(--muted)">${p.para || 'Para cabelos ' + (l.para || '').toLowerCase()}</p>
        ${p.beneficios.length ? `<ul>${p.beneficios.map(b => `<li>${b}</li>`).join('')}</ul>` : `<p style="color:var(--muted)">${l.desc || ''}</p>`}
        <p class="card__price" style="font-size:1.5rem">${p.de ? `<s>${brl(p.de)}</s>` : ''}${brl(p.preco)}</p>
        <button class="btn btn--solid" data-add="${p.id}">Adicionar à sacola</button>
        <small style="color:var(--muted)">${kit ? 'Kit com 5% off · ' : ''}Frete grátis acima de ${brl(FRETE)}</small>
      </div>`;
    if (kit) $('.qv__media img', $('#modalBox')).src = foto(p.img);
    $('#modal').classList.add('is-on');
  }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeAll(); });

  /* ---------------- BUSCA ---------------- */
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  $('#btnBusca').onclick = () => { $('#search').classList.add('is-on'); setTimeout(() => $('#searchInput').focus(), 50); searchRender(''); };
  $('#search').addEventListener('click', e => { if (e.target.id === 'search') closeAll(); const b = e.target.closest('[data-sid]'); if (b) { closeAll(); openQV(b.dataset.sid); } });
  $('#searchInput').addEventListener('input', e => searchRender(e.target.value));
  function searchRender(q) {
    const n = norm(q.trim());
    const r = P.filter(p => !n || norm(p.nome + ' ' + ((L[p.linha] || {}).nome || '') + ' ' + p.para).includes(n)).slice(0, 12);
    $('#searchRes').innerHTML = r.map(p => `<button data-sid="${p.id}" style="--pc:${cor(p)}"><i></i><img src="${img(p.img)}" alt=""><span><b>${p.nome}</b><br><small>${brl(p.preco)}</small></span></button>`).join('') || '<p style="color:var(--muted)">Nada encontrado.</p>';
  }

  /* ---------------- menu / header ---------------- */
  $('#btnMenu').onclick = () => $('#mnav').classList.toggle('is-on');
  $$('#mnav a').forEach(a => a.onclick = () => $('#mnav').classList.remove('is-on'));
  const hdr = $('.header');
  addEventListener('scroll', () => hdr.classList.toggle('is-scrolled', scrollY > 10), { passive: true });

  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('is-on'), 2200); }

  /* ---------------- SCROLL MOTION ---------------- */
  function scrollMotion() {
    if (!hasGsap || reduce) { $$('.reveal').forEach(r => r.style.cssText = 'opacity:1;transform:none'); return; }
    gsap.registerPlugin(ScrollTrigger);

    // entrada do hero: título linha a linha
    gsap.from('.hero__title .line>span', { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: .1, delay: .1 });
    gsap.from(['.hero__lead', '.hero__ctas', '.hero__meta'], { y: 30, opacity: 0, duration: .9, stagger: .1, delay: .5, ease: 'power3.out' });

    $$('.reveal').forEach(el => gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } }));
    gsap.set('.reveal', { y: 40 });

    ['.shop__head', '.kits__head', '.reviews__head', '.insta__head'].forEach(s =>
      gsap.from(`${s} > *`, { y: 36, opacity: 0, duration: .9, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 82%' } }));
    gsap.from('.kit', { x: 80, opacity: 0, duration: 1, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '.kits__track', start: 'top 80%' } });
    gsap.from('.insta__grid img', { y: 60, opacity: 0, duration: .9, stagger: .06, ease: 'power3.out', scrollTrigger: { trigger: '.insta__grid', start: 'top 85%' } });

    // ESSÊNCIA: selo gira com o scroll, faixa troca de cor por ingrediente
    const slides = $$('.essence__slide'), dots = $$('.essence__progress i');
    const ess = $('.essence'), photos = $$('.essence__photos img');
    gsap.fromTo('.scene__video', { yPercent: -8 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: '.scene', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from('.scene__copy > *', { y: 40, opacity: 0, duration: 1, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.scene', start: 'top 70%' } });
    gsap.to('.essence__ring', { rotate: 540, ease: 'none', scrollTrigger: { trigger: ess, start: 'top top', end: 'bottom bottom', scrub: .6 } });
    gsap.fromTo('.essence__seal', { scale: .7 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: ess, start: 'top bottom', end: 'top top', scrub: true } });
    ScrollTrigger.create({
      trigger: ess, start: 'top top', end: 'bottom bottom',
      onUpdate: st => {
        const k = Math.min(slides.length - 1, Math.floor(st.progress * slides.length));
        slides.forEach((s, j) => s.classList.toggle('is-on', j === k));
        dots.forEach((d, j) => d.classList.toggle('is-on', j <= k));
        ess.style.setProperty('--ec', slides[k].dataset.c || '#6E9B22');
        photos.forEach((p, j) => p.classList.toggle('is-on', j === k - 1));
        ess.classList.toggle('has-photo', k > 0);
      }
    });
    gsap.from('.footer__big', { xPercent: 20, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  // vídeo da cena: respeita "reduzir movimento" e só roda quando visível
  const sv = $('.scene__video');
  if (sv) {
    if (reduce) { sv.removeAttribute('autoplay'); sv.pause(); }
    else new IntersectionObserver(([en]) => { en.isIntersecting ? sv.play().catch(() => {}) : sv.pause(); }).observe(sv);
  }

  /* ---------------- init ---------------- */
  selectLine('tutano');
  renderCart();
  showLine(0, 1, true);
  restart();
  scrollMotion();
})();
