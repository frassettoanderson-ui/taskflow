-- CreateEnum
CREATE TYPE "OrigemDocumento" AS ENUM ('MANUAL', 'ENTREGA', 'ROBO');

-- CreateEnum
CREATE TYPE "CanalProtocolo" AS ENUM ('EMAIL', 'AREA_VIP', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "StatusProtocoloFisico" AS ENUM ('AGUARDANDO_RETIRADA', 'ENTREGUE', 'DEVOLVIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "DocumentoGED" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "raiz" TEXT NOT NULL DEFAULT 'DocsEmpresa',
    "pasta" TEXT NOT NULL DEFAULT '',
    "nomeArquivo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "mimeType" TEXT,
    "origem" "OrigemDocumento" NOT NULL DEFAULT 'MANUAL',
    "entregaId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoGED_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocolo" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "documentoId" TEXT,
    "token" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "contatoId" TEXT,
    "canal" "CanalProtocolo" NOT NULL DEFAULT 'EMAIL',
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lembreteEnviadoEm" TIMESTAMP(3),

    CONSTRAINT "Protocolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocoloVisualizacao" (
    "id" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "visualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocoloVisualizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocoloFisico" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "retiradoPor" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusProtocoloFisico" NOT NULL DEFAULT 'AGUARDANDO_RETIRADA',
    "assinaturaPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocoloFisico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoGED_escritorioId_empresaId_raiz_idx" ON "DocumentoGED"("escritorioId", "empresaId", "raiz");

-- CreateIndex
CREATE INDEX "DocumentoGED_empresaId_nomeArquivo_idx" ON "DocumentoGED"("empresaId", "nomeArquivo");

-- CreateIndex
CREATE UNIQUE INDEX "Protocolo_token_key" ON "Protocolo"("token");

-- CreateIndex
CREATE INDEX "Protocolo_escritorioId_empresaId_idx" ON "Protocolo"("escritorioId", "empresaId");

-- CreateIndex
CREATE INDEX "Protocolo_documentoId_idx" ON "Protocolo"("documentoId");

-- CreateIndex
CREATE INDEX "ProtocoloVisualizacao_protocoloId_idx" ON "ProtocoloVisualizacao"("protocoloId");

-- CreateIndex
CREATE INDEX "ProtocoloFisico_escritorioId_empresaId_idx" ON "ProtocoloFisico"("escritorioId", "empresaId");

-- AddForeignKey
ALTER TABLE "DocumentoGED" ADD CONSTRAINT "DocumentoGED_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoGED" ADD CONSTRAINT "DocumentoGED_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocolo" ADD CONSTRAINT "Protocolo_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocolo" ADD CONSTRAINT "Protocolo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocolo" ADD CONSTRAINT "Protocolo_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoGED"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocoloVisualizacao" ADD CONSTRAINT "ProtocoloVisualizacao_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "Protocolo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocoloFisico" ADD CONSTRAINT "ProtocoloFisico_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocoloFisico" ADD CONSTRAINT "ProtocoloFisico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
