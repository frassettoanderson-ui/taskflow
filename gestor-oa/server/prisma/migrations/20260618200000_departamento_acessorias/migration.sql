-- Departamento: campos da tela "Gestao de departamentos" (Acessorias)
ALTER TABLE "Departamento" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Departamento" ADD COLUMN "envioAgendado" TEXT NOT NULL DEFAULT 'De hora em hora';
ALTER TABLE "Departamento" ADD COLUMN "disponivelSolicitacoes" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Departamento" ADD COLUMN "responderPara" TEXT;

ALTER TABLE "Departamento"
  ADD CONSTRAINT "Departamento_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
