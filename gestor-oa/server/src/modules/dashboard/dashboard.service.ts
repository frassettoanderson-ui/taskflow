import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { statusEfetivo, type StatusEntrega } from '../entrega/entrega.status.js';

export const CORES_IND = {
  ok: '#5cb85c', info: '#5b9bd5', warn: '#f0ad4e', danger: '#cf3c5d', neutro: '#94a3b8', roxo: '#7e57c2',
};

// Catalogo de metricas suportadas (usado pelo front no cadastro).
export const METRICAS = [
  { id: 'entregas_baixadas', nome: 'Entregas baixadas', baseEntrega: true },
  { id: 'a_realizar', nome: 'Demandas a realizar', baseEntrega: true },
  { id: 'atrasadas', nome: 'Entregas atrasadas', baseEntrega: true },
  { id: 'pendentes', nome: 'Pendencias', baseEntrega: true },
  { id: 'com_multa', nome: 'Entregues com multa', baseEntrega: true },
  { id: 'processos', nome: 'Processos em andamento', baseEntrega: false },
  { id: 'docs', nome: 'Documentos no GED', baseEntrega: false },
  { id: 'solicitacoes', nome: 'Solicitacoes em aberto', baseEntrega: false },
  { id: 'empresas', nome: 'Empresas ativas', baseEntrega: false },
];

export const PRAZOS = [
  { id: 'mes_atual', nome: 'Mes atual (competencia)' },
  { id: 'semana_atual', nome: 'Semana atual' },
  { id: '7d', nome: 'Proximos 7 dias' },
  { id: '30d', nome: 'Proximos 30 dias' },
];

interface IndicadorRow {
  id: string;
  nome: string;
  tipo: string;
  metrica: string;
  prazo: string;
  filtroDepartamentoId: string | null;
  filtroGrupoId: string | null;
  filtroRegimeId: string | null;
}

function janelaPrazo(prazo: string): { entregaWhere: Prisma.EntregaWhereInput; compAtual: boolean } {
  const hoje = new Date();
  if (prazo === 'mes_atual') {
    return { entregaWhere: { competenciaAno: hoje.getFullYear(), competenciaMes: hoje.getMonth() + 1 }, compAtual: true };
  }
  let ate = new Date(hoje);
  if (prazo === '7d') ate.setDate(hoje.getDate() + 7);
  else if (prazo === '30d') ate.setDate(hoje.getDate() + 30);
  else if (prazo === 'semana_atual') {
    // do inicio (domingo) ao fim (sabado) da semana corrente
    const inicio = new Date(hoje); inicio.setDate(hoje.getDate() - hoje.getDay()); inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6); fim.setHours(23, 59, 59, 999);
    return { entregaWhere: { prazoLegal: { gte: inicio, lte: fim } }, compAtual: false };
  }
  return { entregaWhere: { prazoLegal: { gte: hoje, lte: ate } }, compAtual: false };
}

function filtrosEntrega(ind: IndicadorRow): Prisma.EntregaWhereInput {
  const w: Prisma.EntregaWhereInput = {};
  if (ind.filtroDepartamentoId) w.obrigacao = { departamentoId: ind.filtroDepartamentoId };
  const emp: Prisma.EmpresaWhereInput = {};
  if (ind.filtroGrupoId) emp.grupoEmpresaId = ind.filtroGrupoId;
  if (ind.filtroRegimeId) emp.regimeTributarioId = ind.filtroRegimeId;
  if (Object.keys(emp).length) w.empresa = emp;
  return w;
}

// Calcula um indicador. Retorna { valor } para numerico, ou { itens[] } para colaborador/departamento.
export async function calcularIndicador(escritorioId: string, ind: IndicadorRow) {
  const hoje = new Date();
  const cfgRaw = (await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } })).config as Record<string, unknown>;
  const diasAntecipado = typeof cfgRaw.diasAntecipado === 'number' ? cfgRaw.diasAntecipado : 7;

  // Metricas que nao dependem de entregas
  if (ind.metrica === 'processos') return { valor: await prisma.processo.count({ where: { escritorioId, status: 'EM_ANDAMENTO' } }) };
  if (ind.metrica === 'docs') return { valor: await prisma.documentoGED.count({ where: { escritorioId } }) };
  if (ind.metrica === 'solicitacoes') return { valor: await prisma.solicitacaoInterna.count({ where: { escritorioId, status: { in: ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO'] } } }) };
  if (ind.metrica === 'empresas') return { valor: await prisma.empresa.count({ where: { escritorioId, deletedAt: null, ativo: true } }) };

  const { entregaWhere } = janelaPrazo(ind.prazo);
  const where: Prisma.EntregaWhereInput = { escritorioId, ...entregaWhere, ...filtrosEntrega(ind) };
  const entregas = await prisma.entrega.findMany({
    where,
    select: {
      status: true, prazoTecnico: true, prazoLegal: true, dataEntrega: true,
      responsavelPrazoId: true, obrigacao: { select: { departamentoId: true } },
    },
  });

  const conta = (st: StatusEntrega): { baixada: boolean; atrasada: boolean; comMulta: boolean; pendente: boolean } => ({
    baixada: st === 'ENTREGUE' || st === 'ENTREGUE_JUSTIFICADA',
    atrasada: st === 'EM_ATRASO_LEGAL' || st === 'ENTREGUE_JUSTIFICADA',
    comMulta: st === 'ENTREGUE_JUSTIFICADA',
    pendente: st !== 'ENTREGUE' && st !== 'ENTREGUE_JUSTIFICADA' && st !== 'DISPENSADA',
  });
  const pegaMetrica = (c: ReturnType<typeof conta>): number => {
    if (ind.metrica === 'entregas_baixadas') return c.baixada ? 1 : 0;
    if (ind.metrica === 'a_realizar' || ind.metrica === 'pendentes') return c.pendente ? 1 : 0;
    if (ind.metrica === 'atrasadas') return c.atrasada ? 1 : 0;
    if (ind.metrica === 'com_multa') return c.comMulta ? 1 : 0;
    return 0;
  };

  if (ind.tipo === 'numerico') {
    let valor = 0;
    for (const e of entregas) valor += pegaMetrica(conta(statusEfetivo(e.status as StatusEntrega, e.prazoTecnico, e.prazoLegal, hoje, diasAntecipado)));
    return { valor };
  }

  // tipo colaborador ou departamento -> breakdown
  const chave = (e: (typeof entregas)[number]) => (ind.tipo === 'colaborador' ? e.responsavelPrazoId : e.obrigacao.departamentoId);
  const acc = new Map<string, { baixadas: number; pendentes: number }>();
  for (const e of entregas) {
    const k = chave(e); if (!k) continue;
    const c = conta(statusEfetivo(e.status as StatusEntrega, e.prazoTecnico, e.prazoLegal, hoje, diasAntecipado));
    const cur = acc.get(k) ?? { baixadas: 0, pendentes: 0 };
    if (c.baixada) cur.baixadas++; else if (c.pendente) cur.pendentes++;
    acc.set(k, cur);
  }
  let nomes = new Map<string, { nome: string; cor?: string; foto?: string | null }>();
  if (ind.tipo === 'colaborador') {
    const us = await prisma.usuario.findMany({ where: { escritorioId, id: { in: [...acc.keys()] } }, select: { id: true, nome: true, fotoPerfilArquivo: true } });
    nomes = new Map(us.map((u) => [u.id, { nome: u.nome, foto: u.fotoPerfilArquivo }]));
  } else {
    const ds = await prisma.departamento.findMany({ where: { escritorioId, id: { in: [...acc.keys()] } }, select: { id: true, nome: true, cor: true } });
    nomes = new Map(ds.map((d) => [d.id, { nome: d.nome, cor: d.cor }]));
  }
  const itens = [...acc.entries()].map(([k, v]) => ({ id: k, nome: nomes.get(k)?.nome ?? '?', cor: nomes.get(k)?.cor, foto: nomes.get(k)?.foto ?? null, ...v }))
    .sort((a, b) => (b.baixadas + b.pendentes) - (a.baixadas + a.pendentes));
  return { itens };
}

// Visibilidade: 'todos' aparece p/ qualquer um; 'somente_meu' so p/ o criador.
function visivelPara(visibilidade: string, criadoPorId: string | null, userId: string) {
  return visibilidade !== 'somente_meu' || criadoPorId === userId;
}

export async function listarIndicadores(escritorioId: string, userId: string, incluirInativos = true) {
  const all = await prisma.indicador.findMany({ where: { escritorioId, ...(incluirInativos ? {} : { ativo: true }) }, orderBy: { createdAt: 'desc' } });
  return all.filter((i) => visivelPara(i.visibilidade, i.criadoPorId, userId));
}

export async function listarPaineis(escritorioId: string, userId: string, incluirInativos = true) {
  const all = await prisma.painel.findMany({
    where: { escritorioId, ...(incluirInativos ? {} : { ativo: true }) },
    orderBy: { createdAt: 'desc' },
    include: { indicadores: { include: { indicador: true }, orderBy: { ordem: 'asc' } } },
  });
  return all.filter((p) => visivelPara(p.visibilidade, p.criadoPorId, userId));
}

// Painel completo com cada indicador ja calculado (consumo pelo player).
export async function painelCalculado(escritorioId: string, userId: string, painelId: string) {
  const painel = await prisma.painel.findFirst({
    where: { id: painelId, escritorioId },
    include: { indicadores: { include: { indicador: true }, orderBy: { ordem: 'asc' } } },
  });
  if (!painel) return null;
  const indicadores = [];
  for (const pi of painel.indicadores) {
    if (!pi.indicador.ativo) continue;
    const calc = await calcularIndicador(escritorioId, pi.indicador);
    indicadores.push({
      id: pi.indicador.id, nome: pi.indicador.nome, tipo: pi.indicador.tipo, metrica: pi.indicador.metrica, prazo: pi.indicador.prazo,
      ...calc,
    });
  }
  return { id: painel.id, nome: painel.nome, transicaoSeg: painel.transicaoSeg, indicadores };
}
