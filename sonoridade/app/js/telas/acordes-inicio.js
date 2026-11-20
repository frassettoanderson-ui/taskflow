// Acordes: tela de entrada no mesmo jeito do início (estúdio ao fundo, cartões com foto).
// Três caminhos: as notas do braço, todos os acordes (o mural) e o campo harmônico.
import { ICONES } from '../ui/comum.js';

const V = 'v=1';
const CARTOES = [
  { id: 'notas', href: '#/acordes/notas', nome: 'Notas', dica: 'Que nota sai em cada casa do braço' },
  { id: 'acordes', href: '#/acordes/todos', nome: 'Acordes', dica: 'Todos os acordes, com onde vão os dedos' },
  { id: 'campo', href: '#/acordes/campo', nome: 'Campo harmônico', dica: 'Os acordes que combinam em cada tom' },
];

export function montar(el) {
  el.classList.add('app-inicio');
  el.innerHTML = `
    <div class="ini-fundo" aria-hidden="true"><img src="img/inicio/estudio.webp?v=3" alt=""></div>
    <header class="barra-topo ah-topo">
      <a class="voltar" href="#/" aria-label="Voltar">${ICONES.voltar}</a>
      <h1>Acordes</h1>
      <span></span>
    </header>
    <nav class="ah-grade">
      ${CARTOES.map((c, i) => `
        <a class="ini-cartao ah-cartao" href="${c.href}" data-id="${c.id}" style="--i:${i}">
          <img src="img/acordes/${c.id}.webp?${V}" alt="" loading="eager">
          <span class="ah-texto">
            <span class="ini-nome">${c.nome}</span>
            <span class="ah-dica">${c.dica}</span>
          </span>
        </a>`).join('')}
    </nav>
  `;
  // cartões entram um depois do outro, como no início
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('ini-pronto')));
  return () => el.classList.remove('app-inicio', 'ini-pronto');
}
