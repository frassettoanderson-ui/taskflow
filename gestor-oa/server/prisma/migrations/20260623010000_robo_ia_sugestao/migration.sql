-- Sugestao da IA para itens em revisao do robo e-Continuo
ALTER TABLE "RoboJob" ADD COLUMN "iaObrigacao" TEXT;
ALTER TABLE "RoboJob" ADD COLUMN "iaPalavras" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "RoboJob" ADD COLUMN "iaConfianca" DOUBLE PRECISION;
