-- Permissao: niveis por area (estilo Acessorias); flags continuam derivadas
ALTER TABLE "Permissao" ADD COLUMN "niveis" JSONB NOT NULL DEFAULT '{}';
