-- Metodo APLA: custos fixos
CREATE TABLE "CustoFixo" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "escopo" TEXT NOT NULL DEFAULT 'GERAL',
  "grupoId" TEXT,
  "tagId" TEXT,
  "empresaId" TEXT,
  "valor" DECIMAL(12,2) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustoFixo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustoFixo_escritorioId_idx" ON "CustoFixo"("escritorioId");
