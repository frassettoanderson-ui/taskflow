// HolyTech Assina — assinatura eletrônica com código + selfie + carimbo de tempo HolyTech.
// Tudo sob o prefixo /assinar (nginx do holytechsolution.com.br encaminha p/ cá).
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.js'
import { pool, migrar, evento, ipDe } from './db.js'
import { sha256, tokenAleatorio, codigoVerificacao, cifrar, garantirChaves, chavePublicaPem, carimbar, verificarAssinatura } from './cripto.js'
import { canaisDisponiveis, enviarCodigo, enviarConvite } from './canais.js'
import { gerarFinal } from './certificado.js'
import { notificar } from './webhook.js'
import { paginaAssinar, paginaVerificar, paginaMensagem } from './views.js'

const app = express()
app.set('trust proxy', true)
app.disable('x-powered-by')
const B = config.base
const r = express.Router()

r.use('/static', express.static(path.join(config.raiz, 'public'), { maxAge: '1h' }))
r.get('/chave-publica.pem', (_req, res) => res.type('text/plain').send(chavePublicaPem()))
r.get('/saude', (_req, res) => res.json({ ok: true }))

// ── API (sistemas clientes da HolyTech) ─────────────────────────────────────
async function autenticar(req, res, next) {
  const k = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!k) return res.status(401).json({ erro: 'API key ausente' })
  const c = (await pool.query(`SELECT * FROM contas WHERE api_key_hash = $1 AND ativo`, [sha256(k)])).rows[0]
  if (!c) return res.status(401).json({ erro: 'API key inválida' })
  req.conta = c; next()
}
const api = express.Router()
api.use(express.json({ limit: '25mb' }))
api.use(autenticar)

const linkDe = (token) => `${config.urlPublica}/s/${token}`

async function docComSignatarios(id, contaId) {
  const d = (await pool.query(`SELECT * FROM documentos WHERE id = $1 AND conta_id = $2`, [id, contaId])).rows[0]
  if (!d) return null
  const s = (await pool.query(`SELECT id, nome, cpf, email, whatsapp, papel, status, token, assinado_em, otp_canal FROM signatarios WHERE documento_id = $1 ORDER BY ordem, nome`, [id])).rows
  return { d, s }
}
const respostaDoc = ({ d, s }) => ({
  id: d.id, titulo: d.titulo, external_id: d.external_id, status: d.status, codigo: d.codigo,
  verificacao: `${config.urlPublica}/v/${d.codigo}`, hash_original: d.hash_original, hash_final: d.hash_final,
  criado_em: d.criado_em, concluido_em: d.concluido_em,
  signatarios: s.map(x => ({ id: x.id, nome: x.nome, papel: x.papel, status: x.status, assinado_em: x.assinado_em, link: x.papel === 'contratada' ? null : linkDe(x.token) })),
})

// POST /api/v1/documentos  { titulo, pdf_base64, signatarios:[{nome,cpf,email,whatsapp,papel}], external_id?, callback_url?, enviar_convite?,
//                            assinatura_representante?: true | '<representante_id>' }  → já sai assinado pelo representante autorizado da conta
api.post('/documentos', async (req, res) => {
  try {
    const b = req.body || {}
    const pdf = Buffer.from(String(b.pdf_base64 || ''), 'base64')
    if (!String(b.titulo || '').trim()) return res.status(400).json({ erro: 'titulo obrigatório' })
    if (pdf.length < 100 || pdf.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ erro: 'pdf_base64 inválido' })
    const sigs = Array.isArray(b.signatarios) ? b.signatarios : []
    if (!sigs.length || sigs.some(s => !String(s.nome || '').trim() || (!s.email && !s.whatsapp))) return res.status(400).json({ erro: 'cada signatário precisa de nome e e-mail ou WhatsApp' })
    // Representante com autorização prévia (ex.: contador responsável): valida antes de gravar
    let rep = null
    if (b.assinatura_representante) {
      const q = typeof b.assinatura_representante === 'string'
        ? await pool.query(`SELECT * FROM representantes WHERE id = $1 AND conta_id = $2`, [b.assinatura_representante, req.conta.id])
        : await pool.query(`SELECT * FROM representantes WHERE conta_id = $1 AND autorizado_em IS NOT NULL AND revogado_em IS NULL ORDER BY autorizado_em DESC LIMIT 1`, [req.conta.id])
      rep = q.rows[0]
      if (!rep || !rep.autorizado_em || rep.revogado_em) return res.status(400).json({ erro: 'representante sem autorização de assinatura vigente (assine o Termo de autorização primeiro)' })
    }
    const hash = sha256(pdf)
    const arq = `${crypto.randomUUID()}.pdf`
    fs.writeFileSync(path.join(config.dados, 'originais', arq), pdf)
    const d = (await pool.query(
      `INSERT INTO documentos (conta_id, titulo, external_id, callback_url, codigo, hash_original, arquivo_original) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.conta.id, String(b.titulo).trim(), b.external_id ?? null, b.callback_url ?? null, codigoVerificacao(), hash, arq]
    )).rows[0]
    let ordem = 1
    if (rep) {
      // Assinatura aplicada agora, com base no Termo de autorização (evidências do termo: código + selfie)
      const termo = (await pool.query(
        `SELECT d.codigo, s.otp_validado_em, s.selfie_hash, s.assinado_em FROM documentos d JOIN signatarios s ON s.documento_id = d.id WHERE d.id = $1 LIMIT 1`, [rep.termo_documento_id]
      )).rows[0]
      await pool.query(
        `INSERT INTO signatarios (documento_id, ordem, nome, cpf, email, whatsapp, papel, token, status, assinado_em, otp_canal, otp_destino, otp_validado_em, selfie_hash, ip, user_agent, representante_id, cargo, registro)
         VALUES ($1,$2,$3,$4,$5,$6,'contratada',$7,'assinado',now(),'autorizacao',$8,$9,$10,$11,$12,$13,$14,$15)`,
        [d.id, ordem++, rep.nome, rep.cpf, rep.email, rep.whatsapp, tokenAleatorio(), `Termo de autorização ${termo?.codigo ?? '—'}`, termo?.otp_validado_em ?? null,
         termo?.selfie_hash ?? null, ipDe(req), 'HolyTech Assina API (assinatura autorizada da conta)', rep.id, rep.cargo, rep.registro]
      )
      await evento(d.id, null, 'assinatura_representante', { representante: rep.nome, cargo: rep.cargo, registro: rep.registro, termo: termo?.codigo, termo_assinado_em: termo?.assinado_em }, req)
    }
    for (const s of sigs) {
      await pool.query(
        `INSERT INTO signatarios (documento_id, ordem, nome, cpf, email, whatsapp, papel, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [d.id, ordem++, String(s.nome).trim(), s.cpf ?? null, s.email ? String(s.email).trim() : null, s.whatsapp ?? null, s.papel === 'testemunha' ? 'testemunha' : 'parte', tokenAleatorio()]
      )
    }
    await evento(d.id, null, 'documento_criado', { titulo: d.titulo, hash_original: hash, signatarios: sigs.length, conta: req.conta.nome }, req)
    const out = await docComSignatarios(d.id, req.conta.id)
    if (b.enviar_convite) {
      for (const s of out.s) {
        const feitos = await enviarConvite(req.conta, s, d.titulo, linkDe(s.token))
        await evento(d.id, s.id, 'convite_enviado', { canais: feitos })
      }
    }
    res.status(201).json(respostaDoc(out))
  } catch (e) { console.error(e); res.status(500).json({ erro: 'falha ao criar documento' }) }
})

api.get('/documentos/:id', async (req, res) => {
  const out = await docComSignatarios(req.params.id, req.conta.id).catch(() => null)
  if (!out) return res.status(404).json({ erro: 'não encontrado' })
  res.json(respostaDoc(out))
})
api.get('/documentos/:id/final.pdf', async (req, res) => {
  const d = (await pool.query(`SELECT * FROM documentos WHERE id = $1 AND conta_id = $2`, [req.params.id, req.conta.id]).catch(() => ({ rows: [] }))).rows[0]
  if (!d?.arquivo_final) return res.status(404).json({ erro: 'documento ainda não concluído' })
  res.type('application/pdf').send(fs.readFileSync(path.join(config.dados, 'finais', d.arquivo_final)))
})
api.post('/documentos/:id/cancelar', async (req, res) => {
  const d = (await pool.query(`UPDATE documentos SET status = 'cancelado' WHERE id = $1 AND conta_id = $2 AND status = 'pendente' RETURNING id`, [req.params.id, req.conta.id])).rows[0]
  if (!d) return res.status(404).json({ erro: 'não encontrado ou já concluído' })
  await evento(d.id, null, 'documento_cancelado', {}, req)
  res.json({ ok: true })
})
r.use('/api/v1', api)

// ── Fluxo do signatário (link com token) ────────────────────────────────────
async function carregarSig(token) {
  const s = (await pool.query(`SELECT * FROM signatarios WHERE token = $1`, [token])).rows[0]
  if (!s) return null
  const d = (await pool.query(`SELECT * FROM documentos WHERE id = $1`, [s.documento_id])).rows[0]
  const c = (await pool.query(`SELECT * FROM contas WHERE id = $1`, [d.conta_id])).rows[0]
  return { s, d, c }
}
const sigJson = express.json({ limit: '6mb' })
const erro = (res, st, msg) => res.status(st).json({ erro: msg })

r.get('/s/:token', async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x) return res.status(404).send(paginaMensagem('Link inválido', 'Este link de assinatura não existe ou foi digitado errado.'))
  if (x.d.status === 'cancelado') return res.send(paginaMensagem('Documento cancelado', 'Quem enviou este documento cancelou a assinatura.'))
  await evento(x.d.id, x.s.id, 'pagina_aberta', {}, req)
  res.send(paginaAssinar({ token: req.params.token, doc: x.d, sig: x.s, conta: x.c, canais: canaisDisponiveis(x.c, x.s) }))
})

r.get('/s/:token/documento.pdf', async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x) return res.status(404).end()
  await evento(x.d.id, x.s.id, 'documento_visualizado', {}, req)
  res.type('application/pdf').send(fs.readFileSync(path.join(config.dados, 'originais', x.d.arquivo_original)))
})

r.post('/s/:token/codigo', sigJson, async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x || x.d.status !== 'pendente' || x.s.status !== 'pendente') return erro(res, 400, 'Assinatura não disponível')
  const canal = String(req.body?.canal || '')
  const op = canaisDisponiveis(x.c, x.s).find(c => c.id === canal)
  if (!op) return erro(res, 400, 'Canal indisponível')
  if (x.s.otp_enviado_em && Date.now() - new Date(x.s.otp_enviado_em).getTime() < 60_000) return erro(res, 429, 'Aguarde 1 minuto para pedir outro código')
  const ultHora = (await pool.query(`SELECT count(*)::int n FROM eventos WHERE signatario_id = $1 AND tipo = 'codigo_enviado' AND criado_em > now() - interval '1 hour'`, [x.s.id])).rows[0].n
  if (ultHora >= 6) return erro(res, 429, 'Muitos códigos pedidos. Tente de novo mais tarde.')
  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  try { await enviarCodigo(x.c, x.s, canal, codigo) } catch (e) { console.error('[codigo]', e.message); return erro(res, 502, 'Não foi possível enviar o código por este canal') }
  await pool.query(`UPDATE signatarios SET otp_hash = $2, otp_expira = now() + interval '10 minutes', otp_tentativas = 0, otp_enviado_em = now(), otp_canal = $3, otp_destino = $4 WHERE id = $1`,
    [x.s.id, sha256(`${x.s.id}:${codigo}`), canal, op.destino])
  await evento(x.d.id, x.s.id, 'codigo_enviado', { canal, destino: op.destino }, req)
  res.json({ ok: true, destino: op.destino })
})

r.post('/s/:token/validar', sigJson, async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x || x.d.status !== 'pendente' || x.s.status !== 'pendente') return erro(res, 400, 'Assinatura não disponível')
  if (!x.s.otp_hash || new Date(x.s.otp_expira) < new Date()) return erro(res, 400, 'Código expirado. Peça um novo.')
  if (x.s.otp_tentativas >= 5) return erro(res, 429, 'Muitas tentativas. Peça um novo código.')
  const ok = sha256(`${x.s.id}:${String(req.body?.codigo || '').replace(/\D/g, '')}`) === x.s.otp_hash
  await pool.query(ok ? `UPDATE signatarios SET otp_validado_em = now(), otp_hash = NULL WHERE id = $1` : `UPDATE signatarios SET otp_tentativas = otp_tentativas + 1 WHERE id = $1`, [x.s.id])
  await evento(x.d.id, x.s.id, ok ? 'codigo_validado' : 'codigo_incorreto', { canal: x.s.otp_canal }, req)
  if (!ok) return erro(res, 400, 'Código incorreto')
  res.json({ ok: true })
})

r.post('/s/:token/selfie', sigJson, async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x || x.d.status !== 'pendente' || x.s.status !== 'pendente') return erro(res, 400, 'Assinatura não disponível')
  if (!x.s.otp_validado_em) return erro(res, 400, 'Confirme o código antes da selfie')
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(String(req.body?.imagem || ''))
  if (!m) return erro(res, 400, 'Imagem inválida')
  const jpg = Buffer.from(m[1], 'base64')
  if (jpg.length < 5_000 || jpg.length > 4_000_000) return erro(res, 400, 'Imagem inválida')
  const arq = `${x.s.id}-${Date.now()}.bin`
  fs.writeFileSync(path.join(config.dados, 'selfies', arq), cifrar(jpg), { mode: 0o600 })
  const hash = sha256(jpg)
  await pool.query(`UPDATE signatarios SET selfie_arquivo = $2, selfie_hash = $3, selfie_em = now() WHERE id = $1`, [x.s.id, arq, hash])
  await evento(x.d.id, x.s.id, 'selfie_capturada', { selfie_sha256: hash, bytes: jpg.length, origem: req.body?.origem === 'camera' ? 'camera' : 'desconhecida' }, req)
  res.json({ ok: true })
})

r.post('/s/:token/assinar', sigJson, async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x || x.d.status !== 'pendente' || x.s.status !== 'pendente') return erro(res, 400, 'Assinatura não disponível')
  if (!x.s.otp_validado_em || !x.s.selfie_hash) return erro(res, 400, 'Conclua o código e a selfie antes de assinar')
  if (req.body?.aceite !== true) return erro(res, 400, 'É preciso concordar com o documento')
  await pool.query(`UPDATE signatarios SET status = 'assinado', assinado_em = now(), ip = $2, user_agent = $3 WHERE id = $1`,
    [x.s.id, ipDe(req), String(req.headers['user-agent'] || '').slice(0, 400)])
  await evento(x.d.id, x.s.id, 'assinou', { aceite: true, hash_original: x.d.hash_original }, req)
  notificar(x.c, x.d.callback_url, 'signatario.assinou', { documento_id: x.d.id, external_id: x.d.external_id, signatario_id: x.s.id, nome: x.s.nome }).catch(() => {})
  const pend = (await pool.query(`SELECT count(*)::int n FROM signatarios WHERE documento_id = $1 AND status <> 'assinado'`, [x.d.id])).rows[0].n
  if (pend === 0) concluir(x.d.id).catch(e => console.error('[concluir]', e))
  res.json({ ok: true, verificacao: `${config.urlPublica}/v/${x.d.codigo}` })
})

// Todos assinaram: carimba as evidências, gera o PDF final com certificado e carimba o PDF final.
async function concluir(documentoId) {
  const trava = await pool.query(`UPDATE documentos SET status = 'concluindo' WHERE id = $1 AND status = 'pendente' RETURNING *`, [documentoId])
  const d0 = trava.rows[0]
  if (!d0) return
  try {
    const c = (await pool.query(`SELECT * FROM contas WHERE id = $1`, [d0.conta_id])).rows[0]
    const sigs = (await pool.query(`SELECT * FROM signatarios WHERE documento_id = $1 ORDER BY ordem, nome`, [documentoId])).rows
    const evidencias = sigs.map(s => ({ nome: s.nome, cpf: s.cpf, papel: s.papel, assinado_em: s.assinado_em, otp_canal: s.otp_canal, otp_destino: s.otp_destino, otp_validado_em: s.otp_validado_em, selfie_sha256: s.selfie_hash, ip: s.ip, user_agent: s.user_agent }))
    const hashEvid = sha256(JSON.stringify({ hash_original: d0.hash_original, evidencias }))
    const carimboEvid = await carimbar(hashEvid, { documento: d0.codigo, hash_original: d0.hash_original })
    const concluidoEm = new Date(carimboEvid.hora)
    const original = fs.readFileSync(path.join(config.dados, 'originais', d0.arquivo_original))
    const finalPdf = await gerarFinal({ originalBytes: original, documento: { ...d0, concluido_em: concluidoEm }, conta: c, signatarios: sigs, carimbo: carimboEvid })
    const hashFinal = sha256(finalPdf)
    const carimboFinal = await carimbar(hashFinal, { documento: d0.codigo, tipo: 'pdf_final' })
    const arq = `${d0.id}.pdf`
    fs.writeFileSync(path.join(config.dados, 'finais', arq), finalPdf)
    await pool.query(
      `UPDATE documentos SET status = 'concluido', concluido_em = $2, arquivo_final = $3, hash_final = $4, carimbo = $5 WHERE id = $1`,
      [documentoId, concluidoEm, arq, hashFinal, JSON.stringify({ evidencias: carimboEvid, final: carimboFinal, hash_evidencias: hashEvid })]
    )
    await evento(documentoId, null, 'documento_concluido', { hash_final: hashFinal, carimbo_hora: carimboEvid.hora, fonte: carimboEvid.fonte })
    // Termo de autorização concluído → representante passa a ter assinatura automática vigente
    if (d0.tipo === 'autorizacao' && d0.representante_id) {
      await pool.query(`UPDATE representantes SET autorizado_em = $2, termo_documento_id = $3, revogado_em = NULL WHERE id = $1`, [d0.representante_id, concluidoEm, d0.id])
      await evento(documentoId, null, 'representante_autorizado', { representante_id: d0.representante_id })
    }
    notificar(c, d0.callback_url, 'documento.concluido', { documento_id: d0.id, external_id: d0.external_id, codigo: d0.codigo, hash_final: hashFinal }).catch(() => {})
  } catch (e) {
    await pool.query(`UPDATE documentos SET status = 'pendente' WHERE id = $1 AND status = 'concluindo'`, [documentoId])
    throw e
  }
}

// ── Verificação pública ─────────────────────────────────────────────────────
async function dadosVerificacao(codigo) {
  const d = (await pool.query(`SELECT d.*, c.nome AS conta_nome FROM documentos d JOIN contas c ON c.id = d.conta_id WHERE d.codigo = $1`, [String(codigo).toUpperCase()])).rows[0]
  if (!d) return null
  const s = (await pool.query(`SELECT nome, cpf, papel, status, assinado_em, otp_canal, otp_destino, selfie_hash, cargo, registro FROM signatarios WHERE documento_id = $1 ORDER BY ordem, nome`, [d.id])).rows
  const cb = d.carimbo || {}
  return {
    titulo: d.titulo, solicitante: d.conta_nome, status: d.status, codigo: d.codigo, criado_em: d.criado_em, concluido_em: d.concluido_em,
    hash_original: d.hash_original, hash_final: d.hash_final,
    carimbo: cb.evidencias ? { hora: cb.evidencias.hora, fonte: cb.evidencias.fonte, chave: cb.evidencias.chave,
      valido: verificarAssinatura(cb.evidencias.assinado, cb.evidencias.assinatura) && (!cb.final || verificarAssinatura(cb.final.assinado, cb.final.assinatura)) } : null,
    signatarios: s.map(x => ({ nome: x.nome, cpf: x.cpf ? `***.${String(x.cpf).replace(/\D/g, '').slice(3, 6)}.***-**` : null, papel: x.papel, status: x.status, assinado_em: x.assinado_em, canal: x.otp_canal, selfie: !!x.selfie_hash, cargo: x.cargo, registro: x.registro, base: x.otp_canal === 'autorizacao' ? x.otp_destino : null })),
  }
}
r.get('/v', (_req, res) => res.send(paginaVerificar(null)))
r.get('/v/:codigo', async (req, res) => {
  const v = await dadosVerificacao(req.params.codigo)
  if (!v) return res.status(404).send(paginaVerificar(null, 'Código não encontrado.'))
  res.send(paginaVerificar(v))
})
r.get('/v/:codigo/info.json', async (req, res) => {
  const v = await dadosVerificacao(req.params.codigo)
  if (!v) return res.status(404).json({ erro: 'não encontrado' })
  res.json(v)
})

r.get('/', (_req, res) => res.send(paginaVerificar(null)))
app.use(B, r)
app.get('/', (_req, res) => res.redirect(B))

await migrar()
garantirChaves()
app.listen(config.porta, '127.0.0.1', () => console.log(`HolyTech Assina em :${config.porta}${B} (${config.urlPublica})`))
