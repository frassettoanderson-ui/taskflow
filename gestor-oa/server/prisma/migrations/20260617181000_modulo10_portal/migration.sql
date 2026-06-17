-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "AutorTipo" AS ENUM ('CONTATO', 'USUARIO');

-- CreateTable
CREATE TABLE "Comunicado" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "regimes" JSONB NOT NULL DEFAULT '[]',
    "publicarEm" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComunicadoLeitura" (
    "id" TEXT NOT NULL,
    "comunicadoId" TEXT NOT NULL,
    "contatoEmail" TEXT NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComunicadoLeitura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoPortal" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "contatoEmail" TEXT NOT NULL,
    "contatoNome" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'ABERTA',
    "prazo" TIMESTAMP(3),
    "avaliacaoNota" INTEGER,
    "avaliacaoComentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoMensagem" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "autorTipo" "AutorTipo" NOT NULL,
    "autorNome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AceiteLGPD" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "contatoEmail" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "ip" TEXT,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AceiteLGPD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContatoToken" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "contatoEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'CONVITE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContatoToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comunicado_escritorioId_ativo_idx" ON "Comunicado"("escritorioId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "ComunicadoLeitura_comunicadoId_contatoEmail_key" ON "ComunicadoLeitura"("comunicadoId", "contatoEmail");

-- CreateIndex
CREATE INDEX "SolicitacaoPortal_escritorioId_status_idx" ON "SolicitacaoPortal"("escritorioId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoPortal_empresaId_idx" ON "SolicitacaoPortal"("empresaId");

-- CreateIndex
CREATE INDEX "SolicitacaoMensagem_solicitacaoId_idx" ON "SolicitacaoMensagem"("solicitacaoId");

-- CreateIndex
CREATE INDEX "AceiteLGPD_escritorioId_contatoEmail_idx" ON "AceiteLGPD"("escritorioId", "contatoEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ContatoToken_tokenHash_key" ON "ContatoToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ContatoToken_contatoEmail_idx" ON "ContatoToken"("contatoEmail");

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicadoLeitura" ADD CONSTRAINT "ComunicadoLeitura_comunicadoId_fkey" FOREIGN KEY ("comunicadoId") REFERENCES "Comunicado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoPortal" ADD CONSTRAINT "SolicitacaoPortal_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoPortal" ADD CONSTRAINT "SolicitacaoPortal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoMensagem" ADD CONSTRAINT "SolicitacaoMensagem_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
