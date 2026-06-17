-- CreateEnum
CREATE TYPE "TipoTemplate" AS ENUM ('ENTREGA', 'LEMBRETE', 'COMUNICADO', 'GENERICO');

-- CreateEnum
CREATE TYPE "CanalComunicacao" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "StatusComunicacao" AS ENUM ('FILA', 'ENVIADO', 'FALHOU', 'LIDO', 'INTENCAO');

-- CreateTable
CREATE TABLE "TemplateEmail" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "tipo" "TipoTemplate" NOT NULL DEFAULT 'GENERICO',
    "nome" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComunicacaoLog" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT,
    "canal" "CanalComunicacao" NOT NULL,
    "destinatario" TEXT NOT NULL,
    "assunto" TEXT,
    "conteudo" TEXT,
    "status" "StatusComunicacao" NOT NULL DEFAULT 'FILA',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "responsavelId" TEXT,
    "protocoloId" TEXT,
    "loteId" TEXT,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),

    CONSTRAINT "ComunicacaoLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotFluxo" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "arvore" JSONB NOT NULL DEFAULT '{}',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotFluxo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateEmail_escritorioId_tipo_idx" ON "TemplateEmail"("escritorioId", "tipo");

-- CreateIndex
CREATE INDEX "ComunicacaoLog_escritorioId_createdAt_idx" ON "ComunicacaoLog"("escritorioId", "createdAt");

-- CreateIndex
CREATE INDEX "ComunicacaoLog_empresaId_idx" ON "ComunicacaoLog"("empresaId");

-- CreateIndex
CREATE INDEX "ComunicacaoLog_loteId_idx" ON "ComunicacaoLog"("loteId");

-- CreateIndex
CREATE INDEX "ChatbotFluxo_escritorioId_idx" ON "ChatbotFluxo"("escritorioId");

-- AddForeignKey
ALTER TABLE "TemplateEmail" ADD CONSTRAINT "TemplateEmail_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicacaoLog" ADD CONSTRAINT "ComunicacaoLog_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicacaoLog" ADD CONSTRAINT "ComunicacaoLog_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotFluxo" ADD CONSTRAINT "ChatbotFluxo_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
