-- Gestao de protocolos fisicos (estilo Acessorias): novos status do enum
-- (ADD VALUE precisa estar isolado: nao pode ser usado na mesma transacao)
ALTER TYPE "StatusProtocoloFisico" ADD VALUE IF NOT EXISTS 'PENDENTE';
ALTER TYPE "StatusProtocoloFisico" ADD VALUE IF NOT EXISTS 'IMPRESSO';
