// Canais de envio (código de verificação, convite e e-mails da conta), configurados por conta no painel:
//   canais.email    = { host, port, user, from, pass_cifrado }   (senha guardada cifrada)
//   canais.whatsapp = { provider: 'evolution', url, token_cifrado }  (Evolution Go da HolyTech; token = da instância)
//                   | { provider: 'whatsprofissional', token_cifrado }
// Sem canal próprio, a conta usa o e-mail da plataforma Holysign (variáveis HOLYSIGN_SMTP_*), se configurado.
// Em desenvolvimento, sem nenhum canal, o código só aparece no log do servidor.
import nodemailer from 'nodemailer'
import { config } from './config.js'
import { cifrar, decifrar } from './cripto.js'

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '')
export const guardarSegredo = (v) => cifrar(Buffer.from(String(v), 'utf8')).toString('base64')
const lerSegredo = (b64) => { try { return b64 ? decifrar(Buffer.from(b64, 'base64')).toString('utf8') : '' } catch { return '' } }

// Canais efetivos da conta (com segredos abertos) — nunca devolver isto para o navegador
export function canaisDe(conta) {
  const c = conta?.canais || {}
  const email = c.email?.host ? { host: c.email.host, port: c.email.port, user: c.email.user, from: c.email.from, pass: c.email.pass_cifrado ? lerSegredo(c.email.pass_cifrado) : c.email.pass }
    : config.plataformaEmail.host ? config.plataformaEmail : null
  const tokenWhats = c.whatsapp?.token_cifrado ? lerSegredo(c.whatsapp.token_cifrado) : c.whatsapp?.token
  const whatsapp = tokenWhats ? { provider: c.whatsapp.provider || 'whatsprofissional', url: c.whatsapp.url || 'http://127.0.0.1:8081', token: tokenWhats } : null
  return { email, whatsapp, emailDaPlataforma: !c.email?.host && !!email }
}

export function canaisDisponiveis(conta, sig) {
  const c = canaisDe(conta)
  const out = []
  if (sig.whatsapp && soDigitos(sig.whatsapp).length >= 10 && c.whatsapp) out.push({ id: 'whatsapp', destino: mascararFone(sig.whatsapp) })
  if (sig.email && c.email) out.push({ id: 'email', destino: mascararEmail(sig.email) })
  if (!out.length && config.dev) out.push({ id: 'console', destino: 'log do servidor (desenvolvimento)' })
  return out
}

export function mascararFone(v) { const d = soDigitos(v); return d.length >= 4 ? `(**) *****-${d.slice(-4)}` : '***' }
export function mascararEmail(v) {
  const [u, dom] = String(v).split('@')
  if (!dom) return '***'
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${dom}`
}

async function enviarWhats(w, fone, texto) {
  let p = soDigitos(fone)
  if (p.length === 10 || p.length === 11) p = '55' + p
  if (w.provider === 'evolution') {
    const r = await fetch(`${w.url.replace(/\/$/, '')}/send/text`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: w.token }, body: JSON.stringify({ number: p, text: texto }),
    })
    if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${(await r.text()).slice(0, 160)}`)
    return
  }
  const token = w.token
  const r = await fetch('https://api-v2.whatsprofissional.com/api/public/send-message', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, phone: p, message: texto }),
  })
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${(await r.text()).slice(0, 160)}`)
}

export async function enviarEmail(cfg, para, assunto, texto, html, anexos) {
  const port = Number(cfg.port || 465)
  const t = nodemailer.createTransport({ host: cfg.host, port, secure: port === 465, auth: { user: cfg.user, pass: cfg.pass } })
  await t.sendMail({ from: cfg.from || cfg.user, to: para, subject: assunto, text: texto, html, attachments: anexos })
}

// Documento concluído: cada signatário (com e-mail) recebe o PDF final assinado
export async function enviarFinal(conta, sig, titulo, pdf, verificacao) {
  const c = canaisDe(conta)
  if (!c.email || !sig.email) return false
  const texto = `Olá ${sig.nome.split(' ')[0]}! O documento "${titulo}" foi assinado por todos. A via final, com o certificado de assinatura, está em anexo.

Verificação: ${verificacao}

Holysign`
  await enviarEmail(c.email, sig.email, `Documento assinado: ${titulo}`, texto,
    caixa(`<p style="font-size:15px">O documento abaixo foi <b>assinado por todos</b>. A via final, com o certificado de assinatura, está em anexo.</p><p style="font-size:17px;font-weight:bold;margin:14px 0">${titulo}</p><p><a href="${verificacao}" style="color:#0E7C7B">Verificar autenticidade</a></p>`),
    [{ filename: `${titulo.replace(/[^ws.-]+/g, ' ').trim().slice(0, 80) || 'documento'} - assinado.pdf`, content: pdf, contentType: 'application/pdf' }])
  return true
}

export const caixa = (conteudo) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0e0e10;text-align:center">
<p style="font-size:20px;font-weight:800;margin:0 0 18px">Holy<span style="color:#0E7C7B">sign</span></p>${conteudo}
<p style="margin-top:28px;font-size:11px;color:#777">Holysign by HolyTech — assinatura eletrônica com código e selfie</p></div>`

export async function enviarCodigo(conta, sig, canal, codigo) {
  const c = canaisDe(conta)
  const texto = `Holysign: seu código para assinar o documento é ${codigo}. Válido por 10 minutos. Não compartilhe este código.`
  if (canal === 'whatsapp' && c.whatsapp) return enviarWhats(c.whatsapp, sig.whatsapp, texto)
  if (canal === 'email' && c.email) {
    return enviarEmail(c.email, sig.email, `Seu código de assinatura: ${codigo}`, texto,
      caixa(`<p style="font-size:15px">Seu código para assinar o documento é</p><p style="font-size:34px;font-weight:bold;letter-spacing:6px;margin:12px 0">${codigo}</p><p style="font-size:13px;color:#555">Válido por 10 minutos. Não compartilhe este código.</p>`))
  }
  if (canal === 'console' && config.dev) { console.log(`[DEV] código de ${sig.nome}: ${codigo}`); return }
  throw new Error('Canal de envio indisponível')
}

// Convite com o link de assinatura (opcional: o sistema que pediu a assinatura pode enviar por conta própria)
export async function enviarConvite(conta, sig, titulo, link) {
  const c = canaisDe(conta)
  const texto = `Olá ${sig.nome.split(' ')[0]}! ${conta.nome} enviou o documento "${titulo}" para você assinar eletronicamente:\n\n${link}\n\nHolysign`
  const feitos = []
  if (sig.whatsapp && c.whatsapp) { try { await enviarWhats(c.whatsapp, sig.whatsapp, texto); feitos.push('whatsapp') } catch (e) { console.error('[convite whats]', e.message) } }
  if (sig.email && c.email) {
    try {
      await enviarEmail(c.email, sig.email, `Documento para assinar: ${titulo}`, texto,
        caixa(`<p style="font-size:15px"><b>${conta.nome}</b> enviou um documento para você assinar:</p><p style="font-size:17px;font-weight:bold;margin:14px 0">${titulo}</p><p><a href="${link}" style="display:inline-block;background:#0e0e10;color:#fff;padding:12px 26px;border-radius:6px;text-decoration:none;font-weight:bold">Ler e assinar</a></p>`))
      feitos.push('email')
    } catch (e) { console.error('[convite email]', e.message) }
  }
  return feitos
}

// E-mail do sistema (redefinir senha, convite de equipe) — usa o canal da plataforma
export async function emailDoSistema(para, assunto, texto, html) {
  if (!config.plataformaEmail.host) throw new Error('E-mail da plataforma não configurado')
  await enviarEmail(config.plataformaEmail, para, assunto, texto, caixa(html))
}
