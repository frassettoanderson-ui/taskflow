// Cria uma conta (cliente da HolyTech) e grava API key + segredo do webhook num arquivo protegido
// (dados/contas/<slug>.txt, chmod 600). Não imprime os segredos no terminal.
// Uso: node scripts/criar-conta.mjs "Atuan Contabilidade"
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from '../src/config.js'
import { pool, migrar } from '../src/db.js'

const nome = process.argv[2]
if (!nome) { console.error('Uso: node scripts/criar-conta.mjs "Nome da conta"'); process.exit(1) }
await migrar()
const apiKey = 'hta_' + crypto.randomBytes(24).toString('base64url')
const segredo = crypto.randomBytes(24).toString('hex')
const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
const r = await pool.query(`INSERT INTO contas (nome, api_key_hash, webhook_secret) VALUES ($1,$2,$3) RETURNING id`, [nome, hash, segredo])
const dir = path.join(config.dados, 'contas'); fs.mkdirSync(dir, { recursive: true })
const slug = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const arq = path.join(dir, `${slug}.txt`)
fs.writeFileSync(arq, `CONTA_ID=${r.rows[0].id}\nHOLYASSINA_API_KEY=${apiKey}\nHOLYASSINA_WEBHOOK_SECRET=${segredo}\n`, { mode: 0o600 })
console.log(`Conta criada: ${nome} (${r.rows[0].id}). Segredos gravados em ${arq}`)
await pool.end()
