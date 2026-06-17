-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('MENSAL', 'TRIMESTRAL', 'ANUAL', 'EVENTUAL');

-- CreateEnum
CREATE TYPE "OrigemObrigacao" AS ENUM ('REGIME', 'GRUPO', 'MANUAL');

-- CreateTable
CREATE TABLE "Feriado" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "nome" TEXT NOT NULL,
    "abrangencia" TEXT NOT NULL DEFAULT 'NACIONAL',
    "uf" TEXT,
    "municipio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obrigacao" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "departamentoId" TEXT,
    "descricao" TEXT,
    "periodicidade" "Periodicidade" NOT NULL DEFAULT 'MENSAL',
    "regraPrazo" JSONB NOT NULL DEFAULT '{}',
    "tempoPrevistoMin" INTEGER NOT NULL DEFAULT 0,
    "exigeAnexoNaBaixa" BOOLEAN NOT NULL DEFAULT false,
    "exigeBaixaPeloRobo" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Obrigacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimeTributario" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegimeTributario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegimeObrigacao" (
    "id" TEXT NOT NULL,
    "regimeId" TEXT NOT NULL,
    "obrigacaoId" TEXT NOT NULL,
    "tempoPrevistoOverride" INTEGER,

    CONSTRAINT "RegimeObrigacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoObrigacoes" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoObrigacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoObrigacao" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "obrigacaoId" TEXT NOT NULL,

    CONSTRAINT "GrupoObrigacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaObrigacao" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "obrigacaoId" TEXT NOT NULL,
    "origens" JSONB NOT NULL DEFAULT '[]',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "responsavelId" TEXT,
    "diaPrazoOverride" INTEGER,
    "honorario" DECIMAL(12,2),
    "tempoPrevistoOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaObrigacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feriado_escritorioId_data_idx" ON "Feriado"("escritorioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Feriado_escritorioId_data_nome_key" ON "Feriado"("escritorioId", "data", "nome");

-- CreateIndex
CREATE INDEX "Obrigacao_escritorioId_deletedAt_idx" ON "Obrigacao"("escritorioId", "deletedAt");

-- CreateIndex
CREATE INDEX "Obrigacao_escritorioId_departamentoId_idx" ON "Obrigacao"("escritorioId", "departamentoId");

-- CreateIndex
CREATE INDEX "RegimeTributario_escritorioId_idx" ON "RegimeTributario"("escritorioId");

-- CreateIndex
CREATE UNIQUE INDEX "RegimeTributario_escritorioId_nome_key" ON "RegimeTributario"("escritorioId", "nome");

-- CreateIndex
CREATE INDEX "RegimeObrigacao_obrigacaoId_idx" ON "RegimeObrigacao"("obrigacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "RegimeObrigacao_regimeId_obrigacaoId_key" ON "RegimeObrigacao"("regimeId", "obrigacaoId");

-- CreateIndex
CREATE INDEX "GrupoObrigacoes_escritorioId_idx" ON "GrupoObrigacoes"("escritorioId");

-- CreateIndex
CREATE UNIQUE INDEX "GrupoObrigacoes_escritorioId_nome_key" ON "GrupoObrigacoes"("escritorioId", "nome");

-- CreateIndex
CREATE INDEX "GrupoObrigacao_obrigacaoId_idx" ON "GrupoObrigacao"("obrigacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "GrupoObrigacao_grupoId_obrigacaoId_key" ON "GrupoObrigacao"("grupoId", "obrigacaoId");

-- CreateIndex
CREATE INDEX "EmpresaObrigacao_escritorioId_idx" ON "EmpresaObrigacao"("escritorioId");

-- CreateIndex
CREATE INDEX "EmpresaObrigacao_empresaId_ativo_idx" ON "EmpresaObrigacao"("empresaId", "ativo");

-- CreateIndex
CREATE INDEX "EmpresaObrigacao_obrigacaoId_idx" ON "EmpresaObrigacao"("obrigacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaObrigacao_empresaId_obrigacaoId_key" ON "EmpresaObrigacao"("empresaId", "obrigacaoId");

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_regimeTributarioId_fkey" FOREIGN KEY ("regimeTributarioId") REFERENCES "RegimeTributario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feriado" ADD CONSTRAINT "Feriado_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obrigacao" ADD CONSTRAINT "Obrigacao_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obrigacao" ADD CONSTRAINT "Obrigacao_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeTributario" ADD CONSTRAINT "RegimeTributario_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeObrigacao" ADD CONSTRAINT "RegimeObrigacao_regimeId_fkey" FOREIGN KEY ("regimeId") REFERENCES "RegimeTributario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegimeObrigacao" ADD CONSTRAINT "RegimeObrigacao_obrigacaoId_fkey" FOREIGN KEY ("obrigacaoId") REFERENCES "Obrigacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoObrigacoes" ADD CONSTRAINT "GrupoObrigacoes_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoObrigacao" ADD CONSTRAINT "GrupoObrigacao_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoObrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoObrigacao" ADD CONSTRAINT "GrupoObrigacao_obrigacaoId_fkey" FOREIGN KEY ("obrigacaoId") REFERENCES "Obrigacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaObrigacao" ADD CONSTRAINT "EmpresaObrigacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaObrigacao" ADD CONSTRAINT "EmpresaObrigacao_obrigacaoId_fkey" FOREIGN KEY ("obrigacaoId") REFERENCES "Obrigacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
