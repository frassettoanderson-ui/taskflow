-- AssinaturaDocumento: campos da tela de edicao (entrega automatizada)
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "miniNomeLocal" TEXT;
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "caminhoLocal" TEXT;
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "anteciparVcto" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "msgAlertaAntecipado" TEXT;
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "consideraVcto" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "obrigacoesCorrespondentes" JSONB NOT NULL DEFAULT '[]';

-- Migra a obrigacao unica existente para a lista de correspondentes
UPDATE "AssinaturaDocumento" SET "obrigacoesCorrespondentes" = to_jsonb(ARRAY["obrigacaoNome"])
  WHERE "obrigacaoNome" <> '';
