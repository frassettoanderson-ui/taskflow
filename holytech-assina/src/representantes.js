// Representante da conta com assinatura automática (ex.: contador responsável). Assina UMA vez o
// Termo de autorização (código + selfie); a partir daí os documentos pedidos com "assinar pela empresa"
// já nascem com a assinatura dele, referenciando o termo. Usado pelo painel e por scripts/representante.mjs.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { config } from './config.js'
import { pool, evento } from './db.js'
import { sha256, tokenAleatorio, codigoVerificacao } from './cripto.js'
import { enviarConvite } from './canais.js'

const cpfFmt = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v }

async function termoPdf(conta, rep) {
  const pdf = await PDFDocument.create()
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28, H = 841.89, M = 60, tinta = rgb(0.055, 0.055, 0.063)
  let pag = pdf.addPage([W, H]), y = H - M
  pag.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: rgb(0.055, 0.486, 0.482) })
  const par = (t, { f = fonte, s = 10.5, dy = 15, depois = 8 } = {}) => {
    let linha = ''
    const sai = (l) => { if (y < M) { pag = pdf.addPage([W, H]); y = H - M } pag.drawText(l, { x: M, y, size: s, font: f, color: tinta }); y -= dy }
    for (const p of t.split(' ')) {
      const tent = linha ? linha + ' ' + p : p
      if (f.widthOfTextAtSize(tent, s) > W - 2 * M) { sai(linha); linha = p } else linha = tent
    }
    if (linha) sai(linha)
    y -= depois
  }
  par('TERMO DE AUTORIZAÇÃO DE ASSINATURA ELETRÔNICA', { f: negrito, s: 14, depois: 14 })
  par(`Eu, ${rep.nome}, inscrito(a) no CPF sob o nº ${cpfFmt(rep.cpf)}${rep.registro ? `, registro profissional ${rep.registro}` : ''}, na qualidade de ${rep.cargo} de ${conta.nome} ("CONTRATADA"), declaro e autorizo o seguinte:`)
  par(`1. Autorizo a aplicação da minha assinatura eletrônica, em nome da CONTRATADA, nos contratos e documentos enviados para assinatura no Holysign (HolyTech Solutions) pela conta "${conta.nome}" — pelo painel, por usuário autenticado da conta, ou pela integração com chave de acesso exclusiva —, quando o envio solicitar expressamente a assinatura da empresa.`)
  par('2. Reconheço que cada assinatura aplicada com base neste Termo tem para mim o mesmo valor da assinatura feita individualmente, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e do art. 107 do Código Civil, ficando registrada na trilha de auditoria de cada documento, com data e hora, e na sua página de verificação pública.')
  par('3. Esta autorização é confirmada por mim neste ato com código de verificação enviado ao meu contato e selfie tirada ao vivo, cujas evidências passam a acompanhar cada documento assinado com base neste Termo.')
  par('4. Esta autorização vale por prazo indeterminado e pode ser revogada a qualquer tempo, pelo painel da conta ou por comunicação escrita à HolyTech Solutions. A revogação não afeta os documentos assinados antes dela.')
  par('5. É responsabilidade da CONTRATADA manter sob sigilo os acessos da conta e a chave da integração, e enviar para assinatura apenas documentos cujo conteúdo eu tenha aprovado ou que sigam modelo por mim aprovado.')
  par(`Emitido em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Assinatura eletrônica a seguir, no certificado anexo.`, { depois: 0 })
  return Buffer.from(await pdf.save())
}

export async function criarRepresentante(conta, r, { enviar = true } = {}) {
  if (!String(r.nome || '').trim() || String(r.cpf || '').replace(/\D/g, '').length !== 11 || (!r.email && !r.whatsapp)) {
    throw Object.assign(new Error('informe nome, CPF (11 dígitos) e e-mail ou WhatsApp'), { status: 400 })
  }
  const rep = (await pool.query(
    `INSERT INTO representantes (conta_id, nome, cpf, cargo, registro, email, whatsapp) VALUES ($1,$2,$3,COALESCE(NULLIF($4,''),'Responsável legal'),$5,$6,$7) RETURNING *`,
    [conta.id, r.nome.trim(), r.cpf, r.cargo || '', r.registro || null, r.email || null, r.whatsapp || null]
  )).rows[0]
  const pdf = await termoPdf(conta, rep)
  const arq = `${crypto.randomUUID()}.pdf`
  fs.writeFileSync(path.join(config.dados, 'originais', arq), pdf)
  const d = (await pool.query(
    `INSERT INTO documentos (conta_id, titulo, codigo, hash_original, arquivo_original, tipo, representante_id) VALUES ($1,$2,$3,$4,$5,'autorizacao',$6) RETURNING *`,
    [conta.id, `Termo de autorização de assinatura eletrônica - ${rep.nome}`, codigoVerificacao(), sha256(pdf), arq, rep.id]
  )).rows[0]
  const token = tokenAleatorio()
  const s = (await pool.query(
    `INSERT INTO signatarios (documento_id, ordem, nome, cpf, email, whatsapp, papel, token, representante_id, cargo, registro) VALUES ($1,1,$2,$3,$4,$5,'parte',$6,$7,$8,$9) RETURNING *`,
    [d.id, rep.nome, rep.cpf, rep.email, rep.whatsapp, token, rep.id, rep.cargo, rep.registro]
  )).rows[0]
  await evento(d.id, null, 'documento_criado', { tipo: 'autorizacao', representante_id: rep.id })
  const link = `${config.urlPublica}/s/${token}`
  let enviadoPor = []
  if (enviar) { enviadoPor = await enviarConvite(conta, s, d.titulo, link).catch(() => []); await evento(d.id, s.id, 'convite_enviado', { canais: enviadoPor }) }
  return { representante: rep, termo: { id: d.id, codigo: d.codigo }, link, enviadoPor }
}

export async function listarRepresentantes(contaId) {
  return (await pool.query(
    `SELECT r.id, r.nome, r.cpf, r.cargo, r.registro, r.email, r.whatsapp, r.autorizado_em, r.revogado_em, r.criado_em,
            d.codigo AS termo_codigo, d.status AS termo_status, s.token AS termo_token
       FROM representantes r
       LEFT JOIN documentos d ON d.representante_id = r.id AND d.tipo = 'autorizacao'
       LEFT JOIN signatarios s ON s.documento_id = d.id
      WHERE r.conta_id = $1 ORDER BY r.criado_em DESC`, [contaId]
  )).rows.map(({ termo_token, ...x }) => ({ ...x, link_termo: !x.autorizado_em && termo_token && x.termo_status === 'pendente' ? `${config.urlPublica}/s/${termo_token}` : null }))
}

export async function revogarRepresentante(contaId, id) {
  const r = (await pool.query(`UPDATE representantes SET revogado_em = now() WHERE id = $1 AND conta_id = $2 AND revogado_em IS NULL RETURNING nome, termo_documento_id`, [id, contaId])).rows[0]
  if (!r) throw Object.assign(new Error('representante não encontrado ou já revogado'), { status: 404 })
  if (r.termo_documento_id) await evento(r.termo_documento_id, null, 'autorizacao_revogada', { representante_id: id })
  await pool.query(`UPDATE documentos SET status = 'cancelado' WHERE representante_id = $1 AND tipo = 'autorizacao' AND status = 'pendente'`, [id])
  return { nome: r.nome }
}
