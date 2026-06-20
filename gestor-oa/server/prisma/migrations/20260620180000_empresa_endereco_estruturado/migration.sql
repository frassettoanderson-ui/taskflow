-- Endereco estruturado + grupo de envio (Empresa)
ALTER TABLE "Empresa" ADD COLUMN "cep" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "logradouro" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "numeroEndereco" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "complemento" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "bairro" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "cidade" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "uf" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "grupoEnvio" TEXT;
