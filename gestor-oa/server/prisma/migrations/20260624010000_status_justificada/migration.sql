-- Novo status JUSTIFICADA (pendencia atrasada com justificativa de atraso, fiel ao Acessorias)
ALTER TYPE "StatusEntrega" ADD VALUE IF NOT EXISTS 'JUSTIFICADA' BEFORE 'ENTREGUE';
