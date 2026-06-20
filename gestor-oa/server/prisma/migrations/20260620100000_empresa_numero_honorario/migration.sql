-- Empresa: [ID] numerico sequencial, honorario e apelido e-Continuo
ALTER TABLE "Empresa" ADD COLUMN "numero" INTEGER;
ALTER TABLE "Empresa" ADD COLUMN "honorario" DECIMAL(12,2);
ALTER TABLE "Empresa" ADD COLUMN "apelidoEcontinuo" TEXT;

-- backfill: numera as empresas existentes por escritorio (ordem de criacao)
WITH numeradas AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "escritorioId" ORDER BY "createdAt" ASC) AS rn
  FROM "Empresa"
)
UPDATE "Empresa" e SET "numero" = n.rn FROM numeradas n WHERE e.id = n.id;
