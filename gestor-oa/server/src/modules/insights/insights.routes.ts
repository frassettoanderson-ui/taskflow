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
  entregueComAtraso: number; // entregue em atraso, obrigacao NAO passivel de multa (roxo)
  entregueComMulta: number;  // entregue em atraso, obrigacao passivel de multa (vermelho)
}
const novoAcc = (): Acc => ({ pendenteAntecipado: 0, pendenteNoPrazo: 0, entregueNoPrazo: 0, entregueComAtraso: 0, entregueComMulta: 0 });

function classificar(acc: Acc, status: StatusEntrega, passivelMulta: boolean) {
  if (status === 'PENDENTE_ANTECIPADO') acc.pendenteAntecipado++;
  else if (status === 'ENTREGUE') acc.entregueNoPrazo++;
  else if (status === 'ENTREGUE_JUSTIFICADA') { if (passivelMulta) acc.entregueComMulta++; else acc.entregueComAtraso++; }
  else acc.pendenteNoPrazo++; // PENDENTE + EM_ATRASO_*
}

function comPct(acc: Acc) {
  const total = acc.pendenteAntecipado + acc.pendenteNoPrazo + acc.entregueNoPrazo + acc.entregueComAtraso + acc.entregueComMulta;
  const m = (c: number) => ({ count: c, pct: total ? Math.round((c / total) * 100) : 0 });
  return {
    pendenteAntecipado: m(acc.pendenteAntecipado),
    pendenteNoPrazo: m(acc.pendenteNoPrazo),
    entregueNoPrazo: m(acc.entregueNoPrazo),
    entregueComAtraso: m(acc.entregueComAtraso),
    entregueComMulta: m(acc.entregueComMulta),
  };
}

router.get('/painel', async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const hoje = new Date();

  // janela = semana atual (domingo 00:00 -> sabado 23:59)
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay()); inicioSemana.setHours(0, 0, 0, 0);
  const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6); fimSemana.setHours(23, 59, 59, 999);

  const escritorioRow = await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } });
  const cfgRaw = escritorioRow.config as Record<string, unknown>;
  const diasAntecipado = typeof cfgRaw.diasAntecipado === 'number' ? cfgRaw.diasAntecipado : 7;

  const [usuarios, departamentos, totalEmpresas, entregas, docsTotal, docsLidos, procIniciados, procConcluidos, passosOk, solInternas, solPortal] = await Promise.all([
    prisma.usuario.findMany({ where: { escritorioId, deletedAt: null, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.departamento.findMany({ where: { escritorioId, ativo: true }, select: { id: true, nome: true, cor: true }, orderBy: { nome: 'asc' } }),
    prisma.empresa.count({ where: { escritorioId, deletedAt: null } }),
    prisma.entrega.findMany({
      where: { escritorioId, prazoLegal: { gte: inicioSemana, lte: fimSemana } },
      select: {
        status: true, prazoTecnico: true, prazoLegal: true, dataEntrega: true,
        responsavelPrazoId: true, obrigacao: { select: { departamentoId: true, passivelMulta: true } },
      },
    }),
    prisma.documentoGED.count({ where: { escritorioId, createdAt: { gte: inicioSemana, lte: fimSemana } } }),
    prisma.protocolo.count({ where: { escritorioId, enviadoEm: { gte: inicioSemana, lte: fimSemana }, visualizacoes: { some: {} } } }).catch(() => 0),
    prisma.processo.count({ where: { escritorioId, dataInicio: { gte: inicioSemana, lte: fimSemana } } }),
    prisma.processo.count({ where: { escritorioId, dataConclusao: { gte: inicioSemana, lte: fimSemana } } }),
    prisma.processoPasso.count({ where: { processo: { escritorioId }, concluidoEm: { gte: inicioSemana, lte: fimSemana } } }),
    prisma.solicitacaoInterna.groupBy({ by: ['status'], where: { escritorioId }, _count: true }).catch(() => [] as { status: string; _count: number }[]),
    prisma.solicitacaoPortal.findMany({ where: { escritorioId }, select: { status: true, avaliacaoNota: true } }).catch(() => [] as { status: string; avaliacaoNota: number | null }[]),
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
    const passivelMulta = !!e.obrigacao.passivelMulta;
    const status = statusEfetivo(e.status as StatusEntrega, e.prazoTecnico, e.prazoLegal, hoje, diasAntecipado);
    if (e.responsavelPrazoId && porColab.has(e.responsavelPrazoId)) classificar(porColab.get(e.responsavelPrazoId)!, status, passivelMulta);
    if (e.obrigacao.departamentoId && porDep.has(e.obrigacao.departamentoId)) classificar(porDep.get(e.obrigacao.departamentoId)!, status, passivelMulta);

    const baixada = status === 'ENTREGUE' || status === 'ENTREGUE_JUSTIFICADA';
    if (baixada) {
      num.entregasBaixadas++;
      if (status === 'ENTREGUE_JUSTIFICADA') { num.atrasadas++; num.atrasoJustificado++; if (passivelMulta) num.comMulta++; }
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

  // ----- docs / processos / solicitacoes (numericos) -----
  const docsNaoLidos = Math.max(0, docsTotal - docsLidos);
  const procTotal = procIniciados + procConcluidos;
  const solMap = new Map((solInternas as { status: string; _count: number }[]).map((s) => [s.status, s._count]));
  const solAbertas = (solMap.get('ABERTA') ?? 0) + (solPortal as { status: string }[]).filter((s) => s.status === 'ABERTA').length;
  const solResolvendo = (solMap.get('EM_ANDAMENTO') ?? 0) + (solMap.get('AGUARDANDO') ?? 0);
  const solFinalizadas = (solMap.get('RESOLVIDA') ?? 0) + (solPortal as { status: string }[]).filter((s) => s.status === 'FINALIZADA').length;
  const notas = (solPortal as { avaliacaoNota: number | null }[]).map((s) => s.avaliacaoNota).filter((n): n is number => n != null);
  const mediaAvaliacoes = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : 0;

  return ok(res, {
    periodo: 'Semana atual',
    office: escritorioRow.nome,
    usuario: req.auth!.nome,
    colaboradores: usuarios.map((u) => ({ id: u.id, nome: u.nome, metricas: comPct(porColab.get(u.id)!) })),
    departamentos: departamentos.map((d) => ({ id: d.id, nome: d.nome, cor: d.cor, metricas: comPct(porDep.get(d.id)!) })),
    numericos: {
      entregas: {
        total: num.entregasBaixadas,
        antecipadas: pctNum(num.antecipadas, num.entregasBaixadas),
        prazoTecnico: pctNum(num.prazoTecnico, num.entregasBaixadas),
        atrasadas: pctNum(num.atrasadas, num.entregasBaixadas),
        comMulta: pctNum(num.comMulta, num.atrasadas),
        atrasoJustificado: pctNum(num.atrasoJustificado, num.entregasBaixadas),
      },
      aRealizar: {
        total: num.aRealizar,
        prazoAntecipado: pctNum(num.arPrazoAntecipado, num.aRealizar),
        prazoTecnico: pctNum(num.arPrazoTecnico, num.aRealizar),
        atrasoLegal: pctNum(num.arAtrasoLegal, num.aRealizar),
        comMulta: pctNum(0, num.arAtrasoLegal),
        atrasoJustificado: pctNum(0, num.aRealizar),
      },
      docs: { total: docsTotal, lidos: pctNum(docsLidos, docsTotal), naoLidos: pctNum(docsNaoLidos, docsTotal) },
      processos: { total: procTotal, iniciados: pctNum(procIniciados, procTotal), concluidos: pctNum(procConcluidos, procTotal), passosOk: pctNum(passosOk, passosOk), followups: pctNum(0, 0) },
      solicitacoes: { total: solAbertas + solResolvendo + solFinalizadas, abertas: solAbertas, finalizadas: solFinalizadas, aguardando: solMap.get('AGUARDANDO') ?? 0, resolvendo: solResolvendo, mediaAvaliacoes },
      empresas: totalEmpresas,
    },
  });
});

export default router;
