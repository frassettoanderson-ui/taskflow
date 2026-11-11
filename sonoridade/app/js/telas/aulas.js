// Aulas: vitrine estilo Netflix. Destaque no topo, filtro por instrumento,
// "continuar assistindo" e uma fileira por trilha que rola para o lado.
import { TRILHAS, INSTRUMENTOS, NIVEIS, DESTAQUE, aula, todasAulas, duracao, capa, capaGrande } from '../dados/aulas.js';
import { barraTopo, esc, ICONES, guardar, ler, lerQuery } from '../ui/comum.js';

export const vistas = () => new Set(ler('aulas.vistas', []));
export const recentes = () => ler('aulas.recentes', []);

const serve = (a, inst) => inst === 'todos' || a.instrumento === inst || a.instrumento === 'todos';

export function cartaoAula(a, vistasSet) {
  const vista = vistasSet.has(a.yt);
  return `<a class="aula-cartao${vista ? ' vista' : ''}" href="#/aulas/${a.yt}">
    <span class="aula-capa">
      <img src="${capa(a.yt)}" alt="" loading="lazy">
      <span class="aula-dur">${duracao(a.dur)}</span>
      ${vista ? `<span class="aula-vista">${ICONES.visto}Vista</span>` : ''}
    </span>
    <span class="aula-titulo">${esc(a.titulo)}</span>
    <span class="aula-nivel">${NIVEIS[a.nivel]}</span>
  </a>`;
}

export function fileira(titulo, aulas, vistasSet) {
  if (!aulas.length) return '';
  return `<section class="fileira">
    <h2>${esc(titulo)}</h2>
    <div class="fileira-caixa">
      <button class="fileira-seta esq" aria-label="Voltar" hidden>${ICONES.voltar}</button>
      <div class="fileira-trilho">${aulas.map((a) => cartaoAula(a, vistasSet)).join('')}</div>
      <button class="fileira-seta dir" aria-label="Mais" hidden>${ICONES.avancar}</button>
    </div>
  </section>`;
}

// setas de rolar no PC (só aparecem quando há mais para o lado)
export function ligarFileiras(el) {
  el.querySelectorAll('.fileira-caixa').forEach((caixa) => {
    const trilho = caixa.querySelector('.fileira-trilho');
    const esq = caixa.querySelector('.esq');
    const dir = caixa.querySelector('.dir');
    const atualizar = () => {
      esq.hidden = trilho.scrollLeft < 8;
      dir.hidden = trilho.scrollLeft + trilho.clientWidth > trilho.scrollWidth - 8;
    };
    const passo = () => trilho.clientWidth * 0.85;
    esq.onclick = () => trilho.scrollBy({ left: -passo(), behavior: 'smooth' });
    dir.onclick = () => trilho.scrollBy({ left: passo(), behavior: 'smooth' });
    trilho.addEventListener('scroll', atualizar, { passive: true });
    atualizar();
  });
}

export function montar(el, query) {
  const q = lerQuery(query);
  let inst = INSTRUMENTOS.some((i) => i.id === q.inst) ? q.inst : ler('aulas.inst', 'todos');

  function desenhar() {
    const vs = vistas();
    const lista = todasAulas().filter((a) => serve(a, inst));
    const destaque = (inst === 'todos' || inst === 'violao') ? aula(DESTAQUE) : lista.find((a) => a.instrumento === inst) || lista[0];
    const continuar = recentes().map(aula).filter((a) => a && !vs.has(a.yt) && serve(a, inst));

    el.innerHTML = `
      ${barraTopo('Aulas')}
      <div class="segmentado" id="inst">
        ${INSTRUMENTOS.map((i) => `<button data-inst="${i.id}" class="${i.id === inst ? 'ativo' : ''}">${i.nome}</button>`).join('')}
      </div>

      ${destaque ? `
      <a class="destaque" href="#/aulas/${destaque.yt}">
        <span class="destaque-capa">
          <img src="${capaGrande(destaque.yt)}" alt="" onerror="this.onerror=null;this.src='${capa(destaque.yt)}'">
        </span>
        <span class="destaque-texto">
          <span class="destaque-trilha">${esc(TRILHAS.find((t) => t.id === destaque.trilha).nome)}</span>
          <span class="destaque-titulo">${esc(destaque.titulo)}</span>
          <span class="destaque-meta">${duracao(destaque.dur)}, ${NIVEIS[destaque.nivel].toLowerCase()}</span>
          <span class="botao principal destaque-botao">${ICONES.play}<span>Assistir</span></span>
        </span>
      </a>` : ''}

      ${fileira('Continuar assistindo', continuar, vs)}
      ${TRILHAS.map((t) => fileira(t.nome, t.aulas.map((a) => aula(a.yt)).filter((a) => serve(a, inst)), vs)).join('')}

      <p class="creditos">Aulas provisórias do canal Cifra Club, só para montar a tela. Depois entram as aulas do Evaldo.</p>
    `;
    ligarFileiras(el);
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-inst]');
    if (!b) return;
    inst = b.dataset.inst;
    guardar('aulas.inst', inst);
    const y = window.scrollY;
    desenhar();
    window.scrollTo(0, y);
  });

  desenhar();
}
