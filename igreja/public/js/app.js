// ════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════
const brl = (v) => Number(v || 0).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
const dataBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const hojeISO = () => new Date().toISOString().slice(0, 10);
const mesISO = () => new Date().toISOString().slice(0, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(path, opts = {}) {
  const r = await fetch('api/' + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (r.status === 401) { location.href = 'login.html'; throw new Error('nao autenticado'); }
  return r;
}
const getJSON = async (p) => (await api(p)).json();

// ─── Moeda: máscara R$ 0,00 (apenas números) ───
const fmtMoeda = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-br', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseMoeda = (str) => { const n = String(str).replace(/\D/g, ''); return n ? Number(n) / 100 : 0; };
function maskMoeda(el, valorInicial) {
  el.setAttribute('inputmode', 'numeric');
  el.placeholder = 'R$ 0,00';
  if (valorInicial != null) el.value = valorInicial ? fmtMoeda(valorInicial) : '';
  el.addEventListener('input', () => {
    el.value = el.value.replace(/\D/g, '') ? fmtMoeda(parseMoeda(el.value)) : '';
  });
}
const aplicarMoeda = (...ids) => ids.forEach((id) => { const el = document.getElementById(id); if (el) maskMoeda(el); });

// ─── Modal genérico ───
function abrirModal(titulo, corpoHTML) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal-box">
    <div class="modal-head"><h2>${titulo}</h2><button class="modal-x" title="Fechar">✕</button></div>
    <div class="modal-body">${corpoHTML}</div>
  </div>`;
  document.body.appendChild(ov);
  const fechar = () => ov.remove();
  ov.querySelector('.modal-x').addEventListener('click', fechar);
  ov.addEventListener('click', (e) => { if (e.target === ov) fechar(); });
  return { el: ov, fechar };
}

const app = document.getElementById('app');
const titulo = document.getElementById('titulo-pagina');

const TITULOS = {
  dashboard: 'Dashboard',
  entrada: 'Lançar Dízimo / Oferta',
  despesas: 'Despesas',
  'contas-pagar': 'Contas a Pagar',
  'membro-cadastrar': 'Cadastrar Membro',
  'membro-consultar': 'Consultar Membros',
  cadastros: 'Cadastros',
  exportar: 'Exportar Relatório',
};

// ════════════════════════════════════════════════
//  Shell (menu, navegação)
// ════════════════════════════════════════════════
function initShell() {
  // recolher menu
  document.getElementById('btn-menu').addEventListener('click', () =>
    document.querySelector('.layout').classList.toggle('recolhido')
  );

  // accordion dos grupos
  document.querySelectorAll('.grupo-head').forEach((h) =>
    h.addEventListener('click', () => h.parentElement.classList.toggle('aberto'))
  );

  // clique nos itens de rota
  document.querySelectorAll('.menu .item[data-rota]').forEach((a) =>
    a.addEventListener('click', () => navegar(a.dataset.rota))
  );

  document.getElementById('btn-sair').addEventListener('click', async () => {
    await api('auth/logout', { method: 'POST' });
    location.href = 'login.html';
  });
}

function navegar(rota) {
  document.querySelectorAll('.menu .item').forEach((i) => i.classList.remove('ativo'));
  const item = document.querySelector(`.menu .item[data-rota="${rota}"]`);
  if (item) { item.classList.add('ativo'); const g = item.closest('.grupo'); if (g) g.classList.add('aberto'); }
  titulo.textContent = TITULOS[rota] || '';
  (VIEWS[rota] || VIEWS.dashboard)();
}

// ════════════════════════════════════════════════
//  Views
// ════════════════════════════════════════════════
const VIEWS = {};

// ─── Dashboard (réplica cashtrack) ───
let _charts = [];
let _dashMes = mesISO();
const nomeMes = (m) => ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m - 1];
const kfmt = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'K' : String(Math.round(v)));

VIEWS.dashboard = async () => {
  app.innerHTML = `<div class="dash">
    <div class="strip-wrap">
      <button class="strip-arrow" id="strip-prev" title="Anterior">‹</button>
      <div class="month-strip" id="strip"></div>
      <button class="strip-arrow" id="strip-next" title="Próximo">›</button>
    </div>

    <div class="dash-grid-1">
      <div class="painel">
        <h2>Até o momento <small id="lbl-mes"></small></h2>
        <div class="momento-row">
          <div class="momento-itens">
            <div class="mi mi-entrou"><span class="seta up">↑</span><div><b>Entrou</b><small>Receitas</small></div><strong id="d-entrou" class="val-entrada"></strong></div>
            <div class="mi mi-saiu"><span class="seta down">↓</span><div><b>Saiu</b><small>Despesas</small></div><strong id="d-saiu" class="val-saida"></strong></div>
            <div class="mi mi-sobrou"><span class="seta eq">→</span><div><b>Sobrou</b><small>Saldo</small></div><strong id="d-sobrou"></strong></div>
          </div>
          <div class="donut-wrap"><canvas id="g-donut"></canvas></div>
        </div>
      </div>
      <div class="painel">
        <h2>Comparação <small>com período anterior</small></h2>
        <canvas id="g-comp" height="200"></canvas>
      </div>
      <div class="painel">
        <h2>Para acontecer <small>despesas futuras</small></h2>
        <div id="d-apagar" class="lista-mini"></div>
        <div class="saldo-total">Saldo total<strong id="d-saldo-total"></strong></div>
      </div>
    </div>

    <div class="dash-grid-2">
      <div class="painel">
        <h2>Fluxo financeiro <small>evolução dos últimos 6 meses</small></h2>
        <canvas id="g-fluxo" height="110"></canvas>
      </div>
      <div class="painel">
        <h2>Pendentes <small>despesas atrasadas</small></h2>
        <div id="d-pendentes" class="lista-mini"></div>
        <div class="saldo-total">Total pendente<strong id="d-total-pend" class="val-saida"></strong></div>
      </div>
    </div>

    <div class="dash-kpis" id="d-kpis"></div>
  </div>`;

  document.getElementById('strip-prev').addEventListener('click', () =>
    document.getElementById('strip').scrollBy({ left: -260, behavior: 'smooth' }));
  document.getElementById('strip-next').addEventListener('click', () =>
    document.getElementById('strip').scrollBy({ left: 260, behavior: 'smooth' }));

  await carregarDashboard();
};

const listaMini = (arr, vazio) => arr.length
  ? arr.slice(0, 6).map((p) =>
      `<div class="lm-item"><span class="lm-nome">${esc(p.fornecedor || '—')}${p.parcela_label ? ' <small>' + p.parcela_label + '</small>' : ''}</span><b class="val-saida">– ${brl(p.valor)}</b></div>`).join('')
  : `<p class="vazio">${vazio}</p>`;

async function carregarDashboard() {
  _charts.forEach((c) => c.destroy()); _charts = [];
  const d = await getJSON('dashboard?mes=' + _dashMes);

  // Régua de meses
  document.getElementById('strip').innerHTML = d.meses.map((m) => {
    const mm = Number(m.mes.split('-')[1]);
    const ativo = m.mes === _dashMes ? ' ativo' : '';
    return `<button class="ms${ativo}" data-mes="${m.mes}">
      <span class="ms-nome">${nomeMes(mm)} ${String(d.ano).slice(2)}</span>
      <span class="ms-tot"><span class="up">↑${kfmt(m.entradas)}</span> <span class="down">↓${kfmt(m.saidas)}</span></span>
    </button>`;
  }).join('');
  document.querySelectorAll('.ms').forEach((b) => b.addEventListener('click', () => {
    _dashMes = b.dataset.mes; carregarDashboard();
  }));
  const at = document.querySelector('.ms.ativo'); if (at) at.scrollIntoView({ inline: 'center', block: 'nearest' });

  // Até o momento
  document.getElementById('lbl-mes').textContent = nomeMes(Number(_dashMes.split('-')[1])) + ' ' + _dashMes.split('-')[0];
  document.getElementById('d-entrou').textContent = brl(d.atual.entradas);
  document.getElementById('d-saiu').textContent = '– ' + brl(d.atual.saidas);
  document.getElementById('d-sobrou').textContent = brl(d.atual.saldo);
  document.getElementById('d-saldo-total').textContent = brl(d.saldo_total);
  document.getElementById('d-total-pend').textContent = '– ' + brl(d.total_pendente);

  // Listas
  document.getElementById('d-apagar').innerHTML = listaMini(d.a_pagar, 'Nada futuro. 🎉');
  document.getElementById('d-pendentes').innerHTML = listaMini(d.pendentes, 'Nada atrasado. 🎉');

  // KPIs da igreja (membros + bancos)
  document.getElementById('d-kpis').innerHTML =
    `<div class="kpi"><span>👥 Membros ativos</span><strong>${d.membros_ativos}</strong></div>` +
    d.bancos.map((b) => `<div class="kpi"><span>🏦 ${esc(b.nome)}</span><strong>${brl(b.saldo)}</strong></div>`).join('');

  // Donut
  _charts.push(new Chart(document.getElementById('g-donut'), {
    type: 'doughnut',
    data: { labels: ['Entrou', 'Saiu'], datasets: [{ data: [d.atual.entradas, d.atual.saidas], backgroundColor: ['#16a34a', '#ef4444'], borderWidth: 0 }] },
    options: { cutout: '72%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  }));

  // Comparação
  _charts.push(new Chart(document.getElementById('g-comp'), {
    type: 'bar',
    data: {
      labels: ['Anterior', 'Atual'],
      datasets: [
        { label: 'Entrou', data: [d.anterior.entradas, d.atual.entradas], backgroundColor: '#16a34a', borderRadius: 4 },
        { label: 'Saiu', data: [d.anterior.saidas, d.atual.saidas], backgroundColor: '#ef4444', borderRadius: 4 },
      ],
    },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
  }));

  // Fluxo 6 meses — barras Receita/Gasto + área azul "Consolidado" atrás
  _charts.push(new Chart(document.getElementById('g-fluxo'), {
    data: {
      labels: d.fluxo.map((f) => nomeMes(Number(f.mes.split('-')[1]))),
      datasets: [
        {
          type: 'line', label: 'Consolidado', data: d.fluxo.map((f) => f.consolidado),
          borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.18)',
          fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0, order: 0,
        },
        { type: 'bar', label: 'Receita', data: d.fluxo.map((f) => f.receita), backgroundColor: '#16a34a', borderRadius: 4, order: 1 },
        { type: 'bar', label: 'Gasto', data: d.fluxo.map((f) => f.gasto), backgroundColor: '#ef4444', borderRadius: 4, order: 1 },
      ],
    },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
  }));
}

// ─── Lançar Dízimo / Oferta (entrada) ───
VIEWS.entrada = async () => {
  const [bancos, membros] = await Promise.all([getJSON('bancos'), getJSON('membros?situacao=ativo')]);
  app.innerHTML = `
  <div class="painel">
    <h2>Nova entrada</h2>
    <form id="f" class="form-grid">
      <label class="check-linha"><input type="checkbox" id="visitante"> Visitante (somente oferta)</label>
      <label id="wrap-membro">Membro
        <div class="inline-add">
          <select id="membro"><option value=""></option>${membros.map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</select>
          <button type="button" class="ghost pequeno" id="add-membro" title="Cadastrar novo membro">+ Novo membro</button>
        </div>
      </label>
      <div class="linha">
        <label id="wrap-tipo">Tipo
          <select id="tipo_gasto" required><option value=""></option><option value="DIZIMO">Dízimo</option><option value="OFERTA">Oferta</option></select>
        </label>
        <label>Valor<input type="text" id="valor" required></label>
      </div>
      <div class="linha">
        <label>Banco<select id="banco" required><option value=""></option>${bancos.map((b) => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></label>
        <label>Data<input type="date" id="data" required></label>
      </div>
      <label>Observação<input type="text" id="detalhes" maxlength="255"></label>
      <button type="submit">Lançar entrada</button>
      <p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel">
    <h2>Entradas de ${mesISO().split('-').reverse().join('/')}</h2>
    <div id="lista"></div>
  </div>`;

  aplicarMoeda('valor');

  const visit = document.getElementById('visitante');
  const tipoSel = document.getElementById('tipo_gasto');
  const wrapMembro = document.getElementById('wrap-membro');
  const wrapTipo = document.getElementById('wrap-tipo');
  visit.addEventListener('change', () => {
    // Visitante: esconde Membro e Tipo (sempre Oferta)
    wrapMembro.style.display = visit.checked ? 'none' : 'flex';
    wrapTipo.style.display = visit.checked ? 'none' : 'flex';
    if (visit.checked) tipoSel.value = 'OFERTA';
    else tipoSel.value = '';
  });

  // + Novo membro (cadastro rápido em modal)
  document.getElementById('add-membro').addEventListener('click', () => {
    const m = abrirModal('Cadastro rápido de membro', `
      <form id="fm" class="form-grid" style="max-width:none">
        <label>Nome completo *<input type="text" id="m-nome" required></label>
        <div class="linha">
          <label>Telefone<input type="text" id="m-tel"></label>
          <label>Sexo<select id="m-sexo"><option value=""></option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>
        </div>
        <label>Data de nascimento<input type="date" id="m-nasc"></label>
        <button type="submit">Salvar e selecionar</button>
        <p id="m-msg" class="erro"></p>
      </form>`);
    m.el.querySelector('#fm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await api('membros', { method: 'POST', body: JSON.stringify({
        nome: m.el.querySelector('#m-nome').value,
        telefone: m.el.querySelector('#m-tel').value,
        sexo: m.el.querySelector('#m-sexo').value || null,
        data_nascimento: m.el.querySelector('#m-nasc').value || null,
      }) });
      const d = await r.json();
      if (!r.ok) { m.el.querySelector('#m-msg').textContent = d.erro; return; }
      // recarrega o select e já seleciona o novo membro
      const novos = await getJSON('membros?situacao=ativo');
      const sel = document.getElementById('membro');
      sel.innerHTML = novos.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join('');
      sel.value = d.id;
      m.fechar();
    });
  });

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('lancamentos/entrada', {
      method: 'POST',
      body: JSON.stringify({
        visitante: visit.checked,
        membro_id: visit.checked ? null : document.getElementById('membro').value,
        tipo_gasto: tipoSel.value,
        valor: parseMoeda(document.getElementById('valor').value),
        banco_id: document.getElementById('banco').value,
        data: document.getElementById('data').value,
        detalhes: document.getElementById('detalhes').value,
      }),
    });
    const d = await r.json();
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    msg.className = 'ok-msg'; msg.textContent = 'Entrada lançada!';
    document.getElementById('valor').value = '';
    listarEntradas();
  });

  async function listarEntradas() {
    const ls = await getJSON('lancamentos?tipo=entrada&mes=' + mesISO());
    document.getElementById('lista').innerHTML = tabela(ls, [
      ['Data', (l) => dataBR(l.data)],
      ['Quem', (l) => (l.visitante ? 'Visitante' : esc(l.membro_nome || ''))],
      ['Tipo', (l) => l.tipo_gasto],
      ['Banco', (l) => esc(l.banco_nome)],
      ['Valor', (l) => `<span class="val-entrada">${brl(l.valor)}</span>`],
      ['', (l) => `<button class="acao-link acao-del" data-del="${l.id}">✕</button>`],
    ]);
    ligarDelete('lancamentos', listarEntradas);
  }
  listarEntradas();
};

// ─── Despesas: aba Variáveis ───
async function buildVariavel(host) {
  const [bancos, fornecedores, centros, formas] = await Promise.all([
    getJSON('bancos'), getJSON('fornecedores'), getJSON('centros-custo'), getJSON('formas-pagamento'),
  ]);
  host.innerHTML = `
  <div class="painel">
    <h2>Nova despesa variável</h2>
    <p class="desc">A despesa entra como <b>pendente</b> e aparece em "Contas a Pagar" para você marcar como paga. Para despesas parceladas, use a aba <b>Parcelamentos</b>.</p>
    <form id="f" class="form-grid">
      <label>Fornecedor
        <div class="inline-add">
          <select id="fornecedor" required><option value=""></option>${optFornecedor(fornecedores)}</select>
          <button type="button" class="ghost pequeno" id="add-fornecedor" title="Novo fornecedor">+</button>
        </div>
      </label>
      <label>Centro de custo
        <div class="inline-add">
          <select id="centro"><option value=""></option>${centros.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>
          <button type="button" class="ghost pequeno" id="add-centro" title="Novo centro de custo">+</button>
        </div>
      </label>
      <div class="linha">
        <label>Valor<input type="text" id="valor" required></label>
        <label>Banco<select id="banco" required><option value=""></option>${bancos.map((b) => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></label>
      </div>
      <div class="linha">
        <label>Data<input type="date" id="data" required></label>
        <label>Forma de pagamento<select id="forma" required>${optById(formas)}</select></label>
      </div>
      <label>Descrição<input type="text" id="detalhes" maxlength="255"></label>
      <button type="submit">Lançar despesa</button>
      <p id="msg" class="erro"></p>
    </form>
  </div>`;

  aplicarMoeda('valor');
  ligarAddFornecedor('add-fornecedor', 'fornecedor');
  ligarAddCentro('add-centro', 'centro');

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('lancamentos/saida', {
      method: 'POST',
      body: JSON.stringify({
        fornecedor_id: document.getElementById('fornecedor').value,
        centro_custo_id: document.getElementById('centro').value,
        valor: parseMoeda(document.getElementById('valor').value),
        banco_id: document.getElementById('banco').value,
        data: document.getElementById('data').value,
        forma_pagamento: document.getElementById('forma').value,
        parcelado: false,
        detalhes: document.getElementById('detalhes').value,
      }),
    });
    const d = await r.json();
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    msg.className = 'ok-msg'; msg.textContent = 'Despesa lançada!';
    document.getElementById('f').reset();
  });
}

// Helpers de cadastro rápido reutilizados nas telas de despesa
function ligarAddFornecedor(btnId, selectId) {
  document.getElementById(btnId).addEventListener('click', async () => {
    const novo = await quickCadastro('Novo fornecedor', 'fornecedores', [
      { id: 'nome', label: 'Nome', req: true }, { id: 'telefone', label: 'Telefone' },
    ]);
    if (novo) await refreshSelect(selectId, 'fornecedores', novo.id);
  });
}
function ligarAddCentro(btnId, selectId) {
  document.getElementById(btnId).addEventListener('click', async () => {
    const novo = await quickCadastro('Novo centro de custo', 'centros-custo', [
      { id: 'nome', label: 'Nome', req: true },
    ]);
    if (novo) await refreshSelect(selectId, 'centros-custo', novo.id);
  });
}

// ─── Despesas: aba Fixas ───
async function buildFixa(host) {
  const [bancos, fornecedores, centros] = await Promise.all([
    getJSON('bancos'), getJSON('fornecedores'), getJSON('centros-custo'),
  ]);
  host.innerHTML = `
  <div class="painel">
    <h2>Nova despesa fixa</h2>
    <p class="desc">Modelo recorrente. Gere os lançamentos do mês com o botão abaixo (entram como pendentes).</p>
    <form id="f" class="form-grid">
      <label>Descrição<input type="text" id="descricao" placeholder="Ex.: Aluguel apto pastoral" maxlength="255"></label>
      <div class="linha">
        <label>Fornecedor
          <div class="inline-add">
            <select id="fornecedor"><option value=""></option>${optFornecedor(fornecedores)}</select>
            <button type="button" class="ghost pequeno" id="add-fornecedor" title="Novo fornecedor">+</button>
          </div>
        </label>
        <label>Centro de custo
          <div class="inline-add">
            <select id="centro"><option value=""></option>${centros.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>
            <button type="button" class="ghost pequeno" id="add-centro" title="Novo centro de custo">+</button>
          </div>
        </label>
      </div>
      <div class="linha-3">
        <label>Valor<input type="text" id="valor" required></label>
        <label>Dia venc.<input type="number" min="1" max="28" id="dia" placeholder="5"></label>
        <label>Banco<select id="banco" required><option value=""></option>${bancos.map((b) => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></label>
      </div>
      <button type="submit">Salvar despesa fixa</button>
      <p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel">
    <h2>Despesas fixas cadastradas</h2>
    <div class="toolbar">
      <label class="check-linha" style="margin:0">Gerar mês <input type="month" id="mes-gerar" value="${mesISO()}" style="width:auto"></label>
      <button class="pequeno" id="btn-gerar">Gerar lançamentos do mês</button>
      <span id="msg-gerar" class="ok-msg"></span>
    </div>
    <div id="lista"></div>
  </div>`;

  aplicarMoeda('valor');
  ligarAddFornecedor('add-fornecedor', 'fornecedor');
  ligarAddCentro('add-centro', 'centro');
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('despesas-fixas', {
      method: 'POST',
      body: JSON.stringify({
        descricao: document.getElementById('descricao').value,
        fornecedor_id: document.getElementById('fornecedor').value,
        centro_custo_id: document.getElementById('centro').value,
        valor: parseMoeda(document.getElementById('valor').value),
        dia_vencimento: document.getElementById('dia').value,
        banco_id: document.getElementById('banco').value,
      }),
    });
    const d = await r.json();
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    document.getElementById('f').reset();
    listar();
  });

  document.getElementById('btn-gerar').addEventListener('click', async () => {
    const mes = document.getElementById('mes-gerar').value;
    const d = await (await api('despesas-fixas/gerar', { method: 'POST', body: JSON.stringify({ mes }) })).json();
    document.getElementById('msg-gerar').textContent = `${d.gerados} lançamento(s) gerado(s).`;
  });

  async function listar() {
    const fs = await getJSON('despesas-fixas');
    document.getElementById('lista').innerHTML = tabela(fs, [
      ['Descrição', (f) => esc(f.descricao || '—')],
      ['Fornecedor', (f) => esc(f.fornecedor_nome || '—')],
      ['Centro', (f) => esc(f.centro_custo_nome || '—')],
      ['Dia', (f) => f.dia_vencimento],
      ['Valor', (f) => `<span class="val-saida">${brl(f.valor)}</span>`],
      ['', (f) => `<button class="acao-link acao-del" data-del="${f.id}">✕</button>`],
    ]);
    ligarDelete('despesas-fixas', listar);
  }
  listar();
}

// ─── Despesas: aba Parcelamentos (criar + acompanhar) ───
async function buildParcelamentos(host) {
  const [bancos, fornecedores, centros, formas] = await Promise.all([
    getJSON('bancos'), getJSON('fornecedores'), getJSON('centros-custo'), getJSON('formas-pagamento'),
  ]);
  host.innerHTML = `
  <div class="painel">
    <h2>Nova despesa parcelada</h2>
    <p class="desc">Informe o valor total e a quantidade de parcelas. As parcelas futuras são geradas automaticamente (uma por mês) como pendentes.</p>
    <form id="f" class="form-grid">
      <label>Fornecedor
        <div class="inline-add">
          <select id="fornecedor" required><option value=""></option>${optFornecedor(fornecedores)}</select>
          <button type="button" class="ghost pequeno" id="add-fornecedor" title="Novo fornecedor">+</button>
        </div>
      </label>
      <label>Centro de custo
        <div class="inline-add">
          <select id="centro"><option value=""></option>${centros.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>
          <button type="button" class="ghost pequeno" id="add-centro" title="Novo centro de custo">+</button>
        </div>
      </label>
      <div class="linha-3">
        <label>Valor total<input type="text" id="valor" required></label>
        <label>Nº de parcelas<input type="number" min="2" max="48" id="num_parcelas" value="2" required></label>
        <label>Banco<select id="banco" required><option value=""></option>${bancos.map((b) => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></label>
      </div>
      <div class="linha">
        <label>Data da 1ª parcela<input type="date" id="data" required></label>
        <label>Forma de pagamento<select id="forma" required>${optById(formas)}</select></label>
      </div>
      <label>Descrição<input type="text" id="detalhes" maxlength="255"></label>
      <button type="submit">Lançar parcelamento</button>
      <p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel"><h2>Parcelas lançadas</h2><div id="lista"></div></div>`;

  aplicarMoeda('valor');
  ligarAddFornecedor('add-fornecedor', 'fornecedor');
  ligarAddCentro('add-centro', 'centro');

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('lancamentos/saida', { method: 'POST', body: JSON.stringify({
      fornecedor_id: document.getElementById('fornecedor').value,
      centro_custo_id: document.getElementById('centro').value,
      valor: parseMoeda(document.getElementById('valor').value),
      banco_id: document.getElementById('banco').value,
      data: document.getElementById('data').value,
      forma_pagamento: document.getElementById('forma').value,
      parcelado: true,
      num_parcelas: document.getElementById('num_parcelas').value,
      detalhes: document.getElementById('detalhes').value,
    }) });
    const d = await r.json();
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    msg.className = 'ok-msg'; msg.textContent = `Parcelamento lançado em ${d.parcelas} parcelas!`;
    document.getElementById('f').reset();
    listar();
  });

  async function listar() {
    const ls = await getJSON('lancamentos?tipo=saida');
    const parcelas = ls.filter((l) => l.parcela_label).sort((a, b) => a.data.localeCompare(b.data));
    document.getElementById('lista').innerHTML = tabela(parcelas, [
      ['Fornecedor', (l) => esc(l.fornecedor_nome || '—')],
      ['Parcela', (l) => `<b>${l.parcela_label}</b>`],
      ['Vencimento', (l) => dataBR(l.data)],
      ['Valor', (l) => `<span class="val-saida">${brl(l.valor)}</span>`],
      ['Situação', (l) => `<span class="badge ${l.situacao}">${l.situacao === 'pago' ? 'Pago' : 'Pendente'}</span>`],
    ], 'Nenhuma despesa parcelada ainda.');
  }
  listar();
}

// ─── Despesas (tela única com abas) ───
VIEWS.despesas = () => {
  app.innerHTML = `
  <div class="tabs">
    <button class="tab ativo" data-tab="variaveis">Variáveis</button>
    <button class="tab" data-tab="fixas">Fixas</button>
    <button class="tab" data-tab="parcelamentos">Parcelamentos</button>
  </div>
  <div id="tab-content"></div>`;

  const content = document.getElementById('tab-content');
  const builders = { variaveis: buildVariavel, fixas: buildFixa, parcelamentos: buildParcelamentos };

  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('ativo'));
      t.classList.add('ativo');
      builders[t.dataset.tab](content);
    })
  );
  buildVariavel(content);
};

// ─── Fornecedores (cadastro) ───
async function buildFornecedores(host) {
  host.innerHTML = `
  <div class="painel">
    <h2>Novo fornecedor</h2>
    <form id="f" class="form-grid">
      <label>Nome *<input type="text" id="nome" required></label>
      <div class="linha">
        <label>Telefone<input type="text" id="telefone"></label>
        <label>CPF/CNPJ<input type="text" id="documento"></label>
      </div>
      <label>Observação<input type="text" id="observacao"></label>
      <button type="submit">Salvar</button>
      <p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel">
    <h2>Fornecedores</h2>
    <div class="toolbar"><input class="cresce" id="busca" placeholder="Buscar por nome..."></div>
    <div id="lista"></div>
  </div>`;

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('fornecedores', { method: 'POST', body: JSON.stringify({
      nome: document.getElementById('nome').value,
      telefone: document.getElementById('telefone').value,
      documento: document.getElementById('documento').value,
      observacao: document.getElementById('observacao').value,
    }) });
    const d = await r.json();
    if (!r.ok) { msg.textContent = d.erro; return; }
    document.getElementById('f').reset();
    listar();
  });

  document.getElementById('busca').addEventListener('input', (e) => listar(e.target.value));

  let cache = [];
  async function listar(busca = '') {
    cache = await getJSON('fornecedores?busca=' + encodeURIComponent(busca));
    document.getElementById('lista').innerHTML = tabela(cache, [
      ['Nome', (f) => esc(f.nome)],
      ['Telefone', (f) => esc(f.telefone || '—')],
      ['CPF/CNPJ', (f) => esc(f.documento || '—')],
      ['', (f) => `<button class="acao-link" data-edit="${f.id}">✎ Editar</button>
                   <button class="acao-link acao-del" data-del="${f.id}">✕</button>`],
    ]);
    document.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => editar(cache.find((x) => String(x.id) === b.dataset.edit))));
    ligarDelete('fornecedores', () => listar(busca));
  }

  function editar(f) {
    const m = abrirModal('Editar fornecedor', `
      <form id="fe" class="form-grid" style="max-width:none">
        <label>Nome *<input type="text" id="fe-nome" required value="${esc(f.nome)}"></label>
        <div class="linha">
          <label>Telefone<input type="text" id="fe-tel" value="${esc(f.telefone || '')}"></label>
          <label>CPF/CNPJ<input type="text" id="fe-doc" value="${esc(f.documento || '')}"></label>
        </div>
        <label>Observação<input type="text" id="fe-obs" value="${esc(f.observacao || '')}"></label>
        <button type="submit">Salvar</button>
        <p id="fe-msg" class="erro"></p>
      </form>`);
    m.el.querySelector('#fe').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await api('fornecedores/' + f.id, { method: 'PUT', body: JSON.stringify({
        nome: m.el.querySelector('#fe-nome').value,
        telefone: m.el.querySelector('#fe-tel').value,
        documento: m.el.querySelector('#fe-doc').value,
        observacao: m.el.querySelector('#fe-obs').value,
      }) });
      const d = await r.json();
      if (!r.ok) { m.el.querySelector('#fe-msg').textContent = d.erro; return; }
      m.fechar(); listar();
    });
  }
  listar();
}

// ─── Contas a Pagar (controle do mês: pagas, a vencer, vencidas) ───
VIEWS['contas-pagar'] = async () => {
  const [fornecedores, centros, bancos, formas] = await Promise.all([
    getJSON('fornecedores'), getJSON('centros-custo'), getJSON('bancos'), getJSON('formas-pagamento'),
  ]);

  app.innerHTML = `<div class="painel">
    <h2>Contas a Pagar</h2>
    <p class="desc">Despesas do mês selecionado. Marque como <b>Pagar</b> quando efetuar o pagamento.</p>
    <div class="toolbar">
      <label class="check-linha" style="margin:0">Mês <input type="month" id="mes" value="${mesISO()}" style="width:auto"></label>
      <select id="filtro">
        <option value="">Todas</option>
        <option value="avencer">A vencer</option>
        <option value="atrasada">Vencidas</option>
        <option value="paga">Pagas</option>
      </select>
    </div>
    <div id="lista"></div>
  </div>`;

  const hoje = hojeISO();
  const statusDe = (l) => (l.situacao === 'pago' ? 'paga' : (l.data.slice(0, 10) < hoje ? 'atrasada' : 'avencer'));
  const badge = { paga: '<span class="badge pago">Paga</span>', atrasada: '<span class="badge inativo">Vencida</span>', avencer: '<span class="badge pendente">A vencer</span>' };

  async function listar() {
    const mes = document.getElementById('mes').value;
    const filtro = document.getElementById('filtro').value;
    let ls = await getJSON('lancamentos?tipo=saida&mes=' + mes);
    if (filtro) ls = ls.filter((l) => statusDe(l) === filtro);
    ls.sort((a, b) => a.data.localeCompare(b.data));

    document.getElementById('lista').innerHTML = tabela(ls, [
      ['Vencimento', (l) => dataBR(l.data)],
      ['Status', (l) => badge[statusDe(l)]],
      ['Fornecedor', (l) => esc(l.fornecedor_nome || '—')],
      ['Centro', (l) => esc(l.centro_custo_nome || '—')],
      ['Parcela', (l) => l.parcela_label || (l.parcelamento === 'Recorrente' ? 'Recorrente' : 'À vista')],
      ['Banco', (l) => esc(l.banco_nome)],
      ['Valor', (l) => `<span class="val-saida">${brl(l.valor)}</span>`],
      ['', (l) => `${l.situacao === 'pendente' ? `<button class="acao-link acao-ok" data-pagar="${l.id}">✓ Pagar</button>` : ''}
                   <button class="acao-link" data-edit="${l.id}">✎ Editar</button>
                   <button class="acao-link acao-del" data-del="${l.id}">✕</button>`],
    ], 'Nenhuma despesa neste mês.');

    document.querySelectorAll('[data-pagar]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api('lancamentos/' + b.dataset.pagar + '/pagar', { method: 'PATCH' });
        listar();
      }));
    document.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => editarDespesa(ls.find((x) => String(x.id) === b.dataset.edit))));
    ligarDelete('lancamentos', listar);
  }

  function editarDespesa(l) {
    const m = abrirModal('Editar despesa', `
      <form id="fed" class="form-grid" style="max-width:none">
        <label>Fornecedor<select id="ed-forn"><option value=""></option>${optFornecedor(fornecedores)}</select></label>
        <label>Centro de custo<select id="ed-centro"><option value=""></option>${centros.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>
        <div class="linha">
          <label>Valor<input type="text" id="ed-valor"></label>
          <label>Banco<select id="ed-banco">${optById(bancos)}</select></label>
        </div>
        <div class="linha">
          <label>Vencimento<input type="date" id="ed-data"></label>
          <label>Forma de pagamento<select id="ed-forma">${optById(formas)}</select></label>
        </div>
        <label>Descrição<input type="text" id="ed-detalhes" maxlength="255"></label>
        <button type="submit">Salvar</button>
        <p id="ed-msg" class="erro"></p>
      </form>`);
    const q = (id) => m.el.querySelector(id);
    q('#ed-forn').value = l.fornecedor_id || '';
    q('#ed-centro').value = l.centro_custo_id || '';
    q('#ed-banco').value = l.banco_id || '';
    q('#ed-data').value = l.data.slice(0, 10);
    q('#ed-forma').value = l.forma_pagamento || '';
    q('#ed-detalhes').value = l.detalhes || '';
    maskMoeda(q('#ed-valor'), Number(l.valor));
    q('#fed').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await api('lancamentos/' + l.id, { method: 'PUT', body: JSON.stringify({
        fornecedor_id: q('#ed-forn').value,
        centro_custo_id: q('#ed-centro').value,
        banco_id: q('#ed-banco').value,
        valor: parseMoeda(q('#ed-valor').value),
        data: q('#ed-data').value,
        forma_pagamento: q('#ed-forma').value,
        detalhes: q('#ed-detalhes').value,
      }) });
      const d = await r.json();
      if (!r.ok) { q('#ed-msg').textContent = d.erro; return; }
      m.fechar(); listar();
    });
  }

  document.getElementById('mes').addEventListener('change', listar);
  document.getElementById('filtro').addEventListener('change', listar);
  listar();
};

// ─── Bancos (cadastro) ───
async function buildBancos(host) {
  host.innerHTML = `
  <div class="painel">
    <h2>Novo banco</h2>
    <form id="f" class="form-grid">
      <div class="linha">
        <label>Nome *<input type="text" id="nome" required></label>
        <label>Saldo inicial<input type="text" id="saldo"></label>
      </div>
      <button type="submit">Salvar</button><p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel"><h2>Bancos</h2><p class="desc">Clique em um banco para editar os dados (agência, conta e chave PIX são opcionais).</p><div id="lista"></div></div>
  <div class="painel" id="painel-edit" style="display:none">
    <h2>Editar banco</h2>
    <form id="fe" class="form-grid">
      <input type="hidden" id="e-id">
      <div class="linha">
        <label>Nome *<input type="text" id="e-nome" required></label>
        <label>Saldo inicial<input type="text" id="e-saldo"></label>
      </div>
      <div class="linha">
        <label>Agência<input type="text" id="e-agencia" placeholder="0001"></label>
        <label>Conta<input type="text" id="e-conta" placeholder="12345-6"></label>
      </div>
      <label>Chave PIX<input type="text" id="e-pix" placeholder="CNPJ, telefone, e-mail ou aleatória"></label>
      <div class="linha"><button type="submit">Salvar alterações</button><button type="button" class="ghost" id="cancelar">Cancelar</button></div>
      <p id="e-msg" class="ok-msg"></p>
    </form>
  </div>`;

  aplicarMoeda('saldo', 'e-saldo'); // saldo (novo) e e-saldo (edição)

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('bancos', { method: 'POST', body: JSON.stringify({
      nome: document.getElementById('nome').value, saldo_inicial: parseMoeda(document.getElementById('saldo').value) }) });
    const d = await r.json();
    if (!r.ok) { msg.textContent = d.erro; return; }
    document.getElementById('f').reset(); listar();
  });

  document.getElementById('cancelar').addEventListener('click', () =>
    (document.getElementById('painel-edit').style.display = 'none'));

  let cache = [];
  async function listar() {
    cache = await getJSON('bancos');
    document.getElementById('lista').innerHTML = tabela(cache, [
      ['Banco', (b) => `<button class="acao-link" data-edit="${b.id}" style="font-weight:600">${esc(b.nome)}</button>`],
      ['Agência', (b) => esc(b.agencia || '—')],
      ['Conta', (b) => esc(b.conta || '—')],
      ['Chave PIX', (b) => esc(b.chave_pix || '—')],
      ['Saldo atual', (b) => `<b>${brl(b.saldo_atual)}</b>`],
      ['', (b) => `<button class="acao-link" data-edit="${b.id}">✎ Editar</button>
                   <button class="acao-link acao-del" data-del="${b.id}">✕</button>`],
    ]);
    document.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => abrirEdicao(btn.dataset.edit)));
    ligarDelete('bancos', listar);
  }

  function abrirEdicao(id) {
    const b = cache.find((x) => String(x.id) === String(id));
    document.getElementById('painel-edit').style.display = 'block';
    document.getElementById('e-id').value = b.id;
    document.getElementById('e-nome').value = b.nome;
    document.getElementById('e-saldo').value = Number(b.saldo_inicial) ? fmtMoeda(b.saldo_inicial) : '';
    document.getElementById('e-agencia').value = b.agencia || '';
    document.getElementById('e-conta').value = b.conta || '';
    document.getElementById('e-pix').value = b.chave_pix || '';
    document.getElementById('painel-edit').scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('fe').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('e-msg');
    const id = document.getElementById('e-id').value;
    const r = await api('bancos/' + id, { method: 'PUT', body: JSON.stringify({
      nome: document.getElementById('e-nome').value,
      saldo_inicial: parseMoeda(document.getElementById('e-saldo').value),
      agencia: document.getElementById('e-agencia').value,
      conta: document.getElementById('e-conta').value,
      chave_pix: document.getElementById('e-pix').value,
    }) });
    const d = await r.json();
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    msg.className = 'ok-msg'; msg.textContent = 'Banco atualizado!';
    listar();
  });

  listar();
}

// ─── Centros de custo (cadastro) ───
async function buildCentros(host) {
  host.innerHTML = `
  <div class="painel">
    <h2>Novo centro de custo</h2>
    <form id="f" class="form-grid">
      <label>Nome *<input type="text" id="nome" required></label>
      <button type="submit">Salvar</button><p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel"><h2>Centros de custo</h2><div id="lista"></div></div>`;
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('centros-custo', { method: 'POST', body: JSON.stringify({ nome: document.getElementById('nome').value }) });
    const d = await r.json();
    if (!r.ok) { msg.textContent = d.erro; return; }
    document.getElementById('f').reset(); listar();
  });
  async function listar() {
    const cs = await getJSON('centros-custo');
    document.getElementById('lista').innerHTML = tabela(cs, [
      ['Nome', (c) => esc(c.nome)],
      ['', (c) => `<button class="acao-link acao-del" data-del="${c.id}">✕</button>`],
    ]);
    ligarDelete('centros-custo', listar);
  }
  listar();
}

// ─── Formas de pagamento (cadastro) ───
async function buildFormas(host) {
  host.innerHTML = `
  <div class="painel">
    <h2>Nova forma de pagamento</h2>
    <form id="f" class="form-grid">
      <label>Nome *<input type="text" id="nome" required placeholder="Ex.: Boleto"></label>
      <button type="submit">Salvar</button><p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel"><h2>Formas de pagamento</h2><div id="lista"></div></div>`;
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('formas-pagamento', { method: 'POST', body: JSON.stringify({ nome: document.getElementById('nome').value }) });
    const d = await r.json();
    if (!r.ok) { msg.textContent = d.erro; return; }
    document.getElementById('f').reset(); listar();
  });
  async function listar() {
    const fs = await getJSON('formas-pagamento');
    document.getElementById('lista').innerHTML = tabela(fs, [
      ['Nome', (f) => esc(f.nome)],
      ['', (f) => `<button class="acao-link acao-del" data-del="${f.id}">✕</button>`],
    ]);
    ligarDelete('formas-pagamento', listar);
  }
  listar();
}

// ─── Cadastros (tela única com abas) ───
VIEWS.cadastros = () => {
  app.innerHTML = `
  <div class="tabs">
    <button class="tab ativo" data-tab="bancos">Bancos</button>
    <button class="tab" data-tab="fornecedores">Fornecedores</button>
    <button class="tab" data-tab="formas">Formas de pagamento</button>
    <button class="tab" data-tab="centros">Centros de custo</button>
  </div>
  <div id="tab-content"></div>`;
  const content = document.getElementById('tab-content');
  const builders = { bancos: buildBancos, fornecedores: buildFornecedores, formas: buildFormas, centros: buildCentros };
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('ativo'));
      t.classList.add('ativo');
      builders[t.dataset.tab](content);
    }));
  buildBancos(content);
};

// ─── Membresia: Cadastrar ───
VIEWS['membro-cadastrar'] = async () => {
  const linkPublico = location.origin + location.pathname.replace(/\/$/, '') + '/cadastro.html';
  app.innerHTML = `
  <div class="painel">
    <h2>Cadastrar membro</h2>
    <form id="f" class="form-grid">
      <label>Nome completo *<input type="text" id="nome" required></label>
      <div class="linha">
        <label>Telefone<input type="text" id="telefone" placeholder="(47) 99999-9999"></label>
        <label>Data de nascimento<input type="date" id="nasc"></label>
      </div>
      <div class="linha">
        <label>Sexo<select id="sexo"><option value=""></option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>
        <label>Endereço (opcional)<input type="text" id="endereco"></label>
      </div>
      <button type="submit">Salvar membro</button>
      <p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel">
    <h2>Formulário público</h2>
    <p class="desc">Compartilhe este link para a pessoa se cadastrar sozinha pelo celular:</p>
    <div class="toolbar">
      <input class="cresce" id="link" value="${esc(linkPublico)}" readonly>
      <button class="pequeno" id="copiar">Copiar link</button>
    </div>
  </div>`;

  document.getElementById('copiar').addEventListener('click', () => {
    navigator.clipboard.writeText(linkPublico);
    document.getElementById('copiar').textContent = 'Copiado!';
  });

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('membros', { method: 'POST', body: JSON.stringify({
      nome: document.getElementById('nome').value,
      telefone: document.getElementById('telefone').value,
      data_nascimento: document.getElementById('nasc').value || null,
      sexo: document.getElementById('sexo').value || null,
      endereco: document.getElementById('endereco').value,
    }) });
    const d = await r.json();
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    msg.className = 'ok-msg'; msg.textContent = 'Membro cadastrado!';
    document.getElementById('f').reset();
  });
};

// ─── Membresia: Consultar (filtro + editar + ativar/inativar) ───
VIEWS['membro-consultar'] = async () => {
  app.innerHTML = `
  <div class="painel">
    <h2>Consultar membros</h2>
    <div class="toolbar">
      <input class="cresce" id="busca" placeholder="Buscar por nome...">
      <select id="situacao"><option value="">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select>
    </div>
    <div id="lista"></div>
  </div>
  <div class="painel" id="painel-edit" style="display:none">
    <h2>Editar membro</h2>
    <form id="fe" class="form-grid">
      <input type="hidden" id="e-id">
      <label>Nome *<input type="text" id="e-nome" required></label>
      <div class="linha">
        <label>Telefone<input type="text" id="e-telefone"></label>
        <label>Data de nascimento<input type="date" id="e-nasc"></label>
      </div>
      <div class="linha">
        <label>Sexo<select id="e-sexo"><option value=""></option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>
        <label>Endereço<input type="text" id="e-endereco"></label>
      </div>
      <label class="check-linha"><input type="checkbox" id="e-ativo"> Membro ativo</label>
      <div class="linha"><button type="submit">Salvar alterações</button><button type="button" class="ghost" id="cancelar">Cancelar</button></div>
      <p id="e-msg" class="ok-msg"></p>
    </form>
  </div>`;

  const buscar = () => listar();
  document.getElementById('busca').addEventListener('input', buscar);
  document.getElementById('situacao').addEventListener('change', buscar);
  document.getElementById('cancelar').addEventListener('click', () =>
    (document.getElementById('painel-edit').style.display = 'none'));

  let cache = [];
  async function listar() {
    const busca = document.getElementById('busca').value;
    const sit = document.getElementById('situacao').value;
    cache = await getJSON(`membros?busca=${encodeURIComponent(busca)}&situacao=${sit}`);
    document.getElementById('lista').innerHTML = tabela(cache, [
      ['Nome', (m) => esc(m.nome)],
      ['Telefone', (m) => esc(m.telefone || '—')],
      ['Nascimento', (m) => dataBR(m.data_nascimento) || '—'],
      ['Situação', (m) => `<span class="badge ${m.ativo ? 'ativo' : 'inativo'}">${m.ativo ? 'Ativo' : 'Inativo'}</span>`],
      ['', (m) => `<button class="acao-link" data-edit="${m.id}">✎ Editar</button>
                   <button class="acao-link" data-toggle="${m.id}">${m.ativo ? 'Inativar' : 'Ativar'}</button>
                   <button class="acao-link acao-del" data-delmembro="${m.id}">✕ Excluir</button>`],
    ]);
    document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => abrirEdicao(b.dataset.edit)));
    document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      await api('membros/' + b.dataset.toggle + '/ativo', { method: 'PATCH' }); listar();
    }));
    document.querySelectorAll('[data-delmembro]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Excluir este membro? (se tiver lançamentos, use Inativar)')) return;
      const r = await api('membros/' + b.dataset.delmembro, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json(); alert(d.erro || 'Não foi possível excluir'); return; }
      listar();
    }));
  }

  function abrirEdicao(id) {
    const m = cache.find((x) => String(x.id) === String(id));
    document.getElementById('painel-edit').style.display = 'block';
    document.getElementById('e-id').value = m.id;
    document.getElementById('e-nome').value = m.nome;
    document.getElementById('e-telefone').value = m.telefone || '';
    document.getElementById('e-nasc').value = m.data_nascimento ? m.data_nascimento.slice(0, 10) : '';
    document.getElementById('e-sexo').value = m.sexo || '';
    document.getElementById('e-endereco').value = m.endereco || '';
    document.getElementById('e-ativo').checked = m.ativo;
    document.getElementById('painel-edit').scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('fe').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('e-id').value;
    const r = await api('membros/' + id, { method: 'PUT', body: JSON.stringify({
      nome: document.getElementById('e-nome').value,
      telefone: document.getElementById('e-telefone').value,
      data_nascimento: document.getElementById('e-nasc').value || null,
      sexo: document.getElementById('e-sexo').value || null,
      endereco: document.getElementById('e-endereco').value,
      ativo: document.getElementById('e-ativo').checked,
    }) });
    const d = await r.json();
    const msg = document.getElementById('e-msg');
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    msg.className = 'ok-msg'; msg.textContent = 'Salvo!';
    listar();
  });

  listar();
};

// ─── Exportar relatório (formato contábil) ───
VIEWS.exportar = () => {
  app.innerHTML = `
  <div class="painel">
    <h2>Exportar relatório contábil</h2>
    <p class="desc">Gera o relatório no mesmo formato do envio para a contabilidade. Escolha um mês cheio ou um período específico.</p>
    <form id="f" class="form-grid">
      <div class="tabs" style="margin-bottom:4px">
        <button type="button" class="tab ativo" data-modo="mes">Mês cheio</button>
        <button type="button" class="tab" data-modo="periodo">Período</button>
      </div>

      <div id="bloco-mes">
        <label>Mês de referência<input type="month" id="mes" value="${mesISO()}"></label>
      </div>
      <div id="bloco-periodo" style="display:none">
        <div class="linha">
          <label>De<input type="date" id="inicio"></label>
          <label>Até<input type="date" id="fim"></label>
        </div>
      </div>

      <label>Formato
        <select id="formato"><option value="xlsx">Planilha (.xlsx)</option><option value="pdf">PDF (.pdf)</option></select>
      </label>
      <button type="submit">Baixar relatório</button>
      <p id="msg" class="erro"></p>
    </form>
  </div>`;

  let modo = 'mes';
  document.querySelectorAll('[data-modo]').forEach((t) => t.addEventListener('click', () => {
    modo = t.dataset.modo;
    document.querySelectorAll('[data-modo]').forEach((x) => x.classList.remove('ativo'));
    t.classList.add('ativo');
    document.getElementById('bloco-mes').style.display = modo === 'mes' ? 'block' : 'none';
    document.getElementById('bloco-periodo').style.display = modo === 'periodo' ? 'block' : 'none';
  }));

  document.getElementById('f').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const formato = document.getElementById('formato').value;
    let qs;
    if (modo === 'mes') {
      qs = 'mes=' + document.getElementById('mes').value;
    } else {
      const ini = document.getElementById('inicio').value;
      const fim = document.getElementById('fim').value;
      if (!ini || !fim) { msg.textContent = 'Informe as duas datas do período.'; return; }
      if (ini > fim) { msg.textContent = 'A data inicial não pode ser maior que a final.'; return; }
      qs = `inicio=${ini}&fim=${fim}`;
    }
    msg.textContent = '';
    window.location.href = `api/exportar?${qs}&formato=${formato}`;
  });
};

// ════════════════════════════════════════════════
//  Utilitários de UI
// ════════════════════════════════════════════════
function tabela(linhas, cols, vazioTxt = 'Nenhum registro.') {
  if (!linhas.length) return `<p class="vazio">${vazioTxt}</p>`;
  const head = cols.map((c) => `<th>${c[0]}</th>`).join('');
  const body = linhas.map((l) => `<tr>${cols.map((c) => `<td>${c[1](l)}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
function ligarDelete(recurso, recarregar) {
  document.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Confirma excluir / remover este item?')) return;
      await api(recurso + '/' + b.dataset.del, { method: 'DELETE' });
      recarregar();
    })
  );
}
const optFornecedor = (fs) => fs.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join('');
const optById = (arr) => '<option value=""></option>' + arr.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join('');

// Recarrega as opções de um <select> a partir de um endpoint, mantendo "em branco" no topo.
async function refreshSelect(selectId, endpoint, selecionar) {
  const arr = await getJSON(endpoint);
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = optById(arr);
  if (selecionar) sel.value = selecionar;
}

// Modal genérico de cadastro rápido. `campos`: [{id, label, req, type}]. Resolve com o registro criado (ou null).
function quickCadastro(titulo, endpoint, campos) {
  return new Promise((resolve) => {
    const m = abrirModal(titulo, `
      <form id="qf" class="form-grid" style="max-width:none">
        ${campos.map((c) => `<label>${c.label}${c.req ? ' *' : ''}<input type="${c.type || 'text'}" id="qf-${c.id}" ${c.req ? 'required' : ''}></label>`).join('')}
        <button type="submit">Salvar</button>
        <p id="qf-msg" class="erro"></p>
      </form>`);
    m.el.querySelector('#qf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      campos.forEach((c) => { body[c.id] = m.el.querySelector('#qf-' + c.id).value; });
      const r = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { m.el.querySelector('#qf-msg').textContent = d.erro; return; }
      m.fechar(); resolve(d);
    });
    m.el.querySelector('.modal-x').addEventListener('click', () => resolve(null));
  });
}

// ════════════════════════════════════════════════
//  Init
// ════════════════════════════════════════════════
(async function () {
  const me = await getJSON('auth/me');
  document.getElementById('usuario-nome').textContent = me.usuario.nome;
  initShell();
  navegar('dashboard');
})();
