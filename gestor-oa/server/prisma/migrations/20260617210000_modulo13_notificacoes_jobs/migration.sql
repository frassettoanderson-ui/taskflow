-- Modulo 13: Notificacoes/Alertas + Jobs (scheduler)

CREATE TYPE "TipoNotificacao" AS ENUM ('ENTREGA_ATRASADA', 'PRAZO_PROXIMO', 'PROTOCOLO_NAO_LIDO', 'SOLICITACAO', 'PROCESSO', 'SISTEMA');

CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL DEFAULT 'SISTEMA',
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "link" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lidaEm" TIMESTAMP(3),
    "chave" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notificacao_usuarioId_chave_key" ON "Notificacao"("usuarioId", "chave");
CREATE INDEX "Notificacao_escritorioId_usuarioId_lida_idx" ON "Notificacao"("escritorioId", "usuarioId", "lida");
CREATE INDEX "Notificacao_usuarioId_createdAt_idx" ON "Notificacao"("usuarioId", "createdAt");

ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "JobExecucao" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT,
    "job" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "itens" INTEGER NOT NULL DEFAULT 0,
    "duracaoMs" INTEGER NOT NULL DEFAULT 0,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobExecucao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobExecucao_job_createdAt_idx" ON "JobExecucao"("job", "createdAt");
CREATE INDEX "JobExecucao_escritorioId_createdAt_idx" ON "JobExecucao"("escritorioId", "createdAt");

ALTER TABLE "JobExecucao" ADD CONSTRAINT "JobExecucao_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
