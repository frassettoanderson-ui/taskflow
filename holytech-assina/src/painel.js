// Painel Holysign (pessoas): criar conta, entrar, documentos, configurações, equipe.
// Páginas = um app de uma página (public/app.html + app.js); aqui ficam as rotas JSON.
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.js'
import { pool, ipDe } from './db.js'
import { sha256 } from './cripto.js'
import { hashSenha, conferirSenha, senhaFraca, abrirSessao, fecharSessao, exigirSessao, podeTentar, registrarFalha, gerarConvite, usuarioPorConvite } from './auth.js'
import { criarDocumento, docComSignatarios, respostaDoc, cancelarDocumento, reenviarConvite, usoDoMes } from './documentos.js'
import { criarRepresentante, listarRepresentantes, revogarRepresentante } from './representantes.js'
import { canaisDe, guardarSegredo, emailDoSistema } from './canais.js'

export const painel = express.Router()
const json = express.json({ limit: '30mb' })
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''))
const responder = (fn) => async (req, res) => {
  try { await fn(req, res) } catch (e) {
    if (!e.status) console.error('[painel]', e)
    res.status(e.status || 500).json({ erro: e.status ? e.message : 'Não foi possível concluir agora. Tente de novo.' })
  }
}
const erroUso = (msg, status = 400) => Object.assign(new Error(msg), { status })
const novaApiKey = () => 'hs_' + crypto.randomBytes(24).toString('base64url')
const novoSegredo = () => crypto.randomBytes(24).toString('hex')

// ── Conta e acesso (sem sessão) ─────────────────────────────────────────────
painel.post('/conta/criar', json, responder(async (req, res) => {
  const b = req.body || {}
  const email = String(b.email || '').trim().toLowerCase()
  if (!String(b.empresa || '').trim() || !String(b.nome || '').trim()) throw erroUso('Preencha o nome da empresa e o seu nome.')
  if (!emailOk(email)) throw erroUso('E-mail inválido.')
  if (senhaFraca(b.senha)) throw erroUso('A senha precisa ter pelo menos 8 caracteres.')
  if (!b.aceite) throw erroUso('É preciso aceitar os termos de uso.')
  if ((await pool.query(`SELECT 1 FROM usuarios WHERE email = $1`, [email])).rowCount) throw erroUso('Já existe uma conta com este e-mail. Use “Entrar”.')
  const cnpj = String(b.cnpj || '').replace(/\D/g, '') || null
  const conta = (await pool.query(
    `INSERT INTO contas (nome, cnpj, api_key_hash, webhook_secret, plano, limite_mensal) VALUES ($1,$2,$3,$4,'gratis',$5) RETURNING *`,
    [String(b.empresa).trim(), cnpj, sha256(novaApiKey()), novoSegredo(), config.limiteGratis]
  )).rows[0]
  const u = (await pool.query(`INSERT INTO usuarios (conta_id, nome, email, senha_hash, papel) VALUES ($1,$2,$3,$4,'dono') RETURNING *`,
    [conta.id, String(b.nome).trim(), email, hashSenha(b.senha)])).rows[0]
  await abrirSessao(req, res, u)
  res.status(201).json({ ok: true })
}))

painel.post('/conta/entrar', json, responder(async (req, res) => {
  if (!podeTentar(req)) throw erroUso('Muitas tentativas. Espere alguns minutos e tente de novo.', 429)
  const email = String(req.body?.email || '').trim().toLowerCase()
  const u = (await pool.query(`SELECT u.* FROM usuarios u JOIN contas c ON c.id = u.conta_id WHERE u.email = $1 AND u.ativo AND c.ativo`, [email])).rows[0]
  if (!u || !u.senha_hash || !conferirSenha(req.body?.senha, u.senha_hash)) { registrarFalha(req); throw erroUso('E-mail ou senha incorretos.', 401) }
  await abrirSessao(req, res, u)
  res.json({ ok: true })
}))
painel.post('/conta/sair', responder(async (req, res) => { await fecharSessao(req, res); res.json({ ok: true }) }))

painel.post('/conta/esqueci', json, responder(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const u = (await pool.query(`SELECT * FROM usuarios WHERE email = $1 AND ativo`, [email])).rows[0]
  if (u && config.plataformaEmail.host) {
    const token = await gerarConvite(u.id, 2)
    const link = `${config.urlPublica}/#/redefinir/${token}`
    await emailDoSistema(email, 'Redefinir sua senha do Holysign', `Para criar uma nova senha, abra: ${link}`,
      `<p>Recebemos um pedido para redefinir sua senha.</p><p><a href="${link}" style="display:inline-block;background:#0e0e10;color:#fff;padding:12px 26px;border-radius:6px;text-decoration:none;font-weight:bold">Criar nova senha</a></p><p style="font-size:12px;color:#777">O link vale por 2 horas. Se não foi você, ignore este e-mail.</p>`).catch((e) => console.error('[esqueci]', e.message))
  }
  // Sempre a mesma resposta (não revela se o e-mail existe)
  res.json({ ok: true, emailAtivo: !!config.plataformaEmail.host })
}))

painel.get('/conta/convite/:token', responder(async (req, res) => {
  const u = await usuarioPorConvite(req.params.token)
  if (!u) throw erroUso('Este link expirou ou já foi usado.', 404)
  const c = (await pool.query(`SELECT nome FROM contas WHERE id = $1`, [u.conta_id])).rows[0]
  res.json({ nome: u.nome, email: u.email, empresa: c?.nome, novo: !u.senha_hash })
}))
painel.post('/conta/convite/:token', json, responder(async (req, res) => {
  const u = await usuarioPorConvite(req.params.token)
  if (!u) throw erroUso('Este link expirou ou já foi usado.', 404)
  if (senhaFraca(req.body?.senha)) throw erroUso('A senha precisa ter pelo menos 8 caracteres.')
  const nome = String(req.body?.nome || '').trim() || u.nome
  await pool.query(`UPDATE usuarios SET senha_hash = $2, nome = $3, convite_hash = NULL, convite_expira = NULL WHERE id = $1`, [u.id, hashSenha(req.body.senha), nome])
  await pool.query(`DELETE FROM sessoes WHERE usuario_id = $1`, [u.id])
  await abrirSessao(req, res, u)
  res.json({ ok: true })
}))

// ── Área logada ─────────────────────────────────────────────────────────────
const app = express.Router()
app.use(exigirSessao)
const dono = (req) => { if (req.usuario.papel !== 'dono') throw erroUso('Só o dono da conta pode fazer isso.', 403) }
const ctx = (req) => ({ usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, ip: ipDe(req), req, origem: `Holysign — enviado por ${req.usuario.nome}` })

app.get('/eu', responder(async (req, res) => {
  const c = req.conta
  const can = canaisDe(c)
  const rep = (await pool.query(`SELECT id, nome, cargo FROM representantes WHERE conta_id = $1 AND autorizado_em IS NOT NULL AND revogado_em IS NULL ORDER BY autorizado_em DESC`, [c.id])).rows
  res.json({
    usuario: { id: req.usuario.id, nome: req.usuario.nome, email: req.usuario.email, papel: req.usuario.papel },
    conta: { id: c.id, nome: c.nome, cnpj: c.cnpj, plano: c.plano, webhook_url: c.webhook_url },
    uso: await usoDoMes(c),
    canais: { email: !!can.email, emailDaPlataforma: can.emailDaPlataforma, whatsapp: !!can.whatsapp },
    representantes: rep,
  })
}))

// Documentos
app.get('/documentos', responder(async (req, res) => {
  const { status = '', q = '' } = req.query
  const params = [req.conta.id]; let where = `d.conta_id = $1`
  if (status === 'pendente' || status === 'concluido' || status === 'cancelado') { params.push(status); where += ` AND d.status = $${params.length}` }
  if (status === 'termos') where += ` AND d.tipo = 'autorizacao'`; else where += ` AND d.tipo = 'documento'`
  if (String(q).trim()) { params.push(`%${String(q).trim().toLowerCase()}%`); where += ` AND (lower(d.titulo) LIKE $${params.length} OR d.codigo ILIKE $${params.length} OR EXISTS (SELECT 1 FROM signatarios s WHERE s.documento_id = d.id AND (lower(s.nome) LIKE $${params.length} OR lower(coalesce(s.email,'')) LIKE $${params.length})))` }
  const docs = (await pool.query(
    `SELECT d.id, d.titulo, d.status, d.codigo, d.criado_em, d.concluido_em,
            (SELECT count(*)::int FROM signatarios s WHERE s.documento_id = d.id) AS total,
            (SELECT count(*)::int FROM signatarios s WHERE s.documento_id = d.id AND s.status = 'assinado') AS assinados,
            (SELECT string_agg(s.nome, ', ' ORDER BY s.ordem) FROM signatarios s WHERE s.documento_id = d.id) AS nomes
       FROM documentos d WHERE ${where} ORDER BY d.criado_em DESC LIMIT 300`, params
  )).rows
  const cont = (await pool.query(`SELECT status, count(*)::int n FROM documentos WHERE conta_id = $1 AND tipo = 'documento' GROUP BY status`, [req.conta.id])).rows
  res.json({ documentos: docs, contagem: Object.fromEntries(cont.map((x) => [x.status, x.n])) })
}))
app.post('/documentos', json, responder(async (req, res) => {
  const b = req.body || {}
  const out = await criarDocumento(req.conta, {
    titulo: b.titulo, pdf_base64: b.pdf_base64, signatarios: b.signatarios, enviar_convite: b.enviar_convite !== false,
    assinatura_representante: b.representante_id || undefined, external_id: b.external_id || null,
  }, ctx(req))
  res.status(201).json(respostaDoc(out))
}))
app.get('/documentos/:id', responder(async (req, res) => {
  const x = await docComSignatarios(req.params.id, req.conta.id).catch(() => null)
  if (!x) throw erroUso('Documento não encontrado.', 404)
  const ev = (await pool.query(
    `SELECT e.tipo, e.dados, e.ip, e.criado_em, s.nome FROM eventos e LEFT JOIN signatarios s ON s.id = e.signatario_id WHERE e.documento_id = $1 ORDER BY e.id`, [x.d.id]
  )).rows
  res.json({ ...respostaDoc(x), eventos: ev })
}))
app.post('/documentos/:id/cancelar', responder(async (req, res) => res.json(await cancelarDocumento(req.conta, req.params.id, ctx(req)))))
app.post('/documentos/:id/signatarios/:sid/reenviar', responder(async (req, res) => res.json(await reenviarConvite(req.conta, req.params.id, req.params.sid))))
app.get('/documentos/:id/:qual(original|final).pdf', responder(async (req, res) => {
  const d = (await pool.query(`SELECT * FROM documentos WHERE id = $1 AND conta_id = $2`, [req.params.id, req.conta.id]).catch(() => ({ rows: [] }))).rows[0]
  const arq = req.params.qual === 'final' ? d?.arquivo_final && path.join(config.dados, 'finais', d.arquivo_final) : d && path.join(config.dados, 'originais', d.arquivo_original)
  if (!arq || !fs.existsSync(arq)) throw erroUso('Arquivo indisponível.', 404)
  const nome = `${String(d.titulo).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w -]+/g, '').trim().slice(0, 80) || 'documento'}${req.params.qual === 'final' ? ' - assinado' : ''}.pdf`
  res.setHeader('Content-Disposition', `${req.query.baixar ? 'attachment' : 'inline'}; filename="${nome}"`)
  res.type('application/pdf').send(fs.readFileSync(arq))
}))

// Configurações da conta
app.put('/conta', json, responder(async (req, res) => {
  dono(req)
  const b = req.body || {}
  const url = String(b.webhook_url || '').trim()
  if (url && !/^https:\/\//.test(url)) throw erroUso('O webhook precisa ser um endereço https://')
  await pool.query(`UPDATE contas SET nome = COALESCE(NULLIF($2,''), nome), cnpj = $3, webhook_url = $4 WHERE id = $1`,
    [req.conta.id, String(b.nome || '').trim(), String(b.cnpj || '').replace(/\D/g, '') || null, url || null])
  res.json({ ok: true })
}))
// Chave de API e segredo do webhook: mostrados UMA vez, na hora de gerar
app.post('/conta/api-key', responder(async (req, res) => {
  dono(req)
  const k = novaApiKey()
  await pool.query(`UPDATE contas SET api_key_hash = $2 WHERE id = $1`, [req.conta.id, sha256(k)])
  res.json({ api_key: k })
}))
app.post('/conta/webhook-secret', responder(async (req, res) => {
  dono(req)
  const s = novoSegredo()
  await pool.query(`UPDATE contas SET webhook_secret = $2 WHERE id = $1`, [req.conta.id, s])
  res.json({ webhook_secret: s })
}))
// Canais de envio próprios (segredos guardados cifrados; nunca voltam para a tela)
app.get('/canais', responder(async (req, res) => {
  const c = req.conta.canais || {}
  res.json({
    email: c.email?.host ? { host: c.email.host, port: c.email.port, user: c.email.user, from: c.email.from, temSenha: !!(c.email.pass_cifrado || c.email.pass) } : null,
    whatsapp: c.whatsapp ? { provider: c.whatsapp.provider || 'whatsprofissional', temToken: !!(c.whatsapp.token_cifrado || c.whatsapp.token) } : null,
    plataforma: !!config.plataformaEmail.host,
  })
}))
app.put('/canais', json, responder(async (req, res) => {
  dono(req)
  const b = req.body || {}; const atual = req.conta.canais || {}
  const canais = { ...atual }
  if (b.email === null) delete canais.email
  else if (b.email) {
    if (!b.email.host || !b.email.user) throw erroUso('Informe servidor (host) e usuário do e-mail.')
    canais.email = { host: String(b.email.host).trim(), port: Number(b.email.port) || 465, user: String(b.email.user).trim(), from: String(b.email.from || '').trim(),
      pass_cifrado: b.email.pass ? guardarSegredo(b.email.pass) : atual.email?.pass_cifrado ?? (atual.email?.pass ? guardarSegredo(atual.email.pass) : undefined) }
  }
  if (b.whatsapp === null) delete canais.whatsapp
  else if (b.whatsapp?.token) canais.whatsapp = { provider: 'whatsprofissional', token_cifrado: guardarSegredo(b.whatsapp.token) }
  await pool.query(`UPDATE contas SET canais = $2 WHERE id = $1`, [req.conta.id, JSON.stringify(canais)])
  res.json({ ok: true })
}))

// Representante (assinatura automática pela empresa)
app.get('/representantes', responder(async (req, res) => res.json(await listarRepresentantes(req.conta.id))))
app.post('/representantes', json, responder(async (req, res) => { dono(req); res.status(201).json(await criarRepresentante(req.conta, req.body || {})) }))
app.post('/representantes/:id/revogar', responder(async (req, res) => { dono(req); res.json(await revogarRepresentante(req.conta.id, req.params.id)) }))

// Equipe
app.get('/equipe', responder(async (req, res) => {
  res.json((await pool.query(`SELECT id, nome, email, papel, ativo, ultimo_acesso, senha_hash IS NOT NULL AS ativou FROM usuarios WHERE conta_id = $1 ORDER BY criado_em`, [req.conta.id])).rows)
}))
app.post('/equipe', json, responder(async (req, res) => {
  dono(req)
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!String(req.body?.nome || '').trim() || !emailOk(email)) throw erroUso('Informe nome e e-mail válidos.')
  if ((await pool.query(`SELECT 1 FROM usuarios WHERE email = $1`, [email])).rowCount) throw erroUso('Este e-mail já tem acesso ao Holysign.')
  const u = (await pool.query(`INSERT INTO usuarios (conta_id, nome, email, papel) VALUES ($1,$2,$3,'membro') RETURNING *`, [req.conta.id, String(req.body.nome).trim(), email])).rows[0]
  const token = await gerarConvite(u.id, 72)
  const link = `${config.urlPublica}/#/convite/${token}`
  let enviado = false
  if (config.plataformaEmail.host) {
    await emailDoSistema(email, `${req.usuario.nome} convidou você para o Holysign`, `Crie sua senha: ${link}`,
      `<p><b>${req.usuario.nome}</b> convidou você para assinar e enviar documentos da <b>${req.conta.nome}</b> no Holysign.</p><p><a href="${link}" style="display:inline-block;background:#0e0e10;color:#fff;padding:12px 26px;border-radius:6px;text-decoration:none;font-weight:bold">Criar minha senha</a></p><p style="font-size:12px;color:#777">O convite vale por 3 dias.</p>`)
      .then(() => { enviado = true }).catch((e) => console.error('[convite equipe]', e.message))
  }
  res.status(201).json({ link, enviado })
}))
app.delete('/equipe/:id', responder(async (req, res) => {
  dono(req)
  if (req.params.id === req.usuario.id) throw erroUso('Você não pode remover a si mesmo.')
  const r = await pool.query(`UPDATE usuarios SET ativo = false WHERE id = $1 AND conta_id = $2 AND papel <> 'dono'`, [req.params.id, req.conta.id])
  if (!r.rowCount) throw erroUso('Usuário não encontrado.', 404)
  await pool.query(`DELETE FROM sessoes WHERE usuario_id = $1`, [req.params.id])
  res.json({ ok: true })
}))
app.post('/senha', json, responder(async (req, res) => {
  if (!conferirSenha(req.body?.atual, req.usuario.senha_hash)) throw erroUso('Senha atual incorreta.')
  if (senhaFraca(req.body?.nova)) throw erroUso('A nova senha precisa ter pelo menos 8 caracteres.')
  await pool.query(`UPDATE usuarios SET senha_hash = $2 WHERE id = $1`, [req.usuario.id, hashSenha(req.body.nova)])
  res.json({ ok: true })
}))

painel.use('/app/api', app)
