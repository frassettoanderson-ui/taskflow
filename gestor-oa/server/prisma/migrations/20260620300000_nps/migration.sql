-- NPS (Avalie-nos)
CREATE TABLE "NpsAvaliacao" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "empresaId" TEXT,
  "contatoEmail" TEXT NOT NULL,
  "contatoNome" TEXT,
  "nota" INTEGER NOT NULL,
  "comentario" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NpsAvaliacao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NpsAvaliacao_escritorioId_createdAt_idx" ON "NpsAvaliacao"("escritorioId", "createdAt");
