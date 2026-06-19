-- Gestao de processos [F10]: numero ([ID]), titulo, observacoes, gestor, depto, previsao/conclusao
ALTER TABLE "Processo" ADD COLUMN "numero" INTEGER;
ALTER TABLE "Processo" ADD COLUMN "titulo" TEXT;
ALTER TABLE "Processo" ADD COLUMN "observacoes" TEXT;
ALTER TABLE "Processo" ADD COLUMN "departamentoId" TEXT;
ALTER TABLE "Processo" ADD COLUMN "gestorId" TEXT;
ALTER TABLE "Processo" ADD COLUMN "previsaoConclusao" TIMESTAMP(3);
ALTER TABLE "Processo" ADD COLUMN "dataConclusao" TIMESTAMP(3);
