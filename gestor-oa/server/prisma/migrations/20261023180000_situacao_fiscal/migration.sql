-- AlterTable
ALTER TABLE "Permissao" ADD COLUMN     "ecac_operar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ecac_ver" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "receitaEm" TIMESTAMP(3),
ADD COLUMN     "simeiDesde" TEXT,
ADD COLUMN     "simeiOptante" TEXT,
ADD COLUMN     "simeiSaida" TEXT,
ADD COLUMN     "simplesDesde" TEXT,
ADD COLUMN     "simplesOptante" TEXT,
ADD COLUMN     "simplesSaida" TEXT;

-- CreateTable
CREATE TABLE "SitFiscalRelatorio" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT,
    "cnpj" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "exigivel" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reportEm" TIMESTAMP(3),
    "fileName" TEXT,
    "dados" JSONB NOT NULL,
    "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitFiscalRelatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitFiscalImportacao" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "empresa" TEXT,
    "status" TEXT NOT NULL,
    "mensagem" TEXT,
    "usuarioNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitFiscalImportacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitFiscalRelatorio_escritorioId_cnpj_key" ON "SitFiscalRelatorio"("escritorioId", "cnpj");

-- CreateIndex
CREATE INDEX "SitFiscalRelatorio_escritorioId_priority_idx" ON "SitFiscalRelatorio"("escritorioId", "priority");

-- CreateIndex
CREATE INDEX "SitFiscalImportacao_escritorioId_createdAt_idx" ON "SitFiscalImportacao"("escritorioId", "createdAt");
