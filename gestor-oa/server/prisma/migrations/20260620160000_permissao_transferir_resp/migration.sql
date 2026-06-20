-- Nova flag de permissao: transferir responsabilidade (Usuarios nivel [2])
ALTER TABLE "Permissao" ADD COLUMN "admin_transferir_resp" BOOLEAN NOT NULL DEFAULT false;

-- Usuarios que ja gerenciam permissoes herdam a transferencia de responsabilidade
UPDATE "Permissao" SET "admin_transferir_resp" = true WHERE "admin_permissoes" = true;
