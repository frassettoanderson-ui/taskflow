// Aviso ao sistema que pediu a assinatura (ex.: ERP da Atuan). Corpo JSON assinado com HMAC-SHA256
// no header X-HolyTech-Assinatura (segredo da conta). 3 tentativas com espera crescente.
import crypto from 'node:crypto'

export async function notificar(conta, url, evento, dados) {
  if (!url) return
  const corpo = JSON.stringify({ evento, ...dados, enviado_em: new Date().toISOString() })
  const assinatura = crypto.createHmac('sha256', conta.webhook_secret).update(corpo).digest('hex')
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HolyTech-Assinatura': assinatura, 'X-HolyTech-Evento': evento }, body: corpo })
      if (r.ok) return
    } catch { /* tenta de novo */ }
    await new Promise(r => setTimeout(r, 2000 * (i + 1) ** 2))
  }
  console.error('[webhook] falhou', evento, url)
}
