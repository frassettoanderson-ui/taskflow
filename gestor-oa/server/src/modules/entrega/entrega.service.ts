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

// ---------- Geracao retroativa de UMA obrigacao (botao "Retro") ----------
// Gera as pendencias dessa obrigacao desde dataInicial ate a competencia atual.
// forcarDispensados: prazos DISPENSADA dessas competencias voltam a PENDENTE.
export async function gerarRetroativoObrigacao(
  escritorioId: string,
  obrigacaoId: string,
  dataInicial: Date,
  forcarDispensados: boolean,
) {
  const obrigacao = await prisma.obrigacao.findFirst({ where: { id: obrigacaoId, escritorioId, deletedAt: null } });
  if (!obrigacao) throw Errors.naoEncontrado('Obrigacao');

  const hoje = new Date();
  const cfg = await lerConfig(escritorioId);
  const anoIni = dataInicial.getFullYear();
  const anoFim = hoje.getFullYear();
  const anos: number[] = [];
  for (let a = anoIni; a <= anoFim + 1; a++) anos.push(a);
  const feriados = await lerFeriados(escritorioId, anos);

  const vinculos = await prisma.empresaObrigacao.findMany({
    where: { escritorioId, obrigacaoId, ativo: true },
  });

  const responsaveis = await prisma.empresaResponsavelDepartamento.findMany({ where: { escritorioId } });
  const mapaResp = new Map<string, string>();
  responsaveis.forEach((r) => mapaResp.set(`${r.empresaId}|${r.departamentoId}`, r.usuarioId));

  // entregas ja existentes dessa obrigacao no intervalo
  const existentes = await prisma.entrega.findMany({
    where: { escritorioId, obrigacaoId },
    select: { empresaId: true, competenciaAno: true, competenciaMes: true },
  });
  const jaExiste = new Set(existentes.map((e) => `${e.empresaId}|${e.competenciaAno}|${e.competenciaMes}`));

  const regra = obrigacao.regraPrazo as unknown as RegraPrazo;
  let criadas = 0;

  // itera competencia por competencia (mes a mes) do inicio ate hoje
  const cursor = new Date(anoIni, dataInicial.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  while (cursor <= fim) {
    const ano = cursor.getFullYear();
    const mes = cursor.getMonth() + 1;
    if (regra?.tipoDia && periodicidadeAplica(obrigacao.periodicidade, mes)) {
      const { prazoLegal, prazoTecnico } = calcularPrazos(regra, ano, mes - 1, feriados, cfg.sabadoEhUtil);
      for (const v of vinculos) {
        if (jaExiste.has(`${v.empresaId}|${ano}|${mes}`)) continue;
        const responsavel = v.responsavelId
          ?? (obrigacao.departamentoId ? mapaResp.get(`${v.empresaId}|${obrigacao.departamentoId}`) ?? null : null);
        const status = statusEfetivo('PENDENTE', prazoTecnico, prazoLegal, hoje, cfg.diasAntecipado);
        await prisma.entrega.create({
          data: {
            escritorioId, empresaId: v.empresaId, empresaObrigacaoId: v.id, obrigacaoId,
            competenciaAno: ano, competenciaMes: mes, prazoLegal, prazoTecnico,
            status: status as StatusEntrega, responsavelPrazoId: responsavel, responsavelEntregaId: responsavel,
          },
        });
        criadas++;
      }
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  let reativadas = 0;
  if (forcarDispensados) {
    const r = await prisma.entrega.updateMany({
      where: {
        escritorioId, obrigacaoId, status: 'DISPENSADA',
        OR: [
          { competenciaAno: { gt: anoIni } },
          { competenciaAno: anoIni, competenciaMes: { gte: dataInicial.getMonth() + 1 } },
        ],
      },
      data: { status: 'PENDENTE', motivoDispensa: null },
    });
    reativadas = r.count;
  }

  return { criadas, reativadas };
}

// ---------- Geracao AVULSA de uma obrigacao para UMA empresa (botao "Avulsa") ----------
// Gera demandas dessa obrigacao para a empresa escolhida, em todas as competencias
// do intervalo [inicio, fim], independente da periodicidade.
// Obs: pula meses ja existentes; reativa dispensados; dia 15 se nao houver dia no cadastro.
export async function gerarAvulsaObrigacao(
  escritorioId: string,
  obrigacaoId: string,
  empresaId: string,
  inicio: { ano: number; mes: number },
  fim: { ano: number; mes: number },
) {
  const obrigacao = await prisma.obrigacao.findFirst({ where: { id: obrigacaoId, escritorioId, deletedAt: null } });
  if (!obrigacao) throw Errors.naoEncontrado('Obrigacao');
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, escritorioId, deletedAt: null } });
  if (!empresa) throw Errors.naoEncontrado('Empresa');

  const inicioIdx = inicio.ano * 12 + (inicio.mes - 1);
  const fimIdx = fim.ano * 12 + (fim.mes - 1);
  if (fimIdx < inicioIdx) throw Errors.validacao('O prazo final deve ser maior ou igual ao inicial.');

  // garante o vinculo empresa x obrigacao (cria como MANUAL se nao existir)
  let vinculo = await prisma.empresaObrigacao.findFirst({ where: { escritorioId, empresaId, obrigacaoId } });
  if (!vinculo) {
    vinculo = await prisma.empresaObrigacao.create({
      data: { escritorioId, empresaId, obrigacaoId, origens: [{ origem: 'MANUAL' }], ativo: true },
    });
  }

  const cfg = await lerConfig(escritorioId);
  const anos = [inicio.ano, fim.ano, fim.ano + 1];
  const feriados = await lerFeriados(escritorioId, anos);
  const regraBase = obrigacao.regraPrazo as unknown as RegraPrazo;
  const regra: RegraPrazo = { ...regraBase, dia: regraBase?.dia || 15, tipoDia: regraBase?.tipoDia || 'DIA_FIXO' };

  // responsavel
  const resp = obrigacao.departamentoId
    ? await prisma.empresaResponsavelDepartamento.findFirst({ where: { empresaId, departamentoId: obrigacao.departamentoId } })
    : null;
  const responsavel = vinculo.responsavelId ?? resp?.usuarioId ?? null;

  const existentes = await prisma.entrega.findMany({
    where: { escritorioId, obrigacaoId, empresaId },
    select: { competenciaAno: true, competenciaMes: true },
  });
  const jaExiste = new Set(existentes.map((e) => `${e.competenciaAno}|${e.competenciaMes}`));

  const hoje = new Date();
  let criadas = 0;
  for (let idx = inicioIdx; idx <= fimIdx; idx++) {
    const ano = Math.floor(idx / 12);
    const mes = (idx % 12) + 1;
    if (jaExiste.has(`${ano}|${mes}`)) continue;
    const { prazoLegal, prazoTecnico } = calcularPrazos(regra, ano, mes - 1, feriados, cfg.sabadoEhUtil);
    const status = statusEfetivo('PENDENTE', prazoTecnico, prazoLegal, hoje, cfg.diasAntecipado);
    await prisma.entrega.create({
      data: {
        escritorioId, empresaId, empresaObrigacaoId: vinculo.id, obrigacaoId,
        competenciaAno: ano, competenciaMes: mes, prazoLegal, prazoTecnico,
        status: status as StatusEntrega, responsavelPrazoId: responsavel, responsavelEntregaId: responsavel,
      },
    });
    criadas++;
  }

  // reativa dispensados no intervalo
  const dispensadas = await prisma.entrega.findMany({
    where: { escritorioId, obrigacaoId, empresaId, status: 'DISPENSADA' },
    select: { id: true, competenciaAno: true, competenciaMes: true },
  });
  const idsReativar = dispensadas
    .filter((e) => { const i = e.competenciaAno * 12 + (e.competenciaMes - 1); return i >= inicioIdx && i <= fimIdx; })
    .map((e) => e.id);
  let reativadas = 0;
  if (idsReativar.length) {
    const r = await prisma.entrega.updateMany({ where: { id: { in: idsReativar } }, data: { status: 'PENDENTE', motivoDispensa: null } });
    reativadas = r.count;
  }

  return { criadas, reativadas };
}

// ---------- Listagem ----------
export type OrdemEntrega =
  | 'obrigacao' | 'empresa' | 'prazoTecnico' | 'prazoLegal' | 'competencia';

export interface FiltrosEntrega {
  ano?: number;
  mes?: number;
  empresaId?: string;
  obrigacaoId?: string;
  departamentoId?: string;
  responsavelId?: string;
  tagId?: string;
  status?: StatusEntrega;
  // tela [F2]
  q?: string;                       // busca por empresa (razao/fantasia)
  grupoId?: string;                 // grupo de empresas
  passivelMulta?: boolean;          // so obrigacoes passiveis de multa
  comAnexos?: boolean;              // so entregas com anexos
  statusList?: StatusEntrega[];     // grupos das flags (Pendentes/Justificadas/Entregues/Dispensadas)
  compDe?: { ano: number; mes: number };
  compAte?: { ano: number; mes: number };
  prazoTecDe?: string;
  prazoTecAte?: string;
  prazoLegalDe?: string;
  prazoLegalAte?: string;
  entregaDe?: string;
  entregaAte?: string;
  ordem?: OrdemEntrega;
  dir?: 'asc' | 'desc';
}

function diaUTC(d: string, fimDoDia = false): Date {
  return new Date(`${d}T${fimDoDia ? '23:59:59' : '00:00:00'}.000Z`);
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
  if (f.grupoId) and.push({ empresa: { grupoEmpresaId: f.grupoId } });
  if (f.passivelMulta) and.push({ obrigacao: { passivelMulta: true } });
  if (f.comAnexos) and.push({ anexos: { some: {} } });
  if (f.status) and.push({ status: f.status });
  if (f.statusList?.length) and.push({ status: { in: f.statusList } });
  if (f.responsavelId)
    and.push({
      OR: [{ responsavelPrazoId: f.responsavelId }, { responsavelEntregaId: f.responsavelId }],
    });
  if (f.tagId) and.push({ empresa: { tags: { some: { tagId: f.tagId } } } });

  // busca por empresa (texto)
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({ empresa: { OR: [
      { razaoSocial: { contains: q, mode: 'insensitive' } },
      { nomeFantasia: { contains: q, mode: 'insensitive' } },
    ] } });
  }

  // competencia de/ate (composto ano,mes)
  if (f.compDe) and.push({ OR: [
    { competenciaAno: { gt: f.compDe.ano } },
    { competenciaAno: f.compDe.ano, competenciaMes: { gte: f.compDe.mes } },
  ] });
  if (f.compAte) and.push({ OR: [
    { competenciaAno: { lt: f.compAte.ano } },
    { competenciaAno: f.compAte.ano, competenciaMes: { lte: f.compAte.mes } },
  ] });

  // ranges de data
  if (f.prazoTecDe) and.push({ prazoTecnico: { gte: diaUTC(f.prazoTecDe) } });
  if (f.prazoTecAte) and.push({ prazoTecnico: { lte: diaUTC(f.prazoTecAte, true) } });
  if (f.prazoLegalDe) and.push({ prazoLegal: { gte: diaUTC(f.prazoLegalDe) } });
  if (f.prazoLegalAte) and.push({ prazoLegal: { lte: diaUTC(f.prazoLegalAte, true) } });
  if (f.entregaDe) and.push({ dataEntrega: { gte: diaUTC(f.entregaDe) } });
  if (f.entregaAte) and.push({ dataEntrega: { lte: diaUTC(f.entregaAte, true) } });

  // filtros forcados do usuario
  if (ff?.departamentos?.length)
    and.push({ obrigacao: { departamentoId: { in: ff.departamentos } } });
  if (ff?.tags?.length) and.push({ empresa: { tags: { some: { tagId: { in: ff.tags } } } } });

  return { AND: and };
}

function orderByDe(f: FiltrosEntrega): Prisma.EntregaOrderByWithRelationInput[] {
  const dir = f.dir ?? 'asc';
  switch (f.ordem) {
    case 'obrigacao': return [{ obrigacao: { nome: dir } }];
    case 'empresa': return [{ empresa: { razaoSocial: dir } }];
    case 'prazoTecnico': return [{ prazoTecnico: dir }];
    case 'competencia': return [{ competenciaAno: dir }, { competenciaMes: dir }];
    case 'prazoLegal':
    default: return [{ prazoLegal: dir }];
  }
}

// "0001-65" a partir do CNPJ (14 digitos): filial(4) + DV(2)
function cnpjFinal(identificadores: { tipo: string; valor: string }[]): string | null {
  const cnpj = identificadores.find((i) => i.tipo === 'CNPJ')?.valor?.replace(/\D/g, '');
  if (!cnpj || cnpj.length < 14) return null;
  return `${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
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
      orderBy: orderByDe(filtros),
      skip: pag.skip,
      take: pag.take,
      include: {
        empresa: { select: { id: true, numero: true, razaoSocial: true, nomeFantasia: true, identificadores: { select: { tipo: true, valor: true } } } },
        obrigacao: { select: { id: true, nome: true, exigeAnexoNaBaixa: true, departamento: { select: { nome: true, cor: true } } } },
        _count: { select: { anexos: true, comentarios: true, eventos: true } },
      },
    }),
    prisma.entrega.count({ where }),
  ]);

  return {
    items: items.map((e) => ({
      id: e.id,
      empresa: { id: e.empresa.id, numero: e.empresa.numero, razaoSocial: e.empresa.razaoSocial, nomeFantasia: e.empresa.nomeFantasia, cnpjFinal: cnpjFinal(e.empresa.identificadores) },
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
      qtdComentarios: e._count.comentarios,
      qtdEventos: e._count.eventos,
      numeroProtocolo: e.numeroProtocolo ?? null,
    })),
    total,
  };
}

// registra um evento no historico da demanda (balaozinho [F2])
async function registrarEvento(escritorioId: string, entregaId: string, texto: string, autorId?: string) {
  await prisma.entregaEvento.create({ data: { escritorioId, entregaId, texto, autorId: autorId ?? null } });
}

export async function listarEventos(escritorioId: string, entregaId: string) {
  return prisma.entregaEvento.findMany({
    where: { escritorioId, entregaId },
    orderBy: { createdAt: 'desc' },
  });
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
    numeroProtocolo?: string;
    vencimentoGuia?: string;
    comentario?: string;
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

  const entrega = await prisma.entrega.update({
    where: { id: e.id },
    data: {
      status: aposLegal ? 'ENTREGUE_JUSTIFICADA' : 'ENTREGUE',
      dataEntrega,
      numeroProtocolo: dados.numeroProtocolo?.trim() || null,
      vencimentoGuia: dados.vencimentoGuia ? new Date(dados.vencimentoGuia + 'T12:00:00') : null,
      justificativa: dados.justificativa?.trim() || null,
      origemBaixa: 'MANUAL',
      responsavelEntregaId: dados.atualizarResponsavel ? userId : e.responsavelEntregaId,
    },
  });

  if (dados.comentario?.trim()) {
    await prisma.entregaComentario.create({
      data: { escritorioId, entregaId: e.id, autorId: userId, texto: dados.comentario.trim() },
    });
    await registrarEvento(escritorioId, e.id, `Comentou: ${dados.comentario.trim()}`, userId);
  }
  await registrarEvento(escritorioId, e.id, `Marcou como ${aposLegal ? 'Entregue c/ multa' : 'Entregue'}${dados.numeroProtocolo?.trim() ? ` (protocolo ${dados.numeroProtocolo.trim()})` : ''}`, userId);

  return entrega;
}

// ---------- Desfazer baixa ----------
export async function desfazer(escritorioId: string, entregaId: string, userId?: string) {
  const e = await getEntrega(escritorioId, entregaId);
  const cfg = await lerConfig(escritorioId);
  const status = statusEfetivo('PENDENTE', e.prazoTecnico, e.prazoLegal, new Date(), cfg.diasAntecipado);
  const r = await prisma.entrega.update({
    where: { id: e.id },
    data: {
      status: status as StatusEntrega,
      dataEntrega: null,
      justificativa: null,
      origemBaixa: null,
    },
  });
  await registrarEvento(escritorioId, e.id, 'Desfez a baixa (demanda reaberta)', userId);
  return r;
}

// ---------- Dispensar ----------
export async function dispensar(escritorioId: string, entregaId: string, motivo: string, userId?: string) {
  const e = await getEntrega(escritorioId, entregaId);
  const r = await prisma.entrega.update({
    where: { id: e.id },
    data: { status: 'DISPENSADA', motivoDispensa: motivo || null },
  });
  await registrarEvento(escritorioId, e.id, `Dispensada${motivo ? `: ${motivo}` : ''}`, userId);
  return r;
}

// ---------- Editar prazo (inline) ----------
export async function editarPrazo(
  escritorioId: string,
  entregaId: string,
  dados: { prazoLegal?: string; prazoTecnico?: string },
  userId?: string,
) {
  const e = await getEntrega(escritorioId, entregaId);
  const cfg = await lerConfig(escritorioId);
  const fmt = (d: Date) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const prazoLegal = dados.prazoLegal ? new Date(dados.prazoLegal + 'T12:00:00') : e.prazoLegal;
  const prazoTecnico = dados.prazoTecnico ? new Date(dados.prazoTecnico + 'T12:00:00') : e.prazoTecnico;
  const status = e.status === 'ENTREGUE' || e.status === 'ENTREGUE_JUSTIFICADA' || e.status === 'DISPENSADA'
    ? e.status
    : (statusEfetivo('PENDENTE', prazoTecnico, prazoLegal, new Date(), cfg.diasAntecipado) as StatusEntrega);
  const r = await prisma.entrega.update({
    where: { id: e.id },
    data: { prazoLegal, prazoTecnico, status },
  });
  if (dados.prazoLegal && fmt(e.prazoLegal) !== fmt(prazoLegal)) await registrarEvento(escritorioId, e.id, `Atualizou o prazo legal de ${fmt(e.prazoLegal)} para ${fmt(prazoLegal)}`, userId);
  if (dados.prazoTecnico && fmt(e.prazoTecnico) !== fmt(prazoTecnico)) await registrarEvento(escritorioId, e.id, `Atualizou o prazo tecnico de ${fmt(e.prazoTecnico)} para ${fmt(prazoTecnico)}`, userId);
  return r;
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
