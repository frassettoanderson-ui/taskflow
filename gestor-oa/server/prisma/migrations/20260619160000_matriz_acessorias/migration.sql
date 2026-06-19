-- Matriz de processos [F10]: so sub-matriz, pede autorizacao, barra vermelha apos (dias)
ALTER TABLE "MatrizProcesso" ADD COLUMN "soSubmatriz" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatrizProcesso" ADD COLUMN "pedeAutorizacao" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MatrizProcesso" ADD COLUMN "barraVermelhaDias" INTEGER NOT NULL DEFAULT 45;
