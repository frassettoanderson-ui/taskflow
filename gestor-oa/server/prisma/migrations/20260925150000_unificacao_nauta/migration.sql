-- Unificação com o ERP (Nauta/Atuan): cadastro único de Empresa com contrato, imóvel, filiais e sócios.
ALTER TABLE "Empresa"
  ADD COLUMN "diaVencimento" INTEGER,
  ADD COLUMN "primeiroVencimento" TIMESTAMP(3),
  ADD COLUMN "valorAbertura" DECIMAL(12,2),
  ADD COLUMN "negociacaoObs" TEXT,
  ADD COLUMN "interesse" TEXT,
  ADD COLUMN "emAbertura" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "atividade" TEXT,
  ADD COLUMN "capitalSocial" DECIMAL(14,2),
  ADD COLUMN "inscricaoImobiliaria" TEXT,
  ADD COLUMN "areaOcupada" TEXT,
  ADD COLUMN "areaEdificacao" TEXT,
  ADD COLUMN "proprietarioNome" TEXT,
  ADD COLUMN "proprietarioCpf" TEXT,
  ADD COLUMN "usaGlp" BOOLEAN,
  ADD COLUMN "filiais" JSONB,
  ADD COLUMN "nautaClienteId" TEXT,
  ADD COLUMN "nautaLeadId" TEXT;

CREATE UNIQUE INDEX "Empresa_nautaClienteId_key" ON "Empresa"("nautaClienteId");

CREATE TABLE "EmpresaSocio" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 1,
  "nomeCompleto" TEXT NOT NULL,
  "cpf" TEXT, "rg" TEXT, "nascimento" TEXT, "nomePai" TEXT, "nomeMae" TEXT,
  "participacao" DECIMAL(5,2), "estadoCivil" TEXT, "reciboIrpf" TEXT, "tituloEleitor" TEXT, "senhaGov" TEXT,
  "email" TEXT, "telefone" TEXT, "cep" TEXT, "endereco" TEXT, "bairro" TEXT, "cidadeEstado" TEXT,
  "docUrl" TEXT, "certUrl" TEXT, "certSenha" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmpresaSocio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmpresaSocio_empresaId_idx" ON "EmpresaSocio"("empresaId");
ALTER TABLE "EmpresaSocio" ADD CONSTRAINT "EmpresaSocio_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
