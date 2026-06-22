-- AlterTable: tarefas agendadas com Dia/Mes/Ano/Tempo/Departamento/Lembrar
ALTER TABLE "EmpresaTarefaAgendada" ALTER COLUMN "dataHora" DROP NOT NULL;
ALTER TABLE "EmpresaTarefaAgendada" ADD COLUMN "tempo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmpresaTarefaAgendada" ADD COLUMN "departamentoId" TEXT;
ALTER TABLE "EmpresaTarefaAgendada" ADD COLUMN "dia" INTEGER;
ALTER TABLE "EmpresaTarefaAgendada" ADD COLUMN "mes" INTEGER;
ALTER TABLE "EmpresaTarefaAgendada" ADD COLUMN "ano" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmpresaTarefaAgendada" ADD COLUMN "lembrarDias" INTEGER;
