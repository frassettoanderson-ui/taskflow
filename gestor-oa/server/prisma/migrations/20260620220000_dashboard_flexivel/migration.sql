-- Dashboard Flexivel: Indicadores + Paineis
ALTER TABLE "Usuario" ADD COLUMN "painelPreferidoId" TEXT;

CREATE TABLE "Indicador" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'numerico',
  "metrica" TEXT NOT NULL,
  "prazo" TEXT NOT NULL DEFAULT 'mes_atual',
  "visibilidade" TEXT NOT NULL DEFAULT 'todos',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoPorId" TEXT,
  "filtroDepartamentoId" TEXT,
  "filtroGrupoId" TEXT,
  "filtroRegimeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Indicador_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Indicador_escritorioId_idx" ON "Indicador"("escritorioId");

CREATE TABLE "Painel" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "transicaoSeg" INTEGER NOT NULL DEFAULT 60,
  "visibilidade" TEXT NOT NULL DEFAULT 'todos',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoPorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Painel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Painel_escritorioId_idx" ON "Painel"("escritorioId");

CREATE TABLE "PainelIndicador" (
  "painelId" TEXT NOT NULL,
  "indicadorId" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PainelIndicador_pkey" PRIMARY KEY ("painelId", "indicadorId")
);
CREATE INDEX "PainelIndicador_indicadorId_idx" ON "PainelIndicador"("indicadorId");
ALTER TABLE "PainelIndicador" ADD CONSTRAINT "PainelIndicador_painelId_fkey" FOREIGN KEY ("painelId") REFERENCES "Painel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PainelIndicador" ADD CONSTRAINT "PainelIndicador_indicadorId_fkey" FOREIGN KEY ("indicadorId") REFERENCES "Indicador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
