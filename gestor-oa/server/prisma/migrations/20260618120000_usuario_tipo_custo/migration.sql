-- Usuario: tipo/cargo, telefone, observacoes e configuracao de custo (APLA)

ALTER TABLE "Usuario" ADD COLUMN "tipo" TEXT DEFAULT 'Auxiliar';
ALTER TABLE "Usuario" ADD COLUMN "telefone" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "observacoes" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "custoHora" DECIMAL(12,2);
ALTER TABLE "Usuario" ADD COLUMN "minutosUteisMes" INTEGER;
