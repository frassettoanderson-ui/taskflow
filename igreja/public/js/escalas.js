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
  const addDiasISO = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); const x = new Date(Date.UTC(a, m - 1, d + n)); return x.toISOString().slice(0, 10); };
  const TIPO = {
    culto_fixo:     { nome: 'Culto fixo',     cor: '#fbbf24', cls: 'tag-fixo' },
    evento:         { nome: 'Evento',         cor: '#93a4b8', cls: 'tag-evento' },
    culto_especial: { nome: 'Culto especial', cor: '#a78bfa', cls: 'tag-especial' },
  };
  const tipoInfo = (t) => TIPO[t] || TIPO.evento;
  const tipoTag = (t) => { const i = tipoInfo(t); return `<span class="tag-tipo ${i.cls}">${i.nome}</span>`; };
  const DIASEM = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

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
        ['', (m) => `<button class="acao-link" data-funcoes="${m.id}">Funções</button>
                     <button class="acao-link" data-membros="${m.id}">Membros</button>
                     <button class="acao-link" data-edit="${m.id}">✎ Editar</button>
                     <button class="acao-link acao-del" data-del="${m.id}">✕ Excluir</button>`],
      ], 'Nenhum ministério criado ainda.');

      document.querySelectorAll('[data-funcoes]').forEach((b) => b.addEventListener('click', () => gerirFuncoes(b.dataset.funcoes)));
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

    // Gerir as funções (cargos) de um ministério
    async function gerirFuncoes(id) {
      const det = await getJSON('escalas/ministerios/' + id);
      const { el, fechar } = abrirModal('Funções de ' + esc(det.nome), `
        <p class="desc">Cargos deste ministério (ex.: guitarrista, tecladista, recepção).</p>
        <form id="ff2" class="mb2-busca" style="margin-bottom:14px">
          <input type="text" id="fn-nome" placeholder="Nova função e Enter…" autocomplete="off">
        </form>
        <div id="fn-lista" class="mb2-equipe"></div>`);

      const pintar = () => {
        document.getElementById('fn-lista').innerHTML = det.funcoes.length
          ? det.funcoes.map((f) => `<div class="mb2-item"><span>${esc(f.nome)}</span>
               <button class="mb2-rem" data-delf="${f.id}" title="Excluir">✕</button></div>`).join('')
          : '<p class="vazio">Nenhuma função ainda.</p>';
        el.querySelectorAll('[data-delf]').forEach((b) => b.addEventListener('click', async () => {
          await api('escalas/funcoes/' + b.dataset.delf, { method: 'DELETE' });
          det.funcoes = det.funcoes.filter((x) => String(x.id) !== String(b.dataset.delf)); pintar();
        }));
      };
      document.getElementById('ff2').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('fn-nome').value.trim(); if (!nome) return;
        const r = await api('escalas/ministerios/' + id + '/funcoes', { method: 'POST', body: JSON.stringify({ nome }) });
        const d = await r.json(); if (!r.ok) return;
        det.funcoes.push(d); document.getElementById('fn-nome').value = ''; pintar();
      });
      pintar();
    }

    async function gerirMembros(id) {
      const [det, todos] = await Promise.all([getJSON('escalas/ministerios/' + id), getJSON('membros?situacao=ativo')]);
      const porId = {}; todos.forEach((m) => (porId[m.id] = m));
      const funcoes = det.funcoes || [];
      const equipe = det.membros.map((m) => m.id);
      const fnDe = {}; det.membros.forEach((m) => (fnDe[m.id] = new Set((m.funcoes || []).map(Number))));

      const { el, fechar } = abrirModal('Membros de ' + esc(det.nome), `
        <div class="mb2">
          <div class="mb2-busca">
            <input type="text" id="mb-busca" placeholder="Buscar na igreja para adicionar…" autocomplete="off">
            <div id="mb-result" class="mb2-result" hidden></div>
          </div>
          <div class="mb2-equipe-head"><b>Na equipe</b> <span id="mb-cont" class="sub-txt"></span></div>
          ${funcoes.length ? '' : '<p class="desc">Dica: crie as funções em “Funções” para marcar o cargo de cada um.</p>'}
          <div id="mb-equipe" class="mb2-equipe"></div>
          <div class="linha" style="margin-top:14px"><button id="mb-salvar">Salvar</button><span id="mb-msg" class="sub-txt"></span></div>
        </div>`);

      const pintarEquipe = () => {
        document.getElementById('mb-cont').textContent = equipe.length + (equipe.length === 1 ? ' pessoa' : ' pessoas');
        document.getElementById('mb-equipe').innerHTML = equipe.length
          ? equipe.map((mid) => `<div class="mb2-item mb2-item-col">
               <div class="mb2-row"><span>${esc(porId[mid] ? porId[mid].nome : '—')}</span>
                 <button class="mb2-rem" data-rem="${mid}" title="Remover">✕</button></div>
               ${funcoes.length ? `<div class="mb2-funcs">${funcoes.map((f) => `<button type="button" class="fn-chip ${(fnDe[mid] || new Set()).has(f.id) ? 'on' : ''}" data-m="${mid}" data-f="${f.id}">${esc(f.nome)}</button>`).join('')}</div>` : ''}
             </div>`).join('')
          : '<p class="vazio">Ninguém ainda. Busque acima para adicionar.</p>';
        el.querySelectorAll('[data-rem]').forEach((b) => b.addEventListener('click', () => {
          const i = equipe.indexOf(Number(b.dataset.rem)); if (i >= 0) equipe.splice(i, 1);
          pintarEquipe(); buscar();
        }));
        el.querySelectorAll('.fn-chip').forEach((b) => b.addEventListener('click', () => {
          const mid = Number(b.dataset.m), fid = Number(b.dataset.f);
          fnDe[mid] = fnDe[mid] || new Set();
          if (fnDe[mid].has(fid)) fnDe[mid].delete(fid); else fnDe[mid].add(fid);
          b.classList.toggle('on');
        }));
      };

      const buscar = () => {
        const f = document.getElementById('mb-busca').value.trim().toLowerCase();
        const box = document.getElementById('mb-result');
        if (!f) { box.hidden = true; box.innerHTML = ''; return; }
        const achados = todos.filter((m) => !equipe.includes(m.id) && m.nome.toLowerCase().includes(f)).slice(0, 30);
        box.hidden = false;
        box.innerHTML = achados.length
          ? achados.map((m) => `<button class="mb2-add" data-add="${m.id}"><span>${esc(m.nome)}</span><span class="mb2-plus">+ adicionar</span></button>`).join('')
          : '<div class="mb2-vazio">Nenhum membro encontrado.</div>';
        box.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
          const mid = Number(b.dataset.add);
          if (!equipe.includes(mid)) equipe.push(mid);
          document.getElementById('mb-busca').value = ''; buscar(); pintarEquipe();
          document.getElementById('mb-busca').focus();
        }));
      };

      document.getElementById('mb-busca').addEventListener('input', buscar);
      document.getElementById('mb-salvar').addEventListener('click', async () => {
        const funcMap = {}; equipe.forEach((mid) => { funcMap[mid] = [...(fnDe[mid] || [])]; });
        const r = await api('escalas/ministerios/' + id + '/membros', { method: 'PUT', body: JSON.stringify({ membros: equipe, funcoes: funcMap }) });
        if (!r.ok) { document.getElementById('mb-msg').textContent = 'Erro ao salvar'; return; }
        fechar(); listar();
      });
      pintarEquipe();
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
          <label class="cresce">Título *<input type="text" id="ev-titulo" required placeholder="Culto de Domingo, Santa Ceia..."></label>
          <label>Tipo<select id="ev-tipo">
            <option value="culto_fixo">Culto fixo</option>
            <option value="evento">Evento</option>
            <option value="culto_especial">Culto especial</option>
          </select></label>
        </div>
        <div id="ev-fixo">
          <label>Dias da semana *</label>
          <div class="dias-semana" id="ev-dias">${DIAS.map((d, i) => `<label class="dia-chip"><input type="checkbox" value="${i}"><span>${d}</span></label>`).join('')}</div>
          <p class="desc">O culto fixo aparece toda semana, em todos os meses, nos dias marcados.</p>
        </div>
        <div class="linha" id="ev-datado" style="display:none">
          <label>Data *<input type="date" id="ev-data"></label>
        </div>
        <div class="linha">
          <label>Horário<input type="time" id="ev-hora"></label>
          <label id="ev-obs-lbl" style="display:none">Observação<input type="text" id="ev-obs" placeholder="opcional"></label>
        </div>
        <button type="submit">Cadastrar</button>
        <p id="ev-msg" class="erro"></p>
      </form>
    </div>
    <div class="painel">
      <h2>Cultos fixos</h2>
      <div id="lista-fixos"></div>
    </div>
    <div class="painel">
      <div class="toolbar toolbar-mes">
        <b>Eventos e cultos especiais</b>
        <span style="flex:1"></span>
        <button class="pequeno" id="mes-ant">‹</button>
        <b id="mes-lbl"></b>
        <button class="pequeno" id="mes-prox">›</button>
      </div>
      <div id="lista-ev"></div>
    </div>`;

    const sinc = () => {
      const t = document.getElementById('ev-tipo').value;
      const fixo = t === 'culto_fixo';
      document.getElementById('ev-fixo').style.display = fixo ? '' : 'none';
      document.getElementById('ev-datado').style.display = fixo ? 'none' : '';
      document.getElementById('ev-obs-lbl').style.display = fixo ? 'none' : '';
      const dt = document.getElementById('ev-data');
      if (!fixo && !dt.value) dt.value = hojeISOlocal();
    };
    document.getElementById('ev-tipo').addEventListener('change', sinc);
    sinc();

    document.getElementById('fev').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('ev-msg');
      const tipo = document.getElementById('ev-tipo').value;
      const titulo = document.getElementById('ev-titulo').value;
      const hora = document.getElementById('ev-hora').value;
      let r;
      if (tipo === 'culto_fixo') {
        const dias = [...document.querySelectorAll('#ev-dias input:checked')].map((c) => Number(c.value));
        if (!dias.length) { msg.className = 'erro'; msg.textContent = 'Marque ao menos um dia da semana.'; return; }
        r = await api('escalas/cultos-fixos', { method: 'POST', body: JSON.stringify({ titulo, dias, hora }) });
      } else {
        r = await api('escalas/eventos', { method: 'POST', body: JSON.stringify({
          titulo, tipo, data: document.getElementById('ev-data').value, hora,
          observacao: document.getElementById('ev-obs').value }) });
      }
      const d = await r.json();
      if (!r.ok) { msg.className = 'erro'; msg.textContent = d.erro; return; }
      if (d.data) mes = d.data.slice(0, 7);
      document.getElementById('fev').reset();
      sinc();
      listar();
    });

    document.getElementById('mes-ant').addEventListener('click', () => { mes = proxMes(mes, -1); listar(); });
    document.getElementById('mes-prox').addEventListener('click', () => { mes = proxMes(mes, 1); listar(); });

    async function listar() {
      document.getElementById('mes-lbl').textContent = mesLabel(mes);

      // cultos fixos (regras)
      const fixos = await getJSON('escalas/cultos-fixos');
      document.getElementById('lista-fixos').innerHTML = tabela(fixos, [
        ['Culto', (f) => `${esc(f.titulo)} ${tipoTag('culto_fixo')}`],
        ['Dia da semana', (f) => DIASEM[f.dia_semana]],
        ['Horário', (f) => f.hora || '—'],
        ['', (f) => `<button class="acao-link" data-edfixo="${f.id}">✎ Editar</button>
                     <button class="acao-link acao-del" data-delfixo="${f.id}">✕ Excluir</button>`],
      ], 'Nenhum culto fixo. Crie um acima escolhendo o tipo "Culto fixo".');
      document.querySelectorAll('[data-edfixo]').forEach((b) => b.addEventListener('click', () => editarFixo(b.dataset.edfixo, fixos, listar)));
      document.querySelectorAll('[data-delfixo]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Excluir este culto fixo? As escalas já montadas nele também serão removidas.')) return;
        await api('escalas/cultos-fixos/' + b.dataset.delfixo, { method: 'DELETE' }); listar();
      }));

      // eventos datados do mês
      const evs = await getJSON('escalas/eventos?mes=' + mes);
      document.getElementById('lista-ev').innerHTML = tabela(evs, [
        ['Data', (e) => `<b>${diaDoISO(e.data)}</b> <span class="sub-txt">${DIAS[new Date(e.data + 'T12:00').getDay()]}${e.hora ? ' · ' + e.hora : ''}</span>`],
        ['Título', (e) => `${esc(e.titulo)} ${tipoTag(e.tipo)}${e.observacao ? `<div class="sub-txt">${esc(e.observacao)}</div>` : ''}`],
        ['Escalados', (e) => `${e.qtd_escalados}`],
        ['', (e) => `<button class="acao-link" data-escalar="${e.id}">Montar escala</button>
                     <button class="acao-link" data-edev="${e.id}">✎</button>
                     <button class="acao-link acao-del" data-delev="${e.id}">✕</button>`],
      ], 'Nenhum evento ou culto especial neste mês.');
      document.querySelectorAll('[data-escalar]').forEach((b) => b.addEventListener('click', () => abrirEscala(b.dataset.escalar, listar)));
      document.querySelectorAll('[data-edev]').forEach((b) => b.addEventListener('click', () => editarEvento(b.dataset.edev, evs, listar)));
      document.querySelectorAll('[data-delev]').forEach((b) => b.addEventListener('click', () => {
        if (!confirm('Excluir este evento e sua escala?')) return;
        api('escalas/eventos/' + b.dataset.delev, { method: 'DELETE' }).then(listar);
      }));
    }
    listar();
  };

  function editarFixo(id, fixos, aoConcluir) {
    const f = fixos.find((x) => String(x.id) === String(id));
    const { fechar } = abrirModal('Editar culto fixo', `
      <form id="ff" class="form-grid">
        <label>Título *<input type="text" id="f-titulo" value="${esc(f.titulo)}" required></label>
        <div class="linha">
          <label>Dia da semana<select id="f-dia">${DIASEM.map((d, i) => `<option value="${i}" ${i === f.dia_semana ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label>Horário<input type="time" id="f-hora" value="${esc(f.hora || '')}"></label>
        </div>
        <div class="linha"><button type="submit">Salvar</button></div>
        <p id="f-msg" class="erro"></p>
      </form>`);
    document.getElementById('ff').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const r = await api('escalas/cultos-fixos/' + id, { method: 'PUT', body: JSON.stringify({
        titulo: document.getElementById('f-titulo').value, dia_semana: document.getElementById('f-dia').value,
        hora: document.getElementById('f-hora').value }) });
      const d = await r.json();
      if (!r.ok) { document.getElementById('f-msg').textContent = d.erro; return; }
      fechar(); if (aoConcluir) aoConcluir();
    });
  }

  function editarEvento(id, evs, aoConcluir) {
    const e = evs.find((x) => String(x.id) === String(id));
    const { fechar } = abrirModal('Editar evento', `
      <form id="fee" class="form-grid">
        <div class="linha">
          <label class="cresce">Título *<input type="text" id="x-titulo" value="${esc(e.titulo)}" required></label>
          <label>Tipo<select id="x-tipo"><option value="evento" ${e.tipo === 'evento' ? 'selected' : ''}>Evento</option><option value="culto_especial" ${e.tipo === 'culto_especial' ? 'selected' : ''}>Culto especial</option></select></label>
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
      eventos.forEach((e, i) => { e._i = i; (porDia[diaDoISO(e.data)] = porDia[diaDoISO(e.data)] || []).push(e); });

      const [ano, m] = mes.split('-').map(Number);
      const inicioSemana = new Date(ano, m - 1, 1).getDay();   // 0=Dom
      const diasNoMes = new Date(ano, m, 0).getDate();
      const hojeIso = hojeISOlocal();

      let celulas = '';
      for (let i = 0; i < inicioSemana; i++) celulas += '<div class="cal-cell vazia"></div>';
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const iso = `${mes}-${String(dia).padStart(2, '0')}`;
        const evs = porDia[dia] || [];
        const hoje = iso === hojeIso ? ' hoje' : '';
        const temEv = evs.length ? ' com-ev' : '';
        const borda = evs.length ? ` style="--evcor:${tipoInfo(evs[0].tipo).cor}"` : '';
        // chips de ministérios escalados no dia (um por ministério, com a contagem)
        const chips = [];
        evs.forEach((e) => {
          const porMin = {};
          e.escalados.forEach((s) => { (porMin[s.ministerio] = porMin[s.ministerio] || { cor: s.cor, n: 0 }).n++; });
          Object.entries(porMin).forEach(([nome, o]) => chips.push({ i: e._i, nome, cor: o.cor, n: o.n }));
        });
        celulas += `<div class="cal-cell${hoje}${temEv}"${borda}>
          <div class="cal-tags">${evs.map((e) => `<button class="cal-tag" data-ev="${e._i}" title="${esc(e.titulo)}${e.hora ? ' · ' + e.hora : ''}" style="background:${tipoInfo(e.tipo).cor}">${tipoInfo(e.tipo).nome}</button>`).join('')}</div>
          <span class="cal-dia">${dia}</span>
          ${chips.length
            ? `<div class="cal-mins">${chips.map((c) => `<button class="cal-min" style="--c:${esc(c.cor)}" data-ev="${c.i}" data-min="${esc(c.nome)}">${esc(c.nome)}<i>${c.n}</i></button>`).join('')}</div>`
            : (evs.length ? `<button class="cal-vazio" data-ev="${evs[0]._i}">+ montar escala</button>` : '')}
        </div>`;
      }

      const cal = document.getElementById('cal');
      cal.innerHTML = `
        <div class="cal-grid cal-head">${DIAS.map((d) => `<div class="cal-wd">${d}</div>`).join('')}</div>
        <div class="cal-grid">${celulas}</div>`;

      // clicar na TAG (ou "montar escala") abre o evento; clicar num MINISTÉRIO abre os escalados dele
      cal.querySelectorAll('.cal-tag, .cal-vazio').forEach((b) => b.addEventListener('click', () => verEvento(Number(b.dataset.ev), eventos, render)));
      cal.querySelectorAll('.cal-min').forEach((b) => b.addEventListener('click', () => verMinisterio(eventos[Number(b.dataset.ev)], b.dataset.min)));
    }

    function verMinisterio(e, nome) {
      const nomes = e.escalados.filter((s) => s.ministerio === nome).map((s) => s.membro);
      abrirModal(esc(nome) + ' — ' + dataBR(e.data), `
        <p class="desc">${tipoTag(e.tipo)} ${esc(e.titulo)}${e.hora ? ' · ' + e.hora : ''}</p>
        <div class="esc-chips">${nomes.map((n) => `<span class="chip-pessoa">${esc(n)}</span>`).join('') || '<span class="sub-txt">Ninguém escalado neste ministério.</span>'}</div>`);
    }

    function verEvento(idx, eventos, aoFechar) {
      const e = eventos[idx];
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
      document.getElementById('ver-montar').addEventListener('click', async () => {
        fechar();
        let eventoId = e.id;
        if (!eventoId && e.fixo_id) { // ocorrência de culto fixo ainda não materializada
          const r = await api('escalas/ocorrencia', { method: 'POST', body: JSON.stringify({ culto_fixo_id: e.fixo_id, data: e.data }) });
          const d = await r.json(); if (!r.ok) { alert(d.erro || 'Erro'); return; } eventoId = d.id;
        }
        abrirEscala(eventoId, aoFechar);
      });
    }

    render();
  };
})();
