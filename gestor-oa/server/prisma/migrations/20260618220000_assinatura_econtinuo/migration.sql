-- AssinaturaDocumento: colunas da "Base de conhecimento do e-Continuo"
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "enviaEmail" TEXT NOT NULL DEFAULT 'Imediato';
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "copiaLocal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "aoReenviar" TEXT NOT NULL DEFAULT 'Rep.D.A.A.';
ALTER TABLE "AssinaturaDocumento" ADD COLUMN "semDemanda" TEXT NOT NULL DEFAULT 'Cria';
