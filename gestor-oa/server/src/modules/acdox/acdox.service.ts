import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';

// ---------- Reguas de cobranca (matrizes) ----------
export async function listarReguas(escritorioId: string) {
  const reguas = await prisma.reguaCobranca.findMany({
    where: { escritorioId },
    orderBy: { createdAt: 'desc' },
    include: { itens: { orderBy: { ordem: 'asc' } }, _count: { select: { empresas: true, cobrancas: true } } },
  });
  return reguas.map((r) => ({
    id: r.id, nome: r.nome, diaLimite: r.diaLimite, departamentoId: r.departamentoId,
    lembreteAntesDias: r.lembreteAntesDias, lembreteDepoisDias: r.lembreteDepoisDias,
    modeloEmail: r.modeloEmail, ativo: r.ativo,
    itens: r.itens, empresasCount: r._count.empresas, cobrancasCount: r._count.cobrancas,
  }));
}

export async function obterRegua(escritorioId: string, id: string) {
  const r = await prisma.reguaCobranca.findFirst({
    where: { id, escritorioId },
    include: { itens: { orderBy: { ordem: 'asc' } }, empresas: true },
  });
  if (!r) throw Errors.naoEncontrado('Regua de cobranca');
  return { ...r, empresaIds: r.empresas.map((e) => e.empresaId) };
}

interface ReguaInput {
  nome: string; diaLimite: number; departamentoId?: string | null;
  lembreteAntesDias?: number | null; lembreteDepoisDias?: number | null; modeloEmail?: string | null;
  ativo?: boolean; itens: string[]; empresaIds: string[];
}

export async function criarRegua(escritorioId: string, input: ReguaInput) {
  return prisma.reguaCobranca.create({
    data: {
      escritorioId, nome: input.nome, diaLimite: input.diaLimite,
      departamentoId: input.departamentoId || null,
      lembreteAntesDias: input.lembreteAntesDias ?? null, lembreteDepoisDias: input.lembreteDepoisDias ?? null,
      modeloEmail: input.modeloEmail || null, ativo: input.ativo ?? true,
      itens: { create: input.itens.map((nome, ordem) => ({ nome, ordem })) },
      empresas: { create: input.empresaIds.map((empresaId) => ({ empresaId })) },
    },
  });
}

export async function editarRegua(escritorioId: string, id: string, input: Partial<ReguaInput>) {
  const r = await prisma.reguaCobranca.findFirst({ where: { id, escritorioId } });
  if (!r) throw Errors.naoEncontrado('Regua de cobranca');
  await prisma.reguaCobranca.update({
    where: { id },
    data: {
      nome: input.nome ?? r.nome,
      diaLimite: input.diaLimite ?? r.diaLimite,
      departamentoId: input.departamentoId === undefined ? r.departamentoId : input.departamentoId || null,
      lembreteAntesDias: input.lembreteAntesDias === undefined ? r.lembreteAntesDias : input.lembreteAntesDias,
      lembreteDepoisDias: input.lembreteDepoisDias === undefined ? r.lembreteDepoisDias : input.lembreteDepoisDias,
      modeloEmail: input.modeloEmail === undefined ? r.modeloEmail : input.modeloEmail || null,
      ativo: input.ativo ?? r.ativo,
    },
  });
  if (input.itens) {
    await prisma.reguaCobrancaItem.deleteMany({ where: { reguaId: id } });
    await prisma.reguaCobrancaItem.createMany({ data: input.itens.map((nome, ordem) => ({ reguaId: id, nome, ordem })) });
  }
  if (input.empresaIds) {
    await prisma.reguaCobrancaEmpresa.deleteMany({ where: { reguaId: id } });
    if (input.empresaIds.length) await prisma.reguaCobrancaEmpresa.createMany({ data: input.empresaIds.map((empresaId) => ({ reguaId: id, empresaId })) });
  }
  return obterRegua(escritorioId, id);
}

export async function excluirRegua(escritorioId: string, id: string) {
  const r = await prisma.reguaCobranca.findFirst({ where: { id, escritorioId } });
  if (!r) throw Errors.naoEncontrado('Regua de cobranca');
  await prisma.reguaCobranca.delete({ where: { id } });
}

// ---------- Geracao de cobrancas (por competencia) ----------
export async function gerarCompetencia(escritorioId: string, ano: number, mes: number) {
  const reguas = await prisma.reguaCobranca.findMany({
    where: { escritorioId, ativo: true },
    include: { itens: { orderBy: { ordem: 'asc' } }, empresas: true },
  });
  let criadas = 0;
  for (const r of reguas) {
    const dataLimite = new Date(Date.UTC(ano, mes - 1, r.diaLimite, 12, 0, 0));
    for (const e of r.empresas) {
      const existe = await prisma.cobrancaDoc.findUnique({
        where: { reguaId_empresaId_competenciaAno_competenciaMes: { reguaId: r.id, empresaId: e.empresaId, competenciaAno: ano, competenciaMes: mes } },
      });
      if (existe) continue;
      await prisma.cobrancaDoc.create({
        data: {
          escritorioId, reguaId: r.id, empresaId: e.empresaId, competenciaAno: ano, competenciaMes: mes, dataLimite,
          itens: { create: r.itens.map((it) => ({ nome: it.nome })) },
        },
      });
      criadas++;
    }
  }
  return { criadas };
}

// ---------- Cobrancas (consumo interno) ----------
function statusVigente(status: string, dataLimite: Date): string {
  if (status === 'PENDENTE' && dataLimite < new Date()) return 'VENCIDO';
  return status;
}

export async function listarCobrancas(escritorioId: string, filtros: { ano?: number; mes?: number; status?: string; reguaId?: string }) {
  const cobrancas = await prisma.cobrancaDoc.findMany({
    where: {
      escritorioId,
      ...(filtros.ano ? { competenciaAno: filtros.ano } : {}),
      ...(filtros.mes ? { competenciaMes: filtros.mes } : {}),
      ...(filtros.reguaId ? { reguaId: filtros.reguaId } : {}),
    },
    orderBy: { dataLimite: 'asc' },
    include: { regua: { select: { nome: true } }, _count: { select: { itens: true } } },
  });
  const empresaIds = [...new Set(cobrancas.map((c) => c.empresaId))];
  const empresas = await prisma.empresa.findMany({ where: { id: { in: empresaIds } }, select: { id: true, razaoSocial: true, numero: true } });
  const empMap = new Map(empresas.map((e) => [e.id, e]));
  const recebidos = await prisma.cobrancaDocItem.groupBy({ by: ['cobrancaId', 'status'], where: { cobranca: { escritorioId } }, _count: true });
  const recMap = new Map<string, Record<string, number>>();
  for (const r of recebidos) {
    const cur = recMap.get(r.cobrancaId) ?? {};
    cur[r.status] = r._count; recMap.set(r.cobrancaId, cur);
  }
  let lista = cobrancas.map((c) => ({
    id: c.id, reguaNome: c.regua.nome, reguaId: c.reguaId,
    empresa: empMap.get(c.empresaId)?.razaoSocial ?? '?', empresaNumero: empMap.get(c.empresaId)?.numero ?? null,
    competencia: `${String(c.competenciaMes).padStart(2, '0')}/${c.competenciaAno}`,
    dataLimite: c.dataLimite, status: statusVigente(c.status, c.dataLimite),
    totalItens: c._count.itens, porStatus: recMap.get(c.id) ?? {},
  }));
  if (filtros.status) lista = lista.filter((c) => c.status === filtros.status);
  return lista;
}

export async function obterCobranca(escritorioId: string, id: string) {
  const c = await prisma.cobrancaDoc.findFirst({
    where: { id, escritorioId },
    include: { regua: { select: { nome: true } }, itens: true },
  });
  if (!c) throw Errors.naoEncontrado('Cobranca');
  const empresa = await prisma.empresa.findUnique({ where: { id: c.empresaId }, select: { razaoSocial: true, numero: true } });
  return {
    id: c.id, reguaNome: c.regua.nome, empresa: empresa?.razaoSocial ?? '?', empresaNumero: empresa?.numero ?? null,
    competencia: `${String(c.competenciaMes).padStart(2, '0')}/${c.competenciaAno}`,
    dataLimite: c.dataLimite, status: statusVigente(c.status, c.dataLimite),
    itens: c.itens.map((it) => ({ id: it.id, nome: it.nome, status: it.status, arquivo: it.arquivo, justificativa: it.justificativa, validadoEm: it.validadoEm })),
  };
}

// recalcula o status geral a partir dos itens
async function recomputar(cobrancaId: string) {
  const c = await prisma.cobrancaDoc.findUnique({ where: { id: cobrancaId }, include: { itens: true } });
  if (!c) return;
  const itens = c.itens;
  let novo = 'PENDENTE';
  if (itens.length > 0 && itens.every((i) => i.status === 'VALIDADO')) novo = 'VALIDADO';
  else if (itens.some((i) => i.status === 'RECEBIDO' || i.status === 'VALIDADO')) novo = 'RECEBIDO';
  if (novo === 'PENDENTE' && c.dataLimite < new Date()) novo = 'VENCIDO';
  await prisma.cobrancaDoc.update({ where: { id: cobrancaId }, data: { status: novo } });
}

export async function acaoItem(
  escritorioId: string, cobrancaId: string, itemId: string,
  acao: 'receber' | 'validar' | 'recusar', dados: { justificativa?: string; arquivo?: string }, userId: string,
) {
  const cob = await prisma.cobrancaDoc.findFirst({ where: { id: cobrancaId, escritorioId } });
  if (!cob) throw Errors.naoEncontrado('Cobranca');
  const item = await prisma.cobrancaDocItem.findFirst({ where: { id: itemId, cobrancaId } });
  if (!item) throw Errors.naoEncontrado('Item');
  const status = acao === 'validar' ? 'VALIDADO' : acao === 'recusar' ? 'RECUSADO' : 'RECEBIDO';
  await prisma.cobrancaDocItem.update({
    where: { id: itemId },
    data: {
      status,
      justificativa: acao === 'recusar' ? (dados.justificativa || 'Documento recusado') : item.justificativa,
      arquivo: dados.arquivo ?? item.arquivo,
      validadoPorId: userId, validadoEm: new Date(),
    },
  });
  await recomputar(cobrancaId);
  return obterCobranca(escritorioId, cobrancaId);
}

// ---------- Dashboard ----------
export async function dashboard(escritorioId: string, ano?: number, mes?: number) {
  const cobrancas = await prisma.cobrancaDoc.findMany({
    where: { escritorioId, ...(ano ? { competenciaAno: ano } : {}), ...(mes ? { competenciaMes: mes } : {}) },
    select: { status: true, dataLimite: true },
  });
  const c = { PENDENTE: 0, VENCIDO: 0, RECEBIDO: 0, VALIDADO: 0, RECUSADO: 0 };
  for (const cob of cobrancas) {
    const s = statusVigente(cob.status, cob.dataLimite) as keyof typeof c;
    if (s in c) c[s]++;
  }
  return { total: cobrancas.length, ...c };
}
