// Tela inicial: estúdio ao fundo, dois cartões grandes (Cifras e Tocar com banda) e cinco menores.
// Ao abrir o app, abertura: vídeo de 3,4 s com som (img/abertura/abertura-h|v.mp4, feito no Remotion em
// julius-videos/src/sonoridade): seis cordas dedilham um Cadd9, viram um ponto de luz, nasce o S e o nome.
// O navegador só deixa tocar com som depois de um toque, por isso "Toque para começar".
import { ICONES } from '../ui/comum.js';

const V = 'v=3';
const CARTOES = [
  { id: 'cifras', href: '#/cifras', nome: 'Cifras', foto: 'cifras', grande: true },
  { id: 'banda', href: '../prototipo/', nome: 'Tocar com banda', foto: 'banda', grande: true },
  { id: 'acordes', href: '#/acordes', nome: 'Acordes', foto: 'acordes' },
  { id: 'batidas', href: '#/batidas', nome: 'Batidas', foto: 'batidas' },
  { id: 'aulas', href: '#/aulas', nome: 'Aulas', foto: 'aulas' },
  { id: 'exercicios', href: '#/exercicios', nome: 'Exercícios', foto: 'exercicios' },
  { id: 'ferramentas', href: '#/ferramentas', nome: 'Ferramentas', foto: 'ferramentas' },
];
const VA = 'v=1';

export function montar(el) {
  el.classList.add('app-inicio');
  el.innerHTML = `
    <div class="ini-fundo" aria-hidden="true"><img src="img/inicio/estudio.webp?${V}" alt=""></div>
    <header class="ini-topo">
      <img class="ini-logo" src="img/logo.webp?v=2" alt="Sonoridade">
    </header>
    <nav class="ini-grade">
      ${CARTOES.map((c, i) => `
        <a class="ini-cartao${c.grande ? ' grande' : ''}" href="${c.href}" data-id="${c.id}" style="--i:${i}">
          <img src="img/inicio/${c.foto}.webp?${V}" alt="" loading="${c.grande ? 'eager' : 'lazy'}">
          <span class="ini-nome">${c.nome}</span>
        </a>`).join('')}
    </nav>
    <p class="creditos">Som do violão: MusyngKite (CC BY-SA 3.0)</p>
  `;

  // abertura toda vez que o app é aberto (não repete ao voltar de outra tela); tocar na logo repete
  let fimAbertura = () => {};
  let jaViu = false;
  try { jaViu = sessionStorage.getItem('inicio.abertura') === '1'; } catch { /* sem armazenamento */ }
  const abrir = () => {
    fimAbertura();
    el.classList.remove('ini-pronto');
    fimAbertura = abertura(el, () => { try { sessionStorage.setItem('inicio.abertura', '1'); } catch { /* segue */ } });
  };
  if (!jaViu) abrir();
  else el.classList.add('ini-pronto');
  el.querySelector('.ini-logo').addEventListener('click', abrir);

  return () => { fimAbertura(); el.classList.remove('app-inicio', 'ini-pronto'); };
}

// ---------- abertura ----------
function abertura(el, aoTerminar) {
  // celular em pé usa a versão vertical; o resto, a horizontal
  const lado = window.innerHeight > window.innerWidth ? 'v' : 'h';
  const caixa = document.createElement('div');
  caixa.className = 'abertura';
  caixa.innerHTML = `
    <video class="ab-video" playsinline preload="auto" poster="img/abertura/abertura-${lado}.jpg?${VA}" src="img/abertura/abertura-${lado}.mp4?${VA}"></video>
    <button class="ab-tocar" type="button">${ICONES.play}Toque para começar</button>
    <button class="ab-pular" type="button">Pular</button>
  `;
  document.body.appendChild(caixa);
  document.body.classList.add('com-abertura');
  const video = caixa.querySelector('video');

  let timers = [];
  let foi = false;
  let fechou = false;
  const fechar = () => {
    if (fechou) return;
    fechou = true;
    timers.forEach(clearTimeout);
    timers = [];
    caixa.classList.add('saindo');
    el.classList.add('ini-pronto');
    document.body.classList.remove('com-abertura');
    timers.push(setTimeout(() => { video.pause(); caixa.remove(); }, 750));
    aoTerminar();
  };
  const comecar = () => {
    if (foi) return;
    foi = true;
    caixa.classList.add('tocando');
    video.muted = false;
    video.currentTime = 0;
    // se o navegador recusar com som, toca mudo; se nem assim, abre direto
    video.play().catch(() => { video.muted = true; return video.play(); }).catch(fechar);
    timers.push(setTimeout(fechar, 6000));       // garantia, se o vídeo travar
  };
  // fecha um pouco antes do fim: o fade da caixa cobre o último pedaço parado
  video.addEventListener('timeupdate', () => { if (foi && video.duration && video.currentTime >= video.duration - 0.35) fechar(); });
  video.addEventListener('ended', fechar);
  video.addEventListener('error', () => { if (foi) fechar(); });
  caixa.querySelector('.ab-tocar').addEventListener('click', (e) => { e.stopPropagation(); comecar(); });
  caixa.querySelector('.ab-pular').addEventListener('click', (e) => { e.stopPropagation(); foi = true; fechar(); });
  caixa.addEventListener('click', comecar);

  // saiu da tela no meio (voltar do navegador): some sem deixar sobra
  return () => { if (caixa.isConnected) { timers.forEach(clearTimeout); video.pause(); caixa.remove(); document.body.classList.remove('com-abertura'); } };
}
