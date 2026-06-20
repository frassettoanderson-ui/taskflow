-- Passo compartilhado no portal do cliente (#43)
ALTER TABLE "MatrizPasso" ADD COLUMN "visivelCliente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProcessoPasso" ADD COLUMN "visivelCliente" BOOLEAN NOT NULL DEFAULT false;
