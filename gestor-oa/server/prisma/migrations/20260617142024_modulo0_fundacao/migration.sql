-- CreateTable
CREATE TABLE "Escritorio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "logoUrl" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Escritorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "horariosAcesso" JSONB NOT NULL DEFAULT '[]',
    "filtrosForcados" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permissao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "empresas_ver" BOOLEAN NOT NULL DEFAULT false,
    "empresas_criar" BOOLEAN NOT NULL DEFAULT false,
    "empresas_editar" BOOLEAN NOT NULL DEFAULT false,
    "empresas_excluir" BOOLEAN NOT NULL DEFAULT false,
    "empresas_importar" BOOLEAN NOT NULL DEFAULT false,
    "obrigacoes_ver" BOOLEAN NOT NULL DEFAULT false,
    "obrigacoes_gerenciar" BOOLEAN NOT NULL DEFAULT false,
    "entregas_ver" BOOLEAN NOT NULL DEFAULT false,
    "entregas_baixar" BOOLEAN NOT NULL DEFAULT false,
    "entregas_editar_prazos" BOOLEAN NOT NULL DEFAULT false,
    "entregas_acoes_massa" BOOLEAN NOT NULL DEFAULT false,
    "entregas_desfazer_robo" BOOLEAN NOT NULL DEFAULT false,
    "entregas_dispensar" BOOLEAN NOT NULL DEFAULT false,
    "processos_ver" BOOLEAN NOT NULL DEFAULT false,
    "processos_gerenciar_matrizes" BOOLEAN NOT NULL DEFAULT false,
    "processos_operar" BOOLEAN NOT NULL DEFAULT false,
    "documentos_ver" BOOLEAN NOT NULL DEFAULT false,
    "documentos_upload" BOOLEAN NOT NULL DEFAULT false,
    "documentos_excluir" BOOLEAN NOT NULL DEFAULT false,
    "relatorios_ver" BOOLEAN NOT NULL DEFAULT false,
    "apla_ver" BOOLEAN NOT NULL DEFAULT false,
    "apla_configurar" BOOLEAN NOT NULL DEFAULT false,
    "portal_comunicados" BOOLEAN NOT NULL DEFAULT false,
    "portal_solicitacoes" BOOLEAN NOT NULL DEFAULT false,
    "portal_configurar" BOOLEAN NOT NULL DEFAULT false,
    "admin_usuarios" BOOLEAN NOT NULL DEFAULT false,
    "admin_permissoes" BOOLEAN NOT NULL DEFAULT false,
    "admin_auditoria" BOOLEAN NOT NULL DEFAULT false,
    "admin_escritorio" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Escritorio_deletedAt_idx" ON "Escritorio"("deletedAt");

-- CreateIndex
CREATE INDEX "Usuario_escritorioId_deletedAt_idx" ON "Usuario"("escritorioId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_escritorioId_email_key" ON "Usuario"("escritorioId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Permissao_usuarioId_key" ON "Permissao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_usuarioId_idx" ON "PasswordResetToken"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_escritorioId_entidade_createdAt_idx" ON "LogAuditoria"("escritorioId", "entidade", "createdAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_escritorioId_usuarioId_idx" ON "LogAuditoria"("escritorioId", "usuarioId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permissao" ADD CONSTRAINT "Permissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
