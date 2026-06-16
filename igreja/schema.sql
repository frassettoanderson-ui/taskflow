-- ═══════════════════════════════════════════════
--  IGREJA — Sistema financeiro  (PostgreSQL)
--  Fase 0 + 1: fundação + financeiro
-- ═══════════════════════════════════════════════

-- Igreja (hoje uma; preparado para várias no futuro)
CREATE TABLE IF NOT EXISTS igrejas (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Usuários do sistema (login próprio)
CREATE TABLE IF NOT EXISTS usuarios (
  id        SERIAL PRIMARY KEY,
  igreja_id INT NOT NULL REFERENCES igrejas(id),
  nome      VARCHAR(120) NOT NULL,
  email     VARCHAR(150) NOT NULL UNIQUE,
  senha     VARCHAR(255) NOT NULL,
  papel     VARCHAR(20)  NOT NULL DEFAULT 'admin',
  ativo     BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Bancos / contas (SICOBE, CREDIFOZ...)
CREATE TABLE IF NOT EXISTS bancos (
  id            SERIAL PRIMARY KEY,
  igreja_id     INT NOT NULL REFERENCES igrejas(id),
  nome          VARCHAR(100) NOT NULL,
  agencia       VARCHAR(20)  DEFAULT '',
  conta         VARCHAR(30)  DEFAULT '',
  chave_pix     VARCHAR(150) DEFAULT '',
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  ativo         BOOLEAN DEFAULT TRUE
);
-- Migração para bancos já existentes:
ALTER TABLE bancos ADD COLUMN IF NOT EXISTS agencia   VARCHAR(20)  DEFAULT '';
ALTER TABLE bancos ADD COLUMN IF NOT EXISTS conta     VARCHAR(30)  DEFAULT '';
ALTER TABLE bancos ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(150) DEFAULT '';

-- Centros de custo (só para despesas)
CREATE TABLE IF NOT EXISTS centros_custo (
  id        SERIAL PRIMARY KEY,
  igreja_id INT NOT NULL REFERENCES igrejas(id),
  nome      VARCHAR(100) NOT NULL,
  ativo     BOOLEAN DEFAULT TRUE
);

-- Membros
CREATE TABLE IF NOT EXISTS membros (
  id              SERIAL PRIMARY KEY,
  igreja_id       INT NOT NULL REFERENCES igrejas(id),
  nome            VARCHAR(150) NOT NULL,
  telefone        VARCHAR(30)  DEFAULT '',
  endereco        VARCHAR(255) DEFAULT '',
  data_nascimento DATE,
  sexo            VARCHAR(1),            -- M | F
  ativo           BOOLEAN DEFAULT TRUE,
  origem          VARCHAR(20) DEFAULT 'interno', -- interno | publico
  criado_em       TIMESTAMP DEFAULT NOW()
);

-- Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id         SERIAL PRIMARY KEY,
  igreja_id  INT NOT NULL REFERENCES igrejas(id),
  nome       VARCHAR(150) NOT NULL,
  telefone   VARCHAR(30)  DEFAULT '',
  documento  VARCHAR(30)  DEFAULT '',   -- CPF/CNPJ opcional
  observacao VARCHAR(255) DEFAULT '',
  ativo      BOOLEAN DEFAULT TRUE,
  criado_em  TIMESTAMP DEFAULT NOW()
);

-- Despesas fixas (modelos recorrentes — geram lançamento todo mês)
CREATE TABLE IF NOT EXISTS despesas_fixas (
  id              SERIAL PRIMARY KEY,
  igreja_id       INT NOT NULL REFERENCES igrejas(id),
  fornecedor_id   INT REFERENCES fornecedores(id),
  centro_custo_id INT REFERENCES centros_custo(id),
  banco_id        INT REFERENCES bancos(id),
  descricao       VARCHAR(255) DEFAULT '',
  valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  dia_vencimento  INT NOT NULL DEFAULT 1, -- dia do mês
  forma_pagamento VARCHAR(30) DEFAULT 'Pix',
  ativo           BOOLEAN DEFAULT TRUE,
  criado_em       TIMESTAMP DEFAULT NOW()
);

-- Lançamentos (entradas E saídas — espelha o export contábil)
CREATE TABLE IF NOT EXISTS lancamentos (
  id              SERIAL PRIMARY KEY,
  igreja_id       INT NOT NULL REFERENCES igrejas(id),
  tipo            VARCHAR(10) NOT NULL,        -- entrada | saida
  situacao        VARCHAR(12) NOT NULL,        -- recebido | pago | pendente
  data            DATE NOT NULL,
  banco_id        INT NOT NULL REFERENCES bancos(id),
  valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  descricao       VARCHAR(120) DEFAULT '',     -- RECEITA PIX / FORNECEDOR...
  detalhes        VARCHAR(255) DEFAULT '',
  forma_pagamento VARCHAR(30)  DEFAULT 'Pix',
  parcelamento    VARCHAR(20)  DEFAULT 'À vista', -- À vista | Sim | Recorrente
  parcela_label   VARCHAR(10)  DEFAULT '',     -- ex.: 4/12
  -- entrada:
  membro_id       INT REFERENCES membros(id),
  visitante       BOOLEAN DEFAULT FALSE,
  -- saida:
  fornecedor_id   INT REFERENCES fornecedores(id),
  centro_custo_id INT REFERENCES centros_custo(id),
  tipo_gasto      VARCHAR(40) DEFAULT '',      -- DIZIMO/OFERTA (entrada) ou classif. (saida)
  -- vínculos:
  despesa_fixa_id INT REFERENCES despesas_fixas(id),
  grupo_parcela   UUID,                        -- agrupa parcelas de uma mesma compra
  usuario_id      INT REFERENCES usuarios(id),
  criado_em       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lanc_igreja_data ON lancamentos(igreja_id, data);
CREATE INDEX IF NOT EXISTS idx_lanc_situacao    ON lancamentos(igreja_id, situacao);
CREATE INDEX IF NOT EXISTS idx_lanc_tipo        ON lancamentos(igreja_id, tipo);

-- Evita gerar a mesma despesa fixa duas vezes no mesmo mês.
-- date_trunc sobre timestamp (cast explícito) é IMMUTABLE e pode ir em índice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fixa_mes
  ON lancamentos (despesa_fixa_id, (date_trunc('month', data::timestamp)))
  WHERE despesa_fixa_id IS NOT NULL;

-- ─── Dados iniciais ───────────────────────────────
INSERT INTO igrejas (nome) VALUES ('Minha Igreja') ON CONFLICT DO NOTHING;

INSERT INTO bancos (igreja_id, nome)
  SELECT 1, b FROM (VALUES ('Sicoob'), ('CREDIFOZ')) AS t(b)
  WHERE NOT EXISTS (SELECT 1 FROM bancos WHERE igreja_id = 1);

-- Corrige o nome que estava errado (SICOBE -> Sicoob)
UPDATE bancos SET nome = 'Sicoob' WHERE nome IN ('SICOBE', 'SICOOB', 'Sicobe');
