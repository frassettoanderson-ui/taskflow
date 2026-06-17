import type { Prisma } from '@prisma/client';
import { addDays } from 'date-fns';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import {
  calcularPrazos,
  montarFeriados,
  type FeriadosSet,
} from '../../lib/prazos.js';
import { statusEfetivo, type StatusEntrega } from './entrega.status.js';
import type { RegraPrazo } from '@gestoroa/shared';
import type { AuthUser } from '../../middleware/auth.js';
import type { ParsedPagination } from '../../lib/http.js';

interface ConfigEscritorio {
  sabadoEhUtil: boolean;
  diasAntecipado: number;
}

async function lerConfig(escritorioId: string): Promise<ConfigEscritorio> {
  const e = await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } });
  const cfg = (e.config as Record<string, unknown>) ?? {};
  return {
    sabadoEhUtil: Boolean(cfg.sabadoEhUtil),
    diasAntecipado: typeof cfg.diasAntecipado === 'number' ? cfg.diasAntecipado : 7,
  };
}

async function lerFeriados(escritorioId: string, anos: number[]): Promise<FeriadosSet> {
  const min = new Date(Math.min(...anos), 0, 1);
  const max = new Date(Math.max(...anos), 11, 31);
  const feriados = await prisma.feriado.findMany({
    where: { escritorioId, data: { gte: min, lte: max } },
    select: { data: true },
  });
  return montarFeriados(feriados.map((f) => f.data));
}

// Periodicidade aplica nesta competencia?
function periodicidadeAplica(periodicidade: string, mes: number): boolean {
  if (periodicidade === 'MENSAL') return true;
  if (periodicidade === 'TRIMESTRAL') return mes % 3 === 0; // mar, jun, set, dez
  if (periodicidade === 'ANUAL') return mes === 12;
  return false; // EVENTUAL nao gera automatico
}

// ---------- Geracao de competencia (idempotente) ----------
export async function gerarCompetencia(escritorioId: string, ano: number, mes: number) {
  const cfg = await lerConfig(escritorioId);
  const feriados = await lerFeriados(escritorioId, [ano, ano + 1]);

  // vinculos ativos com obrigacao viva
  const vinculos = await prisma.empresaObrigacao.findMany({
    where: { escritorioId, ativo: true, obrigacao: { deletedAt: null } },
    include: { obrigacao: true },
  });

  // mapa de responsaveis por (empresaId|departamentoId)
  const responsaveis = await prisma.empresaResponsavelDepartamento.findMany({
    where: { escritorioId },
  });
  const mapaResp = new Map<string, string>();
  responsaveis.forEach((r) => mapaResp.set(`${r.empresaId}|${r.departamentoId}`, r.usuarioId));

  // entregas ja existentes nesta competencia
  const existentes = await prisma.entrega.findMany({
    where: { escritorioId, competenciaAno: ano, competenciaMes: mes },
    select: { empresaId: true, obrigacaoId: true },
  });
  const jaExiste = new Set(existentes.map((e) => `${e.empresaId}|${e.obrigacaoId}`));

  let criadas = 0;
  const hoje = new Date();

  for (const v of vinculos) {
    if (!periodicidadeAplica(v.obrigacao.periodicidade, mes)) continue;
    const chave = `${v.empresaId}|${v.obrigacaoId}`;
    if (jaExiste.has(chave)) continue;

    const regra = v.obrigacao.regraPrazo as unknown as RegraPrazo;
    if (!regra?.tipoDia) continue;

    const diaOverride = v.diaPrazoOverride;
    const regraEfetiva: RegraPrazo = diaOverride
      ? { ...regra, dia: diaOverride }
      : regra;

    const { prazoLegal, prazoTecnico } = calcularPrazos(
      regraEfetiva,
      ano,
      mes - 1,
      feriados,
      cfg.sabadoEhUtil,
    );

    const responsavel =
      v.responsavelId ??
      (v.obrigacao.departamentoId
        ? mapaResp.get(`${v.empresaId}|${v.obrigacao.departamentoId}`) ?? null
        : null);

    const status = statusEfetivo('PENDENTE', prazoTecnico, prazoLegal, hoje, cfg.diasAntecipado);

    await prisma.entrega.create({
      data: {
        escritorioId,
        empresaId: v.empresaId,
        empresaObrigacaoId: v.id,
        obrigacaoId: v.obrigacaoId,
        competenciaAno: ano,
        competenciaMes: mes,
        prazoLegal,
        prazoTecnico,
        status: status as StatusEntrega,
        responsavelPrazoId: responsavel,
        responsavelEntregaId: responsavel,
      },
    });
    criadas++;
  }

  return { criadas, total: vinculos.length };
}

// ---------- Listagem ----------
export interface FiltrosEntrega {
  ano?: number;
  mes?: number;
  empresaId?: string;
  obrigacaoId?: string;
  departamentoId?: string;
  responsavelId?: string;
  tagId?: string;
  status?: StatusEntrega;
}

function baseWhere(
  escritorioId: string,
  f: FiltrosEntrega,
  ff: AuthUser['filtrosForcados'],
): Prisma.EntregaWhereInput {
  const and: Prisma.EntregaWhereInput[] = [{ escritorioId }];
  if (f.ano) and.push({ competenciaAno: f.ano });
  if (f.mes) and.push({ competenciaMes: f.mes });
  if (f.empresaId) and.push({ empresaId: f.empresaId });
  if (f.obrigacaoId) and.push({ obrigacaoId: f.obrigacaoId });
  if (f.departamentoId) and.push({ obrigacao: { departamentoId: f.departamentoId } });
  if (f.status) and.push({ status: f.status });
  if (f.responsavelId)
    and.push({
      OR: [{ responsavelPrazoId: f.responsavelId }, { responsavelEntregaId: f.responsavelId }],
    });
  if (f.tagId) and.push({ empresa: { tags: { some: { tagId: f.tagId } } } });

  // filtros forcados do usuario
  if (ff?.departamentos?.length)
    and.push({ obrigacao: { departamentoId: { in: ff.departamentos } } });
  if (ff?.tags?.length) and.push({ empresa: { tags: { some: { tagId: { in: ff.tags } } } } });

  return { AND: and };
}

export async function listar(
  escritorioId: string,
  filtros: FiltrosEntrega,
  ff: AuthUser['filtrosForcados'],
  pag: ParsedPagination,
) {
  const cfg = await lerConfig(escritorioId);
  const where = baseWhere(escritorioId, filtros, ff);
  const hoje = new Date();

  const [items, total] = await Promise.all([
    prisma.entrega.findMany({
      where,
      orderBy: [{ prazoLegal: 'asc' }],
      skip: pag.skip,
      take: pag.take,
      include: {
        empresa: { select: { id: true, razaoSocial: true } },
        obrigacao: { select: { id: true, nome: true, exigeAnexoNaBaixa: true, departamento: { select: { nome: true, cor: true } } } },
        _count: { select: { anexos: true } },
      },
    }),
    prisma.entrega.count({ where }),
  ]);

  return {
    items: items.map((e) => ({
      id: e.id,
      empresa: e.empresa,
      obrigacao: e.obrigacao,
      competencia: `${String(e.competenciaMes).padStart(2, '0')}/${e.competenciaAno}`,
      competenciaAno: e.competenciaAno,
      competenciaMes: e.competenciaMes,
      prazoLegal: e.prazoLegal,
      prazoTecnico: e.prazoTecnico,
      status: statusEfetivo(e.status as StatusEntrega, e.prazoTecnico, e.prazoLegal, hoje, cfg.diasAntecipado),
      statusBase: e.status,
      responsavelPrazoId: e.responsavelPrazoId,
      responsavelEntregaId: e.responsavelEntregaId,
      dataEntrega: e.dataEntrega,
      justificativa: e.justificativa,
      origemBaixa: e.origemBaixa,
      qtdAnexos: e._count.anexos,
    })),
    total,
  };
}

async function getEntrega(escritorioId: string, id: string) {
  const e = await prisma.entrega.findFirst({
    where: { id, escritorioId },
    include: { obrigacao: true },
  });
  if (!e) throw Errors.naoEncontrado('Entrega');
  return e;
}

// ---------- Baixa (OK) ----------
export async function baixar(
  escritorioId: string,
  entregaId: string,
  dados: {
    dataEntrega?: string;
    atualizarResponsavel?: boolean;
    justificativa?: string;
    anexosCount: number;
  },
  userId: string,
) {
  const e = await getEntrega(escritorioId, entregaId);
  const dataEntrega = dados.dataEntrega ? new Date(dados.dataEntrega + 'T12:00:00') : new Date();

  if (e.obrigacao.exigeAnexoNaBaixa && dados.anexosCount === 0) {
    throw Errors.validacao('Esta obrigacao exige anexo na baixa.');
  }

  const aposLegal = dataEntrega > e.prazoLegal;
  if (aposLegal && !dados.justificativa?.trim()) {
    throw Errors.validacao('Baixa apos o prazo legal exige justificativa.');
  }

  return prisma.entrega.update({
    where: { id: e.id },
    data: {
      status: aposLegal ? 'ENTREGUE_JUSTIFICADA' : 'ENTREGUE',
      dataEntrega,
      justificativa: dados.justificativa?.trim() || null,
      origemBaixa: 'MANUAL',
      responsavelEntregaId: dados.atualizarResponsavel ? userId : e.responsavelEntregaId,
    },
  });
}

// ---------- Desfazer baixa ----------
export async function desfazer(escritorioId: string, entregaId: string) {
  const e = await getEntrega(escritorioId, entregaId);
  const cfg = await lerConfig(escritorioId);
  const status = statusEfetivo('PENDENTE', e.prazoTecnico, e.prazoLegal, new Date(), cfg.diasAntecipado);
  return prisma.entrega.update({
    where: { id: e.id },
    data: {
      status: status as StatusEntrega,
      dataEntrega: null,
      justificativa: null,
      origemBaixa: null,
    },
  });
}

// ---------- Dispensar ----------
export async function dispensar(escritorioId: string, entregaId: string, motivo: string) {
  const e = await getEntrega(escritorioId, entregaId);
  return prisma.entrega.update({
    where: { id: e.id },
    data: { status: 'DISPENSADA', motivoDispensa: motivo || null },
  });
}

// ---------- Editar prazo (inline) ----------
export async function editarPrazo(
  escritorioId: string,
  entregaId: string,
  dados: { prazoLegal?: string; prazoTecnico?: string },
) {
  const e = await getEntrega(escritorioId, entregaId);
  const cfg = await lerConfig(escritorioId);
  const prazoLegal = dados.prazoLegal ? new Date(dados.prazoLegal + 'T12:00:00') : e.prazoLegal;
  const prazoTecnico = dados.prazoTecnico ? new Date(dados.prazoTecnico + 'T12:00:00') : e.prazoTecnico;
  const status = e.status === 'ENTREGUE' || e.status === 'ENTREGUE_JUSTIFICADA' || e.status === 'DISPENSADA'
    ? e.status
    : (statusEfetivo('PENDENTE', prazoTecnico, prazoLegal, new Date(), cfg.diasAntecipado) as StatusEntrega);
  return prisma.entrega.update({
    where: { id: e.id },
    data: { prazoLegal, prazoTecnico, status },
  });
}

// ---------- Acoes em massa ----------
export async function acoesMassa(
  escritorioId: string,
  input: {
    entregaIds: string[];
    acao: 'postergar' | 'transferir' | 'baixar' | 'dispensar';
    novaData?: string;
    dias?: number;
    responsavelId?: string;
    motivo?: string;
  },
  userId: string,
) {
  const entregas = await prisma.entrega.findMany({
    where: { id: { in: input.entregaIds }, escritorioId },
  });
  let afetadas = 0;

  for (const e of entregas) {
    if (input.acao === 'postergar') {
      let novoLegal = e.prazoLegal;
      let novoTecnico = e.prazoTecnico;
      if (input.novaData) {
        novoLegal = new Date(input.novaData + 'T12:00:00');
      } else if (input.dias) {
        novoLegal = addDays(e.prazoLegal, input.dias);
        novoTecnico = addDays(e.prazoTecnico, input.dias);
      }
      await prisma.entrega.update({ where: { id: e.id }, data: { prazoLegal: novoLegal, prazoTecnico: novoTecnico } });
    } else if (input.acao === 'transferir') {
      if (!input.responsavelId) continue;
      await prisma.entrega.update({
        where: { id: e.id },
        data: { responsavelPrazoId: input.responsavelId, responsavelEntregaId: input.responsavelId },
      });
    } else if (input.acao === 'baixar') {
      await prisma.entrega.update({
        where: { id: e.id },
        data: {
          status: new Date() > e.prazoLegal ? 'ENTREGUE_JUSTIFICADA' : 'ENTREGUE',
          dataEntrega: new Date(),
          origemBaixa: 'MANUAL',
          justificativa: new Date() > e.prazoLegal ? 'Baixa em lote' : null,
          responsavelEntregaId: e.responsavelEntregaId ?? userId,
        },
      });
    } else if (input.acao === 'dispensar') {
      await prisma.entrega.update({ where: { id: e.id }, data: { status: 'DISPENSADA', motivoDispensa: input.motivo || 'Dispensada em lote' } });
    }
    afetadas++;
  }
  return { afetadas };
}

// ---------- Calendario ----------
export async function calendario(escritorioId: string, ano: number, mes: number, ff: AuthUser['filtrosForcados']) {
  const where = baseWhere(escritorioId, { ano, mes }, ff);
  const entregas = await prisma.entrega.findMany({
    where,
    select: { prazoLegal: true, status: true },
  });
  const porDia = new Map<number, number>();
  for (const e of entregas) {
    const dia = e.prazoLegal.getUTCDate();
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  return [...porDia.entries()].map(([dia, total]) => ({ dia, total }));
}

// ---------- Recalcular status (todas pendentes) ----------
export async function recalcular(escritorioId: string) {
  const cfg = await lerConfig(escritorioId);
  const pendentes = await prisma.entrega.findMany({
    where: { escritorioId, status: { in: ['PENDENTE', 'PENDENTE_ANTECIPADO', 'EM_ATRASO_TECNICO', 'EM_ATRASO_LEGAL'] } },
  });
  let atualizadas = 0;
  for (const e of pendentes) {
    const novo = statusEfetivo('PENDENTE', e.prazoTecnico, e.prazoLegal, new Date(), cfg.diasAntecipado) as StatusEntrega;
    if (novo !== e.status) {
      await prisma.entrega.update({ where: { id: e.id }, data: { status: novo } });
      atualizadas++;
    }
  }
  return { atualizadas };
}
