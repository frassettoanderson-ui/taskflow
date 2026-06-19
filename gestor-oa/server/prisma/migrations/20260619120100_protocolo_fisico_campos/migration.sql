-- Gestao de protocolos fisicos: titulo, numero ([ID]), data de entrega, default PENDENTE
ALTER TABLE "ProtocoloFisico" ADD COLUMN "titulo" TEXT;
ALTER TABLE "ProtocoloFisico" ADD COLUMN "numero" INTEGER;
ALTER TABLE "ProtocoloFisico" ADD COLUMN "dataEntrega" DATE;
ALTER TABLE "ProtocoloFisico" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
