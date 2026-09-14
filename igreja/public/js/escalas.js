// ════════════════════════════════════════════════
//  ESCALAS — Calendário, Ministérios, Membros, Eventos
//  (módulo carregado após app.js; usa VIEWS/TITULOS/api/esc/tabela/abrirModal)
// ════════════════════════════════════════════════
(function () {
  TITULOS['escalas-calendario'] = 'Calendário de Escalas';
  TITULOS['escalas-ministerios'] = 'Ministérios';
  TITULOS['escalas-membros'] = 'Membros dos Ministérios';
  TITULOS['escalas-eventos'] = 'Eventos e Cultos';

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hojeMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const hojeISOlocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const diaDoISO = (iso) => Number(iso.slice(8, 10));           // '2026-10-17' -> 17
  const mesLabel = (mes) => { const [a, m] = mes.split('-'); return `${MESES[m - 1]} ${a}`; };
  const proxMes = (mes, d) => { const [a, m] = mes.split('-').map(Number); const x = new Date(a, m - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
  const tipoTag = (t) => t === 'evento'
    ? '<span class="badge pendente">Evento</span>' : '<span class="badge pago">Culto</span>';

  // ══════════════════════════════════════════════
  //  MINISTÉRIOS
  // ══════════════════════════════════════════════
  VIEWS['escalas-ministerios'] = async () => {
    app.innerHTML = `
    <div class="painel">
      <h2>Novo ministério</h2>
      <form id="fm" class="form-grid">
        <div class="linha">
          <label class="cresce">Nome *<input type="text" id="m-nome" required placeholder="Louvor, Sonoplastia, Recepção..."></label>
          <label>Cor<input type="color" id="m-cor" value="#c9a24a"></label>
        </div>
        <label>Descrição<input type="text" id="m-desc" placeholder="opcional"></label>
        <button type="submit">Criar ministério</button>
        <p id="m-msg" class="erro"></p>
      </form>
    </div>
    <div class="painel">
      <h2>Ministérios</h2>
      <div id="lista-min"></div>
    </div>`;

    document.getElementById('fm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('m-msg');
      const r = await api('escalas/ministerios', { method: 'POST', body: JSON.stringify({
        nome: document.getElementById('m-nome').value,
        cor: document.getElementById('m-cor').value,
        descricao: document.getElementById('m-desc').value,
      }) });
      const d = await r.json();
      if (!r.ok) { msg.textContent = d.erro; return; }
      document.getElementById('fm').reset();
      document.getElementById('m-cor').value = '#c9a24a';
      listar();
    });

    async function listar() {
      const mins = await getJSON('escalas/ministerios');
      document.getElementById('lista-min').innerHTML = tabela(mins, [
        ['Ministério', (m) => `<span class="min-dot" style="background:${esc(m.cor)}"></span> <b>${esc(m.nome)}</b>${m.descricao ? `<div class="sub-txt">${esc(m.descricao)}</div>` : ''}`],
        ['Membros', (m) => `${m.qtd_membros}`],
        ['', (m) => `<button class="acao-link" data-membros="${m.id}">Membros</button>
                     <button class="acao-link" data-edit="${m.id}">✎ Editar</button>
                     <button class="acao-link acao-del" data-del="${m.id}">✕ Excluir</button>`],
      ], 'Nenhum ministério criado ainda.');

      document.querySelectorAll('[data-membros]').forEach((b) => b.addEventListener('click', () => gerirMembros(b.dataset.membros)));
      document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editar(b.dataset.edit, mins)));
      document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Excluir este ministério? As escalas ligadas a ele serão removidas.')) return;
        await api('escalas/ministerios/' + b.dataset.del, { method: 'DELETE' }); listar();
      }));
    }

    function editar(id, mins) {
      const m = mins.find((x) => String(x.id) === String(id));
      const { fechar } = abrirModal('Editar ministério', `
        <form id="fe" class="form-grid">
          <div class="linha">
            <label class="cresce">Nome *<input type="text" id="e-nome" value="${esc(m.nome)}" required></label>
            <label>Cor<input type="color" id="e-cor" value="${esc(m.cor)}"></label>
          </div>
          <label>Descrição<input type="text" id="e-desc" value="${esc(m.descricao || '')}"></label>
          <div class="linha"><button type="submit">Salvar</button></div>
          <p id="e-msg" class="erro"></p>
        </form>`);
      document.getElementById('fe').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await api('escalas/ministerios/' + id, { method: 'PUT', body: JSON.stringify({
          nome: document.getElementById('e-nome').value,
          cor: document.getElementById('e-cor').value,
          descricao: document.getElementById('e-desc').value,
        }) });
        const d = await r.json();
        if (!r.ok) { document.getElementById('e-msg').textContent = d.erro; return; }
        fechar(); listar();
      });
    }

    async function gerirMembros(id) {
      const [det, todos] = await Promise.all([getJSON('escalas/ministerios/' + id), getJSON('membros?situacao=ativo')]);
      const dentro = new Set(det.membros.map((m) => m.id));
      const { fechar } = abrirModal('Membros de ' + esc(det.nome), `
        <p class="desc">Marque quem faz parte deste ministério.</p>
        <input type="text" id="mb-busca" class="cresce" placeholder="Buscar membro..." style="margin-bottom:10px">
        <div id="mb-lista" class="check-list"></div>
        <div class="linha" style="margin-top:12px"><button id="mb-salvar">Salvar</button></div>
        <p id="mb-msg" class="erro"></p>`);

      const render = (filtro = '') => {
        const f = filtro.toLowerCase();
        document.getElementById('mb-lista').innerHTML = todos
          .filter((m) => m.nome.toLowerCase().includes(f))
          .map((m) => `<label class="check-item"><input type="checkbox" value="${m.id}" ${dentro.has(m.id) ? 'checked' : ''}> ${esc(m.nome)}</label>`)
          .join('') || '<p class="vazio">Nenhum membro.</p>';
      };
      render();
      document.getElementById('mb-busca').addEventListener('input', (e) => {
        // preserva marcações antes de refiltrar
        document.querySelectorAll('#mb-lista input:checked').forEach((c) => dentro.add(Number(c.value)));
        document.querySelectorAll('#mb-lista input:not(:checked)').forEach((c) => dentro.delete(Number(c.value)));
        render(e.target.value);
      });
      document.getElementById('mb-salvar').addEventListener('click', async () => {
        document.querySelectorAll('#mb-lista input:checked').forEach((c) => dentro.add(Number(c.value)));
        document.querySelectorAll('#mb-lista input:not(:checked)').forEach((c) => dentro.delete(Number(c.value)));
        const r = await api('escalas/ministerios/' + id + '/membros', { method: 'PUT', body: JSON.stringify({ membros: [...dentro] }) });
        if (!r.ok) { document.getElementById('mb-msg').textContent = 'Erro ao salvar'; return; }
        fechar(); listar();
      });
    }

    listar();
  };

  // ══════════════════════════════════════════════
  //  EVENTOS
  // ══════════════════════════════════════════════
  VIEWS['escalas-eventos'] = async () => {
    let mes = hojeMes();
    app.innerHTML = `
    <div class="painel">
      <h2>Novo culto / evento</h2>
      <form id="fev" class="form-grid">
        <div class="linha">
          <label class="cresce">Título *<input type="text" id="ev-titulo" required placeholder="Culto da Família, Santa Ceia..."></label>
          <label>Tipo<select id="ev-tipo"><option value="culto">Culto</option><option value="evento">Evento</option></select></label>
        </div>
        <div class="linha">
          <label>Data *<input type="date" id="ev-data" required></label>
          <label>Horário<input type="time" id="ev-hora"></label>
        </div>
        <label>Observação<input type="text" id="ev-obs" placeholder="opcional"></label>
        <button type="submit">Cadastrar</button>
        <p id="ev-msg" class="erro"></p>
      </form>
    </div>
    <div class="painel">
      <div class="toolbar toolbar-mes">
        <button class="pequeno" id="mes-ant">‹</button>
        <b id="mes-lbl"></b>
        <button class="pequeno" id="mes-prox">›</button>
      </div>
      <div id="lista-ev"></div>
    </div>`;

    document.getElementById('ev-data').value = hojeISOlocal();
    document.getElementById('fev').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('ev-msg');
      const r = await api('escalas/eventos', { method: 'POST', body: JSON.stringify({
        titulo: document.getElementById('ev-titulo').value,
        tipo: document.getElementById('ev-tipo').value,
        data: document.getElementById('ev-data').value,
        hora: document.getElementById('ev-hora').value,
        observacao: document.getElementById('ev-obs').value,
      }) });
      const d = await r.json();
      if (!r.ok) { msg.textContent = d.erro; return; }
      mes = d.data.slice(0, 7);
      document.getElementById('fev').reset();
      document.getElementById('ev-data').value = hojeISOlocal();
      listar();
    });

    document.getElementById('mes-ant').addEventListener('click', () => { mes = proxMes(mes, -1); listar(); });
    document.getElementById('mes-prox').addEventListener('click', () => { mes = proxMes(mes, 1); listar(); });

    async function listar() {
      document.getElementById('mes-lbl').textContent = mesLabel(mes);
      const evs = await getJSON('escalas/eventos?mes=' + mes);
      document.getElementById('lista-ev').innerHTML = tabela(evs, [
        ['Data', (e) => `<b>${diaDoISO(e.data)}</b> <span class="sub-txt">${DIAS[new Date(e.data + 'T12:00').getDay()]}${e.hora ? ' · ' + e.hora : ''}</span>`],
        ['Título', (e) => `${esc(e.titulo)} ${tipoTag(e.tipo)}${e.observacao ? `<div class="sub-txt">${esc(e.observacao)}</div>` : ''}`],
        ['Escalados', (e) => `${e.qtd_escalados}`],
        ['', (e) => `<button class="acao-link" data-escalar="${e.id}">Montar escala</button>
                     <button class="acao-link" data-edev="${e.id}">✎</button>
                     <button class="acao-link acao-del" data-delev="${e.id}">✕</button>`],
      ], 'Nenhum evento neste mês.');

      document.querySelectorAll('[data-escalar]').forEach((b) => b.addEventListener('click', () => abrirEscala(b.dataset.escalar, listar)));
      document.querySelectorAll('[data-edev]').forEach((b) => b.addEventListener('click', () => editarEvento(b.dataset.edev, evs, listar)));
      document.querySelectorAll('[data-delev]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Excluir este evento e sua escala?')) return;
        await api('escalas/eventos/' + b.dataset.delev, { method: 'DELETE' }); listar();
      }));
    }
    listar();
  };

  function editarEvento(id, evs, aoConcluir) {
    const e = evs.find((x) => String(x.id) === String(id));
    const { fechar } = abrirModal('Editar evento', `
      <form id="fee" class="form-grid">
        <div class="linha">
          <label class="cresce">Título *<input type="text" id="x-titulo" value="${esc(e.titulo)}" required></label>
          <label>Tipo<select id="x-tipo"><option value="culto" ${e.tipo !== 'evento' ? 'selected' : ''}>Culto</option><option value="evento" ${e.tipo === 'evento' ? 'selected' : ''}>Evento</option></select></label>
        </div>
        <div class="linha">
          <label>Data *<input type="date" id="x-data" value="${e.data}" required></label>
          <label>Horário<input type="time" id="x-hora" value="${esc(e.hora || '')}"></label>
        </div>
        <label>Observação<input type="text" id="x-obs" value="${esc(e.observacao || '')}"></label>
        <div class="linha"><button type="submit">Salvar</button></div>
        <p id="x-msg" class="erro"></p>
      </form>`);
    document.getElementById('fee').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const r = await api('escalas/eventos/' + id, { method: 'PUT', body: JSON.stringify({
        titulo: document.getElementById('x-titulo').value, tipo: document.getElementById('x-tipo').value,
        data: document.getElementById('x-data').value, hora: document.getElementById('x-hora').value,
        observacao: document.getElementById('x-obs').value,
      }) });
      const d = await r.json();
      if (!r.ok) { document.getElementById('x-msg').textContent = d.erro; return; }
      fechar(); if (aoConcluir) aoConcluir();
    });
  }

  // Modal: montar a escala de um evento (ministério por ministério)
  async function abrirEscala(eventoId, aoConcluir) {
    const dados = await getJSON('escalas/eventos/' + eventoId + '/escala');
    const detalhes = await Promise.all(dados.ministerios.map((m) => getJSON('escalas/ministerios/' + m.id)));
    const membrosPorMin = {}; detalhes.forEach((d) => (membrosPorMin[d.id] = d.membros));

    const ev = dados.evento;
    const { el, fechar } = abrirModal(`Escala — ${esc(ev.titulo)} (${dataBR(ev.data)}${ev.hora ? ' ' + ev.hora : ''})`,
      `<div id="esc-body"></div>`);

    function pintar() {
      const porMin = {};
      dados.escala.forEach((s) => (porMin[s.ministerio_id] = porMin[s.ministerio_id] || []).push(s));
      document.getElementById('esc-body').innerHTML = dados.ministerios.length ? dados.ministerios.map((m) => {
        const escalados = porMin[m.id] || [];
        const jaIds = new Set(escalados.map((s) => s.membro_id));
        const disp = (membrosPorMin[m.id] || []).filter((mm) => !jaIds.has(mm.id));
        return `<div class="esc-min">
          <div class="esc-min-head"><span class="min-dot" style="background:${esc(m.cor)}"></span> <b>${esc(m.nome)}</b></div>
          <div class="esc-chips">
            ${escalados.map((s) => `<span class="chip-pessoa">${esc(s.membro_nome)}<button class="chip-x" data-rem="${s.id}" title="Remover">✕</button></span>`).join('') || '<span class="sub-txt">Ninguém escalado.</span>'}
          </div>
          ${(membrosPorMin[m.id] || []).length
            ? `<div class="esc-add"><select data-addmin="${m.id}"><option value="">+ escalar…</option>${disp.map((mm) => `<option value="${mm.id}">${esc(mm.nome)}</option>`).join('')}</select></div>`
            : '<p class="sub-txt">Este ministério ainda não tem membros. Adicione em Ministérios › Membros.</p>'}
        </div>`;
      }).join('') : '<p class="vazio">Crie ministérios (com membros) para montar a escala.</p>';

      el.querySelectorAll('[data-rem]').forEach((b) => b.addEventListener('click', async () => {
        await api('escalas/escala/' + b.dataset.rem, { method: 'DELETE' });
        dados.escala = dados.escala.filter((s) => String(s.id) !== String(b.dataset.rem));
        pintar(); if (aoConcluir) aoConcluir();
      }));
      el.querySelectorAll('[data-addmin]').forEach((sel) => sel.addEventListener('change', async () => {
        const membroId = sel.value; if (!membroId) return;
        const r = await api('escalas/escala', { method: 'POST', body: JSON.stringify({
          evento_id: eventoId, ministerio_id: sel.dataset.addmin, membro_id: membroId }) });
        const d = await r.json();
        if (!r.ok) { alert(d.erro || 'Erro ao escalar'); return; }
        const mm = (membrosPorMin[sel.dataset.addmin] || []).find((x) => String(x.id) === String(membroId));
        dados.escala.push({ id: d.id, ministerio_id: Number(sel.dataset.addmin), membro_id: Number(membroId), membro_nome: mm ? mm.nome : '' });
        pintar(); if (aoConcluir) aoConcluir();
      }));
    }
    pintar();
  }

  // ══════════════════════════════════════════════
  //  MEMBROS (dos ministérios)
  // ══════════════════════════════════════════════
  VIEWS['escalas-membros'] = async () => {
    app.innerHTML = `<div class="painel"><h2>Membros dos ministérios</h2>
      <p class="desc">Quem faz parte de algum ministério, com os ministérios e as próximas escalas.</p>
      <div id="lista-mm"></div></div>`;
    const membros = await getJSON('escalas/membros');
    document.getElementById('lista-mm').innerHTML = tabela(membros, [
      ['Nome', (m) => `<b>${esc(m.nome)}</b>${m.telefone ? `<div class="sub-txt">${esc(m.telefone)}</div>` : ''}`],
      ['Ministérios', (m) => m.ministerios.map((mi) => `<span class="chip-min" style="border-color:${esc(mi.cor)};color:${esc(mi.cor)}">${esc(mi.nome)}</span>`).join(' ')],
      ['Próximas escalas', (m) => m.proximas.length
        ? m.proximas.slice(0, 4).map((p) => `<div class="prox-linha"><span class="min-dot" style="background:${esc(p.cor)}"></span> ${dataBR(p.data)}${p.hora ? ' ' + p.hora : ''} — ${esc(p.titulo)} <span class="sub-txt">(${esc(p.ministerio)})</span></div>`).join('')
        : '<span class="sub-txt">Sem escalas futuras.</span>'],
    ], 'Nenhum membro em ministérios ainda. Vá em Ministérios › Membros.');
  };

  // ══════════════════════════════════════════════
  //  CALENDÁRIO
  // ══════════════════════════════════════════════
  VIEWS['escalas-calendario'] = async () => {
    let mes = hojeMes();
    app.innerHTML = `
    <div class="painel">
      <div class="toolbar toolbar-mes">
        <button class="pequeno" id="c-ant">‹</button>
        <b id="c-lbl" class="cal-titulo"></b>
        <button class="pequeno" id="c-prox">›</button>
        <button class="pequeno" id="c-hoje" style="margin-left:auto">Hoje</button>
      </div>
      <div id="cal"></div>
    </div>`;
    document.getElementById('c-ant').addEventListener('click', () => { mes = proxMes(mes, -1); render(); });
    document.getElementById('c-prox').addEventListener('click', () => { mes = proxMes(mes, 1); render(); });
    document.getElementById('c-hoje').addEventListener('click', () => { mes = hojeMes(); render(); });

    async function render() {
      document.getElementById('c-lbl').textContent = mesLabel(mes);
      const { eventos } = await getJSON('escalas/calendario?mes=' + mes);
      const porDia = {};
      eventos.forEach((e) => (porDia[diaDoISO(e.data)] = porDia[diaDoISO(e.data)] || []).push(e));

      const [ano, m] = mes.split('-').map(Number);
      const primeiro = new Date(ano, m - 1, 1);
      const inicioSemana = primeiro.getDay();               // 0=Dom
      const diasNoMes = new Date(ano, m, 0).getDate();
      const hojeIso = hojeISOlocal();

      let celulas = '';
      for (let i = 0; i < inicioSemana; i++) celulas += '<div class="cal-cell vazia"></div>';
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const iso = `${mes}-${String(dia).padStart(2, '0')}`;
        const evs = porDia[dia] || [];
        const hoje = iso === hojeIso ? ' hoje' : '';
        celulas += `<div class="cal-cell${hoje}">
          <span class="cal-dia">${dia}</span>
          ${evs.map((e) => {
            const cores = [...new Set(e.escalados.map((x) => x.cor))];
            return `<button class="cal-ev" data-ev="${e.id}" title="${esc(e.titulo)}">
              <span class="cal-ev-t">${e.hora ? e.hora + ' ' : ''}${esc(e.titulo)}</span>
              <span class="cal-ev-dots">${cores.map((c) => `<i style="background:${esc(c)}"></i>`).join('')}${e.escalados.length ? '<em>' + e.escalados.length + '</em>' : ''}</span>
            </button>`;
          }).join('')}
        </div>`;
      }

      document.getElementById('cal').innerHTML = `
        <div class="cal-grid cal-head">${DIAS.map((d) => `<div class="cal-wd">${d}</div>`).join('')}</div>
        <div class="cal-grid">${celulas}</div>`;

      document.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => verEvento(b.dataset.ev, eventos, render)));
    }

    function verEvento(id, eventos, aoFechar) {
      const e = eventos.find((x) => String(x.id) === String(id));
      const porMin = {};
      e.escalados.forEach((s) => (porMin[s.ministerio] = porMin[s.ministerio] || { cor: s.cor, nomes: [] }).nomes.push(s.membro));
      const corpo = `
        <p class="desc">${tipoTag(e.tipo)} ${dataBR(e.data)}${e.hora ? ' às ' + e.hora : ''}</p>
        ${Object.keys(porMin).length ? Object.entries(porMin).map(([min, o]) =>
          `<div class="esc-min"><div class="esc-min-head"><span class="min-dot" style="background:${esc(o.cor)}"></span> <b>${esc(min)}</b></div>
           <div class="esc-chips">${o.nomes.map((n) => `<span class="chip-pessoa">${esc(n)}</span>`).join('')}</div></div>`).join('')
          : '<p class="vazio">Ninguém escalado ainda.</p>'}
        <div class="linha" style="margin-top:14px"><button id="ver-montar">Montar escala</button></div>`;
      const { fechar } = abrirModal(esc(e.titulo), corpo);
      document.getElementById('ver-montar').addEventListener('click', () => { fechar(); abrirEscala(id, aoFechar); });
    }

    render();
  };
})();
