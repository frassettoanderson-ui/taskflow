import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { sanitizePermissions } from '../../lib/permissions.js';
import type { JanelaAcesso, PermissionFlag } from '@gestoroa/shared';

interface FiltrosForcados {
  departamentos?: string[];
  tags?: string[];
}

function publico(u: {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  tipo?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
  custoHora?: { toNumber: () => number } | number | null;
  minutosUteisMes?: number | null;
  horariosAcesso: unknown;
  filtrosForcados: unknown;
  permissao: Record<string, unknown> | null;
}) {
  const permissoes: Record<string, boolean> = {};
  if (u.permissao) {
    for (const [k, v] of Object.entries(u.permissao)) {
      if (typeof v === 'boolean') permissoes[k] = v;
    }
  }
  const custo = u.custoHora == null ? null : typeof u.custoHora === 'number' ? u.custoHora : u.custoHora.toNumber();
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    tipo: u.tipo ?? null,
    telefone: u.telefone ?? null,
    observacoes: u.observacoes ?? null,
    custoHora: custo,
    minutosUteisMes: u.minutosUteisMes ?? null,
    horariosAcesso: (u.horariosAcesso as JanelaAcesso[]) ?? [],
    filtrosForcados: (u.filtrosForcados as FiltrosForcados) ?? {},
    permissoes,
  };
}

export async function listar(escritorioId: string, incluirInativos: boolean) {
  const usuarios = await prisma.usuario.findMany({
    where: { escritorioId, deletedAt: null, ...(incluirInativos ? {} : { ativo: true }) },
    orderBy: { nome: 'asc' },
    include: { permissao: true },
  });
  return usuarios.map(publico);
}

export async function obter(escritorioId: string, id: string) {
  const u = await prisma.usuario.findFirst({
    where: { id, escritorioId, deletedAt: null },
    include: { permissao: true },
  });
  if (!u) throw Errors.naoEncontrado('Usuario');
  return publico(u);
}

export interface CriarUsuarioInput {
  nome: string;
  email: string;
  senha: string;
  ativo?: boolean;
  tipo?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
  custoHora?: number | null;
  minutosUteisMes?: number | null;
  horariosAcesso?: JanelaAcesso[];
  filtrosForcados?: FiltrosForcados;
  permissoes?: Partial<Record<PermissionFlag, boolean>>;
}

export async function criar(escritorioId: string, input: CriarUsuarioInput) {
  const existe = await prisma.usuario.findFirst({
    where: { escritorioId, email: input.email.toLowerCase(), deletedAt: null },
  });
  if (existe) throw Errors.conflito('Ja existe um usuario com esse e-mail.');

  const senhaHash = await hashPassword(input.senha);
  const u = await prisma.usuario.create({
    data: {
      escritorioId,
      nome: input.nome,
      email: input.email.toLowerCase(),
      senhaHash,
      ativo: input.ativo ?? true,
      tipo: input.tipo ?? 'Auxiliar',
      telefone: input.telefone ?? null,
      observacoes: input.observacoes ?? null,
      custoHora: input.custoHora ?? null,
      minutosUteisMes: input.minutosUteisMes ?? null,
      horariosAcesso: (input.horariosAcesso ?? []) as object,
      filtrosForcados: (input.filtrosForcados ?? {}) as object,
      permissao: { create: sanitizePermissions(input.permissoes) },
    },
    include: { permissao: true },
  });
  return publico(u);
}

export async function editar(
  escritorioId: string,
  id: string,
  input: Partial<Omit<CriarUsuarioInput, 'senha'>>,
) {
  const u = await prisma.usuario.findFirst({ where: { id, escritorioId, deletedAt: null } });
  if (!u) throw Errors.naoEncontrado('Usuario');

  await prisma.usuario.update({
    where: { id },
    data: {
      nome: input.nome ?? u.nome,
      ativo: input.ativo ?? u.ativo,
      tipo: input.tipo === undefined ? undefined : input.tipo,
      telefone: input.telefone === undefined ? undefined : input.telefone,
      observacoes: input.observacoes === undefined ? undefined : input.observacoes,
      custoHora: input.custoHora === undefined ? undefined : input.custoHora,
      minutosUteisMes: input.minutosUteisMes === undefined ? undefined : input.minutosUteisMes,
      horariosAcesso: input.horariosAcesso ? (input.horariosAcesso as object) : undefined,
      filtrosForcados: input.filtrosForcados ? (input.filtrosForcados as object) : undefined,
    },
  });

  if (input.permissoes) {
    const dados = sanitizePermissions(input.permissoes);
    await prisma.permissao.upsert({
      where: { usuarioId: id },
      create: { usuarioId: id, ...dados },
      update: dados,
    });
  }
  return obter(escritorioId, id);
}

export async function inativar(escritorioId: string, id: string, autorId: string) {
  if (id === autorId) throw Errors.validacao('Voce nao pode inativar a si mesmo.');
  const u = await prisma.usuario.findFirst({ where: { id, escritorioId, deletedAt: null } });
  if (!u) throw Errors.naoEncontrado('Usuario');
  await prisma.usuario.update({ where: { id }, data: { ativo: false } });
  // revoga sessoes ativas
  await prisma.sessao.updateMany({ where: { usuarioId: id, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function redefinirSenha(escritorioId: string, id: string, novaSenha: string) {
  const u = await prisma.usuario.findFirst({ where: { id, escritorioId, deletedAt: null } });
  if (!u) throw Errors.naoEncontrado('Usuario');
  await prisma.usuario.update({ where: { id }, data: { senhaHash: await hashPassword(novaSenha) } });
  await prisma.sessao.updateMany({ where: { usuarioId: id, revokedAt: null }, data: { revokedAt: new Date() } });
}

// Replicar permissoes e/ou horarios de um usuario origem para varios destinos.
export async function replicar(
  escritorioId: string,
  origemId: string,
  destinos: string[],
  opcoes: { permissoes: boolean; horarios: boolean; filtros: boolean },
) {
  const origem = await prisma.usuario.findFirst({
    where: { id: origemId, escritorioId, deletedAt: null },
    include: { permissao: true },
  });
  if (!origem) throw Errors.naoEncontrado('Usuario origem');

  const permData = origem.permissao
    ? Object.fromEntries(
        Object.entries(origem.permissao).filter(([k]) => k !== 'id' && k !== 'usuarioId'),
      )
    : {};

  let afetados = 0;
  for (const destinoId of destinos) {
    if (destinoId === origemId) continue;
    const destino = await prisma.usuario.findFirst({ where: { id: destinoId, escritorioId, deletedAt: null } });
    if (!destino) continue;

    if (opcoes.permissoes) {
      await prisma.permissao.upsert({
        where: { usuarioId: destinoId },
        create: { usuarioId: destinoId, ...(permData as object) },
        update: permData as object,
      });
    }
    if (opcoes.horarios || opcoes.filtros) {
      await prisma.usuario.update({
        where: { id: destinoId },
        data: {
          ...(opcoes.horarios ? { horariosAcesso: origem.horariosAcesso as object } : {}),
          ...(opcoes.filtros ? { filtrosForcados: origem.filtrosForcados as object } : {}),
        },
      });
    }
    afetados++;
  }
  return { afetados };
}
