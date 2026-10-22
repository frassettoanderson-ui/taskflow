-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "cnaes" TEXT;

-- AlterTable
ALTER TABLE "Permissao" ADD COLUMN     "alvaras_operar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alvaras_ver" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Licenca" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT,
    "clienteNome" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'Alvará de Funcionamento',
    "orgao" TEXT,
    "protocolo" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'Em preparação',
    "emissao" DATE,
    "validade" DATE,
    "responsavel" TEXT,
    "taxa" DECIMAL(12,2),
    "observacao" TEXT,
    "inativo" BOOLEAN NOT NULL DEFAULT false,
    "inativoEm" DATE,
    "inativoMotivo" TEXT,
    "legadoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Licenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlvConfig" (
    "escritorioId" TEXT NOT NULL,
    "parametros" JSONB NOT NULL DEFAULT '{}',
    "checklists" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlvConfig_pkey" PRIMARY KEY ("escritorioId")
);

-- CreateTable
CREATE TABLE "AlvHistorico" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "licencaId" TEXT,
    "legalizacaoId" TEXT,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "acao" TEXT NOT NULL,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlvHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Licenca_escritorioId_inativo_idx" ON "Licenca"("escritorioId", "inativo");

-- CreateIndex
CREATE INDEX "Licenca_empresaId_idx" ON "Licenca"("empresaId");

-- CreateIndex
CREATE INDEX "AlvHistorico_escritorioId_createdAt_idx" ON "AlvHistorico"("escritorioId", "createdAt");

-- AddForeignKey
ALTER TABLE "Licenca" ADD CONSTRAINT "Licenca_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Tabelas novas criadas como postgres: o usuario da aplicacao precisa ser dono
ALTER TABLE "Licenca" OWNER TO gestoroa;
ALTER TABLE "AlvConfig" OWNER TO gestoroa;
ALTER TABLE "AlvHistorico" OWNER TO gestoroa;

-- Permissoes de Alvaras: mesmo nivel do Societario
UPDATE "Permissao" SET "alvaras_ver" = "societario_ver", "alvaras_operar" = "societario_operar";
UPDATE "Permissao" SET "niveis" = jsonb_set("niveis", '{alvaras}', to_jsonb(CASE WHEN "alvaras_operar" THEN 2 WHEN "alvaras_ver" THEN 1 ELSE 0 END))
  WHERE "niveis" IS NOT NULL AND "niveis" <> '{}'::jsonb;
