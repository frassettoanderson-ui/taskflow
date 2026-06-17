-- CreateEnum
CREATE TYPE "StatusRoboJob" AS ENUM ('PROCESSANDO', 'BAIXADO', 'REVISAO', 'ERRO', 'IGNORADO');

-- CreateEnum
CREATE TYPE "OrigemRoboJob" AS ENUM ('UPLOAD', 'WATCHER', 'API');

-- CreateTable
CREATE TABLE "AssinaturaDocumento" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "obrigacaoNome" TEXT NOT NULL,
    "palavras" JSONB NOT NULL DEFAULT '[]',
    "regexCompetencia" TEXT,
    "regexVencimento" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssinaturaDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoboJob" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "arquivoNome" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "paginaIndex" INTEGER,
    "origem" "OrigemRoboJob" NOT NULL DEFAULT 'UPLOAD',
    "status" "StatusRoboJob" NOT NULL DEFAULT 'PROCESSANDO',
    "motivo" TEXT,
    "empresaId" TEXT,
    "obrigacaoNome" TEXT,
    "competenciaAno" INTEGER,
    "competenciaMes" INTEGER,
    "entregaId" TEXT,
    "etapas" JSONB NOT NULL DEFAULT '[]',
    "textoTrecho" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "RoboJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssinaturaDocumento_escritorioId_ativo_idx" ON "AssinaturaDocumento"("escritorioId", "ativo");

-- CreateIndex
CREATE INDEX "RoboJob_escritorioId_status_idx" ON "RoboJob"("escritorioId", "status");

-- CreateIndex
CREATE INDEX "RoboJob_escritorioId_createdAt_idx" ON "RoboJob"("escritorioId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssinaturaDocumento" ADD CONSTRAINT "AssinaturaDocumento_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoboJob" ADD CONSTRAINT "RoboJob_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
