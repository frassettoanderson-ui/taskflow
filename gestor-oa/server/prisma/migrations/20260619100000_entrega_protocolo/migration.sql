-- Entrega: numero do protocolo de entrega + vencimento (caso seja guia)
ALTER TABLE "Entrega" ADD COLUMN "numeroProtocolo" TEXT;
ALTER TABLE "Entrega" ADD COLUMN "vencimentoGuia" DATE;
