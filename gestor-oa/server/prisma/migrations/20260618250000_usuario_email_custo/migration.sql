-- Usuario: dados de e-mail (SMTP) + custo detalhado (salario/encargos/beneficios)
ALTER TABLE "Usuario" ADD COLUMN "salario" DECIMAL(12,2);
ALTER TABLE "Usuario" ADD COLUMN "encargos" DECIMAL(12,2);
ALTER TABLE "Usuario" ADD COLUMN "beneficios" DECIMAL(12,2);
ALTER TABLE "Usuario" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "smtpPorta" INTEGER;
ALTER TABLE "Usuario" ADD COLUMN "smtpUsuario" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "smtpSenha" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "ccoEmails" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "assinaturaArquivo" TEXT;
