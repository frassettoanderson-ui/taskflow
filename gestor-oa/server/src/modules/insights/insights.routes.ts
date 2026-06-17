import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { statusEfetivo, type StatusEntrega } from '../entrega/entrega.status.js';
import { computarDados } from './insights.service.js';

const router = Router();
router.use(authenticate);

// ---------- Modulo 12: dashboard configuravel ----------
// Catalogo dos widgets disponiveis (id = tipo). O front sabe renderizar cada um.
const WIDGETS_DISPONIVEIS = [
  { tipo: 'kpi_empresas', titulo: 'Empresas ativas', grupo: 'Indicadores' },
  { tipo: 'kpi_entregas_baixadas', titulo: 'Entregas baixadas (mes)', grupo: 'Indicadores' },
  { tipo: 'kpi_a_realizar', titulo: 'A realizar (mes)', grupo: 'Indicadores' },
  { tipo: 'kpi_atrasadas', titulo: 'Atrasadas (mes)', grupo: 'Indicadores' },
  { tipo: 'kpi_processos', titulo: 'Processos em andamento', grupo: 'Indicadores' },
  { tipo: 'kpi_solicitacoes', titulo: 'Solicitacoes em aberto', grupo: 'Indicadores' },
  { tipo: 'kpi_docs', titulo: 'Documentos no GED', grupo: 'Indicadores' },
  { tipo: 'chart_entregas_status', titulo: 'Entregas por status (pizza)', grupo: 'Graficos' },
  { tipo: 'chart_por_departamento', titulo: 'Entregas por departamento', grupo: 'Graficos' },
  { tipo: 'chart_por_colaborador', titulo: 'Entregas por colaborador', grupo: 'Graficos' },
  { tipo: 'chart_evolucao', titulo: 'Evolucao mensal', grupo: 'Graficos' },
  { tipo: 'list_top_pendencias', titulo: 'Top empresas com pendencias', grupo: 'Listas' },
];

// Layout padrao para quem ainda nao personalizou.
const LAYOUT_PADRAO = [
  { id: 'w1', tipo: 'kpi_empresas', w: 1 },
  { id: 'w2', tipo: 'kpi_entregas_baixadas', w: 1 },
  { id: 'w3', tipo: 'kpi_a_realizar', w: 1 },
  { id: 'w4', tipo: 'kpi_atrasadas', w: 1 },
  { id: 'w5', tipo: 'chart_entregas_status', w: 1 },
  { id: 'w6', tipo: 'chart_evolucao', w: 1 },
  { id: 'w7', tipo: 'chart_por_departamento', w: 1 },
  { id: 'w8', tipo: 'list_top_pendencias', w: 1 },
];

router.get('/dashboard', async (req, res) => {
  const cfg = await prisma.dashboardConfig.findUnique({ where: { usuarioId: req.auth!.id } });
  const layout = cfg && Array.isArray(cfg.layout) && (cfg.layout as unknown[]).length > 0 ? cfg.layout : LAYOUT_PADRAO;
  return ok(res, { layout, disponiveis: WIDGETS_DISPONIVEIS });
});

const layoutSchema = z.object({
  layout: z.array(z.object({ id: z.string(), tipo: z.string(), w: z.number().int().min(1).max(2).default(1) })),
});
router.put('/dashboard', validate({ body: layoutSchema }), async (req, res) => {
  const cfg = await prisma.dashboardConfig.upsert({
    where: { usuarioId: req.auth!.id },
    create: { escritorioId: req.auth!.escritorioId, usuarioId: req.auth!.id, layout: req.body.layout },
    update: { layout: req.body.layout },
  });
  return ok(res, cfg);
});

router.get('/dados', async (req, res) => {
  const meses = Math.min(12, Math.max(3, Number(req.query.meses ?? 6) || 6));
  const dados = await computarDados(req.auth!.escritorioId, meses);
  return ok(res, dados);
});

interface Acc {
  pendenteAntecipado: number;
  pendenteNoPrazo: number;
  entregueNoPrazo: number;
  entregueComMulta: number;
}
const novoAcc = (): Acc => ({ pendenteAntecipado: 0, pendenteNoPrazo: 0, entregueNoPrazo: 0, entregueComMulta: 0 });

function classificar(acc: Acc, status: StatusEntrega) {
  if (status === 'PENDENTE_ANTECIPADO') acc.pendenteAntecipado++;
  else if (status === 'ENTREGUE') acc.entregueNoPrazo++;
  else if (status === 'ENTREGUE_JUSTIFICADA') acc.entregueComMulta++;
  else acc.pendenteNoPrazo++; // PENDENTE + EM_ATRASO_*
}

function comPct(acc: Acc) {
  const total = acc.pendenteAntecipado + acc.pendenteNoPrazo + acc.entregueNoPrazo + acc.entregueComMulta;
  const m = (c: number) => ({ count: c, pct: total ? Math.round((c / total) * 100) : 0 });
  return {
    pendenteAntecipado: m(acc.pendenteAntecipado),
    pendenteNoPrazo: m(acc.pendenteNoPrazo),
    entregueNoPrazo: m(acc.entregueNoPrazo),
    entregueComMulta: m(acc.entregueComMulta),
  };
}

router.get('/painel', async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const cfgRaw = (await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } })).config as Record<string, unknown>;
  const diasAntecipado = typeof cfgRaw.diasAntecipado === 'number' ? cfgRaw.diasAntecipado : 7;

  const [usuarios, departamentos, totalEmpresas, entregas] = await Promise.all([
    prisma.usuario.findMany({ where: { escritorioId, deletedAt: null, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.departamento.findMany({ where: { escritorioId, ativo: true }, select: { id: true, nome: true, cor: true }, orderBy: { nome: 'asc' } }),
    prisma.empresa.count({ where: { escritorioId, deletedAt: null } }),
    prisma.entrega.findMany({
      where: { escritorioId, competenciaAno: ano, competenciaMes: mes },
      select: {
        status: true, prazoTecnico: true, prazoLegal: true, dataEntrega: true,
        responsavelPrazoId: true, obrigacao: { select: { departamentoId: true } },
      },
    }),
  ]);

  const porColab = new Map<string, Acc>();
  const porDep = new Map<string, Acc>();
  usuarios.forEach((u) => porColab.set(u.id, novoAcc()));
  departamentos.forEach((d) => porDep.set(d.id, novoAcc()));

  const num = {
    entregasBaixadas: 0, antecipadas: 0, prazoTecnico: 0, atrasadas: 0, comMulta: 0, atrasoJustificado: 0,
    aRealizar: 0, arPrazoAntecipado: 0, arPrazoTecnico: 0, arAtrasoLegal: 0,
  };

  for (const e of entregas) {
    const status = statusEfetivo(e.status as StatusEntrega, e.prazoTecnico, e.prazoLegal, hoje, diasAntecipado);
    if (e.responsavelPrazoId && porColab.has(e.responsavelPrazoId)) classificar(porColab.get(e.responsavelPrazoId)!, status);
    if (e.obrigacao.departamentoId && porDep.has(e.obrigacao.departamentoId)) classificar(porDep.get(e.obrigacao.departamentoId)!, status);

    const baixada = status === 'ENTREGUE' || status === 'ENTREGUE_JUSTIFICADA';
    if (baixada) {
      num.entregasBaixadas++;
      if (status === 'ENTREGUE_JUSTIFICADA') { num.comMulta++; num.atrasadas++; num.atrasoJustificado++; }
      else if (e.dataEntrega && e.dataEntrega < e.prazoTecnico) num.antecipadas++;
      else num.prazoTecnico++;
    } else {
      num.aRealizar++;
      if (status === 'PENDENTE_ANTECIPADO') num.arPrazoAntecipado++;
      else if (status === 'EM_ATRASO_LEGAL') num.arAtrasoLegal++;
      else num.arPrazoTecnico++;
    }
  }

  const pctNum = (c: number, total: number) => ({ count: c, pct: total ? Math.round((c / total) * 100) : 0 });

  return ok(res, {
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    colaboradores: usuarios.map((u) => ({ id: u.id, nome: u.nome, metricas: comPct(porColab.get(u.id)!) })),
    departamentos: departamentos.map((d) => ({ id: d.id, nome: d.nome, cor: d.cor, metricas: comPct(porDep.get(d.id)!) })),
    numericos: {
      entregas: {
        total: num.entregasBaixadas,
        antecipadas: pctNum(num.antecipadas, num.entregasBaixadas),
        prazoTecnico: pctNum(num.prazoTecnico, num.entregasBaixadas),
        atrasadas: pctNum(num.atrasadas, num.entregasBaixadas),
        comMulta: pctNum(num.comMulta, num.entregasBaixadas),
        atrasoJustificado: pctNum(num.atrasoJustificado, num.entregasBaixadas),
      },
      aRealizar: {
        total: num.aRealizar,
        prazoAntecipado: pctNum(num.arPrazoAntecipado, num.aRealizar),
        prazoTecnico: pctNum(num.arPrazoTecnico, num.aRealizar),
        atrasoLegal: pctNum(num.arAtrasoLegal, num.aRealizar),
        comMulta: pctNum(0, num.aRealizar),
        atrasoJustificado: pctNum(0, num.aRealizar),
      },
      docs: { total: 0, lidos: pctNum(0, 0), naoLidos: pctNum(0, 0) },
      processos: { total: 0, iniciados: pctNum(0, 0), concluidos: pctNum(0, 0), passosOk: pctNum(0, 0), followups: pctNum(0, 0) },
      solicitacoes: { total: 0, abertas: 0, finalizadas: 0, aguardando: 0, resolvendo: 0, mediaAvaliacoes: 0 },
      empresas: totalEmpresas,
    },
  });
});

export default router;
