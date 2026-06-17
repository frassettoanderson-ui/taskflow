import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Metrica padrao { count, pct } - zerada ate o Modulo 3 (Entregas) existir.
const zero = () => ({ count: 0, pct: 0 });
const metricasEntrega = () => ({
  pendenteAntecipado: zero(),
  pendenteNoPrazo: zero(),
  entregueNoPrazo: zero(),
  entregueComMulta: zero(),
});

// Painel de Indicadores - retorna as 3 visoes (colaborador / departamento / numericos).
// NOTA: as metricas de entregas serao calculadas a partir do Modulo 3.
// Por ora retornamos a estrutura com listas reais (colaboradores/departamentos)
// e contadores zerados, exceto "empresas" que ja' e' real.
router.get('/painel', async (req, res) => {
  const escritorioId = req.auth!.escritorioId;

  const [usuarios, departamentos, totalEmpresas] = await Promise.all([
    prisma.usuario.findMany({
      where: { escritorioId, deletedAt: null, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.departamento.findMany({
      where: { escritorioId, ativo: true },
      select: { id: true, nome: true, cor: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.empresa.count({ where: { escritorioId, deletedAt: null } }),
  ]);

  return ok(res, {
    periodo: 'Semana atual',
    colaboradores: usuarios.map((u) => ({
      id: u.id,
      nome: u.nome,
      metricas: metricasEntrega(),
    })),
    departamentos: departamentos.map((d) => ({
      id: d.id,
      nome: d.nome,
      cor: d.cor,
      metricas: metricasEntrega(),
    })),
    numericos: {
      entregas: {
        total: 0,
        antecipadas: zero(),
        prazoTecnico: zero(),
        atrasadas: zero(),
        comMulta: zero(),
        atrasoJustificado: zero(),
      },
      aRealizar: {
        total: 0,
        prazoAntecipado: zero(),
        prazoTecnico: zero(),
        atrasoLegal: zero(),
        comMulta: zero(),
        atrasoJustificado: zero(),
      },
      docs: { total: 0, lidos: zero(), naoLidos: zero() },
      processos: {
        total: 0,
        iniciados: zero(),
        concluidos: zero(),
        passosOk: zero(),
        followups: zero(),
      },
      solicitacoes: {
        total: 0,
        abertas: 0,
        finalizadas: 0,
        aguardando: 0,
        resolvendo: 0,
        mediaAvaliacoes: 0,
      },
      empresas: totalEmpresas,
    },
  });
});

export default router;
