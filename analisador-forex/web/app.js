/* Terminal de analise grafica.
 *
 * Desenha as velas, marca os padroes escolhidos e traca os niveis de
 * suporte/resistencia. O painel da direita mostra o desempenho MEDIDO de
 * cada padrao no historico completo — inclusive quando o numero e ruim,
 * que e o caso da maioria. Esconder isso seria o contrario do projeto.
 */

const COR = {
  fundo: '#0a0b09',
  regua: '#1b1e17',
  texto: '#6c7264',
  ambar: '#e0a33c',
  alta: '#5aa06a',
  baixa: '#c9553f',
};

const estado = {
  indice: {},
  par: null,
  tf: null,
  dados: null,
  marcados: new Set(),
  grafico: null,
  velas: null,
  linhas: [],
};

const $ = (id) => document.getElementById(id);
const fmt = (v, d) => v == null ? '—' : v.toFixed(d);
const pct = (v) => v == null ? '—' : (v * 100).toFixed(1) + '%';

/* ---------- grafico ---------- */

function criarGrafico() {
  const el = $('grafico');
  const g = LightweightCharts.createChart(el, {
    layout: { background: { color: COR.fundo }, textColor: COR.texto,
              fontFamily: '"IBM Plex Mono", monospace', fontSize: 11 },
    grid: { vertLines: { color: COR.regua }, horzLines: { color: COR.regua } },
    rightPriceScale: { borderColor: '#2a2e23', scaleMargins: { top: .08, bottom: .08 } },
    timeScale: { borderColor: '#2a2e23', timeVisible: true, secondsVisible: false },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: COR.ambar, width: 1, style: 3, labelBackgroundColor: '#3a2c10' },
      horzLine: { color: COR.ambar, width: 1, style: 3, labelBackgroundColor: '#3a2c10' },
    },
    localization: { locale: 'pt-BR' },
  });

  // Alta com corpo vazado, baixa com corpo cheio: o olho separa os dois
  // sem depender so da cor, e o grafico fica legivel em densidade alta.
  const velas = g.addCandlestickSeries({
    upColor: 'rgba(90,160,106,.45)', downColor: COR.baixa,
    borderUpColor: '#74c185', borderDownColor: COR.baixa,
    wickUpColor: '#74c185', wickDownColor: COR.baixa,
  });

  new ResizeObserver(() => g.applyOptions({ width: el.clientWidth, height: el.clientHeight }))
    .observe(el);
  g.applyOptions({ width: el.clientWidth, height: el.clientHeight });

  estado.grafico = g;
  estado.velas = velas;
}

function desenharVelas() {
  const d = estado.dados;
  estado.velas.applyOptions({
    priceFormat: { type: 'price', precision: d.digitos, minMove: Math.pow(10, -d.digitos) },
  });
  estado.velas.setData(d.velas.map(([t, o, h, l, c]) =>
    ({ time: t, open: o, high: h, low: l, close: c })));
  // Abrir com as 4.000 velas na tela viraria uma mancha. Mostra o trecho
  // recente; o resto continua ali para quem arrastar o eixo.
  const n = d.velas.length;
  estado.grafico.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 260), to: n + 6 });
}

function desenharNiveis() {
  estado.linhas.forEach((l) => estado.velas.removePriceLine(l));
  estado.linhas = [];
  if (!$('ver-niveis').checked) return;

  for (const [preco, toques] of estado.dados.niveis) {
    // Mais toques, traco mais grosso: a forca do nivel vira peso visual.
    estado.linhas.push(estado.velas.createPriceLine({
      price: preco,
      color: toques >= 5 ? '#e0a33c' : toques >= 3 ? '#9c7429' : '#5c4519',
      lineWidth: toques >= 5 ? 2 : 1,
      lineStyle: LightweightCharts.LineStyle.Dotted,
      axisLabelVisible: true,
      title: toques + 'x',
    }));
  }
}

function desenharMarcas() {
  if (!$('ver-padroes').checked || !estado.marcados.size) {
    estado.velas.setMarkers([]);
    return;
  }
  const d = estado.dados;
  const marcas = [];
  // Com um so padrao marcado cabe o nome ao lado da seta. Com varios, o
  // rotulo vira ruido e some — a cor e o sentido da seta ja informam.
  const comRotulo = estado.marcados.size === 1;
  for (const nome of estado.marcados) {
    for (const [i, dir] of (d.padroes[nome] || [])) {
      const vela = d.velas[i];
      if (!vela) continue;
      marcas.push({
        time: vela[0],
        position: dir > 0 ? 'belowBar' : 'aboveBar',
        color: dir > 0 ? COR.alta : COR.baixa,
        shape: dir > 0 ? 'arrowUp' : 'arrowDown',
        text: comRotulo ? nome.replace(/_/g, ' ') : '',
      });
    }
  }
  marcas.sort((a, b) => a.time - b.time);
  estado.velas.setMarkers(marcas);
  atualizarContagem(marcas.length);
}

function atualizarContagem(n) {
  const q = estado.marcados.size;
  $('contagem').textContent = q === 0
    ? 'nenhum padrão marcado'
    : `${q} padrã${q > 1 ? 'os' : 'o'} · ${n.toLocaleString('pt-BR')} ocorrências na janela`;
}

/* ---------- painel ---------- */

function paga(e, breakeven) {
  return (e.taxa != null && e.taxa > breakeven) || (e.expectativa_r != null && e.expectativa_r > 0);
}

function montarLista() {
  const d = estado.dados;
  const lista = $('lista');
  lista.innerHTML = '';
  const soValidos = $('so-validos').checked;

  const ordenados = Object.entries(d.estatisticas)
    .sort((a, b) => (b[1].taxa ?? 0) - (a[1].taxa ?? 0));

  for (const [nome, e] of ordenados) {
    if (soValidos && !paga(e, d.breakeven)) continue;

    const bomTaxa = e.taxa != null && e.taxa > d.breakeven;
    const bomR = e.expectativa_r != null && e.expectativa_r > 0;
    const largura = Math.min(100, Math.max(0, (e.taxa ?? 0) * 100));
    const marcaBreak = d.breakeven * 100;

    const div = document.createElement('div');
    div.className = 'padrao' + (estado.marcados.has(nome) ? ' ativo' : '');
    div.innerHTML = `
      <div class="padrao-topo">
        <span class="padrao-nome">${nome.replace(/_/g, ' ')}</span>
        <span class="padrao-n num">${e.ocorrencias.toLocaleString('pt-BR')}</span>
      </div>
      <div class="padrao-desc">${e.descricao}</div>
      <div class="medidas">
        <div class="medida"><i>acerto</i>
          <b class="num ${bomTaxa ? 'bom' : 'ruim'}">${pct(e.taxa)}</b></div>
        <div class="medida"><i>piso ic</i>
          <b class="num">${pct(e.ic_inf)}</b></div>
        <div class="medida"><i>expect.</i>
          <b class="num ${bomR ? 'bom' : 'ruim'}">${fmt(e.expectativa_r, 3)}R</b></div>
      </div>
      <div class="trilho">
        <i class="${bomTaxa ? 'bom' : ''}" style="width:${largura}%"></i>
        <u style="left:${marcaBreak}%"></u>
      </div>
      <div class="nota">${e.veredito}</div>`;

    div.addEventListener('click', () => {
      estado.marcados.has(nome) ? estado.marcados.delete(nome) : estado.marcados.add(nome);
      div.classList.toggle('ativo');
      $('todos').checked = estado.marcados.size === Object.keys(d.estatisticas).length;
      desenharMarcas();
      if (!estado.marcados.size) atualizarContagem(0);
    });
    lista.appendChild(div);
  }

  if (!lista.children.length) {
    // Estado vazio explicado: aqui "nenhum" e resultado, nao falha de carga.
    lista.innerHTML = `
      <div class="vazio">
        <span class="rotulo">nenhum padrão acima do custo</span>
        <p>Em ${estado.par} ${estado.tf}, nenhum dos 14 padrões supera o
        custo nem na média bruta. Desmarque o filtro para ver os números
        de todos.</p>
      </div>`;
  }

  const m = d.meta;
  $('rodape').innerHTML = `
    <b>Como ler.</b> A barra mostra a taxa de acerto; o risco âmbar é o
    breakeven da binária (${pct(d.breakeven)}), acima do qual o padrão começa a
    pagar o custo. “Expect.” é a expectativa em R no modo tradicional, já com o
    spread real descontado — aqui o custo do par é
    <b>${fmt(m.custo_em_r, 3)}R</b> por operação.<br><br>
    Medido sobre <b>${m.barras_total.toLocaleString('pt-BR')}</b> barras
    (${m.inicio_historico} a ${m.fim_historico}). O gráfico mostra as últimas
    ${m.barras_janela.toLocaleString('pt-BR')}.<br><br>
    <b>Média bruta não é vantagem comprovada.</b> Alguns padrões aparecem
    acima do custo aqui, mas nenhum resistiu à correção de múltiplos testes
    nem se manteve fora da amostra. Com 490 combinações medidas, algumas
    ficam positivas por acaso — é o esperado, não uma descoberta.`;
}

function montarMostradores() {
  const d = estado.dados, m = d.meta;
  const ultima = d.velas[d.velas.length - 1];
  const primeira = d.velas[0];
  const variacao = ((ultima[4] - primeira[4]) / primeira[4]) * 100;

  const itens = [
    ['par', d.par],
    ['tf', d.timeframe],
    ['último', ultima[4].toFixed(d.digitos), true],
    ['janela', (variacao >= 0 ? '+' : '') + variacao.toFixed(2) + '%'],
    ['barras', m.barras_total.toLocaleString('pt-BR')],
    ['período', m.inicio_historico + ' › ' + m.fim_historico.split(' ')[0]],
    ['atr', m.atr_pontos + ' pts'],
    ['spread', m.spread_mediano.toFixed(0) + ' pts'],
    ['custo', fmt(m.custo_em_r, 3) + 'R', true],
    ['níveis', d.niveis.length],
  ];

  $('mostradores').innerHTML = itens.map(([r, v, destaque]) => `
    <div class="mostrador">
      <span class="rotulo">${r}</span>
      <span class="num ${destaque ? 'destaque' : ''}">${v}</span>
    </div>`).join('');
}

/* ---------- navegacao ---------- */

function montarPares() {
  $('pares').innerHTML = Object.keys(estado.indice).map((p) =>
    `<button data-par="${p}" aria-pressed="${p === estado.par}">${p}</button>`).join('');
  $('pares').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => carregar(b.dataset.par, null)));
}

function montarTimeframes() {
  const tfs = estado.indice[estado.par] || [];
  $('timeframes').innerHTML = tfs.map((t) =>
    `<button data-tf="${t}" aria-pressed="${t === estado.tf}">${t}</button>`).join('');
  $('timeframes').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => carregar(estado.par, b.dataset.tf)));
}

async function carregar(par, tf) {
  const tfs = estado.indice[par] || [];
  estado.par = par;
  estado.tf = tfs.includes(tf) ? tf : (tfs.includes(estado.tf) ? estado.tf : tfs[0]);

  $('carregando').classList.remove('oculto');
  const r = await fetch(`dados/${estado.par}_${estado.tf}.json`);
  estado.dados = await r.json();

  montarPares();
  montarTimeframes();
  montarMostradores();
  desenharVelas();
  desenharNiveis();
  montarLista();
  desenharMarcas();
  if (!estado.marcados.size) atualizarContagem(0);
  $('carregando').classList.add('oculto');
}

async function iniciar() {
  criarGrafico();
  estado.indice = await (await fetch('dados/indice.json')).json();

  $('ver-niveis').addEventListener('change', desenharNiveis);
  $('ver-padroes').addEventListener('change', desenharMarcas);
  $('so-validos').addEventListener('change', montarLista);
  $('todos').addEventListener('change', (e) => {
    estado.marcados = e.target.checked
      ? new Set(Object.keys(estado.dados.estatisticas)) : new Set();
    montarLista();
    desenharMarcas();
    if (!estado.marcados.size) atualizarContagem(0);
  });

  const primeiro = Object.keys(estado.indice)[0];
  await carregar(primeiro, 'H1');
  // Um padrao ja marcado na abertura: a tela vazia nao ensina nada.
  estado.marcados.add('engolfo');
  montarLista();
  desenharMarcas();
}

iniciar();
