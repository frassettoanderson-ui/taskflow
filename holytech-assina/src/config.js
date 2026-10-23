// Configuração por variáveis de ambiente (.env carregado pelo PM2 / ecosystem).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// .env simples (sem dependência): CHAVE=valor por linha
const envFile = path.join(raiz, '.env')
if (fs.existsSync(envFile)) {
  for (const linha of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

export const config = {
  raiz,
  porta: Number(process.env.PORT || 3460),
  // URL pública (sem barra no fim), ex.: https://holytechsolution.com.br/holysign
  urlPublica: (process.env.URL_PUBLICA || 'http://localhost:3460/holysign').replace(/\/$/, ''),
  base: '/holysign',
  baseAntiga: '/assinar', // links antigos redirecionam
  // E-mail da plataforma (redefinir senha, convites; e canal padrão das contas sem e-mail próprio)
  plataformaEmail: {
    host: process.env.HOLYSIGN_SMTP_HOST || '', port: Number(process.env.HOLYSIGN_SMTP_PORT || 465),
    user: process.env.HOLYSIGN_SMTP_USER || '', pass: process.env.HOLYSIGN_SMTP_PASS || '', from: process.env.HOLYSIGN_SMTP_FROM || '',
  },
  limiteGratis: Number(process.env.HOLYSIGN_LIMITE_GRATIS || 5),
  databaseUrl: process.env.DATABASE_URL || 'postgres://localhost/holyassina',
  dados: process.env.DADOS_DIR || path.join(raiz, 'dados'),
  // AES-256-GCM das selfies (32 bytes em hex). Obrigatória em produção.
  chaveCripto: process.env.CHAVE_CRIPTO || '',
  ntp: process.env.NTP_SERVIDOR || 'a.ntp.br',
  dev: process.env.NODE_ENV !== 'production',
}

for (const sub of ['originais', 'finais', 'selfies', 'chaves']) fs.mkdirSync(path.join(config.dados, sub), { recursive: true })
