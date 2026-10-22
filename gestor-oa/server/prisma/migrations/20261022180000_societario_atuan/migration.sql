-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "carteiraMei" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "frente" TEXT,
ADD COLUMN     "legadoAtuanId" TEXT,
ADD COLUMN     "naCarteira" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Permissao" ADD COLUMN     "societario_operar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "societario_ver" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SocProcesso" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT,
    "codigo" TEXT NOT NULL,
    "grupo" TEXT,
    "servico" TEXT NOT NULL,
    "natureza" TEXT NOT NULL DEFAULT '',
    "etapa" TEXT NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'Em análise',
    "responsavel" TEXT,
    "dependeDe" TEXT NOT NULL DEFAULT 'Escritório',
    "prazo" DATE,
    "proximaAcao" TEXT,
    "honorario" DECIMAL(12,2),
    "honorarioSit" TEXT NOT NULL DEFAULT 'Não informado',
    "cpf" TEXT,
    "senhaGov" TEXT,
    "observacao" TEXT,
    "protocoloRegin" TEXT,
    "requerimento" TEXT,
    "pagamentoFeito" BOOLEAN NOT NULL DEFAULT false,
    "mudaEndereco" BOOLEAN NOT NULL DEFAULT false,
    "mudaAtividade" BOOLEAN NOT NULL DEFAULT false,
    "mudaMunicipio" BOOLEAN NOT NULL DEFAULT false,
    "baixaCadEconomico" BOOLEAN,
    "baixaCadEconomicoEm" DATE,
    "foraDoQuadro" BOOLEAN NOT NULL DEFAULT false,
    "ocultoAte" TIMESTAMP(3),
    "checklistDe" TEXT,
    "concluidoEm" TIMESTAMP(3),
    "encaminhadoEm" TIMESTAMP(3),
    "origemFormularioId" TEXT,
    "legadoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocProcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocChecklistItem" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "etapa" TEXT NOT NULL,
    "tarefa" TEXT NOT NULL,
    "feito" BOOLEAN NOT NULL DEFAULT false,
    "na" BOOLEAN NOT NULL DEFAULT false,
    "nota" TEXT,

    CONSTRAINT "SocChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocHistorico" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "processoId" TEXT,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "acao" TEXT NOT NULL,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocFormulario" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "servidorId" TEXT,
    "protocolo" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TEXT,
    "servico" TEXT NOT NULL,
    "empresaNome" TEXT NOT NULL,
    "contato" TEXT,
    "telefone" TEXT,
    "dados" JSONB NOT NULL,
    "documentoArquivo" TEXT,
    "documentoNome" TEXT,
    "documentoTipo" TEXT,
    "documentoTamanho" INTEGER,
    "processoId" TEXT,
    "empresaId" TEXT,
    "empresaNova" BOOLEAN NOT NULL DEFAULT false,
    "aprovadoEm" TIMESTAMP(3),
    "aprovadoPor" TEXT,
    "legadoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocFormulario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Legalizacao" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT,
    "clienteNome" TEXT,
    "processoId" TEXT,
    "licencaId" TEXT,
    "paiId" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'Alvará de Funcionamento',
    "orgao" TEXT,
    "protocolo" TEXT,
    "tipoProcesso" TEXT NOT NULL DEFAULT 'Manual',
    "prazo" DATE,
    "vencimento" DATE,
    "etapa" TEXT NOT NULL DEFAULT 'A iniciar',
    "observacao" TEXT,
    "alvarasPrevistos" JSONB,
    "alvarasGerados" JSONB,
    "ocultoNoIniciar" BOOLEAN NOT NULL DEFAULT false,
    "taxaPaga" BOOLEAN NOT NULL DEFAULT false,
    "taxaPagaEm" DATE,
    "concluidoEm" TIMESTAMP(3),
    "renovadoEm" DATE,
    "licencaCriada" BOOLEAN NOT NULL DEFAULT false,
    "validadeAnterior" TEXT,
    "situacaoAnterior" TEXT,
    "obsAnterior" TEXT,
    "inativo" BOOLEAN NOT NULL DEFAULT false,
    "inativoEm" DATE,
    "inativoMotivo" TEXT,
    "responsavel" TEXT,
    "legadoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Legalizacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocProcesso_escritorioId_situacao_idx" ON "SocProcesso"("escritorioId", "situacao");

-- CreateIndex
CREATE INDEX "SocProcesso_empresaId_idx" ON "SocProcesso"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "SocProcesso_escritorioId_codigo_key" ON "SocProcesso"("escritorioId", "codigo");

-- CreateIndex
CREATE INDEX "SocChecklistItem_processoId_idx" ON "SocChecklistItem"("processoId");

-- CreateIndex
CREATE INDEX "SocHistorico_escritorioId_createdAt_idx" ON "SocHistorico"("escritorioId", "createdAt");

-- CreateIndex
CREATE INDEX "SocHistorico_processoId_idx" ON "SocHistorico"("processoId");

-- CreateIndex
CREATE INDEX "SocFormulario_escritorioId_recebidoEm_idx" ON "SocFormulario"("escritorioId", "recebidoEm");

-- CreateIndex
CREATE UNIQUE INDEX "SocFormulario_escritorioId_servidorId_key" ON "SocFormulario"("escritorioId", "servidorId");

-- CreateIndex
CREATE INDEX "Legalizacao_escritorioId_etapa_idx" ON "Legalizacao"("escritorioId", "etapa");

-- CreateIndex
CREATE INDEX "Legalizacao_processoId_idx" ON "Legalizacao"("processoId");

-- AddForeignKey
ALTER TABLE "SocProcesso" ADD CONSTRAINT "SocProcesso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocChecklistItem" ADD CONSTRAINT "SocChecklistItem_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "SocProcesso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocHistorico" ADD CONSTRAINT "SocHistorico_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "SocProcesso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Legalizacao" ADD CONSTRAINT "Legalizacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Tabelas novas criadas como postgres: o usuario da aplicacao precisa ser dono
ALTER TABLE "SocProcesso" OWNER TO gestoroa;
ALTER TABLE "SocChecklistItem" OWNER TO gestoroa;
ALTER TABLE "SocHistorico" OWNER TO gestoroa;
ALTER TABLE "SocFormulario" OWNER TO gestoroa;
ALTER TABLE "Legalizacao" OWNER TO gestoroa;

-- Permissoes do Societario para quem ja opera processos (mesmo nivel)
UPDATE "Permissao" SET "societario_ver" = true WHERE "processos_ver" = true OR "empresas_ver" = true;
UPDATE "Permissao" SET "societario_operar" = true WHERE "processos_operar" = true;
UPDATE "Permissao" SET "niveis" = jsonb_set(COALESCE("niveis", '{}'::jsonb), '{societario}', to_jsonb(CASE WHEN "societario_operar" THEN 2 WHEN "societario_ver" THEN 1 ELSE 0 END))
  WHERE "niveis" IS NOT NULL AND "niveis" <> '{}'::jsonb;
