-- Grupo de empresas
CREATE TABLE "GrupoEmpresa" (
  "id" TEXT NOT NULL,
  "escritorioId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrupoEmpresa_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GrupoEmpresa_escritorioId_idx" ON "GrupoEmpresa"("escritorioId");
ALTER TABLE "GrupoEmpresa" ADD CONSTRAINT "GrupoEmpresa_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Empresa" ADD COLUMN "grupoEmpresaId" TEXT;
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_grupoEmpresaId_fkey" FOREIGN KEY ("grupoEmpresaId") REFERENCES "GrupoEmpresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
