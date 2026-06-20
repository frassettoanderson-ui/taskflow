-- Formularios flexiveis de solicitacao
CREATE TABLE "FormularioSolicitacao" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "campos" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormularioSolicitacao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FormularioSolicitacao_escritorioId_idx" ON "FormularioSolicitacao"("escritorioId");

ALTER TABLE "SolicitacaoPortal" ADD COLUMN "formularioId" TEXT;
ALTER TABLE "SolicitacaoPortal" ADD COLUMN "respostas" JSONB;
