-- AlterTable: campos fiscais/inscricoes da empresa
ALTER TABLE "Empresa" ADD COLUMN "nire" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "inscricaoMunicipal" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "inscMunicipalData" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "website" TEXT;
ALTER TABLE "Empresa" ADD COLUMN "ieIsenta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Empresa" ADD COLUMN "inscricoesEstaduais" JSONB;
ALTER TABLE "Empresa" ADD COLUMN "dataAbertura" TIMESTAMP(3);
