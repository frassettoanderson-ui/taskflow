-- CreateEnum
CREATE TYPE "StatusProcesso" AS ENUM ('EM_ANDAMENTO', 'SUSPENSO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusPasso" AS ENUM ('PENDENTE', 'CONCLUIDO', 'DISPENSADO');

-- CreateEnum
CREATE TYPE "BasePrazoPasso" AS ENUM ('INICIO', 'PASSO_ANTERIOR');

-- CreateEnum
CREATE TYPE "AcaoAutomatica" AS ENUM ('NENHUMA', 'CRIAR_TAREFA', 'CRIAR_OBRIGACAO_NA_EMPRESA', 'INICIAR_SUBPROCESSO');

-- CreateEnum
CREATE TYPE "TipoRecorrencia" AS ENUM ('DIAS_MES', 'DIAS_SEMANA', 'DIAS_UTEIS');

-- CreateTable
CREATE TABLE "MatrizProcesso" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "departamentoId" TEXT,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrizProcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrizPasso" (
    "id" TEXT NOT NULL,
    "matrizId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "departamentoId" TEXT,
    "prazoDias" INTEGER NOT NULL DEFAULT 0,
    "basePrazo" "BasePrazoPasso" NOT NULL DEFAULT 'INICIO',
    "bloqueante" BOOLEAN NOT NULL DEFAULT false,
    "acaoAutomatica" "AcaoAutomatica" NOT NULL DEFAULT 'NENHUMA',
    "acaoRef" TEXT,

    CONSTRAINT "MatrizPasso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Processo" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "matrizId" TEXT,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "StatusProcesso" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspensoAte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessoPasso" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "departamentoId" TEXT,
    "bloqueante" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusPasso" NOT NULL DEFAULT 'PENDENTE',
    "prazo" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "responsavelId" TEXT,
    "acaoAutomatica" "AcaoAutomatica" NOT NULL DEFAULT 'NENHUMA',
    "acaoRef" TEXT,

    CONSTRAINT "ProcessoPasso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessoComentario" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessoComentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessoRecorrente" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "matrizId" TEXT NOT NULL,
    "empresaId" TEXT,
    "tipoRecorrencia" "TipoRecorrencia" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaExecucao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessoRecorrente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatrizProcesso_escritorioId_idx" ON "MatrizProcesso"("escritorioId");

-- CreateIndex
CREATE INDEX "MatrizPasso_matrizId_idx" ON "MatrizPasso"("matrizId");

-- CreateIndex
CREATE INDEX "Processo_escritorioId_status_idx" ON "Processo"("escritorioId", "status");

-- CreateIndex
CREATE INDEX "Processo_empresaId_idx" ON "Processo"("empresaId");

-- CreateIndex
CREATE INDEX "ProcessoPasso_processoId_idx" ON "ProcessoPasso"("processoId");

-- CreateIndex
CREATE INDEX "ProcessoComentario_processoId_idx" ON "ProcessoComentario"("processoId");

-- CreateIndex
CREATE INDEX "ProcessoRecorrente_escritorioId_ativo_idx" ON "ProcessoRecorrente"("escritorioId", "ativo");

-- AddForeignKey
ALTER TABLE "MatrizProcesso" ADD CONSTRAINT "MatrizProcesso_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrizPasso" ADD CONSTRAINT "MatrizPasso_matrizId_fkey" FOREIGN KEY ("matrizId") REFERENCES "MatrizProcesso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_matrizId_fkey" FOREIGN KEY ("matrizId") REFERENCES "MatrizProcesso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessoPasso" ADD CONSTRAINT "ProcessoPasso_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessoComentario" ADD CONSTRAINT "ProcessoComentario_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessoRecorrente" ADD CONSTRAINT "ProcessoRecorrente_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessoRecorrente" ADD CONSTRAINT "ProcessoRecorrente_matrizId_fkey" FOREIGN KEY ("matrizId") REFERENCES "MatrizProcesso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
