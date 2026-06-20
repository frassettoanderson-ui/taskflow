-- Acessorias DOCS (ACDOX): regua de cobranca de documentos
CREATE TABLE "ReguaCobranca" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "diaLimite" INTEGER NOT NULL DEFAULT 10,
  "departamentoId" TEXT,
  "lembreteAntesDias" INTEGER,
  "lembreteDepoisDias" INTEGER,
  "modeloEmail" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReguaCobranca_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReguaCobranca_escritorioId_idx" ON "ReguaCobranca"("escritorioId");

CREATE TABLE "ReguaCobrancaItem" (
  "id" TEXT NOT NULL,
  "reguaId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ReguaCobrancaItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReguaCobrancaItem_reguaId_idx" ON "ReguaCobrancaItem"("reguaId");
ALTER TABLE "ReguaCobrancaItem" ADD CONSTRAINT "ReguaCobrancaItem_reguaId_fkey" FOREIGN KEY ("reguaId") REFERENCES "ReguaCobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReguaCobrancaEmpresa" (
  "reguaId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  CONSTRAINT "ReguaCobrancaEmpresa_pkey" PRIMARY KEY ("reguaId", "empresaId")
);
CREATE INDEX "ReguaCobrancaEmpresa_empresaId_idx" ON "ReguaCobrancaEmpresa"("empresaId");
ALTER TABLE "ReguaCobrancaEmpresa" ADD CONSTRAINT "ReguaCobrancaEmpresa_reguaId_fkey" FOREIGN KEY ("reguaId") REFERENCES "ReguaCobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CobrancaDoc" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "reguaId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "competenciaAno" INTEGER NOT NULL,
  "competenciaMes" INTEGER NOT NULL,
  "dataLimite" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CobrancaDoc_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CobrancaDoc_reguaId_empresaId_competenciaAno_competenciaMes_key" ON "CobrancaDoc"("reguaId", "empresaId", "competenciaAno", "competenciaMes");
CREATE INDEX "CobrancaDoc_escritorioId_status_idx" ON "CobrancaDoc"("escritorioId", "status");
CREATE INDEX "CobrancaDoc_empresaId_idx" ON "CobrancaDoc"("empresaId");
ALTER TABLE "CobrancaDoc" ADD CONSTRAINT "CobrancaDoc_reguaId_fkey" FOREIGN KEY ("reguaId") REFERENCES "ReguaCobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CobrancaDocItem" (
  "id" TEXT NOT NULL,
  "cobrancaId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "arquivo" TEXT,
  "justificativa" TEXT,
  "validadoPorId" TEXT,
  "validadoEm" TIMESTAMP(3),
  CONSTRAINT "CobrancaDocItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CobrancaDocItem_cobrancaId_idx" ON "CobrancaDocItem"("cobrancaId");
ALTER TABLE "CobrancaDocItem" ADD CONSTRAINT "CobrancaDocItem_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "CobrancaDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
