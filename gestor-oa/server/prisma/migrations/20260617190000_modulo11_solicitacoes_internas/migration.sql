-- Modulo 11: Solicitacoes Internas (tickets entre setores)

-- Enums
CREATE TYPE "PrioridadeSolicitacao" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');
CREATE TYPE "StatusSolicitacaoInterna" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDA', 'CANCELADA');

-- Permissoes
ALTER TABLE "Permissao" ADD COLUMN "solicitacoes_internas_ver" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permissao" ADD COLUMN "solicitacoes_internas_gerenciar" BOOLEAN NOT NULL DEFAULT false;

-- SolicitacaoInterna
CREATE TABLE "SolicitacaoInterna" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "prioridade" "PrioridadeSolicitacao" NOT NULL DEFAULT 'MEDIA',
    "status" "StatusSolicitacaoInterna" NOT NULL DEFAULT 'ABERTA',
    "solicitanteId" TEXT NOT NULL,
    "departamentoDestinoId" TEXT,
    "responsavelId" TEXT,
    "empresaId" TEXT,
    "processoId" TEXT,
    "prazo" TIMESTAMP(3),
    "resolvidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SolicitacaoInterna_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SolicitacaoInterna_escritorioId_status_idx" ON "SolicitacaoInterna"("escritorioId", "status");
CREATE INDEX "SolicitacaoInterna_escritorioId_departamentoDestinoId_idx" ON "SolicitacaoInterna"("escritorioId", "departamentoDestinoId");
CREATE INDEX "SolicitacaoInterna_responsavelId_idx" ON "SolicitacaoInterna"("responsavelId");
CREATE INDEX "SolicitacaoInterna_solicitanteId_idx" ON "SolicitacaoInterna"("solicitanteId");

ALTER TABLE "SolicitacaoInterna" ADD CONSTRAINT "SolicitacaoInterna_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SolicitacaoInternaMensagem
CREATE TABLE "SolicitacaoInternaMensagem" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "autorId" TEXT,
    "autorNome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "evento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolicitacaoInternaMensagem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SolicitacaoInternaMensagem_solicitacaoId_idx" ON "SolicitacaoInternaMensagem"("solicitacaoId");

ALTER TABLE "SolicitacaoInternaMensagem" ADD CONSTRAINT "SolicitacaoInternaMensagem_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoInterna"("id") ON DELETE CASCADE ON UPDATE CASCADE;
