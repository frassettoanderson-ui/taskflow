-- AlterTable
ALTER TABLE "Permissao" ADD COLUMN     "mei_operar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mei_ver" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Mei" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT,
    "apelido" TEXT,
    "codigo" TEXT,
    "cnpj" TEXT,
    "ocupacao" TEXT,
    "atividade" TEXT NOT NULL DEFAULT 'servicos',
    "situacao" TEXT NOT NULL DEFAULT 'Ativo',
    "abertura" DATE,
    "temEmpregado" BOOLEAN NOT NULL DEFAULT false,
    "honorario" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "honorarioHist" JSONB NOT NULL DEFAULT '{}',
    "comissaoPct" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "comissaoPctHist" JSONB NOT NULL DEFAULT '{}',
    "honPago" JSONB NOT NULL DEFAULT '{}',
    "observacao" TEXT,
    "inativoEm" DATE,
    "inativoMotivo" TEXT,
    "simeiBaixa" TEXT,
    "simeiBaixaEm" DATE,
    "legadoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mei_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeiLancamento" (
    "id" TEXT NOT NULL,
    "meiId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "competencia" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "automatico" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeiLancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeiDas" (
    "id" TEXT NOT NULL,
    "meiId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'Em aberto',
    "pagoEm" DATE,
    "parcelamentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeiDas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeiDasn" (
    "id" TEXT NOT NULL,
    "meiId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'Pendente',
    "entregueEm" DATE,
    "receitaInformada" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeiDasn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeiParcelamento" (
    "id" TEXT NOT NULL,
    "meiId" TEXT NOT NULL,
    "competencias" JSONB NOT NULL,
    "principal" DECIMAL(12,2) NOT NULL,
    "juros" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "parcelas" INTEGER NOT NULL,
    "valorParcela" DECIMAL(12,2) NOT NULL,
    "valorPrimeira" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "parcelasPagas" INTEGER NOT NULL DEFAULT 0,
    "adesao" DATE,
    "protocolo" TEXT,
    "observacao" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'Ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeiParcelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeiConfig" (
    "escritorioId" TEXT NOT NULL,
    "salarioMinimo" JSONB NOT NULL DEFAULT '{}',
    "limiteAnual" DECIMAL(12,2) NOT NULL DEFAULT 81000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeiConfig_pkey" PRIMARY KEY ("escritorioId")
);

-- CreateTable
CREATE TABLE "MeiHistorico" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "meiId" TEXT,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "acao" TEXT NOT NULL,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeiHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mei_escritorioId_situacao_idx" ON "Mei"("escritorioId", "situacao");

-- CreateIndex
CREATE INDEX "MeiLancamento_meiId_competencia_idx" ON "MeiLancamento"("meiId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "MeiDas_meiId_competencia_key" ON "MeiDas"("meiId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "MeiDasn_meiId_ano_key" ON "MeiDasn"("meiId", "ano");

-- CreateIndex
CREATE INDEX "MeiHistorico_escritorioId_createdAt_idx" ON "MeiHistorico"("escritorioId", "createdAt");

-- AddForeignKey
ALTER TABLE "Mei" ADD CONSTRAINT "Mei_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeiLancamento" ADD CONSTRAINT "MeiLancamento_meiId_fkey" FOREIGN KEY ("meiId") REFERENCES "Mei"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeiDas" ADD CONSTRAINT "MeiDas_meiId_fkey" FOREIGN KEY ("meiId") REFERENCES "Mei"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeiDasn" ADD CONSTRAINT "MeiDasn_meiId_fkey" FOREIGN KEY ("meiId") REFERENCES "Mei"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeiParcelamento" ADD CONSTRAINT "MeiParcelamento_meiId_fkey" FOREIGN KEY ("meiId") REFERENCES "Mei"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tabelas novas criadas como postgres: o usuario da aplicacao precisa ser dono
ALTER TABLE "Mei" OWNER TO gestoroa;
ALTER TABLE "MeiLancamento" OWNER TO gestoroa;
ALTER TABLE "MeiDas" OWNER TO gestoroa;
ALTER TABLE "MeiDasn" OWNER TO gestoroa;
ALTER TABLE "MeiParcelamento" OWNER TO gestoroa;
ALTER TABLE "MeiConfig" OWNER TO gestoroa;
ALTER TABLE "MeiHistorico" OWNER TO gestoroa;

-- Permissoes do MEI: mesmo nivel do Societario
UPDATE "Permissao" SET "mei_ver" = "societario_ver", "mei_operar" = "societario_operar";
UPDATE "Permissao" SET "niveis" = jsonb_set("niveis", '{mei}', to_jsonb(CASE WHEN "mei_operar" THEN 2 WHEN "mei_ver" THEN 1 ELSE 0 END))
  WHERE "niveis" IS NOT NULL AND "niveis" <> '{}'::jsonb;
