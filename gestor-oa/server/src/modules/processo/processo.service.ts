import { addDays } from 'date-fns';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import * as empresaObrigacao from '../obrigacao/empresaObrigacao.service.js';

// ---------- Instanciar um processo a partir de uma matriz ----------
export async function instanciar(
  escritorioId: string,
  matrizId: string,
  empresaId: string,
  extra: { titulo?: string; observacoes?: string; gestorId?: string } = {},
) {
  const matriz = await prisma.matrizProcesso.findFirst({
    where: { id: matrizId, escritorioId },
    include: { passos: { orderBy: { ordem: 'asc' } } },
  });
  if (!matriz) throw Errors.naoEncontrado('Matriz');
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, escritorioId, deletedAt: null } });
  if (!empresa) throw Errors.naoEncontrado('Empresa');

  const inicio = new Date();
  let prazoAnterior = inicio;
  let previsao: Date | null = null;
  const passosData = matriz.passos.map((p) => {
    const base = p.basePrazo === 'PASSO_ANTERIOR' ? prazoAnterior : inicio;
    const prazo = p.prazoDias > 0 ? addDays(base, p.prazoDias) : null;
    if (prazo) { prazoAnterior = prazo; previsao = prazo; }
    return {
      ordem: p.ordem,
      titulo: p.titulo,
      descricao: p.descricao,
      departamentoId: p.departamentoId,
      bloqueante: p.bloqueante,
      prazo,
      acaoAutomatica: p.acaoAutomatica,
      acaoRef: p.acaoRef,
    };
  });

  // numero sequencial por escritorio ([ID])
  const ultimo = await prisma.processo.aggregate({ where: { escritorioId }, _max: { numero: true } });

  return prisma.processo.create({
    data: {
      escritorioId,
      matrizId,
      empresaId,
      nome: matriz.nome,
      numero: (ultimo._max.numero ?? 0) + 1,
      titulo: extra.titulo?.trim() || matriz.nome,
      observacoes: extra.observacoes?.trim() || null,
      departamentoId: matriz.departamentoId,
      gestorId: extra.gestorId || null,
      previsaoConclusao: previsao,
      dataInicio: inicio,
      passos: { create: passosData },
    },
    include: { passos: true },
  });
}

// "0001-17" a partir do CNPJ (14 digitos): filial(4) + DV(2)
function cnpjFinal(identificadores: { tipo: string; valor: string }[]): string | null {
  const cnpj = identificadores.find((i) => i.tipo === 'CNPJ')?.valor?.replace(/\D/g, '');
  if (!cnpj || cnpj.length < 14) return null;
  return `${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

interface FiltrosProcesso {
  status?: string;
  statusList?: string[];
  matrizId?: string;
  empresaId?: string;
  q?: string;
  inicioDe?: string; inicioAte?: string;
  conclusaoDe?: string; conclusaoAte?: string;
}

// ---------- Listagem (auto-retoma suspensos vencidos) ----------
export async function listar(escritorioId: string, filtros: FiltrosProcesso) {
  // retoma processos cuja suspensao expirou
  await prisma.processo.updateMany({
    where: { escritorioId, status: 'SUSPENSO', suspensoAte: { lte: new Date() } },
    data: { status: 'EM_ANDAMENTO', suspensoAte: null },
  });

  const and: Record<string, unknown>[] = [{ escritorioId }];
  if (filtros.status) and.push({ status: filtros.status });
  if (filtros.statusList?.length) and.push({ status: { in: filtros.statusList } });
  if (filtros.matrizId) and.push({ matrizId: filtros.matrizId });
  if (filtros.empresaId) and.push({ empresaId: filtros.empresaId });
  if (filtros.inicioDe) and.push({ dataInicio: { gte: new Date(`${filtros.inicioDe}T00:00:00.000Z`) } });
  if (filtros.inicioAte) and.push({ dataInicio: { lte: new Date(`${filtros.inicioAte}T23:59:59.000Z`) } });
  if (filtros.conclusaoDe) and.push({ previsaoConclusao: { gte: new Date(`${filtros.conclusaoDe}T00:00:00.000Z`) } });
  if (filtros.conclusaoAte) and.push({ previsaoConclusao: { lte: new Date(`${filtros.conclusaoAte}T23:59:59.000Z`) } });
  if (filtros.q?.trim()) {
    const q = filtros.q.trim();
    and.push({ OR: [
      { titulo: { contains: q, mode: 'insensitive' } },
      { nome: { contains: q, mode: 'insensitive' } },
      { observacoes: { contains: q, mode: 'insensitive' } },
      { empresa: { razaoSocial: { contains: q, mode: 'insensitive' } } },
    ] });
  }

  const processos = await prisma.processo.findMany({
    where: { AND: and as never },
    orderBy: { numero: 'desc' },
    include: {
      empresa: { select: { numero: true, razaoSocial: true, identificadores: { select: { tipo: true, valor: true } } } },
      matriz: { select: { nome: true } },
      passos: { select: { status: true } },
    },
  });
  const hoje = new Date();
  return processos.map((p) => {
    const total = p.passos.length;
    const concluidos = p.passos.filter((x) => x.status !== 'PENDENTE').length;
    const fim = p.dataConclusao ?? hoje;
    const diasCorridos = Math.max(0, Math.round((fim.getTime() - p.dataInicio.getTime()) / 86400000));
    return {
      id: p.id, numero: p.numero, nome: p.nome, titulo: p.titulo, observacoes: p.observacoes,
      status: p.status, dataInicio: p.dataInicio, previsaoConclusao: p.previsaoConclusao, dataConclusao: p.dataConclusao,
      suspensoAte: p.suspensoAte, departamentoId: p.departamentoId, gestorId: p.gestorId,
      empresa: p.empresa ? { numero: p.empresa.numero, razaoSocial: p.empresa.razaoSocial, cnpjFinal: cnpjFinal(p.empresa.identificadores) } : null,
      matriz: p.matriz, diasCorridos,
      progresso: total ? Math.round((concluidos / total) * 100) : 0,
      totalPassos: total, passosConcluidos: concluidos,
    };
  });
}

export async function obter(escritorioId: string, id: string) {
  const p = await prisma.processo.findFirst({
    where: { id, escritorioId },
    include: {
      empresa: { select: { id: true, numero: true, razaoSocial: true, identificadores: { select: { tipo: true, valor: true } } } },
      matriz: { select: { nome: true } },
      passos: { orderBy: { ordem: 'asc' } },
      comentarios: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!p) throw Errors.naoEncontrado('Processo');
  const { identificadores, ...empresa } = p.empresa;
  return { ...p, empresa: { ...empresa, cnpjFinal: cnpjFinal(identificadores) } };
}

async function getProcessoDoPasso(escritorioId: string, passoId: string) {
  const passo = await prisma.processoPasso.findUnique({
    where: { id: passoId },
    include: { processo: true },
  });
  if (!passo || passo.processo.escritorioId !== escritorioId) throw Errors.naoEncontrado('Passo');
  return passo;
}

// ---------- Concluir passo (com bloqueantes e acoes automaticas) ----------
export async function concluirPasso(escritorioId: string, passoId: string) {
  const passo = await getProcessoDoPasso(escritorioId, passoId);
  if (passo.status !== 'PENDENTE') throw Errors.validacao('Passo ja finalizado.');

  // bloqueantes anteriores precisam estar concluidos/dispensados
  const anterioresBloqueantes = await prisma.processoPasso.findMany({
    where: { processoId: passo.processoId, bloqueante: true, ordem: { lt: passo.ordem }, status: 'PENDENTE' },
  });
  if (anterioresBloqueantes.length > 0) {
    throw Errors.validacao('Existe um passo bloqueante anterior ainda pendente.');
  }

  await prisma.processoPasso.update({
    where: { id: passoId },
    data: { status: 'CONCLUIDO', concluidoEm: new Date() },
  });

  // acao automatica
  await executarAcao(escritorioId, passo.processoId, passo.acaoAutomatica, passo.acaoRef);

  await verificarConclusao(passo.processoId);
  return obter(escritorioId, passo.processoId);
}

async function executarAcao(escritorioId: string, processoId: string, acao: string, ref: string | null) {
  if (acao === 'NENHUMA' || !acao) return;
  const processo = await prisma.processo.findUnique({ where: { id: processoId } });
  if (!processo) return;

  if (acao === 'CRIAR_OBRIGACAO_NA_EMPRESA' && ref) {
    const obrig = await prisma.obrigacao.findFirst({ where: { escritorioId, nome: ref, deletedAt: null } });
    if (obrig) await empresaObrigacao.adicionarManual(escritorioId, processo.empresaId, obrig.id).catch(() => undefined);
  } else if (acao === 'INICIAR_SUBPROCESSO' && ref) {
    await instanciar(escritorioId, ref, processo.empresaId).catch(() => undefined);
  } else if (acao === 'CRIAR_TAREFA') {
    await prisma.processoComentario.create({
      data: { processoId, texto: `Tarefa criada automaticamente: ${ref ?? 'sem descricao'}` },
    });
  }
}

async function verificarConclusao(processoId: string) {
  const pendentes = await prisma.processoPasso.count({ where: { processoId, status: 'PENDENTE' } });
  if (pendentes === 0) {
    await prisma.processo.update({ where: { id: processoId }, data: { status: 'CONCLUIDO', dataConclusao: new Date() } });
  }
}

export async function dispensarPasso(escritorioId: string, passoId: string) {
  const passo = await getProcessoDoPasso(escritorioId, passoId);
  await prisma.processoPasso.update({ where: { id: passoId }, data: { status: 'DISPENSADO', concluidoEm: new Date() } });
  await verificarConclusao(passo.processoId);
  return obter(escritorioId, passo.processoId);
}

// ---------- Reabrir passo (volta para PENDENTE) ----------
export async function reabrirPasso(escritorioId: string, passoId: string) {
  const passo = await getProcessoDoPasso(escritorioId, passoId);
  await prisma.processoPasso.update({ where: { id: passoId }, data: { status: 'PENDENTE', concluidoEm: null } });
  // reabre o processo se estava concluido
  if (passo.processo.status === 'CONCLUIDO') {
    await prisma.processo.update({ where: { id: passo.processoId }, data: { status: 'EM_ANDAMENTO', dataConclusao: null } });
  }
  return obter(escritorioId, passo.processoId);
}

// ---------- Editar cabecalho (titulo, observacoes, gestor) ----------
export async function editar(escritorioId: string, id: string, dados: { titulo?: string; observacoes?: string; gestorId?: string | null }) {
  const p = await prisma.processo.findFirst({ where: { id, escritorioId } });
  if (!p) throw Errors.naoEncontrado('Processo');
  return prisma.processo.update({
    where: { id },
    data: {
      titulo: dados.titulo === undefined ? p.titulo : dados.titulo,
      observacoes: dados.observacoes === undefined ? p.observacoes : (dados.observacoes || null),
      gestorId: dados.gestorId === undefined ? p.gestorId : (dados.gestorId || null),
    },
  });
}

export async function adicionarPasso(escritorioId: string, processoId: string, dados: { titulo: string; descricao?: string; departamentoId?: string; bloqueante?: boolean; prazoDias?: number }) {
  const p = await prisma.processo.findFirst({ where: { id: processoId, escritorioId } });
  if (!p) throw Errors.naoEncontrado('Processo');
  const max = await prisma.processoPasso.aggregate({ where: { processoId }, _max: { ordem: true } });
  // reabre processo concluido se adicionar passo
  if (p.status === 'CONCLUIDO') await prisma.processo.update({ where: { id: processoId }, data: { status: 'EM_ANDAMENTO' } });
  await prisma.processoPasso.create({
    data: {
      processoId, ordem: (max._max.ordem ?? 0) + 1, titulo: dados.titulo, descricao: dados.descricao || null,
      departamentoId: dados.departamentoId || null, bloqueante: dados.bloqueante ?? false,
      prazo: dados.prazoDias ? addDays(new Date(), dados.prazoDias) : null,
    },
  });
  return obter(escritorioId, processoId);
}

export async function comentar(escritorioId: string, processoId: string, texto: string, autorId: string) {
  const p = await prisma.processo.findFirst({ where: { id: processoId, escritorioId } });
  if (!p) throw Errors.naoEncontrado('Processo');
  await prisma.processoComentario.create({ data: { processoId, texto, autorId } });
  return obter(escritorioId, processoId);
}

export async function suspender(escritorioId: string, processoId: string, dias: number) {
  const p = await prisma.processo.findFirst({ where: { id: processoId, escritorioId } });
  if (!p) throw Errors.naoEncontrado('Processo');
  return prisma.processo.update({
    where: { id: processoId },
    data: { status: 'SUSPENSO', suspensoAte: addDays(new Date(), dias) },
  });
}

export async function mudarStatus(escritorioId: string, processoId: string, status: 'EM_ANDAMENTO' | 'CANCELADO' | 'CONCLUIDO') {
  const p = await prisma.processo.findFirst({ where: { id: processoId, escritorioId } });
  if (!p) throw Errors.naoEncontrado('Processo');
  const dataConclusao = status === 'EM_ANDAMENTO' ? null : (p.dataConclusao ?? new Date());
  return prisma.processo.update({ where: { id: processoId }, data: { status, suspensoAte: null, dataConclusao } });
}

export async function excluirMassa(escritorioId: string, ids: string[]) {
  const r = await prisma.processo.deleteMany({ where: { id: { in: ids }, escritorioId } });
  return { excluidos: r.count };
}
