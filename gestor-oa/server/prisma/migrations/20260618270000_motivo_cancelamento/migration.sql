-- Motivos de cancelamento das empresas
CREATE TABLE "MotivoCancelamento" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MotivoCancelamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MotivoCancelamento_escritorioId_nome_key" ON "MotivoCancelamento"("escritorioId", "nome");
CREATE INDEX "MotivoCancelamento_escritorioId_idx" ON "MotivoCancelamento"("escritorioId");

ALTER TABLE "MotivoCancelamento" ADD CONSTRAINT "MotivoCancelamento_escritorioId_fkey"
  FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Empresa" ADD COLUMN "motivoCancelamentoId" TEXT;
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_motivoCancelamentoId_fkey"
  FOREIGN KEY ("motivoCancelamentoId") REFERENCES "MotivoCancelamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
