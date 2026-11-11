// Uma aula: vídeo, explicação, marcar como vista e o resto da trilha.
import { NIVEIS, aula as acharAula, trilhaDe, duracao, capaGrande, capa } from '../dados/aulas.js';
import { barraTopo, esc, ICONES, guardar, ler } from '../ui/comum.js';
import { vistas, fileira, ligarFileiras } from './aulas.js';

export function montar(el, yt) {
  const a = acharAula(yt);
  if (!a) {
    el.innerHTML = `${barraTopo('Aula', '#/aulas')}<p class="intro">Aula não encontrada.</p>`;
    return;
  }
  const t = trilhaDe(a);

  // guarda como recente (para "continuar assistindo")
  guardar('aulas.recentes', [a.yt, ...ler('aulas.recentes', []).filter((x) => x !== a.yt)].slice(0, 12));

  // o resto da trilha, começando pela próxima aula
  const i = t.aulas.findIndex((x) => x.yt === a.yt);
  const resto = [...t.aulas.slice(i + 1), ...t.aulas.slice(0, i)].map((x) => acharAula(x.yt));

  function desenhar() {
    const vs = vistas();
    const vista = vs.has(a.yt);
    el.innerHTML = `
      ${barraTopo('Aula', '#/aulas')}
      <div class="video" id="video">
        <button class="video-capa" id="tocar" aria-label="Assistir ${esc(a.titulo)}">
          <img src="${capaGrande(a.yt)}" alt="" onerror="this.onerror=null;this.src='${capa(a.yt)}'">
          <span class="video-play">${ICONES.play}</span>
        </button>
      </div>

      <section class="aula-info">
        <span class="destaque-trilha">${esc(t.nome)}, aula ${i + 1} de ${t.aulas.length}</span>
        <h2 class="aula-nome">${esc(a.titulo)}</h2>
        <span class="destaque-meta">${duracao(a.dur)}, ${NIVEIS[a.nivel].toLowerCase()}</span>
        <p>${esc(a.resumo)}</p>
        <div class="acoes">
          <button class="botao${vista ? ' principal' : ''}" id="vista">${ICONES.visto}<span>${vista ? 'Vista' : 'Marcar como vista'}</span></button>
          <a class="botao" href="https://www.youtube.com/watch?v=${a.yt}" target="_blank" rel="noopener">Abrir no YouTube</a>
        </div>
        <span class="aula-fonte">Aula do canal ${esc(a.fonte)}</span>
      </section>

      ${fileira('Mais desta trilha', resto, vs)}
    `;
    ligarFileiras(el);

    el.querySelector('#tocar').onclick = () => {
      el.querySelector('#video').innerHTML = `<iframe
        src="https://www.youtube-nocookie.com/embed/${a.yt}?autoplay=1&rel=0&playsinline=1"
        title="${esc(a.titulo)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    };
    el.querySelector('#vista').onclick = () => {
      const s = vistas();
      if (s.has(a.yt)) s.delete(a.yt); else s.add(a.yt);
      guardar('aulas.vistas', [...s]);
      const tocando = el.querySelector('#video iframe');
      const html = tocando ? el.querySelector('#video').innerHTML : null;
      desenhar();
      if (html) el.querySelector('#video').innerHTML = html;   // não reinicia o vídeo
    };
  }

  desenhar();
}
