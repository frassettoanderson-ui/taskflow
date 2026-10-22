// Canais de envio (código de verificação e convite), configurados por conta:
//   canais.email    = { host, port, user, pass, from }
//   canais.whatsapp = { provider: 'whatsprofissional', token }
// Em desenvolvimento, sem canal configurado, o código só aparece no log do servidor.
import nodemailer from 'nodemailer'
import { config } from './config.js'

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '')

export function canaisDisponiveis(conta, sig) {
  const c = conta.canais || {}
  const out = []
  if (sig.whatsapp && soDigitos(sig.whatsapp).length >= 10 && c.whatsapp?.token) out.push({ id: 'whatsapp', destino: mascararFone(sig.whatsapp) })
  if (sig.email && c.email?.host) out.push({ id: 'email', destino: mascararEmail(sig.email) })
  if (!out.length && config.dev) out.push({ id: 'console', destino: 'log do servidor (desenvolvimento)' })
  return out
}

export function mascararFone(v) { const d = soDigitos(v); return d.length >= 4 ? `(**) *****-${d.slice(-4)}` : '***' }
export function mascararEmail(v) {
  const [u, dom] = String(v).split('@')
  if (!dom) return '***'
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(1, u.length - 2))}@${dom}`
}

async function enviarWhats(token, fone, texto) {
  let p = soDigitos(fone)
  if (p.length === 10 || p.length === 11) p = '55' + p
  const r = await fetch('https://api-v2.whatsprofissional.com/api/public/send-message', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, phone: p, message: texto }),
  })
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${(await r.text()).slice(0, 160)}`)
}

async function enviarEmail(cfg, para, assunto, texto, html) {
  const port = Number(cfg.port || 465)
  const t = nodemailer.createTransport({ host: cfg.host, port, secure: port === 465, auth: { user: cfg.user, pass: cfg.pass } })
  await t.sendMail({ from: cfg.from || cfg.user, to: para, subject: assunto, text: texto, html })
}

const caixa = (conteudo) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0e0e10;text-align:center">${conteudo}<p style="margin-top:28px;font-size:11px;color:#777">HolyTech Assina — assinatura eletrônica · holytechsolution.com.br</p></div>`

export async function enviarCodigo(conta, sig, canal, codigo) {
  const texto = `HolyTech Assina: seu código para assinar o documento é ${codigo}. Válido por 10 minutos. Não compartilhe este código.`
  if (canal === 'whatsapp') return enviarWhats(conta.canais.whatsapp.token, sig.whatsapp, texto)
  if (canal === 'email') {
    return enviarEmail(conta.canais.email, sig.email, `Seu código de assinatura: ${codigo}`, texto,
      caixa(`<p style="font-size:15px">Seu código para assinar o documento é</p><p style="font-size:34px;font-weight:bold;letter-spacing:6px;margin:12px 0">${codigo}</p><p style="font-size:13px;color:#555">Válido por 10 minutos. Não compartilhe este código.</p>`))
  }
  if (canal === 'console' && config.dev) { console.log(`[DEV] código de ${sig.nome}: ${codigo}`); return }
  throw new Error('Canal de envio indisponível')
}

// Convite com o link de assinatura (opcional: o sistema que pediu a assinatura pode enviar por conta própria)
export async function enviarConvite(conta, sig, titulo, link) {
  const c = conta.canais || {}
  const texto = `Olá ${sig.nome.split(' ')[0]}! ${conta.nome} enviou o documento "${titulo}" para você assinar eletronicamente:\n\n${link}\n\nHolyTech Assina`
  const feitos = []
  if (sig.whatsapp && c.whatsapp?.token) { try { await enviarWhats(c.whatsapp.token, sig.whatsapp, texto); feitos.push('whatsapp') } catch (e) { console.error('[convite whats]', e.message) } }
  if (sig.email && c.email?.host) {
    try {
      await enviarEmail(c.email, sig.email, `Documento para assinar: ${titulo}`, texto,
        caixa(`<p style="font-size:15px"><b>${conta.nome}</b> enviou um documento para você assinar:</p><p style="font-size:17px;font-weight:bold;margin:14px 0">${titulo}</p><p><a href="${link}" style="display:inline-block;background:#0e0e10;color:#fff;padding:12px 26px;border-radius:6px;text-decoration:none;font-weight:bold">Ler e assinar</a></p>`))
      feitos.push('email')
    } catch (e) { console.error('[convite email]', e.message) }
  }
  return feitos
}
