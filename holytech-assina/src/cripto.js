// Criptografia: hash, cifra das selfies, chave de assinatura da HolyTech e carimbo de tempo.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import dgram from 'node:dgram'
import { config } from './config.js'

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
export const tokenAleatorio = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url')

// Código público curto e legível (sem 0/O/1/I): XXXX-XXXX-XXXX
export function codigoVerificacao() {
  const alfa = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const b = crypto.randomBytes(12)
  let s = ''
  for (let i = 0; i < 12; i++) s += alfa[b[i] % alfa.length]
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}

// ── Selfies: AES-256-GCM (iv 12 | tag 16 | dados) ──────────────────────────
function chave() {
  const hex = config.chaveCripto
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    if (!config.dev) throw new Error('CHAVE_CRIPTO ausente/inválida (64 hex)')
    return crypto.createHash('sha256').update('holyassina-dev').digest()
  }
  return Buffer.from(hex, 'hex')
}
export function cifrar(buf) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', chave(), iv)
  const dados = Buffer.concat([c.update(buf), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), dados])
}
export function decifrar(buf) {
  const d = crypto.createDecipheriv('aes-256-gcm', chave(), buf.subarray(0, 12))
  d.setAuthTag(buf.subarray(12, 28))
  return Buffer.concat([d.update(buf.subarray(28)), d.final()])
}

// ── Chave de assinatura da HolyTech (RSA 3072). Gerada na 1ª subida. ────────
// Futuro: trocar/compor com o e-CNPJ A1 da HolyTech (ICP-Brasil).
const dirChaves = path.join(config.dados, 'chaves')
const arqPriv = path.join(dirChaves, 'holytech-assina.key.pem')
const arqPub = path.join(dirChaves, 'holytech-assina.pub.pem')
export function garantirChaves() {
  if (fs.existsSync(arqPriv) && fs.existsSync(arqPub)) return
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 })
  fs.writeFileSync(arqPriv, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  fs.writeFileSync(arqPub, publicKey.export({ type: 'spki', format: 'pem' }))
}
export const chavePublicaPem = () => fs.readFileSync(arqPub, 'utf8')
export const impressaoChave = () => sha256(crypto.createPublicKey(chavePublicaPem()).export({ type: 'spki', format: 'der' })).slice(0, 32)

export function assinarTexto(texto) {
  return crypto.sign('sha256', Buffer.from(texto), fs.readFileSync(arqPriv, 'utf8')).toString('base64')
}
export function verificarAssinatura(texto, assinaturaB64) {
  try { return crypto.verify('sha256', Buffer.from(texto), chavePublicaPem(), Buffer.from(assinaturaB64, 'base64')) } catch { return false }
}

// ── Hora oficial: consulta SNTP ao NTP.br (a.ntp.br) ────────────────────────
export function horaNtp(servidor = config.ntp, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4')
    const pkt = Buffer.alloc(48); pkt[0] = 0x1b // LI=0, VN=3, Mode=3 (cliente)
    const t = setTimeout(() => { sock.close(); resolve(null) }, timeoutMs)
    sock.once('message', (msg) => {
      clearTimeout(t); sock.close()
      try {
        const seg = msg.readUInt32BE(40), frac = msg.readUInt32BE(44)
        const ms = (seg - 2208988800) * 1000 + Math.round((frac * 1000) / 2 ** 32)
        resolve(new Date(ms))
      } catch { resolve(null) }
    })
    sock.send(pkt, 123, servidor, (err) => { if (err) { clearTimeout(t); sock.close(); resolve(null) } })
  })
}

// Carimbo de tempo HolyTech: { hash, hora (NTP.br se disponível), fonte, servidor, assinatura RSA }
export async function carimbar(hashHex, contexto = {}) {
  const ntp = await horaNtp()
  const local = new Date()
  const hora = (ntp ?? local).toISOString()
  const corpo = {
    versao: 1, emissor: 'HolyTech Solutions — HolyTech Assina', algoritmo: 'RSA-SHA256',
    hash_sha256: hashHex, hora, fonte: ntp ? `NTP.br (${config.ntp})` : 'relógio do servidor (NTP indisponível)',
    hora_servidor: local.toISOString(), diferenca_ms: ntp ? local.getTime() - ntp.getTime() : null,
    chave: impressaoChave(), ...contexto,
  }
  const texto = JSON.stringify(corpo)
  return { ...corpo, assinatura: assinarTexto(texto), assinado: texto }
}
