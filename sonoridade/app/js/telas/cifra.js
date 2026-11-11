// Uma cifra: versão principal/simplificada, tom, capotraste, afinação, os desenhos dos acordes,
// rolagem automática e "tocar junto" (o violão do app faz a batida e troca os acordes na ordem
// da cifra, marcando no texto onde está).
//
// Ritmo: velocidade medida na gravação e batida de cada parte vêm de dados/ritmos.js
// ("como na música"); a pessoa também pode escolher uma batida só para tudo.
// Cada acorde ainda dura o mesmo tanto (½, 1 ou 2 compassos).
//
// "Ouvir a gravação original": toca o vídeo oficial (YouTube) e marca na cifra o acorde que está
// soando, pelo mapa de tempos medido no áudio (dados-teste/sincronia.json).

import { musica, versao, sincronia, ler as lerCifra } from '../dados/cifras.js';
import { posicao, transporAcorde, transporTom, usaBemol, distancia } from '../dados/teoria.js';
import { criarPlayer, carregarApi, ESTADO } from '../ui/youtube.js';
import { BATIDAS, batida as acharBatida } from '../dados/batidas.js';
import { ritmoDe, tipoParte } from '../dados/ritmos.js';
import { braco, vibrar } from '../ui/braco.js';
import { barraTopo, esc, ICONES, guardar, ler, ehDedilhado } from '../ui/comum.js';
import { passosHtml } from './batidas.js';
import * as som from '../audio/som.js';

const AFINACOES = [
  { id: 0, nome: 'Padrão', resumo: 'afinação padrão' },
  { id: 1, nome: '½ tom abaixo', resumo: 'afinação meio tom abaixo' },
  { id: 2, nome: '1 tom abaixo', resumo: 'afinação um tom abaixo' },
];
const DURACOES = [
  { id: 0.5, nome: 'Meio compasso' },
  { id: 1, nome: '1 compasso' },
  { id: 2, nome: '2 compassos' },
];
const VELOCIDADES = [8, 14, 22, 32, 46];   // rolagem, em pixels por segundo

export function montar(el, id) {
  el.innerHTML = `${barraTopo('Tocar cifra', '#/cifras')}<p class="intro">Carregando…</p>`;
  let fim = null;
  let vivo = true;
  musica(id).then((m) => {
    if (!vivo) return;
    if (!m) { el.innerHTML = `${barraTopo('Tocar cifra', '#/cifras')}<p class="intro">Música não encontrada.</p>`; return; }
    fim = tela(el, m);
  });
  return () => { vivo = false; if (fim) fim(); };
}

function tela(el, m) {
  guardar('cifras.recentes', [m.id, ...ler('cifras.recentes', []).filter((x) => x !== m.id)].slice(0, 10));

  const pref = ler(`cifra.${m.id}`, {});
  const ritmo = ritmoDe(m.id);
  const st = {
    versao: pref.versao === 'simplificada' && m.simplificada ? 'simplificada' : 'principal',
    desloc: pref.desloc || 0,
    capo: pref.capo ?? null,          // null = o capotraste da versão
    afin: pref.afin || 0,
    fonte: pref.fonte || 17,
    batida: acharBatida(pref.batida) ? pref.batida : 'balada',
    modo: ritmo ? (pref.modo || 'musica') : 'manual',   // 'musica' = batida de cada parte; 'manual' = uma só
    bpm: pref.bpm || ritmo?.bpm || 70,
    cpa: pref.cpa || ritmo?.cpa || 1,
    click: pref.click ?? true,
    vel: pref.vel ?? 1,
    rolando: false,
    tocando: false,
  };
  const salvar = () => guardar(`cifra.${m.id}`, {
    versao: st.versao, desloc: st.desloc, capo: st.capo, afin: st.afin, fonte: st.fonte,
    batida: st.batida, modo: st.modo, bpm: st.bpm, cpa: st.cpa, click: st.click, vel: st.vel,
  });

  // ---------- contas do tom ----------
  const v = () => versao(m, st.versao);
  const capoAgora = () => st.capo ?? (v().capo || 0);
  const deslDesenho = () => st.desloc + (v().capo || 0) - capoAgora() + st.afin;   // quanto mover os desenhos
  const formaAgora = () => transporTom(v().forma || v().tom, deslDesenho());
  const tomAgora = () => transporTom(v().tom, st.desloc);
  const mostrar = (s) => transporAcorde(s, deslDesenho(), usaBemol(formaAgora()));
  const soando = (a) => a && { ...a, transpor: capoAgora() - st.afin };

  let seq = [];          // acordes na ordem da cifra (já no tom escolhido)
  let partes = [];       // tipo de parte (intro, refrao…) de cada acorde de seq
  const NOME_PARTE = { intro: 'Intro', estrofe: 'Estrofes', pre: 'Pré-refrão', refrao: 'Refrão', ponte: 'Ponte', solo: 'Solo', final: 'Final' };
  // batida de um acorde da sequência (ou de um tipo de parte)
  const batidaDaParte = (tipo) => acharBatida(st.modo === 'musica' && ritmo ? (ritmo.batidas[tipo] || 'balada') : st.batida) || acharBatida('balada');
  const batidaDo = (k) => batidaDaParte(partes[k] || 'estrofe');

  el.innerHTML = `
    ${barraTopo('Tocar cifra', '#/cifras')}
    <header class="cf-cabeca">
      <img class="cf-capa" src="${esc(m.capa || '')}" alt="" onerror="this.style.display='none'">
      <h2 class="cf-titulo">${esc(m.titulo)}</h2>
      <div class="cf-artista">${esc(m.artista)}</div>
      <div class="cf-resumo" id="resumo"></div>
      ${ritmo?.yt ? `<button class="cf-original" id="original">
        ${ICONES.play}<span><b>Ouvir a gravação original</b><small>${esc(ritmo.gravacao)}</small></span>
      </button>` : ''}
    </header>

    <section class="cf-ajustes">
      <div class="segmentado" id="versao">
        <button data-versao="principal">Principal</button>
        <button data-versao="simplificada" ${m.simplificada ? '' : 'disabled title="Esta música não tem versão simplificada"'}>Simplificada</button>
      </div>
      <div class="cf-controles">
        <div class="cf-controle">
          <span class="cf-rotulo">Tom</span>
          <div class="cf-passo">
            <button class="redondo" data-acao="tom-" aria-label="Meio tom abaixo">${ICONES.menos}</button>
            <output id="tom"></output>
            <button class="redondo" data-acao="tom+" aria-label="Meio tom acima">${ICONES.mais}</button>
          </div>
          <button class="cf-volta" data-acao="tom0" id="tomOriginal"></button>
        </div>
        <div class="cf-controle">
          <span class="cf-rotulo">Capotraste</span>
          <div class="cf-passo">
            <button class="redondo" data-acao="capo-" aria-label="Capotraste uma casa abaixo">${ICONES.menos}</button>
            <output id="capo"></output>
            <button class="redondo" data-acao="capo+" aria-label="Capotraste uma casa acima">${ICONES.mais}</button>
          </div>
          <span class="cf-volta" id="forma"></span>
        </div>
      </div>
      <div class="segmentado" id="afin">
        ${AFINACOES.map((a) => `<button data-afin="${a.id}">${a.nome}</button>`).join('')}
      </div>
    </section>

    <section class="cf-desenhos">
      <h3>Acordes desta música</h3>
      <div class="cf-trilho" id="desenhos"></div>
    </section>

    <div class="cf-letra-ajuste">
      <button class="redondo" data-acao="letra-" aria-label="Letra menor"><span>A</span></button>
      <span>Tamanho da letra</span>
      <button class="redondo" data-acao="letra+" aria-label="Letra maior"><span class="maior">A</span></button>
    </div>

    <article class="cifra" id="cifra"></article>

    <section class="secao cf-junto-ajustes">
      <h2>Tocar junto</h2>
      <p class="dica-grupo">O violão do app faz a batida e troca os acordes na ordem da cifra.</p>
      ${ritmo ? `<div class="segmentado" id="modo">
        <button data-modo="musica">Batida de cada parte</button>
        <button data-modo="manual">Uma batida para tudo</button>
      </div>` : ''}
      <div id="porParte"></div>
      <div id="umaSo">
        <div class="opcoes-linha" id="batidas"></div>
        <div class="passos" id="passosEscolha"></div>
      </div>
      <div class="cf-velocidade" id="velocidade"></div>
      <h3 class="cf-sub">Cada acorde dura</h3>
      <div class="segmentado" id="cpa">
        ${DURACOES.map((d) => `<button data-cpa="${d.id}">${d.nome}</button>`).join('')}
      </div>
      <div class="segmentado">
        <button id="tClick" aria-pressed="false">Metrônomo</button>
      </div>
      <div class="segmentado" id="timbre">
        ${Object.entries(som.TIMBRES).map(([k, t]) => `<button data-timbre="${k}">Cordas de ${t.nome.toLowerCase()}</button>`).join('')}
      </div>
    </section>

    <p class="creditos">Cifra copiada do <a href="${esc(m.fonte)}" target="_blank" rel="noopener">Cifra Club</a>, só para uso pessoal.</p>
    <div class="cf-espaco"></div>

    <div class="doca" id="doca">
      <div class="doca-original" id="orig" hidden>
        <div class="do-video" id="oVideo"></div>
        <div class="do-lado">
          <div class="do-acordes">
            <div class="dj-agora"><span class="rotulo">Agora</span><b id="oAgora"></b></div>
            <div class="dj-prox"><span class="rotulo">Próximo</span><b id="oProx"></b></div>
          </div>
          <div class="troca"><i id="oTroca"></i></div>
          <div class="do-botoes">
            <button class="redondo" id="oPlay" aria-label="Tocar">${ICONES.play}</button>
            <span class="do-tempo" id="oTempo">0:00</span>
            <button class="redondo" id="oFechar" aria-label="Fechar a gravação">${ICONES.fechar}</button>
          </div>
        </div>
        <div class="do-aviso" id="oAviso" hidden></div>
      </div>
      <div class="doca-junto" id="junto" hidden>
        <div class="dj-linha">
          <div class="dj-agora"><span class="rotulo">Agora</span><b id="jAgora"></b></div>
          <div class="dj-mini" id="jMini"></div>
          <div class="dj-prox"><span class="rotulo">Próximo</span><b id="jProx"></b></div>
        </div>
        <div class="troca"><i id="jTroca"></i></div>
        <div class="dj-batida" id="jBatida"></div>
      </div>
      <div class="doca-barra">
        <div class="doca-lado">
          <button class="redondo" data-acao="bpm-" aria-label="Mais devagar">${ICONES.menos}</button>
          <span class="doca-bpm"><output id="bpm"></output><small>bpm</small></span>
          <button class="redondo" data-acao="bpm+" aria-label="Mais rápido">${ICONES.mais}</button>
        </div>
        <button class="play" id="play" aria-label="Tocar junto">${ICONES.play}</button>
        <div class="doca-lado">
          <button class="doca-rolar" id="rolar" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v15M6 13l6 6 6-6"/></svg>
            <span id="rolarTxt">Rolar</span>
          </button>
        </div>
      </div>
    </div>

    <div class="folha" id="folha" hidden>
      <div class="folha-fundo" data-acao="fechar"></div>
      <div class="folha-caixa" role="dialog" aria-modal="true" aria-labelledby="folhaNome">
        <div class="folha-nome" id="folhaNome"></div>
        <div class="folha-ext" id="folhaExt"></div>
        <div class="folha-braco" id="folhaBraco"></div>
        <div class="acoes">
          <button class="botao principal" data-acao="ouvir">${ICONES.som}<span>Ouvir</span></button>
          <button class="botao" data-acao="dedilhar">${ICONES.cordas}<span>Dedilhar</span></button>
        </div>
        <button class="botao largo" data-acao="daqui" id="daqui">${ICONES.play}<span>Tocar junto a partir daqui</span></button>
        <button class="botao largo cf-fechar" data-acao="fechar">Fechar</button>
      </div>
    </div>
  `;
  const $ = (s) => el.querySelector(s);

  // ---------- cifra ----------
  function htmlCifra() {
    seq = [];
    partes = [];
    let parte = 'intro';
    const blocos = lerCifra(v().cifra);
    const botao = (s) => {
      const nome = mostrar(s);
      const k = seq.push(nome) - 1;
      partes[k] = parte;
      return `<button class="cf-ac" data-k="${k}" data-s="${esc(nome)}">${esc(nome)}</button>`;
    };
    const out = [];
    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      if (b.tipo === 'secao') {
        // "Tab - Solo 1" e parecidos são só rótulo de tablatura: não mudam a parte
        const soRotulo = /^(tab|dedilhado)\b/i.test(b.nome);
        if (!soRotulo) parte = tipoParte(b.nome);
        const bt = st.modo === 'musica' && ritmo && !soRotulo ? batidaDaParte(parte) : null;
        out.push(`<h3 class="cf-secao">${esc(b.nome)}${bt ? `<span class="cf-secao-batida">${esc(bt.nome)}</span>` : ''}</h3>`);
      }
      else if (b.tipo === 'vazia') out.push('<div class="cf-vazia"></div>');
      else if (b.tipo === 'tab') {
        // junta as tablaturas seguidas num bloco só, fechado (abre se quiser ver)
        const linhas = [];
        let titulo = '';
        let j = i;
        for (; j < blocos.length && (blocos[j].tipo === 'tab' || blocos[j].tipo === 'vazia'); j++) {
          if (blocos[j].tipo !== 'tab') continue;
          blocos[j].linhas.forEach((l) => {
            const rot = /^\[(.*)\]$/.exec(l.trim());
            if (rot) { if (!titulo) titulo = rot[1]; return; }
            linhas.push(l);
          });
          linhas.push('');
        }
        i = j - 1;
        // "[Tab - Primeira Parte]" → "Tablatura: primeira parte"
        const [tipo, parte] = titulo.split(/\s+-\s+/);
        const nome = `${(tipo || 'Tab').replace(/^Tab$/, 'Tablatura')}${parte ? `: ${parte.toLowerCase()}` : ''}`;
        out.push(`<details class="cf-tab"><summary>${esc(nome)}${deslDesenho() ? ' (no tom original)' : ''}</summary><pre>${esc(linhas.join('\n').replace(/\n+$/, ''))}</pre></details>`);
      } else if (b.tipo === 'linha') {
        if (b.soAcordes) {
          out.push(`<div class="cf-ln so-ac">${b.partes.map((p) => (p.acorde ? botao(p.acorde) : '')).join(' ')}</div>`);
        } else if (!b.partes.some((p) => p.acorde)) {
          out.push(`<div class="cf-ln">${esc(b.partes.map((p) => p.texto).join(''))}</div>`);
        } else {
          out.push(`<div class="cf-ln com-ac">${b.partes.map((p) => {
            if (!p.acorde) return esc(p.texto);
            const [, silaba, resto] = /^(\S*)([\s\S]*)$/.exec(p.texto);
            const html = botao(p.acorde);
            const nome = seq.at(-1);
            // ​: sem sílaba embaixo, a âncora ainda precisa da altura de uma linha
            // (sem sílaba o acorde fica por cima do espaço seguinte, sem abrir vão; só no fim da linha ele precisa de lugar)
            const largura = silaba || !resto.trim() ? `min-width:${(nome.length * 0.56 + 0.5).toFixed(2)}em` : '';
            return `<span class="cf-anc" style="${largura}">${html}${esc(silaba) || '​'}</span>${esc(resto)}`;
          }).join('')}</div>`);
        }
      }
    }
    return out.join('');
  }

  function desenharDesenhos() {
    const unicos = [...new Set(seq)];
    $('#desenhos').innerHTML = unicos.map((s) => {
      const a = posicao(s);
      return `<button class="cf-desenho" data-s="${esc(s)}">
        <span class="cf-desenho-nome">${esc(s)}</span>
        ${a ? braco(a, { orientacao: 'vertical' }) : '<span class="cf-sem">sem desenho</span>'}
      </button>`;
    }).join('');
    som.preparar(unicos.map(posicao).filter(Boolean).map(soando));
  }

  function desenharTudo() {
    const capo = capoAgora();
    const resumo = [`Tom ${tomAgora()}`];
    if (capo) resumo.push(`capotraste na ${capo}ª casa`);
    if (st.afin) resumo.push(AFINACOES[st.afin].resumo);
    $('#resumo').textContent = resumo.join(', ');
    $('#tom').textContent = tomAgora();
    const original = v().tom;
    $('#tomOriginal').textContent = st.desloc ? `Voltar ao original (${original})` : 'Tom original';
    $('#tomOriginal').disabled = !st.desloc;
    $('#capo').textContent = capo ? `${capo}ª casa` : 'Sem';
    $('#forma').textContent = (capo || st.afin) ? `Acordes na forma de ${formaAgora()}` : 'Sem capotraste';
    el.querySelectorAll('#versao button').forEach((b) => b.classList.toggle('ativo', b.dataset.versao === st.versao));
    el.querySelectorAll('#afin button').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.afin) === st.afin));
    $('#cifra').style.fontSize = `${st.fonte}px`;
    $('#cifra').innerHTML = htmlCifra();
    if (orig.ativo) { avisoOriginal(); orig.k = -2; }
    desenharDesenhos();
    desenharJunto();
    marcado = -1;
  }

  function desenharJunto() {
    const porParte = st.modo === 'musica' && ritmo;
    el.querySelectorAll('#modo button').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === st.modo));
    $('#umaSo').hidden = !!porParte;
    $('#porParte').hidden = !porParte;
    if (porParte) {
      // só as partes que existem nesta versão da cifra, na ordem em que aparecem
      const tipos = [...new Set(partes)];
      $('#porParte').innerHTML = `<div class="cf-partes">${tipos.map((t) => {
        const bt = batidaDaParte(t);
        return `<div class="cf-parte"><span class="cf-parte-nome">${NOME_PARTE[t]}</span><span class="cf-parte-batida">${esc(bt.nome)}</span><div class="passos">${passosHtml(bt)}</div></div>`;
      }).join('')}</div>
      <p class="cf-nota">Sugestão para violão, ainda não conferida por quem toca.${ritmo.aviso ? ` ${esc(ritmo.aviso)}` : ''}</p>`;
    } else {
      $('#batidas').innerHTML = BATIDAS.map((b) => `<button class="opcao-linha${b.id === st.batida ? ' ativo' : ''}" data-batida="${b.id}">${esc(b.nome)}</button>`).join('');
      $('#passosEscolha').innerHTML = passosHtml(acharBatida(st.batida));
    }
    $('#velocidade').innerHTML = ritmo
      ? `<span>Velocidade da gravação: <b>${ritmo.bpm} bpm</b></span>
         <span class="cf-gravacao">medida em ${esc(ritmo.gravacao)}</span>
         ${st.bpm !== ritmo.bpm ? `<button class="cf-volta" data-acao="bpm0">Você está em ${st.bpm} bpm. Voltar para ${ritmo.bpm}</button>` : ''}`
      : `<span>Velocidade: <b>${st.bpm} bpm</b> (ajuste na barra de baixo)</span>`;
    el.querySelectorAll('#cpa button').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.cpa) === st.cpa));
    $('#tClick').classList.toggle('ativo', st.click);
    $('#tClick').setAttribute('aria-pressed', String(st.click));
    el.querySelectorAll('#timbre button').forEach((b) => b.classList.toggle('ativo', b.dataset.timbre === som.timbreAtual()));
    $('#bpm').textContent = st.bpm;
  }


  // ---------- folha com o desenho de um acorde ----------
  let naFolha = null;     // { s, k }
  function abrirFolha(s, k = null) {
    const a = posicao(s);
    naFolha = { s, k };
    $('#folhaNome').textContent = s;
    $('#folhaExt').textContent = a?.nome || '';
    $('#folhaBraco').innerHTML = a ? braco(a, { compacto: window.innerWidth < 600, orientacao: 'horizontal' })
      : '<p class="cf-sem">Não achei uma posição para este acorde.</p>';
    $('#daqui').hidden = k === null;
    $('#daqui').querySelector('span').textContent = orig.ativo && bate() ? 'Ouvir a gravação daqui' : 'Tocar junto a partir daqui';
    $('#folha').hidden = false;
    if (a) som.preparar([soando(a)]);
  }
  const fecharFolha = () => { $('#folha').hidden = true; naFolha = null; };

  // ---------- tocar junto ----------
  // Agenda passo a passo, um pouco à frente do relógio do áudio. Cada acorde usa a batida
  // da parte em que está e dura st.cpa compassos.
  const j = { vez: 0, timer: 0, raf: 0, desde: 0, idx: 0, passo: 0, tProx: 0, inicios: [], fimEm: Infinity };
  let marcado = -1;
  const passosDoAcorde = (bt) => Math.max(1, Math.round(bt.passos.length * st.cpa));
  const duracaoDoAcorde = (k) => { const bt = batidaDo(k); return passosDoAcorde(bt) * 60 / st.bpm / bt.porTempo; };

  function agendar() {
    if (!st.tocando) return;
    const c = som.contexto();
    while (j.tProx < c.currentTime + 0.12) {
      if (j.idx >= seq.length) { j.fimEm = Math.min(j.fimEm, j.tProx); break; }
      const bt = batidaDo(j.idx);
      const n = bt.passos.length;
      const t = j.tProx;
      if (j.passo === 0) j.inicios[j.idx] = t;
      const i = j.passo % n;
      if (st.click && i % bt.porTempo === 0) som.click(t, i === 0, 0.36);
      const a = soando(posicao(seq[j.idx]));
      if (a) {
        const p = bt.passos[i];
        if (p === 'B' || p === 'C') {
          const direcao = p === 'B' ? 'baixo' : 'cima';
          som.batida(a, { direcao, quando: t, forca: p === 'B' ? 1 : 0.85 });
          const espera = Math.max(0, (t - som.tempoAudio()) * 1000);
          setTimeout(() => { if (st.tocando) vibrar($('#jMini'), a, { direcao }); }, espera);
        } else if (p === 'X') som.abafada(t, a);
        else if (ehDedilhado(p)) som.nota(a, p, { quando: t });
      }
      j.passo++;
      j.tProx += 60 / st.bpm / bt.porTempo;
      if (j.passo >= passosDoAcorde(bt)) { j.passo = 0; j.idx++; }
    }
  }

  async function comecar(desde = 0) {
    if (st.tocando) parar();
    pararRolagem();
    if (!seq.length) return;
    st.tocando = true;
    const vez = ++j.vez;
    clearInterval(j.timer);
    j.desde = Math.min(desde, seq.length - 1);
    j.idx = j.desde;
    j.passo = 0;
    j.inicios = [];
    j.fimEm = Infinity;
    $('#play').innerHTML = ICONES.pausa;
    $('#play').setAttribute('aria-label', 'Parar');
    $('#junto').hidden = false;
    $('#jMini').innerHTML = '';
    marcado = -1;
    som.contexto();
    await som.preparar([...new Set(seq.slice(j.desde))].map(posicao).filter(Boolean).map(soando));
    if (!st.tocando || vez !== j.vez) return;
    const c = som.contexto();
    const bt = batidaDo(j.desde);
    const tempo = 60 / st.bpm;
    j.tProx = c.currentTime + 0.15 + bt.tempos * tempo;     // um compasso de contagem antes
    j.inicios[j.desde] = j.tProx;
    for (let t = 0; t < bt.tempos; t++) som.click(c.currentTime + 0.15 + t * tempo, t === 0, 0.42);
    agendar();
    j.timer = setInterval(agendar, 25);
    j.raf = requestAnimationFrame(acompanhar);
  }

  function parar() {
    st.tocando = false;
    clearInterval(j.timer);
    cancelAnimationFrame(j.raf);
    som.silenciar();
    $('#play').innerHTML = ICONES.play;
    $('#play').setAttribute('aria-label', 'Tocar junto');
    $('#junto').hidden = true;
    el.querySelectorAll('.cf-ac.agora, .cf-ac.prox').forEach((x) => x.classList.remove('agora', 'prox'));
    marcado = -1;
  }

  function acompanhar() {
    if (!st.tocando) return;
    j.raf = requestAnimationFrame(acompanhar);
    const agora = som.tempoAudio();
    if (agora >= j.fimEm + 0.4) { parar(); return; }
    const ini = j.inicios[j.desde];
    if (ini === undefined || agora < ini) {
      // contagem antes de começar
      const falta = ini === undefined ? 0 : Math.ceil((ini - agora) * st.bpm / 60);
      $('#jAgora').textContent = falta ? String(falta) : '';
      $('#jProx').textContent = seq[j.desde];
      $('#jBatida').textContent = batidaDo(j.desde).nome;
      $('#jTroca').style.width = '0%';
      return;
    }
    let idx = Math.max(marcado, j.desde);
    while (j.inicios[idx + 1] !== undefined && j.inicios[idx + 1] <= agora) idx++;
    const fracao = Math.min(1, (agora - j.inicios[idx]) / duracaoDoAcorde(idx));
    $('#jTroca').style.width = `${(fracao * 100).toFixed(1)}%`;
    if (idx !== marcado) {
      el.querySelectorAll('.cf-ac.agora, .cf-ac.prox').forEach((x) => x.classList.remove('agora', 'prox'));
      const atual = el.querySelector(`.cf-ac[data-k="${idx}"]`);
      el.querySelector(`.cf-ac[data-k="${idx + 1}"]`)?.classList.add('prox');
      if (atual) {
        atual.classList.add('agora');
        seguir(atual);
      }
      $('#jAgora').textContent = seq[idx];
      $('#jProx').textContent = seq[idx + 1] || 'Fim';
      $('#jBatida').textContent = batidaDo(idx).nome;
      if (seq[idx] !== seq[marcado]) {
        const a = posicao(seq[idx]);
        $('#jMini').innerHTML = a ? braco(a, { compacto: true }) : '';
      }
      marcado = idx;
    }
  }

  // mantém o acorde que está tocando na parte de cima da tela
  function seguir(alvo) {
    const r = alvo.getBoundingClientRect();
    const doca = $('#doca').getBoundingClientRect().top;
    if (r.top < 70 || r.bottom > Math.min(window.innerHeight * 0.5, doca - 20)) {
      window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.28, behavior: 'smooth' });
    }
  }

  // ---------- rolagem automática ----------
  const rol = { raf: 0, ultimo: 0, resto: 0 };
  function rolar(t) {
    if (!st.rolando) return;
    rol.raf = requestAnimationFrame(rolar);
    const dt = rol.ultimo ? Math.min(0.1, (t - rol.ultimo) / 1000) : 0;
    rol.ultimo = t;
    rol.resto += VELOCIDADES[st.vel] * dt;
    const passo = Math.floor(rol.resto);
    if (passo >= 1) {
      rol.resto -= passo;
      window.scrollBy(0, passo);
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) pararRolagem();
    }
  }
  function comecarRolagem() {
    if (st.tocando) return;
    st.rolando = true;
    rol.ultimo = 0; rol.resto = 0;
    rol.raf = requestAnimationFrame(rolar);
    atualizarRolar();
  }
  function pararRolagem() {
    st.rolando = false;
    cancelAnimationFrame(rol.raf);
    atualizarRolar();
  }
  function atualizarRolar() {
    $('#rolar').classList.toggle('ativo', st.rolando);
    $('#rolar').setAttribute('aria-pressed', String(st.rolando));
    $('#rolarTxt').textContent = st.rolando ? `Rolando ${st.vel + 1}` : 'Rolar';
  }
  // tocar no botão enquanto rola: acelera; na última velocidade, para
  $('#rolar').onclick = () => {
    if (!st.rolando) { comecarRolagem(); return; }
    if (st.vel < VELOCIDADES.length - 1) { st.vel++; salvar(); atualizarRolar(); }
    else { st.vel = 0; salvar(); pararRolagem(); }
  };

  // ---------- gravação original ----------
  const orig = { ativo: false, player: null, sinc: null, raf: 0, k: -2, tocando: false };
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  // em que tom a gravação está (pode ser diferente do tom da cifra)
  const tomGravacao = () => orig.sinc?.tom || m.tom;
  // já busca o mapa, para o toque no botão abrir o vídeo sem esperar (o celular exige)
  if (ritmo?.yt) { sincronia(m.id).then((s) => { orig.sinc = s; if (orig.ativo && !$('#oAviso').dataset.erro) { orig.k = -2; avisoOriginal(); } }); carregarApi().catch(() => {}); }
  const bate = () => orig.sinc &&st.versao === 'principal' && distancia(tomGravacao(), tomAgora()) === 0;

  // o que impede a cifra de bater com o som
  function avisoOriginal() {
    const caixa = $('#oAviso');
    let html = '';
    if (!orig.sinc) html = '<span>Ainda não medi quando cada acorde toca nesta gravação: dá para ouvir, mas a cifra não anda junto.</span>';
    else if (st.versao !== 'principal') html = '<span>A cifra anda junto só na versão principal.</span><button class="cf-volta" data-acao="principal">Usar a principal</button>';
    else if (distancia(tomGravacao(), tomAgora()) !== 0) {
      html = `<span>A gravação está em ${esc(tomGravacao())}; a cifra está em ${esc(tomAgora())}.</span><button class="cf-volta" data-acao="tomGravacao">Pôr em ${esc(tomGravacao())}</button>`;
    }
    caixa.innerHTML = html;
    caixa.hidden = !html;
  }

  function abrirOriginal(desde = null) {
    if (st.tocando) parar();
    pararRolagem();
    orig.ativo = true;
    el.classList.add('com-original');
    $('#orig').hidden = false;
    el.querySelector('.doca-barra').hidden = true;
    $('#original')?.classList.add('ativo');
    avisoOriginal();
    if (!orig.player) {
      orig.player = criarPlayer($('#oVideo'), ritmo.yt, {
        inicio: desde ?? 0,
        autoplay: true,
        aoMudar: (e) => {
          orig.tocando = e === ESTADO.tocando;
          $('#oPlay').innerHTML = orig.tocando ? ICONES.pausa : ICONES.play;
          $('#oPlay').setAttribute('aria-label', orig.tocando ? 'Pausar' : 'Tocar');
          if (orig.tocando && $('#oAviso').dataset.erro) { delete $('#oAviso').dataset.erro; avisoOriginal(); }
        },
        aoErro: (motivo) => {
          if (!orig.ativo) return;
          const caixa = $('#oAviso');
          caixa.dataset.erro = motivo;
          caixa.innerHTML = `<span>${motivo === 'parado' ? 'Toque no vídeo para começar a gravação.'
            : motivo === 'rede' ? 'Não consegui carregar o YouTube. Confira a internet.'
            : 'Este vídeo não abre aqui. Dá para tocar junto com a batida do app.'}</span>`;
          caixa.hidden = false;
        },
      });
    } else {
      if (desde !== null) orig.player.ir(desde);
      orig.player.tocar();
    }
    cancelAnimationFrame(orig.raf);
    orig.k = -2;
    orig.raf = requestAnimationFrame(acompanharOriginal);
  }

  function fecharOriginal() {
    orig.ativo = false;
    delete $('#oAviso').dataset.erro;
    el.classList.remove('com-original');
    cancelAnimationFrame(orig.raf);
    orig.player?.destruir();
    orig.player = null;
    orig.tocando = false;
    $('#orig').hidden = true;
    el.querySelector('.doca-barra').hidden = false;
    $('#original')?.classList.remove('ativo');
    el.querySelectorAll('.cf-ac.agora, .cf-ac.prox').forEach((x) => x.classList.remove('agora', 'prox'));
  }

  // último evento com tempo <= t
  function eventoEm(t) {
    const ev = orig.sinc.eventos;
    let a = 0, b = ev.length - 1, r = -1;
    while (a <= b) { const c = (a + b) >> 1; if (ev[c][0] <= t) { r = c; a = c + 1; } else b = c - 1; }
    return r;
  }

  function acompanharOriginal() {
    if (!orig.ativo) return;
    orig.raf = requestAnimationFrame(acompanharOriginal);
    const t = orig.player.tempo();
    $('#oTempo').textContent = mmss(t);
    const ok = bate();
    const ev = orig.sinc?.eventos || [];
    const i = ok && t <= orig.sinc.ate ? eventoEm(t) : -1;
    const k = i >= 0 ? ev[i][1] : -1;
    const prox = i >= 0 && ev[i + 1] && ev[i + 1][0] <= orig.sinc.ate ? ev[i + 1] : null;
    $('#oTroca').style.width = prox ? `${Math.min(100, ((t - ev[i][0]) / (prox[0] - ev[i][0])) * 100).toFixed(1)}%` : '0%';
    const passou = ok && t > orig.sinc.ate;
    if (passou && $('#oAviso').hidden) {
      $('#oAviso').innerHTML = `<span>A cifra acompanha a gravação até ${mmss(orig.sinc.ate)}. Daqui em diante, siga pelo ouvido.</span>`;
      $('#oAviso').hidden = false;
    } else if (ok && !passou && !$('#oAviso').hidden && !$('#oAviso').dataset.erro) avisoOriginal();
    if (k === orig.k) return;
    orig.k = k;
    el.querySelectorAll('.cf-ac.agora, .cf-ac.prox').forEach((x) => x.classList.remove('agora', 'prox'));
    if (k < 0) {
      // antes do primeiro acorde: mostra qual vem
      const primeiro = ok && ev.length && t < ev[0][0] ? ev[0][1] : -1;
      $('#oAgora').textContent = '';
      $('#oProx').textContent = primeiro >= 0 ? seq[primeiro] || '' : '';
      if (primeiro >= 0) el.querySelector(`.cf-ac[data-k="${primeiro}"]`)?.classList.add('prox');
      return;
    }
    const atual = el.querySelector(`.cf-ac[data-k="${k}"]`);
    if (prox) el.querySelector(`.cf-ac[data-k="${prox[1]}"]`)?.classList.add('prox');
    if (atual) { atual.classList.add('agora'); seguir(atual); }
    $('#oAgora').textContent = seq[k] || '';
    $('#oProx').textContent = prox ? seq[prox[1]] || '' : '';
  }

  // primeira vez que o acorde k toca na gravação
  function tempoDoAcorde(k) {
    const ev = orig.sinc?.eventos || [];
    const achado = ev.find((e) => e[1] === k) || ev.find((e) => e[1] > k);
    return achado ? Math.max(0, achado[0] - 0.6) : null;
  }

  // ---------- cliques ----------
  el.addEventListener('click', (e) => {
    const x = e.target.closest('button, [data-acao]');
    if (!x || x.id === 'rolar') return;
    const acao = x.dataset.acao;
    if (x.classList.contains('cf-ac')) { abrirFolha(x.dataset.s, Number(x.dataset.k)); return; }
    if (x.classList.contains('cf-desenho')) { abrirFolha(x.dataset.s); return; }
    if (x.id === 'play') { st.tocando ? parar() : comecar(0); return; }
    if (x.id === 'original') { orig.ativo ? fecharOriginal() : abrirOriginal(); return; }
    if (x.id === 'oFechar') { fecharOriginal(); return; }
    if (x.id === 'oPlay') { orig.tocando ? orig.player.pausar() : orig.player.tocar(); return; }
    if (acao === 'principal') { st.versao = 'principal'; st.desloc = 0; st.capo = null; salvar(); desenharTudo(); return; }
    if (acao === 'tomGravacao') { st.desloc = distancia(v().tom, tomGravacao()); salvar(); desenharTudo(); return; }

    if (acao === 'fechar') { fecharFolha(); return; }
    if (acao === 'ouvir' || acao === 'dedilhar') {
      const a = soando(posicao(naFolha?.s));
      if (!a) return;
      const palco = $('#folhaBraco');
      if (acao === 'ouvir') { som.batida(a); vibrar(palco, a, { atraso: 30 }); }
      else { som.dedilhar(a); vibrar(palco, a, { atraso: 30, passo: 340 }); }
      return;
    }
    if (acao === 'daqui') {
      const k = naFolha.k;
      fecharFolha();
      if (orig.ativo && bate()) { const t = tempoDoAcorde(k); if (t !== null) { orig.player.ir(t); orig.player.tocar(); } }
      else { if (orig.ativo) fecharOriginal(); comecar(k); }
      return;
    }
    if (acao === 'bpm-' || acao === 'bpm+') { definirBpm(st.bpm + (acao === 'bpm+' ? 5 : -5)); return; }
    if (acao === 'bpm0' && ritmo) { definirBpm(ritmo.bpm); return; }
    if (x.dataset.modo) {
      if (x.dataset.modo === st.modo) return;
      st.modo = x.dataset.modo;
      if (st.tocando) parar();
      salvar();
      desenharTudo();     // as etiquetas de batida nas partes da cifra mudam
      return;
    }
    if (acao === 'letra-' || acao === 'letra+') {
      st.fonte = Math.max(13, Math.min(26, st.fonte + (acao === 'letra+' ? 1 : -1)));
      $('#cifra').style.fontSize = `${st.fonte}px`;
      salvar();
      return;
    }

    // ajustes que mudam a cifra
    let mudou = true;
    if (x.dataset.versao) { if (x.dataset.versao === st.versao) return; st.versao = x.dataset.versao; st.desloc = 0; st.capo = null; }
    else if (acao === 'tom-' || acao === 'tom+') st.desloc = ((st.desloc + (acao === 'tom+' ? 1 : -1) + 17) % 12) - 5;
    else if (acao === 'tom0') st.desloc = 0;
    else if (acao === 'capo-' || acao === 'capo+') st.capo = Math.max(0, Math.min(9, capoAgora() + (acao === 'capo+' ? 1 : -1)));
    else if (x.dataset.afin) st.afin = Number(x.dataset.afin);
    else mudou = false;
    if (mudou) { if (st.tocando) parar(); salvar(); desenharTudo(); return; }

    // ajustes do tocar junto
    if (x.dataset.batida) st.batida = x.dataset.batida;
    else if (x.dataset.cpa) st.cpa = Number(x.dataset.cpa);
    else if (x.id === 'tClick') st.click = !st.click;
    else if (x.dataset.timbre) som.definirTimbre(x.dataset.timbre);
    else return;
    if (st.tocando && (x.dataset.batida || x.dataset.cpa)) parar();
    salvar();
    desenharJunto();
  });

  function definirBpm(valor) {
    st.bpm = Math.max(40, Math.min(160, Math.round(valor)));   // vale a partir do próximo passo
    $('#bpm').textContent = st.bpm;
    desenharJunto();
    salvar();
  }


  // parar a rolagem se a pessoa mexer na tela
  const mexeu = (e) => { if (st.rolando && !e.target.closest?.('#doca')) pararRolagem(); };
  window.addEventListener('wheel', mexeu, { passive: true });
  window.addEventListener('touchstart', mexeu, { passive: true });

  const tecla = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (orig.ativo) { if (orig.tocando) orig.player.pausar(); else orig.player.tocar(); }
      else if (st.tocando) parar();
      else comecar(0);
    }
    if (e.key === 'Escape') fecharFolha();
  };
  const visibilidade = () => { if (document.hidden && st.tocando) parar(); };
  document.addEventListener('keydown', tecla);
  document.addEventListener('visibilitychange', visibilidade);

  desenharTudo();

  // o fim da cifra sempre sobra acima da doca, qualquer que seja a altura dela
  const medida = new ResizeObserver(() => el.style.setProperty('--doca-h', `${$('#doca').offsetHeight}px`));
  medida.observe($('#doca'));

  return () => {
    medida.disconnect();
    fecharOriginal();
    st.tocando = false;
    clearInterval(j.timer);
    cancelAnimationFrame(j.raf);
    pararRolagem();
    som.silenciar();
    window.removeEventListener('wheel', mexeu);
    window.removeEventListener('touchstart', mexeu);
    document.removeEventListener('keydown', tecla);
    document.removeEventListener('visibilitychange', visibilidade);
  };
}
