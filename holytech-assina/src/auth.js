// Usuários e sessões do painel Holysign. Senha com scrypt; sessão = cookie httpOnly com token aleatório
// (no banco só o hash). Convite de equipe e redefinição de senha usam token de uso único com validade.
import crypto from 'node:crypto'
import { config } from './config.js'
import { pool, ipDe } from './db.js'
import { sha256, tokenAleatorio } from './cripto.js'

const COOKIE = 'hs_sessao'
const DIAS = 30

export function hashSenha(senha) {
  const sal = crypto.randomBytes(16)
  const h = crypto.scryptSync(String(senha), sal, 64)
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`
}
export function conferirSenha(senha, guardado) {
  const [alg, salHex, hHex] = String(guardado || '').split('$')
  if (alg !== 'scrypt' || !salHex || !hHex) return false
  const h = crypto.scryptSync(String(senha), Buffer.from(salHex, 'hex'), 64)
  return crypto.timingSafeEqual(h, Buffer.from(hHex, 'hex'))
}
export const senhaFraca = (s) => String(s || '').length < 8

export async function abrirSessao(req, res, usuario) {
  const token = tokenAleatorio(32)
  await pool.query(`INSERT INTO sessoes (token_hash, usuario_id, expira, ip, user_agent) VALUES ($1,$2,now() + interval '${DIAS} days',$3,$4)`,
    [sha256(token), usuario.id, ipDe(req), String(req.headers['user-agent'] || '').slice(0, 300)])
  await pool.query(`UPDATE usuarios SET ultimo_acesso = now() WHERE id = $1`, [usuario.id])
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: !config.dev, path: config.base, maxAge: DIAS * 86400_000 })
}
export async function fecharSessao(req, res) {
  const t = lerCookie(req)
  if (t) await pool.query(`DELETE FROM sessoes WHERE token_hash = $1`, [sha256(t)])
  res.clearCookie(COOKIE, { path: config.base })
}
function lerCookie(req) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(String(req.headers.cookie || ''))
  return m ? decodeURIComponent(m[1]) : ''
}
// Middleware: exige sessão válida; põe req.usuario e req.conta
export async function exigirSessao(req, res, next) {
  const t = lerCookie(req)
  if (t) {
    const r = (await pool.query(
      `SELECT u.*, c.nome AS conta_nome FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id JOIN contas c ON c.id = u.conta_id
        WHERE s.token_hash = $1 AND s.expira > now() AND u.ativo AND c.ativo`, [sha256(t)]
    )).rows[0]
    if (r) {
      req.usuario = r
      req.conta = (await pool.query(`SELECT * FROM contas WHERE id = $1`, [r.conta_id])).rows[0]
      return next()
    }
  }
  res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' })
}

// Limite simples de tentativas de login por IP (memória)
const tentativas = new Map()
export function podeTentar(req) {
  const ip = ipDe(req); const agora = Date.now()
  const l = (tentativas.get(ip) ?? []).filter((t) => agora - t < 15 * 60_000)
  tentativas.set(ip, l)
  return l.length < 10
}
export function registrarFalha(req) { const ip = ipDe(req); tentativas.set(ip, [...(tentativas.get(ip) ?? []), Date.now()]) }

// Convite / redefinição: token de uso único
export async function gerarConvite(usuarioId, horas = 72) {
  const token = tokenAleatorio(24)
  await pool.query(`UPDATE usuarios SET convite_hash = $2, convite_expira = now() + ($3 || ' hours')::interval WHERE id = $1`, [usuarioId, sha256(token), String(horas)])
  return token
}
export async function usuarioPorConvite(token) {
  return (await pool.query(`SELECT * FROM usuarios WHERE convite_hash = $1 AND convite_expira > now() AND ativo`, [sha256(String(token || ''))])).rows[0] ?? null
}
