import { addDays } from 'date-fns';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import * as empresaObrigacao from '../obrigacao/empresaObrigacao.service.js';

// ---------- Instanciar um processo a partir de uma matriz ----------
export async function instanciar(escritorioId: string, matrizId: string, empresaId: string) {
  const matriz = await prisma.matrizProcesso.findFirst({
    where: { id: matrizId, escritorioId },
    include: { passos: { orderBy: { ordem: 'asc' } } },
  });
  if (!matriz) throw Errors.naoEncontrado('Matriz');
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, escritorioId, deletedAt: null } });
  if (!empresa) throw Errors.naoEncontrado('Empresa');

  const inicio = new Date();
  let prazoAnterior = inicio;
  const passosData = matriz.passos.map((p) => {
    const base = p.basePrazo === 'PASSO_ANTERIOR' ? prazoAnterior : inicio;
    const prazo = p.prazoDias > 0 ? addDays(base, p.prazoDias) : null;
    if (prazo) prazoAnterior = prazo;
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

  return prisma.processo.create({
    data: {
      escritorioId,
      matrizId,
      empresaId,
      nome: matriz.nome,
      dataInicio: inicio,
      passos: { create: passosData },
    },
    include: { passos: true },
  });
}

// ---------- Listagem (auto-retoma suspensos vencidos) ----------
export async function listar(escritorioId: string, filtros: { status?: string; matrizId?: string; empresaId?: string }) {
  // retoma processos cuja suspensao expirou
  await prisma.processo.updateMany({
    where: { escritorioId, status: 'SUSPENSO', suspensoAte: { lte: new Date() } },
    data: { status: 'EM_ANDAMENTO', suspensoAte: null },
  });

  const processos = await prisma.processo.findMany({
    where: {
      escritorioId,
      ...(filtros.status ? { status: filtros.status as never } : {}),
      ...(filtros.matrizId ? { matrizId: filtros.matrizId } : {}),
      ...(filtros.empresaId ? { empresaId: filtros.empresaId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      empresa: { select: { razaoSocial: true } },
      matriz: { select: { nome: true } },
      passos: { select: { status: true } },
    },
  });
  return processos.map((p) => {
    const total = p.passos.length;
    const concluidos = p.passos.filter((x) => x.status !== 'PENDENTE').length;
    return {
      id: p.id, nome: p.nome, status: p.status, dataInicio: p.dataInicio, suspensoAte: p.suspensoAte,
      empresa: p.empresa, matriz: p.matriz,
      progresso: total ? Math.round((concluidos / total) * 100) : 0,
      totalPassos: total, passosConcluidos: concluidos,
    };
  });
}

export async function obter(escritorioId: string, id: string) {
  const p = await prisma.processo.findFirst({
    where: { id, escritorioId },
    include: {
      empresa: { select: { id: true, razaoSocial: true } },
      matriz: { select: { nome: true } },
      passos: { orderBy: { ordem: 'asc' } },
      comentarios: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!p) throw Errors.naoEncontrado('Processo');
  return p;
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
    await prisma.processo.update({ where: { id: processoId }, data: { status: 'CONCLUIDO' } });
  }
}

export async function dispensarPasso(escritorioId: string, passoId: string) {
  const passo = await getProcessoDoPasso(escritorioId, passoId);
  await prisma.processoPasso.update({ where: { id: passoId }, data: { status: 'DISPENSADO', concluidoEm: new Date() } });
  await verificarConclusao(passo.processoId);
  return obter(escritorioId, passo.processoId);
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
  return prisma.processo.update({ where: { id: processoId }, data: { status, suspensoAte: null } });
}

export async function excluirMassa(escritorioId: string, ids: string[]) {
  const r = await prisma.processo.deleteMany({ where: { id: { in: ids }, escritorioId } });
  return { excluidos: r.count };
}
