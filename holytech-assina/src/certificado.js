// PDF final = documento original + páginas do Certificado de Assinatura (Holysign).
// A selfie NÃO vai no PDF (dado biométrico): só o hash dela, para provar a correspondência.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { config } from './config.js'

const fmt = (d) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }) + ' (Brasília)' : '—'
const cpfFmt = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (v || '—') }
// Fonte padrão do PDF não tem todos os glifos: troca o que não for Latin-1
const limpo = (s) => String(s ?? '').replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')

export async function gerarFinal({ originalBytes, documento, conta, signatarios, carimbo }) {
  const pdf = await PDFDocument.load(originalBytes, { ignoreEncryption: true })
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const mono = await pdf.embedFont(StandardFonts.Courier)
  const tinta = rgb(0.055, 0.055, 0.063), cinza = rgb(0.42, 0.42, 0.45), amarelo = rgb(0.992, 0.733, 0.004)
  const urlVer = `${config.urlPublica}/v/${documento.codigo}`
  const qr = await pdf.embedPng(await QRCode.toBuffer(urlVer, { margin: 1, width: 220 }))

  let pag, y
  const W = 595.28, H = 841.89, M = 48
  const novaPagina = () => {
    pag = pdf.addPage([W, H]); y = H - M
    pag.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: amarelo })
  }
  const texto = (t, { f = fonte, s = 10, c = tinta, x = M, dy = 14 } = {}) => {
    if (y < M + 40) novaPagina()
    pag.drawText(limpo(t), { x, y, size: s, font: f, color: c }); y -= dy
  }
  const quebra = (t, { f = fonte, s = 9, c = tinta, x = M, larg = W - 2 * M, dy = 12 } = {}) => {
    const palavras = limpo(t).split(' '); let linha = ''
    for (const p of palavras) {
      const tent = linha ? linha + ' ' + p : p
      if (f.widthOfTextAtSize(tent, s) > larg) { texto(linha, { f, s, c, x, dy }); linha = p } else linha = tent
    }
    if (linha) texto(linha, { f, s, c, x, dy })
  }

  novaPagina()
  texto('CERTIFICADO DE ASSINATURA ELETRÔNICA', { f: negrito, s: 15, dy: 20 })
  texto('Holysign by HolyTech - HolyTech Solutions (provedor de assinatura)', { s: 10, c: cinza, dy: 22 })
  pag.drawImage(qr, { x: W - M - 96, y: H - M - 104, width: 96, height: 96 })

  texto('Documento', { f: negrito, s: 11, dy: 15 })
  quebra(`Título: ${documento.titulo}`)
  texto(`Solicitante: ${conta.nome}`, { s: 9, dy: 12 })
  texto(`Código de verificação: ${documento.codigo}`, { s: 9, dy: 12 })
  texto(`Criado em: ${fmt(documento.criado_em)}   |   Concluído em: ${fmt(documento.concluido_em)}`, { s: 9, dy: 12 })
  texto('SHA-256 do documento original:', { s: 9, dy: 11 })
  texto(documento.hash_original, { f: mono, s: 8, dy: 18 })

  texto('Signatários', { f: negrito, s: 11, dy: 16 })
  for (const s of signatarios) {
    if (s.papel === 'contratada') {
      texto(`${s.nome}  (CONTRATADA - ${s.cargo || 'representante'}${s.registro ? ', ' + s.registro : ''})`, { f: negrito, s: 10, dy: 13 })
      texto(`CPF: ${cpfFmt(s.cpf)}   |   Assinou em: ${fmt(s.assinado_em)}`, { s: 9, dy: 12 })
      quebra(`Assinatura eletrônica aplicada automaticamente em ${fmt(s.assinado_em)}, no momento da geração deste documento, em nome da contratada. Fundamento: autorização prévia e permanente dada pelo representante no ${s.otp_destino}, firmado anteriormente em ${fmt(s.otp_validado_em)} com código de verificação e selfie (selfie SHA-256 ${String(s.selfie_hash || '').slice(0, 32)}...). Documento enviado pela integração autenticada da conta (IP ${s.ip || '-'}).`, { s: 9, dy: 12 })
      y -= 6
      continue
    }
    texto(`${s.nome}${s.papel === 'testemunha' ? '  (testemunha)' : ''}`, { f: negrito, s: 10, dy: 13 })
    texto(`CPF: ${cpfFmt(s.cpf)}   |   Assinou em: ${fmt(s.assinado_em)}`, { s: 9, dy: 12 })
    quebra(`Identidade confirmada por código enviado via ${s.otp_canal === 'whatsapp' ? 'WhatsApp' : s.otp_canal === 'email' ? 'e-mail' : s.otp_canal} para ${s.otp_destino} (validado em ${fmt(s.otp_validado_em)})`, { s: 9, dy: 12 })
    texto(`Selfie capturada pela câmera no ato da assinatura - SHA-256: ${String(s.selfie_hash || '').slice(0, 32)}...`, { s: 9, dy: 12 })
    quebra(`IP: ${s.ip || '—'}   |   Dispositivo: ${String(s.user_agent || '—').slice(0, 140)}`, { s: 8, c: cinza, dy: 11 })
    y -= 6
  }

  y -= 4
  texto('Carimbo de tempo HolyTech', { f: negrito, s: 11, dy: 15 })
  texto(`Hora: ${fmt(carimbo.hora)}   |   Fonte: ${carimbo.fonte}`, { s: 9, dy: 12 })
  texto(`Chave HolyTech (impressão): ${carimbo.chave}   |   Algoritmo: ${carimbo.algoritmo}`, { s: 9, dy: 12 })
  texto('Assinatura do carimbo (base64, início):', { s: 9, dy: 11 })
  texto(carimbo.assinatura.slice(0, 88), { f: mono, s: 7, dy: 18 })

  quebra('As partes reconhecem a validade desta assinatura eletrônica nos termos do art. 10, § 2º, da MP 2.200-2/2001 e do art. 107 do Código Civil. A integridade do documento e das evidências pode ser conferida no endereço abaixo, informando o código de verificação ou enviando este PDF.', { s: 8, c: cinza, dy: 11 })
  y -= 4
  texto(`Verificação: ${urlVer}`, { f: negrito, s: 9, dy: 12 })

  pdf.setTitle(limpo(documento.titulo)); pdf.setProducer('Holysign by HolyTech'); pdf.setCreator('Holysign')
  return Buffer.from(await pdf.save())
}
