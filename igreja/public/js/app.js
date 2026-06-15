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

const app = document.getElementById('app');
const titulo = document.getElementById('titulo-pagina');

const TITULOS = {
  dashboard: 'Dashboard',
  entrada: 'Lançar Dízimo / Oferta',
  'despesa-fixa': 'Despesa Fixa',
  'despesa-variavel': 'Despesa Variável',
  fornecedores: 'Fornecedores',
  aprovar: 'Aprovar Despesas',
  'membro-cadastrar': 'Cadastrar Membro',
  'membro-consultar': 'Consultar Membros',
  'centros-custo': 'Centros de Custo',
  bancos: 'Bancos',
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

// ─── Dashboard (placeholder — Fase 4) ───
VIEWS.dashboard = () => {
  app.innerHTML = `<div class="painel"><div class="placeholder">
    <h2>📊 Dashboard</h2>
    <p>Réplica do painel (cards, gráficos e seletor de meses) vem na <b>Fase 4</b>.</p>
  </div></div>`;
};

// ─── Lançar Dízimo / Oferta (entrada) ───
VIEWS.entrada = async () => {
  const [bancos, membros] = await Promise.all([getJSON('bancos'), getJSON('membros?situacao=ativo')]);
  app.innerHTML = `
  <div class="painel">
    <h2>Nova entrada</h2>
    <form id="f" class="form-grid">
      <label class="check-linha"><input type="checkbox" id="visitante"> Visitante (somente oferta)</label>
      <label id="wrap-membro">Membro
        <select id="membro">${membros.map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</select>
      </label>
      <div class="linha">
        <label>Tipo
          <select id="tipo_gasto"><option value="DIZIMO">Dízimo</option><option value="OFERTA">Oferta</option></select>
        </label>
        <label>Valor (R$)<input type="number" step="0.01" min="0.01" id="valor" required></label>
      </div>
      <div class="linha">
        <label>Banco<select id="banco">${bancos.map((b) => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></label>
        <label>Data<input type="date" id="data" value="${hojeISO()}" required></label>
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

  const visit = document.getElementById('visitante');
  const tipoSel = document.getElementById('tipo_gasto');
  const wrapMembro = document.getElementById('wrap-membro');
  visit.addEventListener('change', () => {
    wrapMembro.style.display = visit.checked ? 'none' : 'flex';
    if (visit.checked) { tipoSel.value = 'OFERTA'; tipoSel.querySelector('[value=DIZIMO]').disabled = true; }
    else tipoSel.querySelector('[value=DIZIMO]').disabled = false;
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
        valor: document.getElementById('valor').value,
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

// ─── Despesa Variável (saída avulsa, à vista ou parcelada) ───
VIEWS['despesa-variavel'] = async () => {
  const [bancos, fornecedores, centros] = await Promise.all([
    getJSON('bancos'), getJSON('fornecedores'), getJSON('centros-custo'),
  ]);
  app.innerHTML = `
  <div class="painel">
    <h2>Nova despesa variável</h2>
    <p class="desc">A despesa entra como <b>pendente</b> e precisa ser aprovada em "Aprovar Despesas".</p>
    <form id="f" class="form-grid">
      <div class="linha">
        <label>Fornecedor<select id="fornecedor">${optFornecedor(fornecedores)}</select></label>
        <label>Centro de custo<select id="centro"><option value="">—</option>${centros.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>
      </div>
      <div class="linha">
        <label>Valor total (R$)<input type="number" step="0.01" min="0.01" id="valor" required></label>
        <label>Banco<select id="banco">${bancos.map((b) => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></label>
      </div>
      <div class="linha">
        <label>Data<input type="date" id="data" value="${hojeISO()}" required></label>
        <label>Forma de pagamento
          <select id="forma"><option>Pix</option><option>Cartão</option><option>Débito automático</option></select>
        </label>
      </div>
      <label class="check-linha"><input type="checkbox" id="parcelado"> Parcelado</label>
      <label id="wrap-parcelas" style="display:none">Quantidade de parcelas
        <input type="number" min="2" max="48" id="num_parcelas" value="2">
      </label>
      <label>Descrição<input type="text" id="detalhes" maxlength="255"></label>
      <button type="submit">Lançar despesa</button>
      <p id="msg" class="erro"></p>
    </form>
  </div>`;

  const parc = document.getElementById('parcelado');
  parc.addEventListener('change', () =>
    (document.getElementById('wrap-parcelas').style.display = parc.checked ? 'flex' : 'none')
  );

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('lancamentos/saida', {
      method: 'POST',
      body: JSON.stringify({
        fornecedor_id: document.getElementById('fornecedor').value,
        centro_custo_id: document.getElementById('centro').value,
        valor: document.getElementById('valor').value,
        banco_id: document.getElementById('banco').value,
        data: document.getElementById('data').value,
        forma_pagamento: document.getElementById('forma').value,
        parcelado: parc.checked,
        num_parcelas: document.getElementById('num_parcelas').value,
        detalhes: document.getElementById('detalhes').value,
      }),
    });
    const d = await r.json();
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    msg.className = 'ok-msg';
    msg.textContent = d.parcelas > 1 ? `Despesa lançada em ${d.parcelas} parcelas!` : 'Despesa lançada!';
    document.getElementById('f').reset();
    document.getElementById('data').value = hojeISO();
    document.getElementById('wrap-parcelas').style.display = 'none';
  });
};

// ─── Despesa Fixa (recorrente) ───
VIEWS['despesa-fixa'] = async () => {
  const [bancos, fornecedores, centros] = await Promise.all([
    getJSON('bancos'), getJSON('fornecedores'), getJSON('centros-custo'),
  ]);
  app.innerHTML = `
  <div class="painel">
    <h2>Nova despesa fixa</h2>
    <p class="desc">Modelo recorrente. Gere os lançamentos do mês com o botão abaixo (entram como pendentes).</p>
    <form id="f" class="form-grid">
      <label>Descrição<input type="text" id="descricao" placeholder="Ex.: Aluguel apto pastoral" maxlength="255"></label>
      <div class="linha">
        <label>Fornecedor<select id="fornecedor"><option value="">—</option>${optFornecedor(fornecedores, true)}</select></label>
        <label>Centro de custo<select id="centro"><option value="">—</option>${centros.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></label>
      </div>
      <div class="linha-3">
        <label>Valor (R$)<input type="number" step="0.01" min="0.01" id="valor" required></label>
        <label>Dia venc.<input type="number" min="1" max="28" id="dia" value="5"></label>
        <label>Banco<select id="banco">${bancos.map((b) => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></label>
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

  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('despesas-fixas', {
      method: 'POST',
      body: JSON.stringify({
        descricao: document.getElementById('descricao').value,
        fornecedor_id: document.getElementById('fornecedor').value,
        centro_custo_id: document.getElementById('centro').value,
        valor: document.getElementById('valor').value,
        dia_vencimento: document.getElementById('dia').value,
        banco_id: document.getElementById('banco').value,
      }),
    });
    const d = await r.json();
    if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
    document.getElementById('f').reset();
    document.getElementById('dia').value = 5;
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
};

// ─── Fornecedores ───
VIEWS.fornecedores = async () => {
  app.innerHTML = `
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
    const r = await api('fornecedores', {
      method: 'POST',
      body: JSON.stringify({
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value,
        documento: document.getElementById('documento').value,
        observacao: document.getElementById('observacao').value,
      }),
    });
    const d = await r.json();
    if (!r.ok) { msg.textContent = d.erro; return; }
    document.getElementById('f').reset();
    listar();
  });

  document.getElementById('busca').addEventListener('input', (e) => listar(e.target.value));

  async function listar(busca = '') {
    const fs = await getJSON('fornecedores?busca=' + encodeURIComponent(busca));
    document.getElementById('lista').innerHTML = tabela(fs, [
      ['Nome', (f) => esc(f.nome)],
      ['Telefone', (f) => esc(f.telefone || '—')],
      ['CPF/CNPJ', (f) => esc(f.documento || '—')],
      ['', (f) => `<button class="acao-link acao-del" data-del="${f.id}">✕</button>`],
    ]);
    ligarDelete('fornecedores', () => listar(busca));
  }
  listar();
};

// ─── Aprovar Despesas (pendentes → pago) ───
VIEWS.aprovar = async () => {
  app.innerHTML = `<div class="painel"><h2>Despesas pendentes</h2><div id="lista"></div></div>`;
  async function listar() {
    const ls = await getJSON('lancamentos?tipo=saida&situacao=pendente');
    document.getElementById('lista').innerHTML = tabela(ls, [
      ['Data', (l) => dataBR(l.data)],
      ['Fornecedor', (l) => esc(l.fornecedor_nome || '—')],
      ['Centro', (l) => esc(l.centro_custo_nome || '—')],
      ['Parcela', (l) => l.parcela_label || (l.parcelamento === 'Recorrente' ? 'Recorrente' : 'À vista')],
      ['Banco', (l) => esc(l.banco_nome)],
      ['Valor', (l) => `<span class="val-saida">${brl(l.valor)}</span>`],
      ['', (l) => `<button class="acao-link acao-ok" data-ok="${l.id}">✓ Dar OK</button>
                   <button class="acao-link acao-del" data-del="${l.id}">✕</button>`],
    ], 'Nenhuma despesa pendente. 🎉');

    document.querySelectorAll('[data-ok]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api('lancamentos/' + b.dataset.ok + '/aprovar', { method: 'PATCH' });
        listar();
      })
    );
    ligarDelete('lancamentos', listar);
  }
  listar();
};

// ─── Bancos (config) ───
VIEWS.bancos = async () => {
  app.innerHTML = `
  <div class="painel">
    <h2>Novo banco</h2>
    <form id="f" class="form-grid">
      <div class="linha">
        <label>Nome *<input type="text" id="nome" required></label>
        <label>Saldo inicial (R$)<input type="number" step="0.01" id="saldo" value="0"></label>
      </div>
      <button type="submit">Salvar</button><p id="msg" class="erro"></p>
    </form>
  </div>
  <div class="painel"><h2>Bancos</h2><div id="lista"></div></div>`;
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    const r = await api('bancos', { method: 'POST', body: JSON.stringify({
      nome: document.getElementById('nome').value, saldo_inicial: document.getElementById('saldo').value }) });
    const d = await r.json();
    if (!r.ok) { msg.textContent = d.erro; return; }
    document.getElementById('f').reset(); listar();
  });
  async function listar() {
    const bs = await getJSON('bancos');
    document.getElementById('lista').innerHTML = tabela(bs, [
      ['Banco', (b) => esc(b.nome)],
      ['Saldo atual', (b) => `<b>${brl(b.saldo_atual)}</b>`],
      ['', (b) => `<button class="acao-link acao-del" data-del="${b.id}">✕</button>`],
    ]);
    ligarDelete('bancos', listar);
  }
  listar();
};

// ─── Centros de custo (config) ───
VIEWS['centros-custo'] = async () => {
  app.innerHTML = `
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
};

// ─── Placeholders das próximas fases ───
const placeholder = (txt) => () => (app.innerHTML = `<div class="painel"><div class="placeholder"><p>${txt}</p></div></div>`);
VIEWS['membro-cadastrar'] = placeholder('Cadastro de membros — Fase 2.');
VIEWS['membro-consultar'] = placeholder('Consulta de membros — Fase 2.');
VIEWS.exportar = placeholder('Exportar relatório contábil — Fase 3.');

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

// ════════════════════════════════════════════════
//  Init
// ════════════════════════════════════════════════
(async function () {
  const me = await getJSON('auth/me');
  document.getElementById('usuario-nome').textContent = me.usuario.nome;
  initShell();
  navegar('dashboard');
})();
