-- Obrigacao: campos para replicar o cadastro do Acessorias

ALTER TABLE "Obrigacao" ADD COLUMN "mininome" TEXT;
ALTER TABLE "Obrigacao" ADD COLUMN "responsavelId" TEXT;
ALTER TABLE "Obrigacao" ADD COLUMN "entregaMeses" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Obrigacao" ADD COLUMN "lembrarDiasAntes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Obrigacao" ADD COLUMN "competenciaRef" TEXT NOT NULL DEFAULT 'MES_ANTERIOR';
ALTER TABLE "Obrigacao" ADD COLUMN "passivelMulta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Obrigacao" ADD COLUMN "alertaNaoLida" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Obrigacao" ADD COLUMN "comentarioPadrao" TEXT;
