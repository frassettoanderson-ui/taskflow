-- Departamento: varios usuarios gestores (multi)
ALTER TABLE "Departamento" ADD COLUMN "gestoresIds" JSONB NOT NULL DEFAULT '[]';

-- Migra o responsavel unico existente para a lista de gestores
UPDATE "Departamento" SET "gestoresIds" = to_jsonb(ARRAY["responsavelId"])
  WHERE "responsavelId" IS NOT NULL;
