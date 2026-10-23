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

    -- Representante da conta (ex.: contador responsável) com autorização prévia de assinatura:
    -- assina 1x o Termo de autorização (código + selfie) e a assinatura dele é aplicada
    -- automaticamente nos documentos enviados pela API da conta.
    CREATE TABLE IF NOT EXISTS representantes (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id         uuid NOT NULL REFERENCES contas(id),
      nome             text NOT NULL,
      cpf              text NOT NULL,
      cargo            text NOT NULL DEFAULT 'Contador responsável',
      registro         text,               -- ex.: CRC/SC 041514/O
      email            text,
      whatsapp         text,
      termo_documento_id uuid,
      autorizado_em    timestamptz,
      revogado_em      timestamptz,
      criado_em        timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE documentos  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'documento'; -- documento | autorizacao
    ALTER TABLE documentos  ADD COLUMN IF NOT EXISTS representante_id uuid;
    ALTER TABLE signatarios ADD COLUMN IF NOT EXISTS representante_id uuid;
    ALTER TABLE signatarios ADD COLUMN IF NOT EXISTS cargo text;
    ALTER TABLE signatarios ADD COLUMN IF NOT EXISTS registro text;

    -- Holysign: contas com cadastro próprio, usuários e sessões do painel
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS cnpj text;
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'gratis';      -- gratis | cortesia | (pagos no futuro)
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS limite_mensal int DEFAULT 5;              -- NULL = sem limite
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS webhook_url text;
    ALTER TABLE documentos ADD COLUMN IF NOT EXISTS criado_por uuid;
    CREATE TABLE IF NOT EXISTS usuarios (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id       uuid NOT NULL REFERENCES contas(id),
      nome           text NOT NULL,
      email          text NOT NULL UNIQUE,
      senha_hash     text,
      papel          text NOT NULL DEFAULT 'membro',   -- dono | membro
      ativo          boolean NOT NULL DEFAULT true,
      convite_hash   text,                            -- convite de equipe / redefinição de senha
      convite_expira timestamptz,
      criado_em      timestamptz NOT NULL DEFAULT now(),
      ultimo_acesso  timestamptz
    );
    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash  text PRIMARY KEY,
      usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira      timestamptz NOT NULL,
      ip          text,
      user_agent  text,
      criado_em   timestamptz NOT NULL DEFAULT now()
    );
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
