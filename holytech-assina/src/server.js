// Holysign (by HolyTech) — assinatura eletrônica com código + selfie + carimbo de tempo HolyTech.
// Tudo sob o prefixo /holysign (nginx do holytechsolution.com.br encaminha p/ cá); /assinar redireciona.
import express from 'express'
import QRCode from 'qrcode'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.js'
import { pool, migrar, evento, ipDe } from './db.js'
import { sha256, tokenAleatorio, codigoVerificacao, cifrar, garantirChaves, chavePublicaPem, carimbar, verificarAssinatura } from './cripto.js'
import { canaisDisponiveis, enviarCodigo, enviarConvite, enviarFinal } from './canais.js'
import { gerarFinal } from './certificado.js'
import { notificar } from './webhook.js'
import { criarDocumento, docComSignatarios, respostaDoc, cancelarDocumento, linkDe } from './documentos.js'
import { painel } from './painel.js'
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

// POST /api/v1/documentos  { titulo, pdf_base64, signatarios:[{nome,cpf,email,whatsapp,papel}], external_id?, callback_url?, enviar_convite?,
//                            assinatura_representante?: true | '<representante_id>' }  → já sai assinado pelo representante autorizado da conta
api.post('/documentos', async (req, res) => {
  try {
    const out = await criarDocumento(req.conta, req.body || {}, { ip: ipDe(req), req, origem: 'Holysign API (assinatura autorizada da conta)' })
    res.status(201).json(respostaDoc(out))
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message })
    console.error(e); res.status(500).json({ erro: 'falha ao criar documento' })
  }
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
  try { res.json(await cancelarDocumento(req.conta, req.params.id, { req })) } catch (e) { res.status(e.status || 500).json({ erro: e.message }) }
})
r.use('/api/v1', api)
r.use(painel)

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

// QR code do próprio link — para continuar no celular (selfie) quando abriu no computador
r.get('/s/:token/qr.svg', async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x) return res.status(404).end()
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(await QRCode.toString(linkDe(req.params.token), { type: 'svg', margin: 1, color: { dark: '#0E0E10', light: '#FFFFFF' } }))
})
// Estado do signatário (a página do computador acompanha o que foi feito no celular)
r.get('/s/:token/estado', async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x) return res.status(404).json({})
  res.set('Cache-Control', 'no-store').json({ otpValidado: !!x.s.otp_validado_em, selfie: !!x.s.selfie_hash, assinado: x.s.status === 'assinado', documento: x.d.status })
})

// Via final assinada (tela "Baixar contrato" do signatário que já assinou)
r.get('/s/:token/final.pdf', async (req, res) => {
  const x = await carregarSig(req.params.token)
  if (!x || x.s.status !== 'assinado') return res.status(404).send('Documento não encontrado')
  if (x.d.status !== 'concluido' || !x.d.arquivo_final) return res.status(409).send('O documento final ainda está sendo gerado. Tente em instantes.')
  const nome = `${x.d.titulo.replace(/[^ws.-]+/g, ' ').trim().slice(0, 80) || 'documento'} - assinado.pdf`
  res.set('Content-Disposition', `attachment; filename="${nome}"`)
  res.type('application/pdf').send(fs.readFileSync(path.join(config.dados, 'finais', x.d.arquivo_final)))
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
    // Via final por e-mail para quem assinou com código (a contratada já tem pela conta)
    for (const s of sigs.filter(x => x.papel !== 'contratada' && x.email)) {
      enviarFinal(c, s, d0.titulo, finalPdf, `${config.urlPublica}/v/${d0.codigo}`)
        .then(ok => ok && evento(documentoId, s.id, 'via_final_enviada', { canal: 'email' }))
        .catch(e => console.error('[via final]', e.message))
    }
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

// Painel (entrar, criar conta, documentos, configurações) — app de uma página
const appHtml = () => fs.readFileSync(path.join(config.raiz, 'public', 'app.html'), 'utf8').replaceAll('{{BASE}}', B)
r.get('/', (_req, res) => res.type('html').send(appHtml()))
app.use(B, r)
// Links antigos (/assinar/...) continuam funcionando
app.use(config.baseAntiga, (req, res) => res.redirect(301, B + req.url))
app.get('/', (_req, res) => res.redirect(B))

await migrar()
garantirChaves()
app.listen(config.porta, '127.0.0.1', () => console.log(`Holysign em :${config.porta}${B} (${config.urlPublica})`))
