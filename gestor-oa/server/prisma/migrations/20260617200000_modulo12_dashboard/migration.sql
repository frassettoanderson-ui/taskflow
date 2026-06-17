-- Modulo 12: Tela de Insights (dashboard configuravel por usuario)

CREATE TABLE "DashboardConfig" (
    "id" TEXT NOT NULL,
    "escritorioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardConfig_usuarioId_key" ON "DashboardConfig"("usuarioId");
CREATE INDEX "DashboardConfig_escritorioId_idx" ON "DashboardConfig"("escritorioId");

ALTER TABLE "DashboardConfig" ADD CONSTRAINT "DashboardConfig_escritorioId_fkey" FOREIGN KEY ("escritorioId") REFERENCES "Escritorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
