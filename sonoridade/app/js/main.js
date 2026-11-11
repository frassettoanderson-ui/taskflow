// Sonoridade — navegação entre telas (por #hash, funciona sem servidor especial)
import * as inicio from './telas/inicio.js';
import * as acordes from './telas/acordes.js';
import * as acordeDetalhe from './telas/acorde.js';
import * as batidas from './telas/batidas.js';
import * as treino from './telas/treino.js';
import * as sequencias from './telas/sequencias.js';
import * as aulas from './telas/aulas.js';
import * as aulaDetalhe from './telas/aula.js';
import * as cifras from './telas/cifras.js';
import * as cifra from './telas/cifra.js';
import * as afinador from './telas/afinador.js';
import * as exercicios from './telas/exercicios.js';
import * as ferramentas from './telas/ferramentas.js';

const ROTAS = [
  { re: /^\/acordes\/([^?]+)(?:\?(.*))?$/, tela: acordeDetalhe },
  { re: /^\/acordes(?:\?(.*))?$/, tela: acordes },
  { re: /^\/batidas\/([^?]+)(?:\?(.*))?$/, tela: treino },
  { re: /^\/batidas\/?$/, tela: batidas },
  { re: /^\/sequencias\/?$/, tela: sequencias },
  { re: /^\/cifras\/([^?]+)$/, tela: cifra },
  { re: /^\/cifras\/?$/, tela: cifras },
  { re: /^\/afinador\/?$/, tela: afinador },
  { re: /^\/exercicios(?:\/([^?]+))?\/?$/, tela: exercicios },
  { re: /^\/ferramentas(?:\/([^?]+))?\/?$/, tela: ferramentas },
  { re: /^\/aulas\/([^?]+)$/, tela: aulaDetalhe },
  { re: /^\/aulas(?:\?(.*))?$/, tela: aulas },
  { re: /^\/?$/, tela: inicio },
];

let app = document.getElementById('app');
let desmontar = null;
let caminhoAnterior = null;

// Profundidade da tela: "/" = 0, "/cifras" = 1, "/cifras/x" = 2. Entrar mais fundo = zoom para dentro,
// voltar = zoom para fora, como se tudo rodasse numa tela só.
const profundidade = (c) => c.split('?')[0].split('/').filter(Boolean).length;

// o zoom de entrada parte de onde a pessoa tocou (o cartão escolhido)
document.addEventListener('pointerdown', (e) => {
  document.documentElement.style.setProperty('--zx', `${e.clientX}px`);
  document.documentElement.style.setProperty('--zy', `${e.clientY}px`);
}, { capture: true, passive: true });

function trocarTela(rota, params) {
  if (desmontar) { try { desmontar(); } catch (e) { console.error(e); } }
  desmontar = null;
  // área nova a cada tela: ouvintes de clique da tela anterior não ficam presos
  const nova = app.cloneNode(false);
  app.replaceWith(nova);
  app = nova;
  desmontar = rota.tela.montar(app, ...params) || null;
  window.scrollTo(0, 0);
}

function navegar() {
  const caminho = (location.hash || '#/').slice(1);
  const rota = ROTAS.find((r) => r.re.test(caminho)) || ROTAS.at(-1);
  const m = caminho.match(rota.re) || [];
  const params = m.slice(1).map((v) => (v === undefined ? undefined : decodeURIComponent(v)));

  const antes = caminhoAnterior;
  caminhoAnterior = caminho;
  // primeira tela ou mesma tela (só mudou o ?filtro): troca direto. O zoom roda mesmo com "reduzir movimento"
  // ligado no aparelho (pedido do usuário: ele faz parte da identidade do app)
  if (antes === null || antes.split('?')[0] === caminho.split('?')[0]) { trocarTela(rota, params); return; }

  const d = profundidade(caminho) - profundidade(antes);
  const sentido = d > 0 ? 'entra' : d < 0 ? 'sai' : 'lado';
  const raiz = document.documentElement;
  raiz.dataset.zoom = sentido;
  if (document.startViewTransition) {
    // o navegador tira uma foto da tela velha e anima as duas (CSS ::view-transition-*)
    const vt = document.startViewTransition(() => trocarTela(rota, params));
    vt.finished.finally(() => { if (raiz.dataset.zoom === sentido) delete raiz.dataset.zoom; });
  } else {
    // sem View Transitions (navegador antigo): só a tela nova anima
    trocarTela(rota, params);
    app.classList.add('zoom-entra-sozinha');
    setTimeout(() => { app.classList.remove('zoom-entra-sozinha'); delete raiz.dataset.zoom; }, 600);
  }
}

window.addEventListener('hashchange', navegar);
navegar();
