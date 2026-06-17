-- CreateEnum
CREATE TYPE "TipoIdentificador" AS ENUM ('CNPJ', 'CPF', 'INSCRICAO_ESTADUAL', 'CEI', 'CAEPF');

-- CreateTable
CREATE TABLE "Departamento" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#0f5c5e',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#64748b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "emailPrincipal" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "regimeTributarioId" TEXT,
    "anotacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dataEntrada" TIMESTAMP(3),
    "dataSaida" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaTag" (
    "empresaId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "EmpresaTag_pkey" PRIMARY KEY ("empresaId","tagId")
);

-- CreateTable
CREATE TABLE "EmpresaIdentificador" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoIdentificador" NOT NULL,
    "valor" TEXT NOT NULL,
    "apelido" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpresaIdentificador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaResponsavelDepartamento" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "EmpresaResponsavelDepartamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaContato" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT,
    "cargo" TEXT,
    "departamentoIds" JSONB NOT NULL DEFAULT '[]',
    "obrigacaoIds" JSONB NOT NULL DEFAULT '[]',
    "senhaHash" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaContato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaAnexo" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpresaAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaComentario" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT,
    "departamentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpresaComentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Departamento_escritorioId_idx" ON "Departamento"("escritorioId");

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_escritorioId_nome_key" ON "Departamento"("escritorioId", "nome");

-- CreateIndex
CREATE INDEX "Tag_escritorioId_idx" ON "Tag"("escritorioId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_escritorioId_nome_key" ON "Tag"("escritorioId", "nome");

-- CreateIndex
CREATE INDEX "Empresa_escritorioId_deletedAt_idx" ON "Empresa"("escritorioId", "deletedAt");

-- CreateIndex
CREATE INDEX "Empresa_escritorioId_ativo_idx" ON "Empresa"("escritorioId", "ativo");

-- CreateIndex
CREATE INDEX "EmpresaTag_tagId_idx" ON "EmpresaTag"("tagId");

-- CreateIndex
CREATE INDEX "EmpresaIdentificador_empresaId_idx" ON "EmpresaIdentificador"("empresaId");

-- CreateIndex
CREATE INDEX "EmpresaIdentificador_escritorioId_valor_idx" ON "EmpresaIdentificador"("escritorioId", "valor");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaIdentificador_escritorioId_tipo_valor_key" ON "EmpresaIdentificador"("escritorioId", "tipo", "valor");

-- CreateIndex
CREATE INDEX "EmpresaResponsavelDepartamento_escritorioId_idx" ON "EmpresaResponsavelDepartamento"("escritorioId");

-- CreateIndex
CREATE INDEX "EmpresaResponsavelDepartamento_usuarioId_idx" ON "EmpresaResponsavelDepartamento"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaResponsavelDepartamento_empresaId_departamentoId_key" ON "EmpresaResponsavelDepartamento"("empresaId", "departamentoId");

-- CreateIndex
CREATE INDEX "EmpresaContato_empresaId_idx" ON "EmpresaContato"("empresaId");

-- CreateIndex
CREATE INDEX "EmpresaContato_escritorioId_idx" ON "EmpresaContato"("escritorioId");

-- CreateIndex
CREATE INDEX "EmpresaAnexo_empresaId_idx" ON "EmpresaAnexo"("empresaId");

-- CreateIndex
CREATE INDEX "EmpresaComentario_empresaId_idx" ON "EmpresaComentario"("empresaId");

-- AddForeignKey
ALTER TABLE "Departamento" ADD CONSTRAINT "Departamento_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaTag" ADD CONSTRAINT "EmpresaTag_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaTag" ADD CONSTRAINT "EmpresaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaIdentificador" ADD CONSTRAINT "EmpresaIdentificador_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaResponsavelDepartamento" ADD CONSTRAINT "EmpresaResponsavelDepartamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaResponsavelDepartamento" ADD CONSTRAINT "EmpresaResponsavelDepartamento_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaContato" ADD CONSTRAINT "EmpresaContato_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaAnexo" ADD CONSTRAINT "EmpresaAnexo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaComentario" ADD CONSTRAINT "EmpresaComentario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaComentario" ADD CONSTRAINT "EmpresaComentario_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
