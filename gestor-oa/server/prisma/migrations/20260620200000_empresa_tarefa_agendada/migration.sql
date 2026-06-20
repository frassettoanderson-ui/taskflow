-- Tarefas agendadas por empresa
CREATE TABLE "EmpresaTarefaAgendada" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "dataHora" TIMESTAMP(3) NOT NULL,
  "concluida" BOOLEAN NOT NULL DEFAULT false,
  "concluidaEm" TIMESTAMP(3),
  "autorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmpresaTarefaAgendada_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmpresaTarefaAgendada_empresaId_idx" ON "EmpresaTarefaAgendada"("empresaId");
CREATE INDEX "EmpresaTarefaAgendada_escritorioId_dataHora_idx" ON "EmpresaTarefaAgendada"("escritorioId", "dataHora");
ALTER TABLE "EmpresaTarefaAgendada" ADD CONSTRAINT "EmpresaTarefaAgendada_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
