// Representante da conta com assinatura automática (ex.: contador responsável da Atuan).
// 1) criar: cadastra o representante, gera o Termo de autorização em PDF e um documento para ele
//    assinar UMA vez pelo fluxo normal (código + selfie). Ao concluir, a autorização fica vigente.
// 2) Depois disso, a API aceita `assinatura_representante: true` e o documento já sai assinado por ele.
// Uso (na VPS):
//   node scripts/representante.mjs criar "<conta>" '{"nome":"...","cpf":"...","cargo":"Contador responsável","registro":"CRC/SC ...","email":"...","whatsapp":"..."}'
//   node scripts/representante.mjs listar "<conta>"
//   node scripts/representante.mjs revogar <representante_id>
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { config } from '../src/config.js'
import { pool, migrar, evento } from '../src/db.js'
import { sha256, tokenAleatorio, codigoVerificacao } from '../src/cripto.js'

const [acao, a1, a2] = process.argv.slice(2)
await migrar()

async function contaPor(nomeOuId) {
  const r = await pool.query(`SELECT * FROM contas WHERE id::text = $1 OR lower(nome) = lower($1)`, [nomeOuId])
  if (!r.rows[0]) throw new Error(`conta não encontrada: ${nomeOuId}`)
  return r.rows[0]
}

const cpfFmt = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v }

async function termoPdf(conta, rep) {
  const pdf = await PDFDocument.create()
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28, H = 841.89, M = 60, tinta = rgb(0.055, 0.055, 0.063)
  let pag = pdf.addPage([W, H]), y = H - M
  pag.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: rgb(0.992, 0.733, 0.004) })
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
  par(`1. Autorizo a aplicação da minha assinatura eletrônica, em nome da CONTRATADA, nos contratos e documentos enviados para assinatura no HolyTech Assina pela integração autenticada da conta "${conta.nome}" (sistema da CONTRATADA, por meio de chave de acesso exclusiva), quando o envio solicitar expressamente a assinatura do representante.`)
  par('2. Reconheço que cada assinatura aplicada com base neste Termo tem para mim o mesmo valor da assinatura feita individualmente, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e do art. 107 do Código Civil, ficando registrada na trilha de auditoria de cada documento, com data e hora, e na sua página de verificação pública.')
  par('3. Esta autorização é confirmada por mim neste ato com código de verificação enviado ao meu contato e selfie tirada ao vivo, cujas evidências passam a acompanhar cada documento assinado com base neste Termo.')
  par('4. Esta autorização vale por prazo indeterminado e pode ser revogada a qualquer tempo, mediante comunicação por escrito à HolyTech Solutions. A revogação não afeta os documentos assinados antes dela.')
  par('5. É responsabilidade da CONTRATADA manter sob sigilo a chave de acesso da integração e enviar para assinatura apenas documentos cujo conteúdo eu tenha aprovado ou que sigam modelo por mim aprovado.')
  par(`Emitido em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Assinatura eletrônica a seguir, no certificado anexo.`, { depois: 0 })
  return Buffer.from(await pdf.save())
}

if (acao === 'criar') {
  const conta = await contaPor(a1)
  const r = JSON.parse(a2 || '{}')
  if (!r.nome || !r.cpf || (!r.email && !r.whatsapp)) throw new Error('informe nome, cpf e e-mail ou whatsapp')
  const rep = (await pool.query(
    `INSERT INTO representantes (conta_id, nome, cpf, cargo, registro, email, whatsapp) VALUES ($1,$2,$3,COALESCE($4,'Contador responsável'),$5,$6,$7) RETURNING *`,
    [conta.id, r.nome.trim(), r.cpf, r.cargo || null, r.registro || null, r.email || null, r.whatsapp || null]
  )).rows[0]
  const pdf = await termoPdf(conta, rep)
  const arq = `${crypto.randomUUID()}.pdf`
  fs.writeFileSync(path.join(config.dados, 'originais', arq), pdf)
  const d = (await pool.query(
    `INSERT INTO documentos (conta_id, titulo, codigo, hash_original, arquivo_original, tipo, representante_id) VALUES ($1,$2,$3,$4,$5,'autorizacao',$6) RETURNING *`,
    [conta.id, `Termo de autorização de assinatura eletrônica - ${rep.nome}`, codigoVerificacao(), sha256(pdf), arq, rep.id]
  )).rows[0]
  const token = tokenAleatorio()
  await pool.query(
    `INSERT INTO signatarios (documento_id, ordem, nome, cpf, email, whatsapp, papel, token, representante_id, cargo, registro) VALUES ($1,1,$2,$3,$4,$5,'parte',$6,$7,$8,$9)`,
    [d.id, rep.nome, rep.cpf, rep.email, rep.whatsapp, token, rep.id, rep.cargo, rep.registro]
  )
  await evento(d.id, null, 'documento_criado', { tipo: 'autorizacao', representante_id: rep.id, origem: 'script' })
  console.log(`Representante ${rep.nome} (${rep.id}) cadastrado.\nTermo ${d.codigo} — link para ele assinar:\n${config.urlPublica}/s/${token}`)
} else if (acao === 'listar') {
  const conta = await contaPor(a1)
  const r = await pool.query(`SELECT id, nome, cargo, registro, autorizado_em, revogado_em FROM representantes WHERE conta_id = $1 ORDER BY criado_em`, [conta.id])
  for (const x of r.rows) console.log(`${x.id}  ${x.nome}  ${x.cargo}${x.registro ? ' ' + x.registro : ''}  ${x.revogado_em ? 'REVOGADO ' + x.revogado_em.toISOString() : x.autorizado_em ? 'AUTORIZADO ' + x.autorizado_em.toISOString() : 'aguardando assinatura do termo'}`)
} else if (acao === 'revogar') {
  const r = await pool.query(`UPDATE representantes SET revogado_em = now() WHERE id = $1 AND revogado_em IS NULL RETURNING nome, termo_documento_id`, [a1])
  if (!r.rows[0]) throw new Error('representante não encontrado ou já revogado')
  if (r.rows[0].termo_documento_id) await evento(r.rows[0].termo_documento_id, null, 'autorizacao_revogada', { representante_id: a1 })
  console.log(`Autorização de ${r.rows[0].nome} revogada.`)
} else {
  console.log('Uso: criar "<conta>" \'{json}\' | listar "<conta>" | revogar <id>')
}
await pool.end()
