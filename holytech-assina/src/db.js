// Banco (Postgres). O esquema é criado/atualizado na subida (idempotente).
import pg from 'pg'
import { config } from './config.js'

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 8 })

export async function migrar() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- Clientes da HolyTech que usam o assinador (ex.: Atuan Contabilidade)
    CREATE TABLE IF NOT EXISTS contas (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome          text NOT NULL,
      api_key_hash  text NOT NULL UNIQUE,
      webhook_secret text NOT NULL,
      canais        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { email: {...smtp}, whatsapp: {provider, token} }
      ativo         boolean NOT NULL DEFAULT true,
      criado_em     timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS documentos (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id         uuid NOT NULL REFERENCES contas(id),
      titulo           text NOT NULL,
      external_id      text,
      callback_url     text,
      status           text NOT NULL DEFAULT 'pendente',  -- pendente | concluido | cancelado
      codigo           text NOT NULL UNIQUE,              -- código público de verificação
      hash_original    text NOT NULL,
      arquivo_original text NOT NULL,
      arquivo_final    text,
      hash_final       text,
      carimbo          jsonb,
      criado_em        timestamptz NOT NULL DEFAULT now(),
      concluido_em     timestamptz
    );
    CREATE INDEX IF NOT EXISTS documentos_conta_idx ON documentos (conta_id, criado_em DESC);

    CREATE TABLE IF NOT EXISTS signatarios (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      documento_id     uuid NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
      ordem            int NOT NULL DEFAULT 1,
      nome             text NOT NULL,
      cpf              text,
      email            text,
      whatsapp         text,
      papel            text NOT NULL DEFAULT 'parte',     -- parte | testemunha
      token            text NOT NULL UNIQUE,
      status           text NOT NULL DEFAULT 'pendente',  -- pendente | assinado
      otp_hash         text,
      otp_expira       timestamptz,
      otp_tentativas   int NOT NULL DEFAULT 0,
      otp_enviado_em   timestamptz,
      otp_canal        text,
      otp_destino      text,
      otp_validado_em  timestamptz,
      selfie_arquivo   text,
      selfie_hash      text,
      selfie_em        timestamptz,
      ip               text,
      user_agent       text,
      assinado_em      timestamptz
    );
    CREATE INDEX IF NOT EXISTS signatarios_doc_idx ON signatarios (documento_id);

    -- Trilha de auditoria (somente inclusão)
    CREATE TABLE IF NOT EXISTS eventos (
      id            bigserial PRIMARY KEY,
      documento_id  uuid NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
      signatario_id uuid,
      tipo          text NOT NULL,
      dados         jsonb NOT NULL DEFAULT '{}'::jsonb,
      ip            text,
      user_agent    text,
      criado_em     timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS eventos_doc_idx ON eventos (documento_id, id);
  `)
}

export async function evento(documentoId, signatarioId, tipo, dados = {}, req = null) {
  await pool.query(
    `INSERT INTO eventos (documento_id, signatario_id, tipo, dados, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)`,
    [documentoId, signatarioId, tipo, JSON.stringify(dados), req ? ipDe(req) : null, req ? String(req.headers['user-agent'] || '').slice(0, 400) : null]
  )
}

export function ipDe(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return xf || req.socket?.remoteAddress || ''
}
