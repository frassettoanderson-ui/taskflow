// Holysign — painel (app de uma página, sem framework). Rotas por hash: #/entrar, #/criar, #/docs, #/novo, #/doc/:id, #/config/:aba ...
(() => {
  'use strict'
  const B = window.HS_BASE
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]
  const app = $('#app')
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const dataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
  const data = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')
  let eu = null

  // ── utilitários ───────────────────────────────────────────────
  async function api(caminho, opts = {}) {
    const r = await fetch(B + caminho, { method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin' })
    const j = await r.json().catch(() => ({}))
    if (r.status === 401 && caminho.startsWith('/app/api') && eu) { eu = null; ir('#/entrar'); throw new Error(j.erro || 'Sessão expirada') }
    if (!r.ok) throw new Error(j.erro || 'Algo deu errado. Tente de novo.')
    return j
  }
  function toast(msg, erro = false) {
    const t = $('#toast'); t.textContent = msg; t.className = `toast on${erro ? ' erro' : ''}`
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast' }, 3600)
  }
  const ir = (h) => { if (location.hash === h) rota(); else location.hash = h }
  async function copiar(txt, msg = 'Copiado.') {
    try { await navigator.clipboard.writeText(txt); toast(msg) } catch { prompt('Copie:', txt) }
  }
  const dig = (v) => String(v || '').replace(/\D/g, '')
  const mascara = {
    cpf: (v) => dig(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
    cnpj: (v) => dig(v).slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'),
    fone: (v) => { const d = dig(v).slice(0, 11); return d.length <= 10 ? d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2') : d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2') },
  }
  // aplica máscara em qualquer input com data-mascara
  document.addEventListener('input', (e) => { const m = e.target.dataset?.mascara; if (m && mascara[m]) e.target.value = mascara[m](e.target.value) })
  function formMsg(el, texto, ok = false) { el.textContent = texto || ''; el.className = `msg ${ok ? 'ok' : 'erro'}` }
  const marca = (cls = '') => `<a class="marca ${cls}" href="#/">Holy<b>sign</b></a>`
  const ehDono = () => eu?.usuario.papel === 'dono'

  // ── telas de acesso ───────────────────────────────────────────
  function acesso(conteudo) {
    app.innerHTML = `<div class="acesso"><header>${marca()}<span class="marca-by">by HolyTech</span></header><main>${conteudo}</main>
      <footer>Holysign · assinatura eletrônica com código, selfie e carimbo de tempo · <a href="${B}/v">verificar um documento</a></footer></div>`
  }
  function telaCapa() {
    acesso(`<section class="capa">
      <div class="capa-texto">
        <h1 class="titulo">Holy<b>sign</b></h1>
        <p>Envie contratos para assinar pelo celular. Quem assina confirma com código e selfie; você recebe o PDF com certificado, carimbo de tempo e verificação por QR code.</p>
        <div class="capa-acoes"><a class="btn sign grande" href="#/criar">Criar conta grátis</a><a class="btn claro grande" href="#/entrar">Entrar</a></div>
        <ul class="capa-pontos">
          <li>O contrato pode sair já assinado pela sua empresa</li>
          <li>API e webhook para o seu sistema enviar e saber quando assinou</li>
          <li>Validade jurídica: MP 2.200-2/2001, art. 10, § 2º</li>
        </ul>
      </div>
      <div class="ilustra" aria-hidden="true">
        <div class="pg atras"></div>
        <div class="pg"><div class="ln t"></div><div class="ln"></div><div class="ln"></div><div class="ln" style="width:84%"></div><div class="ln"></div><div class="ln" style="width:70%"></div>
          <div class="assin"><svg viewBox="0 0 190 56"><path d="M4 44c14-2 18-34 30-34s-4 36 10 36 12-26 22-26-2 22 10 22 10-18 18-18 4 14 12 14 14-12 22-12 8 8 18 6" fill="none" stroke="#0E0E10" stroke-width="2.4" stroke-linecap="round"/></svg><small>assinatura</small></div>
          <div class="carimbo"><div>ASSINADO<b>✓</b>HOLYSIGN</div></div></div>
      </div></section>`)
  }
  function telaEntrar() {
    acesso(`<div class="cartao-acesso"><h1>Entrar</h1><p class="sub">Acesse a conta da sua empresa.</p>
      <form class="folha" id="f"><label class="campo"><span>E-mail</span><input class="inp" name="email" type="email" autocomplete="email" required></label>
      <label class="campo"><span>Senha</span><input class="inp" name="senha" type="password" autocomplete="current-password" required></label>
      <button class="btn sign" style="width:100%">Entrar</button><p class="msg" id="m"></p>
      <p class="centro" style="margin:8px 0 0"><a class="link" href="#/esqueci">Esqueci minha senha</a></p></form>
      <p class="troca">Ainda não tem conta? <a class="link" href="#/criar">Criar conta grátis</a></p></div>`)
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target)
      try { await api('/conta/entrar', { method: 'POST', body: { email: f.get('email'), senha: f.get('senha') } }); await carregarEu(); ir('#/docs') } catch (er) { formMsg($('#m'), er.message) }
    }
  }
  function telaCriar() {
    acesso(`<div class="cartao-acesso" style="max-width:520px"><h1>Criar conta</h1><p class="sub">Grátis para começar. Leva um minuto.</p>
      <form class="folha" id="f">
        <div class="grade g2"><label class="campo"><span>Empresa</span><input class="inp" name="empresa" required></label>
        <label class="campo"><span>CNPJ (opcional)</span><input class="inp" name="cnpj" data-mascara="cnpj" inputmode="numeric" placeholder="00.000.000/0000-00"></label></div>
        <label class="campo"><span>Seu nome</span><input class="inp" name="nome" autocomplete="name" required></label>
        <label class="campo"><span>E-mail</span><input class="inp" name="email" type="email" autocomplete="email" required></label>
        <label class="campo"><span>Senha (mínimo 8 caracteres)</span><input class="inp" name="senha" type="password" autocomplete="new-password" minlength="8" required></label>
        <label class="check"><input type="checkbox" name="aceite" required> <span>Li e aceito os termos de uso e a política de privacidade do Holysign.</span></label>
        <button class="btn sign" style="width:100%">Criar conta</button><p class="msg" id="m"></p></form>
      <p class="troca">Já tem conta? <a class="link" href="#/entrar">Entrar</a></p></div>`)
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target)
      try {
        await api('/conta/criar', { method: 'POST', body: { empresa: f.get('empresa'), cnpj: f.get('cnpj'), nome: f.get('nome'), email: f.get('email'), senha: f.get('senha'), aceite: !!f.get('aceite') } })
        await carregarEu(); toast('Conta criada. Bem-vindo ao Holysign!'); ir('#/docs')
      } catch (er) { formMsg($('#m'), er.message) }
    }
  }
  function telaEsqueci() {
    acesso(`<div class="cartao-acesso"><h1>Esqueci a senha</h1><p class="sub">Enviamos um link para você criar uma nova.</p>
      <form class="folha" id="f"><label class="campo"><span>E-mail da conta</span><input class="inp" name="email" type="email" required></label>
      <button class="btn sign" style="width:100%">Enviar link</button><p class="msg" id="m"></p></form>
      <p class="troca"><a class="link" href="#/entrar">Voltar para entrar</a></p></div>`)
    $('#f').onsubmit = async (e) => {
      e.preventDefault()
      try {
        const r = await api('/conta/esqueci', { method: 'POST', body: { email: new FormData(e.target).get('email') } })
        formMsg($('#m'), r.emailAtivo ? 'Se o e-mail tiver conta, o link chega em instantes. Confira também o spam.' : 'O envio de e-mail ainda não está ativo. Fale com o suporte da HolyTech para redefinir.', r.emailAtivo)
      } catch (er) { formMsg($('#m'), er.message) }
    }
  }
  async function telaConvite(token, redefinir) {
    acesso('<div class="cartao-acesso"><p class="sub">Carregando…</p></div>')
    let c
    try { c = await api(`/conta/convite/${token}`) } catch (er) { acesso(`<div class="cartao-acesso"><h1>Link inválido</h1><p class="sub">${esc(er.message)}</p><a class="btn" href="#/entrar">Entrar</a></div>`); return }
    acesso(`<div class="cartao-acesso"><h1>${redefinir || !c.novo ? 'Nova senha' : 'Bem-vindo'}</h1>
      <p class="sub">${redefinir || !c.novo ? esc(c.email) : `${esc(c.empresa)} convidou você para o Holysign.`}</p>
      <form class="folha" id="f">${redefinir || !c.novo ? '' : `<label class="campo"><span>Seu nome</span><input class="inp" name="nome" value="${esc(c.nome)}" required></label>`}
      <label class="campo"><span>Senha (mínimo 8 caracteres)</span><input class="inp" name="senha" type="password" minlength="8" autocomplete="new-password" required></label>
      <button class="btn sign" style="width:100%">Salvar e entrar</button><p class="msg" id="m"></p></form></div>`)
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target)
      try { await api(`/conta/convite/${token}`, { method: 'POST', body: { nome: f.get('nome'), senha: f.get('senha') } }); await carregarEu(); ir('#/docs') } catch (er) { formMsg($('#m'), er.message) }
    }
  }

  // ── moldura do app logado ─────────────────────────────────────
  function moldura(ativo, conteudo) {
    const u = eu.uso; const pct = u.limite ? Math.min(100, Math.round((u.usados / u.limite) * 100)) : 0
    app.innerHTML = `<div class="barra"><div class="dentro">${marca()}
      <nav><a href="#/docs" class="${ativo === 'docs' ? 'ativo' : ''}">Documentos</a><a href="#/novo" class="${ativo === 'novo' ? 'ativo' : ''}">Novo documento</a><a href="#/config" class="${ativo === 'config' ? 'ativo' : ''}">Configurações</a></nav>
      <div class="direita">${u.limite ? `<span class="uso" title="Documentos enviados neste mês">${u.usados}/${u.limite} no mês <span class="trilho"><i style="width:${pct}%"></i></span></span>` : '<span class="uso">Plano cortesia · sem limite</span>'}
      <span>${esc(eu.conta.nome)}</span><button class="link" id="sair" style="color:#cfcfd4">Sair</button></div></div></div>
      <div class="pagina">${conteudo}</div>`
    $('#sair').onclick = async () => { await api('/conta/sair', { method: 'POST' }).catch(() => {}); eu = null; ir('#/') }
  }
  async function carregarEu() { eu = await api('/app/api/eu') }

  // ── lista de documentos ───────────────────────────────────────
  let filtro = { status: 'pendente', q: '' }
  async function telaDocs() {
    moldura('docs', `<div class="cabeca"><div><h1>Documentos</h1><p class="sub">O que você enviou para assinar.</p></div><a class="btn sign" href="#/novo">+ Novo documento</a></div>
      <div class="abas" id="abas"></div><input class="inp" id="q" placeholder="Buscar por título, nome, e-mail ou código" value="${esc(filtro.q)}" style="margin-bottom:14px">
      <div class="docs" id="lista"><p class="sub centro">Carregando…</p></div>`)
    const carregar = async () => {
      const r = await api(`/app/api/documentos?status=${filtro.status}&q=${encodeURIComponent(filtro.q)}`)
      const c = r.contagem; const total = (c.pendente || 0) + (c.concluido || 0) + (c.cancelado || 0)
      $('#abas').innerHTML = [['pendente', 'Aguardando', c.pendente], ['concluido', 'Assinados', c.concluido], ['cancelado', 'Cancelados', c.cancelado], ['', 'Todos', total], ['termos', 'Termos da empresa', null]]
        .map(([v, t, n]) => `<button data-v="${v}" class="${filtro.status === v ? 'ativo' : ''}">${t}${n != null ? `<span class="n">${n || 0}</span>` : ''}</button>`).join('')
      $$('#abas button').forEach((b) => (b.onclick = () => { filtro.status = b.dataset.v; carregar() }))
      $('#lista').innerHTML = r.documentos.length ? r.documentos.map((d) => `<a class="doc ${d.status}" href="#/doc/${d.id}">
          <div class="t">${esc(d.titulo)}</div><div class="quem">${esc(d.nomes || '')}</div>
          <div class="lado"><span class="selo ${d.status}">${{ pendente: 'aguardando', concluido: 'assinado', cancelado: 'cancelado' }[d.status] || d.status}</span>
          <span class="regua" title="${d.assinados} de ${d.total} assinaram">${Array.from({ length: d.total }, (_, i) => `<i class="${i < d.assinados ? 'ok' : ''}"></i>`).join('')}</span>
          <span>${data(d.criado_em)}</span></div></a>`).join('')
        : `<div class="vazio folha"><div class="grande-ico">✎</div>${filtro.q ? 'Nada encontrado com essa busca.' : filtro.status === 'pendente' ? 'Nenhum documento aguardando assinatura.' : 'Nenhum documento aqui ainda.'}<p style="margin-top:14px"><a class="btn sign" href="#/novo">Enviar o primeiro</a></p></div>`
    }
    let t; $('#q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { filtro.q = e.target.value; carregar() }, 300) }
    await carregar()
  }

  // ── novo documento ────────────────────────────────────────────
  async function telaNovo() {
    const reps = eu.representantes
    moldura('novo', `<div class="cabeca"><div><h1>Novo documento</h1><p class="sub">Suba o PDF, diga quem assina e envie.</p></div></div>
      <form id="f">
        <div class="folha"><h2>1. Documento</h2>
          <div class="soltar" id="soltar"><input type="file" id="arq" accept="application/pdf" class="oculto"><div id="arqInfo"><strong>Arraste o PDF aqui</strong><span class="sub">ou clique para escolher (até 20 MB)</span></div></div>
          <label class="campo" style="margin-top:14px"><span>Título</span><input class="inp" name="titulo" id="titulo" required placeholder="Ex.: Contrato de prestação de serviços — Empresa X"></label>
        </div>
        <div class="folha"><h2>2. Quem assina</h2><p class="sub">Cada pessoa recebe um link e confirma com código (e-mail ou WhatsApp) e selfie.</p>
          ${reps.length ? `<div class="empresa-assina"><label class="check" style="margin:0"><input type="checkbox" id="empresaAssina"> <span><b>Já enviar assinado pela empresa</b><br><span class="sub" style="margin:0">Assina como ${esc(reps[0].nome)} (${esc(reps[0].cargo)}), pelo termo de autorização dele.</span></span></label>
            ${reps.length > 1 ? `<select class="inp" id="repSel" style="margin-top:8px">${reps.map((r) => `<option value="${r.id}">${esc(r.nome)} — ${esc(r.cargo)}</option>`).join('')}</select>` : `<input type="hidden" id="repSel" value="${reps[0].id}">`}</div>`
            : `<p class="dica" style="margin:-6px 0 12px">Quer que os contratos já saiam assinados pela sua empresa? Cadastre o responsável em <a class="link" href="#/config/empresa-assina">Configurações → Assinatura da empresa</a>.</p>`}
          <div id="sigs"></div>
          <button type="button" class="btn claro peq" id="maisSig">+ Adicionar pessoa</button>
        </div>
        <div class="folha"><h2>3. Envio</h2>
          <label class="check"><input type="checkbox" id="enviar" checked> <span>Enviar o link de assinatura por e-mail/WhatsApp para cada pessoa${eu.canais.email || eu.canais.whatsapp ? '' : ' <span class="sub">(nenhum canal configurado ainda — você poderá copiar os links)</span>'}</span></label>
          <div class="centro" style="margin-top:14px"><button class="btn sign grande" id="enviarBtn">Enviar para assinatura</button><p class="msg" id="m"></p></div>
        </div>
      </form>`)
    let pdfB64 = ''
    const zona = $('#soltar'); const input = $('#arq')
    const carregarArq = (file) => {
      if (!file) return
      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return toast('Escolha um arquivo PDF.', true)
      if (file.size > 20 * 1024 * 1024) return toast('O PDF passa de 20 MB.', true)
      const r = new FileReader()
      r.onload = () => {
        pdfB64 = String(r.result).split(',')[1]
        $('#arqInfo').innerHTML = `<div class="arquivo-ok"><span class="ico"></span><div style="text-align:left"><b>${esc(file.name)}</b><div class="sub" style="margin:0">${(file.size / 1024).toFixed(0)} KB · <button type="button" class="link" id="trocarArq">trocar</button></div></div></div>`
        $('#trocarArq').onclick = (e) => { e.stopPropagation(); input.click() }
        if (!$('#titulo').value) $('#titulo').value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')
      }
      r.readAsDataURL(file)
    }
    zona.onclick = () => input.click()
    input.onchange = () => carregarArq(input.files[0])
    zona.ondragover = (e) => { e.preventDefault(); zona.classList.add('sobre') }
    zona.ondragleave = () => zona.classList.remove('sobre')
    zona.ondrop = (e) => { e.preventDefault(); zona.classList.remove('sobre'); carregarArq(e.dataTransfer.files[0]) }

    const linhaSig = () => `<div class="sig"><span class="num"></span><button type="button" class="link tirar">remover</button>
      <div class="grade g4"><label class="campo"><span>Nome completo</span><input class="inp" data-k="nome" required></label>
      <label class="campo"><span>E-mail</span><input class="inp" data-k="email" type="email"></label>
      <label class="campo"><span>WhatsApp</span><input class="inp" data-k="whatsapp" data-mascara="fone" inputmode="tel" placeholder="(48) 99999-9999"></label>
      <label class="campo"><span>Assina como</span><select class="inp" data-k="papel"><option value="parte">Parte</option><option value="testemunha">Testemunha</option></select></label></div>
      <div class="grade g4"><label class="campo"><span>CPF (opcional)</span><input class="inp" data-k="cpf" data-mascara="cpf" inputmode="numeric" placeholder="000.000.000-00"></label></div></div>`
    const renum = () => $$('#sigs .sig').forEach((s, i, l) => { s.querySelector('.num').textContent = `PESSOA ${i + 1}`; s.querySelector('.tirar').classList.toggle('oculto', l.length === 1) })
    const adicionar = () => { $('#sigs').insertAdjacentHTML('beforeend', linhaSig()); renum() }
    $('#sigs').onclick = (e) => { if (e.target.classList.contains('tirar')) { e.target.closest('.sig').remove(); renum() } }
    $('#maisSig').onclick = adicionar
    adicionar()

    $('#f').onsubmit = async (e) => {
      e.preventDefault()
      if (!pdfB64) return formMsg($('#m'), 'Escolha o PDF do documento.')
      const signatarios = $$('#sigs .sig').map((s) => Object.fromEntries($$('[data-k]', s).map((i) => [i.dataset.k, i.value.trim()])))
      if (signatarios.some((s) => !s.nome || (!s.email && !s.whatsapp))) return formMsg($('#m'), 'Cada pessoa precisa de nome e e-mail ou WhatsApp.')
      const btn = $('#enviarBtn'); btn.disabled = true; btn.textContent = 'Enviando…'
      try {
        const d = await api('/app/api/documentos', { method: 'POST', body: {
          titulo: $('#titulo').value, pdf_base64: pdfB64, signatarios: signatarios.map((s) => ({ ...s, cpf: dig(s.cpf), whatsapp: dig(s.whatsapp) })),
          enviar_convite: $('#enviar').checked, representante_id: $('#empresaAssina')?.checked ? $('#repSel').value : null,
        } })
        await carregarEu(); toast('Documento enviado para assinatura.'); ir(`#/doc/${d.id}`)
      } catch (er) { formMsg($('#m'), er.message); btn.disabled = false; btn.textContent = 'Enviar para assinatura' }
    }
  }

  // ── detalhe ───────────────────────────────────────────────────
  const EVENTOS = {
    documento_criado: 'Documento criado', convite_enviado: 'Convite enviado', pagina_aberta: 'Abriu o link', documento_visualizado: 'Visualizou o PDF',
    codigo_enviado: 'Código enviado', codigo_validado: 'Código confirmado', codigo_incorreto: 'Código incorreto', selfie_capturada: 'Selfie registrada',
    assinou: 'Assinou', documento_concluido: 'Documento concluído e carimbado', documento_cancelado: 'Documento cancelado', assinatura_representante: 'Assinado pela empresa (termo de autorização)',
    representante_autorizado: 'Assinatura automática da empresa liberada', autorizacao_revogada: 'Autorização revogada',
  }
  async function telaDoc(id) {
    moldura('docs', '<p class="sub">Carregando…</p>')
    let d
    try { d = await api(`/app/api/documentos/${id}`) } catch (er) { moldura('docs', `<div class="vazio folha">${esc(er.message)}<p><a class="btn" href="#/docs">Voltar</a></p></div>`); return }
    const assinados = d.signatarios.filter((s) => s.status === 'assinado').length
    moldura('docs', `<p style="margin:0 0 10px"><a class="link" href="#/docs">← Documentos</a></p>
      <div class="cabeca"><div><h1>${esc(d.titulo)}</h1><p class="sub">Criado em ${dataHora(d.criado_em)}${d.concluido_em ? ` · concluído em ${dataHora(d.concluido_em)}` : ''}</p></div>
        <span class="selo ${d.status}">${{ pendente: 'aguardando assinaturas', concluido: 'assinado', cancelado: 'cancelado', concluindo: 'finalizando' }[d.status] || d.status}</span></div>
      <div class="detalhe">
        <div>
          <div class="folha assinantes"><h2>Quem assina <span class="sub" style="font-size:14px">· ${assinados} de ${d.signatarios.length}</span></h2>
            ${d.signatarios.map((s, i) => `<div class="linha"><span class="bola ${s.status === 'assinado' ? 'ok' : ''}">${s.status === 'assinado' ? '✓' : i + 1}</span>
              <div><b>${esc(s.nome)}</b>${s.papel === 'testemunha' ? ' <span class="sub">(testemunha)</span>' : s.papel === 'contratada' ? ` <span class="sub">(pela empresa${s.cargo ? ` · ${esc(s.cargo)}` : ''})</span>` : ''}
                <div class="sub" style="margin:0;font-size:13px">${esc([s.email, s.whatsapp && mascara.fone(s.whatsapp)].filter(Boolean).join(' · ')) || '—'}${s.assinado_em ? ` · assinou em ${dataHora(s.assinado_em)}` : ''}</div></div>
              <div class="acoes">${s.status !== 'assinado' && s.link && d.status === 'pendente' ? `<button class="btn claro peq" data-copiar="${esc(s.link)}">Copiar link</button><button class="btn claro peq" data-reenviar="${s.id}">Reenviar</button>` : ''}</div></div>`).join('')}
          </div>
          <div class="folha"><h2>Trilha de auditoria</h2><p class="sub">Tudo o que aconteceu com o documento, com data e hora.</p>
            <ol class="trilha">${d.eventos.map((e) => `<li><time>${dataHora(e.criado_em)}${e.ip ? ` · IP ${esc(e.ip)}` : ''}</time>${esc(EVENTOS[e.tipo] || e.tipo)}${e.nome ? ` — ${esc(e.nome)}` : ''}</li>`).join('')}</ol></div>
        </div>
        <div>
          <div class="folha centro"><p class="sub" style="margin:0">Código de verificação</p><p class="codigo-grande">${esc(d.codigo)}</p>
            <p><a class="link" href="${esc(d.verificacao)}" target="_blank" rel="noopener">Página pública de verificação ↗</a></p>
            <div style="display:grid;gap:8px;margin-top:14px">
              ${d.status === 'concluido' ? `<a class="btn sign" href="${B}/app/api/documentos/${d.id}/final.pdf?baixar=1">Baixar PDF assinado</a>` : ''}
              <a class="btn claro" href="${B}/app/api/documentos/${d.id}/original.pdf" target="_blank" rel="noopener">Ver PDF original</a>
              ${d.status === 'pendente' ? '<button class="btn perigo" id="cancelar">Cancelar documento</button>' : ''}
            </div></div>
          <div class="folha"><h3>Como funciona a assinatura</h3><p class="sub" style="margin:0">Cada pessoa lê o PDF, confirma o código enviado ao e-mail ou WhatsApp e tira uma selfie na hora. Quando todos assinam, o Holysign aplica o carimbo de tempo e gera o PDF final com o certificado e o QR code de verificação.</p></div>
        </div>
      </div>`)
    $$('[data-copiar]').forEach((b) => (b.onclick = () => copiar(b.dataset.copiar, 'Link de assinatura copiado.')))
    $$('[data-reenviar]').forEach((b) => (b.onclick = async () => {
      try { const r = await api(`/app/api/documentos/${d.id}/signatarios/${b.dataset.reenviar}/reenviar`, { method: 'POST' }); toast(`Reenviado por ${r.canais.join(' e ')}.`) } catch (er) { toast(er.message, true) }
    }))
    if ($('#cancelar')) $('#cancelar').onclick = async () => {
      if (!confirm('Cancelar este documento? Os links de assinatura deixam de funcionar.')) return
      try { await api(`/app/api/documentos/${d.id}/cancelar`, { method: 'POST' }); toast('Documento cancelado.'); telaDoc(d.id) } catch (er) { toast(er.message, true) }
    }
  }

  // ── configurações ─────────────────────────────────────────────
  const ABAS = [['empresa', 'Empresa'], ['empresa-assina', 'Assinatura da empresa'], ['envio', 'Envio de códigos'], ['integracao', 'API e webhook'], ['equipe', 'Equipe'], ['senha', 'Minha senha']]
  async function telaConfig(aba = 'empresa') {
    moldura('config', `<div class="cabeca"><div><h1>Configurações</h1><p class="sub">${esc(eu.conta.nome)}${ehDono() ? '' : ' · só o dono da conta altera estas opções'}</p></div></div>
      <div class="cfg"><div class="cfg-menu">${ABAS.map(([k, t]) => `<button data-a="${k}" class="${aba === k ? 'ativo' : ''}">${t}</button>`).join('')}</div><div id="cfgCorpo"></div></div>`)
    $$('.cfg-menu button').forEach((b) => (b.onclick = () => ir(`#/config/${b.dataset.a}`)))
    const corpo = $('#cfgCorpo')
    const dis = ehDono() ? '' : 'disabled'
    if (aba === 'empresa') {
      corpo.innerHTML = `<form class="folha" id="f"><h2>Empresa</h2><p class="sub">Aparece para quem assina: “<b>${esc(eu.conta.nome)}</b> enviou um documento para você assinar”.</p>
        <fieldset ${dis} style="border:0;padding:0;margin:0"><div class="grade g2"><label class="campo"><span>Nome da empresa</span><input class="inp" name="nome" value="${esc(eu.conta.nome)}" required></label>
        <label class="campo"><span>CNPJ</span><input class="inp" name="cnpj" data-mascara="cnpj" value="${esc(mascara.cnpj(eu.conta.cnpj || ''))}"></label></div>
        <p class="sub">Plano: <b>${eu.conta.plano === 'cortesia' ? 'Cortesia (sem limite)' : `Grátis — ${eu.uso.limite} documentos por mês`}</b>. Neste mês: ${eu.uso.usados} enviado(s).</p>
        <button class="btn sign">Salvar</button></fieldset><p class="msg" id="m"></p></form>`
      $('#f').onsubmit = async (e) => {
        e.preventDefault(); const f = new FormData(e.target)
        try { await api('/app/api/conta', { method: 'PUT', body: { nome: f.get('nome'), cnpj: f.get('cnpj'), webhook_url: eu.conta.webhook_url } }); await carregarEu(); toast('Dados salvos.'); telaConfig('empresa') } catch (er) { formMsg($('#m'), er.message) }
      }
    }
    if (aba === 'empresa-assina') {
      const reps = await api('/app/api/representantes')
      corpo.innerHTML = `<div class="folha"><h2>Assinatura da empresa</h2>
        <p class="sub">O responsável (ex.: sócio, diretor, contador) assina <b>uma única vez</b> um termo de autorização, com código e selfie. Depois disso, os documentos marcados com “Já enviar assinado pela empresa” saem com a assinatura dele — e quem recebe assina só a parte dele.</p>
        ${reps.length ? `<table class="tabela"><thead><tr><th>Responsável</th><th>Situação</th><th></th></tr></thead><tbody>${reps.map((r) => `<tr><td><b>${esc(r.nome)}</b><div class="sub" style="margin:0">${esc(r.cargo)}${r.registro ? ` · ${esc(r.registro)}` : ''}</div></td>
          <td>${r.revogado_em ? '<span class="selo cancelado">revogado</span>' : r.autorizado_em ? `<span class="selo assinado">autorizado</span><div class="dica">desde ${data(r.autorizado_em)}</div>` : `<span class="selo pendente">aguardando o termo</span>${r.link_termo ? `<div><button class="link" data-copiar="${esc(r.link_termo)}">copiar link do termo</button></div>` : ''}`}</td>
          <td style="text-align:right">${!r.revogado_em && ehDono() ? `<button class="btn perigo peq" data-revogar="${r.id}">Revogar</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="estado">Nenhum responsável cadastrado ainda.</p>'}
      </div>
      ${ehDono() ? `<form class="folha" id="f"><h3>Cadastrar responsável</h3><p class="sub">Ele recebe o link do termo por e-mail/WhatsApp (ou você copia o link aqui).</p>
        <div class="grade g2"><label class="campo"><span>Nome completo</span><input class="inp" name="nome" required></label><label class="campo"><span>CPF</span><input class="inp" name="cpf" data-mascara="cpf" inputmode="numeric" required></label>
        <label class="campo"><span>Cargo</span><input class="inp" name="cargo" placeholder="Ex.: Sócio administrador, Contador responsável"></label><label class="campo"><span>Registro profissional (opcional)</span><input class="inp" name="registro" placeholder="Ex.: CRC/SC 000000/O"></label>
        <label class="campo"><span>E-mail</span><input class="inp" name="email" type="email"></label><label class="campo"><span>WhatsApp</span><input class="inp" name="whatsapp" data-mascara="fone" inputmode="tel"></label></div>
        <button class="btn sign">Cadastrar e gerar o termo</button><p class="msg" id="m"></p><div id="linkTermo"></div></form>` : ''}`
      $$('[data-copiar]').forEach((b) => (b.onclick = () => copiar(b.dataset.copiar, 'Link do termo copiado.')))
      $$('[data-revogar]').forEach((b) => (b.onclick = async () => {
        if (!confirm('Revogar a assinatura automática deste responsável? Os documentos já assinados continuam válidos.')) return
        try { await api(`/app/api/representantes/${b.dataset.revogar}/revogar`, { method: 'POST' }); await carregarEu(); toast('Autorização revogada.'); telaConfig('empresa-assina') } catch (er) { toast(er.message, true) }
      }))
      if ($('#f')) $('#f').onsubmit = async (e) => {
        e.preventDefault(); const f = Object.fromEntries(new FormData(e.target))
        try {
          const r = await api('/app/api/representantes', { method: 'POST', body: { ...f, cpf: dig(f.cpf), whatsapp: dig(f.whatsapp) } })
          $('#linkTermo').innerHTML = `<p class="msg ok">Termo gerado${r.enviadoPor.length ? ` e enviado por ${r.enviadoPor.join(' e ')}` : ''}. Link para ele assinar:</p><div class="segredo">${esc(r.link)}</div><button type="button" class="btn claro peq" id="copTermo">Copiar link</button>`
          $('#copTermo').onclick = () => copiar(r.link, 'Link do termo copiado.')
          e.target.reset()
        } catch (er) { formMsg($('#m'), er.message) }
      }
    }
    if (aba === 'envio') {
      const c = await api('/app/api/canais')
      corpo.innerHTML = `<div class="folha"><h2>Envio de códigos e convites</h2>
        <p class="sub">Quem assina recebe o link e o código de confirmação por estes canais. Use o e-mail e o WhatsApp da sua empresa para a mensagem sair no seu nome.</p>
        <div class="estado ${c.email || c.whatsapp ? 'ok' : c.plataforma ? '' : 'aviso'}">${c.email || c.whatsapp ? `Canais próprios ativos: ${[c.email && 'e-mail', c.whatsapp && 'WhatsApp'].filter(Boolean).join(' e ')}.`
          : c.plataforma ? 'Usando o e-mail padrão do Holysign. Configure os seus abaixo para enviar no nome da empresa.' : 'Nenhum canal configurado: quem assina não recebe o código. Configure um e-mail ou WhatsApp abaixo.'}</div></div>
        <form class="folha" id="fe"><h3>E-mail (SMTP)</h3><fieldset ${dis} style="border:0;padding:0;margin:0">
          <div class="grade g2"><label class="campo"><span>Servidor (host)</span><input class="inp" name="host" value="${esc(c.email?.host || '')}" placeholder="smtp.seudominio.com.br"></label>
          <label class="campo"><span>Porta</span><input class="inp" name="port" value="${esc(c.email?.port || 465)}" inputmode="numeric"></label>
          <label class="campo"><span>Usuário</span><input class="inp" name="user" value="${esc(c.email?.user || '')}" autocomplete="off"></label>
          <label class="campo"><span>Senha ${c.email?.temSenha ? '(em branco = manter a atual)' : ''}</span><input class="inp" name="pass" type="password" autocomplete="new-password"></label></div>
          <label class="campo"><span>Remetente (como aparece)</span><input class="inp" name="from" value="${esc(c.email?.from || '')}" placeholder="Empresa X <contratos@empresax.com.br>"></label>
          <button class="btn sign">Salvar e-mail</button> ${c.email ? '<button type="button" class="btn perigo" id="tirarEmail">Remover</button>' : ''}</fieldset><p class="msg" id="me"></p></form>
        <form class="folha" id="fw"><h3>WhatsApp (WhatsProfissional)</h3><p class="sub">Token da conexão no WhatsProfissional. ${c.whatsapp?.temToken ? 'Já existe um token salvo.' : ''}</p><fieldset ${dis} style="border:0;padding:0;margin:0">
          <label class="campo"><span>Token ${c.whatsapp?.temToken ? '(em branco = manter)' : ''}</span><input class="inp" name="token" type="password" autocomplete="off"></label>
          <button class="btn sign">Salvar WhatsApp</button> ${c.whatsapp ? '<button type="button" class="btn perigo" id="tirarWhats">Remover</button>' : ''}</fieldset><p class="msg" id="mw"></p></form>`
      const salvar = async (body, msgEl) => { try { await api('/app/api/canais', { method: 'PUT', body }); await carregarEu(); toast('Canais atualizados.'); telaConfig('envio') } catch (er) { formMsg(msgEl, er.message) } }
      $('#fe').onsubmit = (e) => { e.preventDefault(); salvar({ email: Object.fromEntries(new FormData(e.target)) }, $('#me')) }
      $('#fw').onsubmit = (e) => { e.preventDefault(); const t = new FormData(e.target).get('token'); if (!t) return formMsg($('#mw'), 'Informe o token.'); salvar({ whatsapp: { token: t } }, $('#mw')) }
      if ($('#tirarEmail')) $('#tirarEmail').onclick = () => confirm('Remover o e-mail próprio?') && salvar({ email: null }, $('#me'))
      if ($('#tirarWhats')) $('#tirarWhats').onclick = () => confirm('Remover o WhatsApp?') && salvar({ whatsapp: null }, $('#mw'))
    }
    if (aba === 'integracao') {
      corpo.innerHTML = `<div class="folha"><h2>API</h2><p class="sub">Para o seu sistema enviar documentos e consultar o andamento. A chave aparece <b>uma única vez</b>, na hora de gerar — gerar outra desativa a anterior.</p>
          ${ehDono() ? '<button class="btn" id="gerarKey">Gerar chave de API</button><div id="key"></div>' : ''}
          <h3 style="margin-top:18px">Enviar documento</h3>
          <div class="codigo">POST ${esc(location.origin + B)}/api/v1/documentos
Authorization: Bearer SUA_CHAVE
{
  "titulo": "Contrato de prestação de serviços",
  "pdf_base64": "JVBERi0xLjcK...",
  "signatarios": [{ "nome": "Maria Souza", "email": "maria@email.com", "whatsapp": "48999999999", "cpf": "00000000000" }],
  "assinatura_representante": true,      // opcional: já sai assinado pela empresa
  "enviar_convite": true,                // opcional: envia o link por e-mail/WhatsApp
  "external_id": "contrato-123",         // opcional: seu identificador
  "callback_url": "https://..."          // opcional: webhook só deste documento
}</div>
          <p class="sub" style="margin-top:10px">Também: <span class="mono">GET /api/v1/documentos/:id</span> · <span class="mono">GET /api/v1/documentos/:id/final.pdf</span> · <span class="mono">POST /api/v1/documentos/:id/cancelar</span></p></div>
        <form class="folha" id="fw"><h2>Webhook</h2><p class="sub">Avisamos o seu sistema quando alguém assina (<span class="mono">signatario.assinou</span>) e quando o documento é concluído (<span class="mono">documento.concluido</span>). Cada aviso leva o cabeçalho <span class="mono">X-Holysign-Assinatura</span> = HMAC-SHA256 do corpo com o segredo abaixo.</p>
          <fieldset ${dis} style="border:0;padding:0;margin:0"><label class="campo"><span>URL do webhook (https)</span><input class="inp" name="url" value="${esc(eu.conta.webhook_url || '')}" placeholder="https://seusistema.com.br/webhooks/holysign"></label>
          <button class="btn sign">Salvar webhook</button> <button type="button" class="btn claro" id="gerarSeg">Gerar novo segredo</button></fieldset><div id="seg"></div><p class="msg" id="m"></p></form>`
      if ($('#gerarKey')) $('#gerarKey').onclick = async () => {
        if (!confirm('Gerar uma nova chave? A chave anterior para de funcionar na hora.')) return
        const r = await api('/app/api/conta/api-key', { method: 'POST' })
        $('#key').innerHTML = `<p class="msg ok">Copie e guarde agora — ela não aparece de novo.</p><div class="segredo">${esc(r.api_key)}</div><button class="btn claro peq" id="copKey">Copiar</button>`
        $('#copKey').onclick = () => copiar(r.api_key, 'Chave copiada.')
      }
      $('#gerarSeg').onclick = async () => {
        if (!confirm('Gerar um novo segredo do webhook? O anterior deixa de valer.')) return
        const r = await api('/app/api/conta/webhook-secret', { method: 'POST' })
        $('#seg').innerHTML = `<p class="msg ok">Segredo do webhook (aparece só agora):</p><div class="segredo">${esc(r.webhook_secret)}</div>`
      }
      $('#fw').onsubmit = async (e) => {
        e.preventDefault()
        try { await api('/app/api/conta', { method: 'PUT', body: { nome: eu.conta.nome, cnpj: eu.conta.cnpj, webhook_url: new FormData(e.target).get('url') } }); await carregarEu(); formMsg($('#m'), 'Webhook salvo.', true) } catch (er) { formMsg($('#m'), er.message) }
      }
    }
    if (aba === 'equipe') {
      const eq = await api('/app/api/equipe')
      corpo.innerHTML = `<div class="folha"><h2>Equipe</h2><p class="sub">Pessoas da empresa que podem enviar e acompanhar documentos.</p>
        <table class="tabela"><thead><tr><th>Nome</th><th>Acesso</th><th></th></tr></thead><tbody>${eq.map((u) => `<tr><td><b>${esc(u.nome)}</b><div class="sub" style="margin:0">${esc(u.email)}</div></td>
          <td>${u.papel === 'dono' ? 'Dono' : 'Membro'}${!u.ativo ? ' · <span class="selo cancelado">removido</span>' : !u.ativou ? ' · <span class="selo pendente">convite pendente</span>' : ''}</td>
          <td style="text-align:right">${ehDono() && u.papel !== 'dono' && u.ativo ? `<button class="btn perigo peq" data-tirar="${u.id}">Remover</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
        ${ehDono() ? `<form class="folha" id="f"><h3>Convidar pessoa</h3><div class="grade g2"><label class="campo"><span>Nome</span><input class="inp" name="nome" required></label><label class="campo"><span>E-mail</span><input class="inp" name="email" type="email" required></label></div>
          <button class="btn sign">Gerar convite</button><p class="msg" id="m"></p><div id="conv"></div></form>` : ''}`
      $$('[data-tirar]').forEach((b) => (b.onclick = async () => { if (!confirm('Remover o acesso desta pessoa?')) return; try { await api(`/app/api/equipe/${b.dataset.tirar}`, { method: 'DELETE' }); telaConfig('equipe') } catch (er) { toast(er.message, true) } }))
      if ($('#f')) $('#f').onsubmit = async (e) => {
        e.preventDefault()
        try {
          const r = await api('/app/api/equipe', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) })
          $('#conv').innerHTML = `<p class="msg ok">${r.enviado ? 'Convite enviado por e-mail. ' : ''}Link do convite (vale 3 dias):</p><div class="segredo">${esc(r.link)}</div><button type="button" class="btn claro peq" id="copConv">Copiar</button>`
          $('#copConv').onclick = () => copiar(r.link, 'Convite copiado.')
          e.target.reset()
        } catch (er) { formMsg($('#m'), er.message) }
      }
    }
    if (aba === 'senha') {
      corpo.innerHTML = `<form class="folha" id="f" style="max-width:460px"><h2>Minha senha</h2><p class="sub">${esc(eu.usuario.email)}</p>
        <label class="campo"><span>Senha atual</span><input class="inp" name="atual" type="password" autocomplete="current-password" required></label>
        <label class="campo"><span>Nova senha (mínimo 8)</span><input class="inp" name="nova" type="password" autocomplete="new-password" minlength="8" required></label>
        <button class="btn sign">Trocar senha</button><p class="msg" id="m"></p></form>`
      $('#f').onsubmit = async (e) => { e.preventDefault(); try { await api('/app/api/senha', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); formMsg($('#m'), 'Senha trocada.', true); e.target.reset() } catch (er) { formMsg($('#m'), er.message) } }
    }
  }

  // ── roteador ──────────────────────────────────────────────────
  async function rota() {
    const h = location.hash.replace(/^#/, '') || '/'
    const p = h.split('/').filter(Boolean)
    if (p[0] === 'convite' || p[0] === 'redefinir') return telaConvite(p[1], p[0] === 'redefinir')
    if (!eu) { try { await carregarEu() } catch { eu = null } }
    const publicas = { '': telaCapa, entrar: telaEntrar, criar: telaCriar, esqueci: telaEsqueci }
    if (!eu) return (publicas[p[0] || ''] || telaEntrar)()
    if (!p[0] || p[0] in publicas) return ir('#/docs')
    if (p[0] === 'docs') return telaDocs()
    if (p[0] === 'novo') return telaNovo()
    if (p[0] === 'doc') return telaDoc(p[1])
    if (p[0] === 'config') return telaConfig(p[1])
    ir('#/docs')
  }
  window.addEventListener('hashchange', rota)
  rota()
})()
