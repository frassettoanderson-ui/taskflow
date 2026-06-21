-- AlterTable: novos campos do feriado (Dia/Mes/Ano + Cidades)
ALTER TABLE "Feriado" ADD COLUMN "dia" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Feriado" ADD COLUMN "mes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Feriado" ADD COLUMN "ano" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Feriado" ADD COLUMN "cidades" TEXT;

-- Backfill a partir da data existente
UPDATE "Feriado"
   SET "dia" = EXTRACT(DAY FROM "data")::int,
       "mes" = EXTRACT(MONTH FROM "data")::int,
       "ano" = EXTRACT(YEAR FROM "data")::int
 WHERE "data" IS NOT NULL;

-- data passa a ser opcional (null = feriado recorrente)
ALTER TABLE "Feriado" ALTER COLUMN "data" DROP NOT NULL;
