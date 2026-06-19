-- Usuario: dados do "meu perfil" (foto + notificacoes por e-mail)
ALTER TABLE "Usuario" ADD COLUMN "fotoPerfilArquivo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "notifSolicitacoesEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Usuario" ADD COLUMN "notifMarketingEmail" BOOLEAN NOT NULL DEFAULT true;
