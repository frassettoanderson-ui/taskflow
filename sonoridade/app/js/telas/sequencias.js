// Sequências de acordes dentro do campo harmônico: escolhe o tom, toca nos graus para montar,
// usa uma sequência pronta, ouve e leva para o treino de batida.
import { tonsDo, grausDo, funcoesDo, sequenciasDo, tom as acharTom } from '../dados/campo.js';
import { BATIDAS } from '../dados/batidas.js';
import { acorde } from '../dados/acordes.js';
import { barraTopo, esc, ICONES, guardar, ler } from '../ui/comum.js';
import * as som from '../audio/som.js';

const MAX = 8;

export function montar(el) {
  const salvo = ler('seq.atual', null);
  const st = {
    modo: salvo?.modo || 'maior',
    tom: salvo?.tom || 'G',
    graus: salvo?.graus || [0, 4, 5, 3],
    batida: salvo?.batida || 'balada',
    tocando: false,
    raf: 0,
    inicio: 0,
    durAcorde: 0,
  };

  el.innerHTML = `
    ${barraTopo('Sequências', '#/exercicios')}
    <p class="intro">Todo tom tem uma "família" de acordes que combinam entre si: o campo harmônico. Monte sua sequência tocando nos acordes.</p>

    <div class="segmentado" id="modo">
      <button data-modo="maior">Tom maior</button>
      <button data-modo="menor">Tom menor</button>
    </div>
    <div class="opcoes-linha" id="tons"></div>

    <section class="secao">
      <h2 id="tituloCampo"></h2>
      <div class="campo" id="campo"></div>
    </section>

    <section class="secao">
      <h2>Sua sequência</h2>
      <div class="sequencia" id="sequencia"></div>
      <div class="acoes-seq">
        <button class="botao principal" id="ouvir">${ICONES.play}<span>Ouvir</span></button>
        <button class="botao" id="desfazer">${ICONES.menos}<span>Desfazer</span></button>
        <button class="botao" id="salvar">${ICONES.salvar}<span>Guardar</span></button>
      </div>
    </section>

    <section class="secao">
      <h2>Treinar com a batida</h2>
      <div class="opcoes-linha" id="batidas"></div>
      <a class="botao principal largo" id="treinar">Treinar esta sequência</a>
    </section>

    <section class="secao">
      <h2>Sequências que mais aparecem</h2>
      <div class="lista-prontas" id="prontas"></div>
    </section>

    <section class="secao" id="secaoSalvas">
      <h2>Guardadas</h2>
      <div class="lista-prontas" id="salvas"></div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);

  const tomAtual = () => acharTom(st.modo, st.tom);
  const acordesDaSeq = () => st.graus.map((g) => tomAtual().acordes[g]);

  function persistir() {
    guardar('seq.atual', { modo: st.modo, tom: st.tom, graus: st.graus, batida: st.batida });
  }

  function desenhar() {
    const t = tomAtual();
    const graus = grausDo(st.modo);
    const funcoes = funcoesDo(st.modo);

    el.querySelectorAll('#modo button').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === st.modo));
    $('#tons').innerHTML = tonsDo(st.modo).map((x) =>
      `<button class="opcao-linha${x.id === st.tom ? ' ativo' : ''}" data-tom="${x.id}">${esc(x.nome)}</button>`).join('');

    $('#tituloCampo').textContent = `Campo harmônico de ${t.nome}`;
    $('#campo').innerHTML = t.acordes.map((s, i) => `
      <button class="grau" data-grau="${i}" aria-label="Adicionar ${esc(s)}">
        <span class="g-num">${graus[i]}</span>
        <span class="g-sim">${esc(s)}</span>
        <span class="g-fun">${funcoes[i]}</span>
      </button>`).join('');

    const seq = acordesDaSeq();
    $('#sequencia').innerHTML = seq.length
      ? seq.map((s, i) => `
        <button class="passo-seq" data-tirar="${i}" title="Tocar para tirar">
          <span class="g-num">${graus[st.graus[i]]}</span>
          <span class="g-sim">${esc(s)}</span>
        </button>`).join('')
      : '<p class="vazio">Toque nos acordes acima para montar.</p>';

    $('#batidas').innerHTML = BATIDAS.map((b) =>
      `<button class="opcao-linha${b.id === st.batida ? ' ativo' : ''}" data-batida="${b.id}">${esc(b.nome)}</button>`).join('');
    const link = `#/batidas/${st.batida}?seq=${encodeURIComponent(seq.join(','))}`;
    $('#treinar').href = seq.length ? link : '#/sequencias';
    $('#treinar').classList.toggle('desligado', !seq.length);

    $('#prontas').innerHTML = sequenciasDo(st.modo).map((p, i) => `
      <button class="pronta" data-pronta="${i}">
        <span class="p-nome">${esc(p.nome)}</span>
        <span class="p-acordes">${p.graus.map((g) => esc(t.acordes[g])).join('  ')}</span>
        <span class="p-dica">${esc(p.dica)}</span>
      </button>`).join('');

    const salvas = ler('seq.salvas', []);
    $('#secaoSalvas').hidden = !salvas.length;
    $('#salvas').innerHTML = salvas.map((s, i) => {
      const tt = acharTom(s.modo, s.tom);
      return `<div class="pronta salva">
        <button class="p-abrir" data-salva="${i}">
          <span class="p-nome">${esc(tt.nome)}</span>
          <span class="p-acordes">${s.graus.map((g) => esc(tt.acordes[g])).join('  ')}</span>
        </button>
        <button class="p-lixo" data-apagar="${i}" aria-label="Apagar">${ICONES.lixo}</button>
      </div>`;
    }).join('');

    $('#desfazer').disabled = !st.graus.length;
    $('#ouvir').disabled = !st.graus.length;
    persistir();
    som.preparar(seq.map(acorde));
  }

  // ---------- ouvir a sequência ----------
  function parar() {
    st.tocando = false;
    cancelAnimationFrame(st.raf);
    som.silenciar();
    $('#ouvir').innerHTML = `${ICONES.play}<span>Ouvir</span>`;
    el.querySelectorAll('.passo-seq').forEach((p) => p.classList.remove('agora'));
  }

  async function ouvir() {
    if (st.tocando) { parar(); return; }
    const seq = acordesDaSeq().map(acorde);
    if (!seq.length) return;
    $('#ouvir').innerHTML = `${ICONES.pausa}<span>Parar</span>`;
    st.tocando = true;
    await som.preparar(seq);
    if (!st.tocando) return;
    const c = som.contexto();
    const tempo = 60 / 92;
    st.durAcorde = tempo * 4;
    st.inicio = c.currentTime + 0.1;
    // por acorde: baixo, baixo, baixo-cima, baixo-cima
    const levada = [[0, 'B'], [1, 'B'], [2, 'B'], [2.5, 'C'], [3, 'B'], [3.5, 'C']];
    seq.forEach((a, i) => {
      levada.forEach(([b, d]) => som.batida(a, { direcao: d === 'B' ? 'baixo' : 'cima', quando: st.inicio + i * st.durAcorde + b * tempo, forca: d === 'B' ? 1 : 0.8 }));
    });
    const fim = st.inicio + seq.length * st.durAcorde;
    const passos = [...el.querySelectorAll('.passo-seq')];
    const quadro = () => {
      if (!st.tocando) return;
      const t = som.tempoAudio();
      if (t > fim + 0.6) { parar(); return; }
      const i = Math.floor((t - st.inicio) / st.durAcorde);
      passos.forEach((p, k) => p.classList.toggle('agora', k === i));
      st.raf = requestAnimationFrame(quadro);
    };
    quadro();
  }

  // ---------- cliques ----------
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.modo && d.modo !== st.modo) {
      st.modo = d.modo;
      st.tom = tonsDo(st.modo)[0].id;
      st.graus = [...sequenciasDo(st.modo)[0].graus];
    } else if (d.tom) {
      st.tom = d.tom;                       // mesma sequência de graus, outro tom
    } else if (d.grau !== undefined) {
      if (st.graus.length < MAX) st.graus.push(Number(d.grau));
      som.batida(acorde(tomAtual().acordes[Number(d.grau)]));
    } else if (d.tirar !== undefined) {
      st.graus.splice(Number(d.tirar), 1);
    } else if (d.batida) {
      st.batida = d.batida;
    } else if (d.pronta !== undefined) {
      st.graus = [...sequenciasDo(st.modo)[Number(d.pronta)].graus];
    } else if (d.salva !== undefined) {
      const s = ler('seq.salvas', [])[Number(d.salva)];
      if (s) { st.modo = s.modo; st.tom = s.tom; st.graus = [...s.graus]; }
    } else if (d.apagar !== undefined) {
      const lista = ler('seq.salvas', []);
      lista.splice(Number(d.apagar), 1);
      guardar('seq.salvas', lista);
    } else if (b.id === 'desfazer') {
      st.graus.pop();
    } else if (b.id === 'salvar') {
      if (!st.graus.length) return;
      const lista = ler('seq.salvas', []);
      const chave = JSON.stringify([st.modo, st.tom, st.graus]);
      if (!lista.some((s) => JSON.stringify([s.modo, s.tom, s.graus]) === chave)) {
        lista.unshift({ modo: st.modo, tom: st.tom, graus: [...st.graus] });
        guardar('seq.salvas', lista.slice(0, 20));
      }
      b.querySelector('span').textContent = 'Guardada';
      setTimeout(() => { const s = b.querySelector('span'); if (s) s.textContent = 'Guardar'; }, 1400);
    } else if (b.id === 'ouvir') {
      ouvir();
      return;
    } else {
      return;
    }
    if (st.tocando) parar();
    desenhar();
  });

  desenhar();
  return () => parar();
}
