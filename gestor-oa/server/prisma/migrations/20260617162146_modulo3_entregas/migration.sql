-- CreateEnum
CREATE TYPE "StatusEntrega" AS ENUM ('PENDENTE', 'PENDENTE_ANTECIPADO', 'EM_ATRASO_TECNICO', 'EM_ATRASO_LEGAL', 'ENTREGUE', 'ENTREGUE_JUSTIFICADA', 'DISPENSADA');

-- CreateEnum
CREATE TYPE "OrigemBaixa" AS ENUM ('MANUAL', 'ROBO');

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "empresaObrigacaoId" TEXT NOT NULL,
    "obrigacaoId" TEXT NOT NULL,
    "competenciaAno" INTEGER NOT NULL,
    "competenciaMes" INTEGER NOT NULL,
    "prazoLegal" DATE NOT NULL,
    "prazoTecnico" DATE NOT NULL,
    "status" "StatusEntrega" NOT NULL DEFAULT 'PENDENTE',
    "responsavelPrazoId" TEXT,
    "responsavelEntregaId" TEXT,
    "dataEntrega" TIMESTAMP(3),
    "justificativa" TEXT,
    "motivoDispensa" TEXT,
    "origemBaixa" "OrigemBaixa",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaAnexo" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaComentario" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaComentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entrega_escritorioId_competenciaAno_competenciaMes_idx" ON "Entrega"("escritorioId", "competenciaAno", "competenciaMes");

-- CreateIndex
CREATE INDEX "Entrega_escritorioId_status_idx" ON "Entrega"("escritorioId", "status");

-- CreateIndex
CREATE INDEX "Entrega_escritorioId_prazoLegal_idx" ON "Entrega"("escritorioId", "prazoLegal");

-- CreateIndex
CREATE INDEX "Entrega_responsavelPrazoId_idx" ON "Entrega"("responsavelPrazoId");

-- CreateIndex
CREATE INDEX "Entrega_responsavelEntregaId_idx" ON "Entrega"("responsavelEntregaId");

-- CreateIndex
CREATE INDEX "Entrega_empresaId_idx" ON "Entrega"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Entrega_empresaId_obrigacaoId_competenciaAno_competenciaMes_key" ON "Entrega"("empresaId", "obrigacaoId", "competenciaAno", "competenciaMes");

-- CreateIndex
CREATE INDEX "EntregaAnexo_entregaId_idx" ON "EntregaAnexo"("entregaId");

-- CreateIndex
CREATE INDEX "EntregaComentario_entregaId_idx" ON "EntregaComentario"("entregaId");

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_empresaObrigacaoId_fkey" FOREIGN KEY ("empresaObrigacaoId") REFERENCES "EmpresaObrigacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_obrigacaoId_fkey" FOREIGN KEY ("obrigacaoId") REFERENCES "Obrigacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaAnexo" ADD CONSTRAINT "EntregaAnexo_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaComentario" ADD CONSTRAINT "EntregaComentario_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
