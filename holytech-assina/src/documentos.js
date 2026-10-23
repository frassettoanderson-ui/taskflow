// Criação e consulta de documentos — usado pela API (sistemas) e pelo painel (pessoas).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.js'
import { pool, evento } from './db.js'
import { sha256, tokenAleatorio, codigoVerificacao } from './cripto.js'
import { enviarConvite } from './canais.js'

export const linkDe = (token) => `${config.urlPublica}/s/${token}`
export class ErroUso extends Error { constructor(msg, status = 400) { super(msg); this.status = status } }

export async function docComSignatarios(id, contaId) {
  const d = (await pool.query(`SELECT * FROM documentos WHERE id = $1 AND conta_id = $2`, [id, contaId])).rows[0]
  if (!d) return null
  const s = (await pool.query(`SELECT id, nome, cpf, email, whatsapp, papel, status, token, assinado_em, otp_canal, cargo, registro FROM signatarios WHERE documento_id = $1 ORDER BY ordem, nome`, [id])).rows
  return { d, s }
}
export const respostaDoc = ({ d, s }) => ({
  id: d.id, titulo: d.titulo, external_id: d.external_id, status: d.status, codigo: d.codigo, tipo: d.tipo,
  verificacao: `${config.urlPublica}/v/${d.codigo}`, hash_original: d.hash_original, hash_final: d.hash_final,
  criado_em: d.criado_em, concluido_em: d.concluido_em,
  signatarios: s.map(x => ({ id: x.id, nome: x.nome, email: x.email, whatsapp: x.whatsapp, papel: x.papel, status: x.status, assinado_em: x.assinado_em, cargo: x.cargo, link: x.papel === 'contratada' ? null : linkDe(x.token) })),
})

// Limite do plano gratuito (documentos por mês); limite_mensal NULL = sem limite
export async function usoDoMes(conta) {
  const n = (await pool.query(`SELECT count(*)::int n FROM documentos WHERE conta_id = $1 AND tipo = 'documento' AND criado_em >= date_trunc('month', now())`, [conta.id])).rows[0].n
  return { usados: n, limite: conta.limite_mensal ?? null }
}

// b = { titulo, pdf (Buffer) | pdf_base64, signatarios:[{nome,cpf,email,whatsapp,papel}], external_id?, callback_url?, enviar_convite?, assinatura_representante? }
export async function criarDocumento(conta, b, ctx = {}) {
  const pdf = b.pdf ?? Buffer.from(String(b.pdf_base64 || ''), 'base64')
  if (!String(b.titulo || '').trim()) throw new ErroUso('titulo obrigatório')
  if (pdf.length < 100 || pdf.subarray(0, 5).toString() !== '%PDF-') throw new ErroUso('o arquivo precisa ser um PDF válido')
  const sigs = Array.isArray(b.signatarios) ? b.signatarios.filter(s => String(s?.nome || '').trim()) : []
  if (!sigs.length || sigs.some(s => !s.email && !s.whatsapp)) throw new ErroUso('cada signatário precisa de nome e e-mail ou WhatsApp')
  const uso = await usoDoMes(conta)
  if (uso.limite != null && uso.usados >= uso.limite) throw new ErroUso(`limite do plano atingido (${uso.limite} documentos por mês)`, 402)
  // Representante com autorização prévia (ex.: contador responsável)
  let rep = null
  if (b.assinatura_representante) {
    const q = typeof b.assinatura_representante === 'string'
      ? await pool.query(`SELECT * FROM representantes WHERE id = $1 AND conta_id = $2`, [b.assinatura_representante, conta.id])
      : await pool.query(`SELECT * FROM representantes WHERE conta_id = $1 AND autorizado_em IS NOT NULL AND revogado_em IS NULL ORDER BY autorizado_em DESC LIMIT 1`, [conta.id])
    rep = q.rows[0]
    if (!rep || !rep.autorizado_em || rep.revogado_em) throw new ErroUso('representante sem autorização de assinatura vigente (assine o Termo de autorização primeiro)')
  }
  const hash = sha256(pdf)
  const arq = `${crypto.randomUUID()}.pdf`
  fs.writeFileSync(path.join(config.dados, 'originais', arq), pdf)
  const d = (await pool.query(
    `INSERT INTO documentos (conta_id, titulo, external_id, callback_url, codigo, hash_original, arquivo_original, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [conta.id, String(b.titulo).trim(), b.external_id ?? null, b.callback_url || null, codigoVerificacao(), hash, arq, ctx.usuarioId ?? null]
  )).rows[0]
  let ordem = 1
  if (rep) {
    const termo = (await pool.query(
      `SELECT d.codigo, s.otp_validado_em, s.selfie_hash, s.assinado_em FROM documentos d JOIN signatarios s ON s.documento_id = d.id WHERE d.id = $1 LIMIT 1`, [rep.termo_documento_id]
    )).rows[0]
    await pool.query(
      `INSERT INTO signatarios (documento_id, ordem, nome, cpf, email, whatsapp, papel, token, status, assinado_em, otp_canal, otp_destino, otp_validado_em, selfie_hash, ip, user_agent, representante_id, cargo, registro)
       VALUES ($1,$2,$3,$4,$5,$6,'contratada',$7,'assinado',now(),'autorizacao',$8,$9,$10,$11,$12,$13,$14,$15)`,
      [d.id, ordem++, rep.nome, rep.cpf, rep.email, rep.whatsapp, tokenAleatorio(), `Termo de autorização ${termo?.codigo ?? '—'}`, termo?.otp_validado_em ?? null,
        termo?.selfie_hash ?? null, ctx.ip ?? null, ctx.origem ?? 'Holysign (assinatura autorizada da conta)', rep.id, rep.cargo, rep.registro]
    )
    await evento(d.id, null, 'assinatura_representante', { representante: rep.nome, cargo: rep.cargo, registro: rep.registro, termo: termo?.codigo, termo_assinado_em: termo?.assinado_em }, ctx.req)
  }
  for (const s of sigs) {
    await pool.query(
      `INSERT INTO signatarios (documento_id, ordem, nome, cpf, email, whatsapp, papel, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [d.id, ordem++, String(s.nome).trim(), s.cpf || null, s.email ? String(s.email).trim().toLowerCase() : null, s.whatsapp || null, s.papel === 'testemunha' ? 'testemunha' : 'parte', tokenAleatorio()]
    )
  }
  await evento(d.id, null, 'documento_criado', { titulo: d.titulo, hash_original: hash, signatarios: sigs.length, conta: conta.nome, por: ctx.usuarioNome ?? 'API' }, ctx.req)
  const out = await docComSignatarios(d.id, conta.id)
  if (b.enviar_convite) {
    for (const s of out.s.filter(x => x.status === 'pendente')) {
      const feitos = await enviarConvite(conta, s, d.titulo, linkDe(s.token)).catch(() => [])
      await evento(d.id, s.id, 'convite_enviado', { canais: feitos })
    }
  }
  return out
}

export async function cancelarDocumento(conta, id, ctx = {}) {
  const d = (await pool.query(`UPDATE documentos SET status = 'cancelado' WHERE id = $1 AND conta_id = $2 AND status = 'pendente' RETURNING id`, [id, conta.id])).rows[0]
  if (!d) throw new ErroUso('não encontrado ou já concluído', 404)
  await evento(d.id, null, 'documento_cancelado', { por: ctx.usuarioNome ?? 'API' }, ctx.req)
  return { ok: true }
}

export async function reenviarConvite(conta, docId, sigId) {
  const x = await docComSignatarios(docId, conta.id)
  if (!x || x.d.status !== 'pendente') throw new ErroUso('documento não está aguardando assinaturas')
  const s = x.s.find(y => y.id === sigId && y.status === 'pendente')
  if (!s) throw new ErroUso('signatário não encontrado ou já assinou')
  const feitos = await enviarConvite(conta, s, x.d.titulo, linkDe(s.token))
  await evento(x.d.id, s.id, 'convite_enviado', { canais: feitos, reenvio: true })
  if (!feitos.length) throw new ErroUso('nenhum canal de envio configurado — copie o link e mande por conta própria')
  return { canais: feitos }
}
