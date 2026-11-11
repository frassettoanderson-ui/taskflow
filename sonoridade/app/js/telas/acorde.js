// Um acorde: braço do violão com os dedos, ouvir, dicas e navegar para o próximo
import { acorde, dicas, GRUPOS, TONS, GRAUS, FUNCAO_GRAU } from '../dados/acordes.js';
import { posicao, ehAcorde } from '../dados/teoria.js';
import { braco, vibrar } from '../ui/braco.js';
import { barraTopo, lerQuery, esc, ICONES } from '../ui/comum.js';
import * as som from '../audio/som.js';

export function montar(el, simbolo, query) {
  const q = lerQuery(query);
  // fora do dicionário (C6(9), F#m7...), a posição é calculada pela teoria
  const a = acorde(simbolo) || (ehAcorde(simbolo) ? posicao(simbolo) : null);
  const voltar = `#/acordes?${q.tom ? `tom=${q.tom}` : `lista=${q.lista || 'primeiros'}`}`;

  if (!a) {
    el.innerHTML = `${barraTopo('Acordes', voltar)}<p class="intro">Acorde não encontrado.</p>`;
    return;
  }

  // lista em que o acorde está (para anterior / próximo)
  let lista, consulta, grau = null;
  if (q.tom) {
    const t = TONS.find((x) => x.id === q.tom) || TONS[0];
    lista = t.acordes; consulta = `tom=${t.id}`;
    const i = lista.indexOf(simbolo);
    if (i >= 0) grau = `${GRAUS[i]} no tom de ${t.nome}, ${FUNCAO_GRAU[i].toLowerCase()}`;
  } else {
    const g = GRUPOS.find((x) => x.id === q.lista) || GRUPOS.find((x) => x.acordes.includes(simbolo)) || GRUPOS[0];
    lista = g.acordes; consulta = `lista=${g.id}`;
  }
  const pos = lista.indexOf(simbolo);
  const ant = pos > 0 ? lista[pos - 1] : null;
  const prox = pos >= 0 && pos < lista.length - 1 ? lista[pos + 1] : null;
  const link = (s) => `#/acordes/${encodeURIComponent(s)}?${consulta}`;

  el.innerHTML = `
    ${barraTopo('Acorde', voltar)}
    <section class="acorde-cabeca">
      <div class="sim">${esc(a.simbolo)}</div>
      <div class="ext">${esc(a.nome)}</div>
      ${a.apelidos ? `<div class="extra">${esc(a.apelidos)}</div>` : ''}
      ${grau ? `<div class="extra">${esc(grau)}</div>` : ''}
    </section>

    <section class="palco-braco">
      ${braco(a)}
      <div class="legenda-dedos">
        <span><b>1</b>indicador</span><span><b>2</b>médio</span><span><b>3</b>anelar</span><span><b>4</b>mínimo</span>
      </div>
    </section>

    <div class="acoes">
      <button class="botao principal" id="ouvir">${ICONES.som}<span>Ouvir</span></button>
      <button class="botao" id="dedilhar">${ICONES.cordas}<span>Dedilhar</span></button>
    </div>

    <ul class="dicas">
      ${dicas(a).map((d) => `<li>${esc(d)}</li>`).join('')}
    </ul>

    <a class="botao largo" style="margin-top:12px" href="#/batidas/balada?acorde=${encodeURIComponent(a.simbolo)}">
      Treinar uma batida com ${esc(a.simbolo)}
    </a>

    <nav class="navega">
      <a class="${ant ? '' : 'vazio'}" href="${ant ? link(ant) : '#'}" aria-label="Acorde anterior">
        ${ICONES.voltar}<span><span class="n-sim">${ant ? esc(ant) : ''}</span><span class="n-txt">anterior</span></span>
      </a>
      <a class="${prox ? '' : 'vazio'}" href="${prox ? link(prox) : '#'}" aria-label="Próximo acorde">
        <span><span class="n-sim">${prox ? esc(prox) : ''}</span><span class="n-txt">próximo</span></span>${ICONES.avancar}
      </a>
    </nav>
  `;

  som.preparar([a]);
  const palco = el.querySelector('.palco-braco');
  const ouvir = () => { som.batida(a, { direcao: 'baixo' }); vibrar(palco, a, { atraso: 30 }); };
  el.querySelector('#ouvir').onclick = ouvir;
  el.querySelector('#dedilhar').onclick = () => { som.dedilhar(a); vibrar(palco, a, { atraso: 30, passo: 340 }); };

  // setas do teclado no PC
  const teclas = (e) => {
    if (e.key === 'ArrowLeft' && ant) location.hash = link(ant);
    if (e.key === 'ArrowRight' && prox) location.hash = link(prox);
    if (e.key === ' ') { e.preventDefault(); ouvir(); }
  };
  document.addEventListener('keydown', teclas);
  return () => { document.removeEventListener('keydown', teclas); som.silenciar(); };
}
