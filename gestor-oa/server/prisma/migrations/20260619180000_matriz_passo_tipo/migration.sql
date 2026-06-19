-- Itens da matriz [F10]: tipo (passo simples / sub-matriz / desdobramento / follow-up), sub-matriz alvo, config JSON
ALTER TABLE "MatrizPasso" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'PASSO_SIMPLES';
ALTER TABLE "MatrizPasso" ADD COLUMN "subMatrizId" TEXT;
ALTER TABLE "MatrizPasso" ADD COLUMN "config" JSONB;
