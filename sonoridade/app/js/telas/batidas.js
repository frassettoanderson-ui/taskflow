// Lista de batidas
import { BATIDAS, contagem } from '../dados/batidas.js';
import { barraTopo, esc, BATIDA_SVG } from '../ui/comum.js';

export function passosHtml(b) {
  const conta = contagem(b);
  return [...b.passos].map((p, i) => {
    const tempo = i % b.porTempo === 0;
    return `<span class="passo${tempo ? ' tempo' : ''}" data-i="${i}">${BATIDA_SVG[p]}<span class="conta">${conta[i]}</span></span>`;
  }).join('');
}

const NIVEL = { 1: 'Para começar', 2: 'Intermediária', 3: 'Avançando' };

export function montar(el) {
  el.innerHTML = `
    ${barraTopo('Batidas')}
    <div class="legenda-batida">
      <span>${BATIDA_SVG.B}para baixo</span>
      <span>${BATIDA_SVG.C}para cima</span>
      <span>${BATIDA_SVG.X}abafada</span>
      <span>${BATIDA_SVG['-']}passa sem tocar</span>
      <span>${BATIDA_SVG.P}polegar no baixo</span>
      <span>${BATIDA_SVG['3']}corda (dedilhado)</span>
    </div>
    <div class="lista-batidas">
      ${BATIDAS.map((b) => `
        <a class="cartao-batida" href="#/batidas/${b.id}">
          <h2>${esc(b.nome)}</h2>
          <span class="nivel-txt">${NIVEL[b.nivel]}</span>
          <div class="passos">${passosHtml(b)}</div>
          <p>${esc(b.dica)}</p>
        </a>`).join('')}
    </div>
  `;
}
