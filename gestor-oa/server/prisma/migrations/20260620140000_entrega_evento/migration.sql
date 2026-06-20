-- Historico de movimentacao da demanda ([F2] balaozinho)
CREATE TABLE "EntregaEvento" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "entregaId" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "autorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntregaEvento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EntregaEvento_entregaId_idx" ON "EntregaEvento"("entregaId");
ALTER TABLE "EntregaEvento" ADD CONSTRAINT "EntregaEvento_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
