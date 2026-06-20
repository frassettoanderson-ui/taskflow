import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { sanitizePermissions } from '../../lib/permissions.js';
import { nivelParaFlags, flagsParaNiveis, type JanelaAcesso, type PermissionFlag, type PermissionNiveis } from '@gestoroa/shared';

interface FiltrosForcados {
  departamentos?: string[];
  tags?: string[];
}

type Dec = { toNumber: () => number } | number | null | undefined;
const dec = (v: Dec) => (v == null ? null : typeof v === 'number' ? v : v.toNumber());

function publico(u: {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  tipo?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
  custoHora?: Dec;
  minutosUteisMes?: number | null;
  salario?: Dec;
  encargos?: Dec;
  beneficios?: Dec;
  smtpHost?: string | null;
  smtpPorta?: number | null;
  smtpUsuario?: string | null;
  smtpSenha?: string | null;
  ccoEmails?: string | null;
  assinaturaArquivo?: string | null;
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
  // niveis: usa o salvo; se vazio (usuario antigo), deriva das flags
  const niveisSalvos = (u.permissao?.niveis as PermissionNiveis | undefined) ?? {};
  const niveis = Object.keys(niveisSalvos).length > 0 ? niveisSalvos : flagsParaNiveis(permissoes as never);
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    tipo: u.tipo ?? null,
    telefone: u.telefone ?? null,
    observacoes: u.observacoes ?? null,
    custoHora: dec(u.custoHora),
    minutosUteisMes: u.minutosUteisMes ?? null,
    salario: dec(u.salario),
    encargos: dec(u.encargos),
    beneficios: dec(u.beneficios),
    smtpHost: u.smtpHost ?? null,
    smtpPorta: u.smtpPorta ?? null,
    smtpUsuario: u.smtpUsuario ?? null,
    temSmtpSenha: !!u.smtpSenha,
    ccoEmails: u.ccoEmails ?? null,
    temAssinatura: !!u.assinaturaArquivo,
    horariosAcesso: (u.horariosAcesso as JanelaAcesso[]) ?? [],
    filtrosForcados: (u.filtrosForcados as FiltrosForcados) ?? {},
    permissoes,
    niveis,
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
  salario?: number | null;
  encargos?: number | null;
  beneficios?: number | null;
  smtpHost?: string | null;
  smtpPorta?: number | null;
  smtpUsuario?: string | null;
  smtpSenha?: string | null;
  ccoEmails?: string | null;
  horariosAcesso?: JanelaAcesso[];
  filtrosForcados?: FiltrosForcados;
  permissoes?: Partial<Record<PermissionFlag, boolean>>;
  niveis?: PermissionNiveis;
}

export async function criar(escritorioId: string, input: CriarUsuarioInput) {
  const existe = await prisma.usuario.findFirst({
    where: { escritorioId, email: input.email.toLowerCase(), deletedAt: null },
  });
  if (existe) throw Errors.conflito('Ja existe um usuario com esse e-mail.');

  // niveis tem prioridade: deriva as flags. Sem niveis, usa permissoes (legado).
  const flags = input.niveis ? nivelParaFlags(input.niveis) : input.permissoes;
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
      salario: input.salario ?? null,
      encargos: input.encargos ?? null,
      beneficios: input.beneficios ?? null,
      smtpHost: input.smtpHost ?? null,
      smtpPorta: input.smtpPorta ?? null,
      smtpUsuario: input.smtpUsuario ?? null,
      smtpSenha: input.smtpSenha || null,
      ccoEmails: input.ccoEmails ?? null,
      horariosAcesso: (input.horariosAcesso ?? []) as object,
      filtrosForcados: (input.filtrosForcados ?? {}) as object,
      permissao: { create: { ...sanitizePermissions(flags), niveis: (input.niveis ?? {}) as object } },
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
      salario: input.salario === undefined ? undefined : input.salario,
      encargos: input.encargos === undefined ? undefined : input.encargos,
      beneficios: input.beneficios === undefined ? undefined : input.beneficios,
      smtpHost: input.smtpHost === undefined ? undefined : input.smtpHost,
      smtpPorta: input.smtpPorta === undefined ? undefined : input.smtpPorta,
      smtpUsuario: input.smtpUsuario === undefined ? undefined : input.smtpUsuario,
      smtpSenha: input.smtpSenha ? input.smtpSenha : undefined,
      ccoEmails: input.ccoEmails === undefined ? undefined : input.ccoEmails,
      horariosAcesso: input.horariosAcesso ? (input.horariosAcesso as object) : undefined,
      filtrosForcados: input.filtrosForcados ? (input.filtrosForcados as object) : undefined,
    },
  });

  if (input.niveis) {
    const dados = sanitizePermissions(nivelParaFlags(input.niveis));
    await prisma.permissao.upsert({
      where: { usuarioId: id },
      create: { usuarioId: id, ...dados, niveis: input.niveis as object },
      update: { ...dados, niveis: input.niveis as object },
    });
  } else if (input.permissoes) {
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

// Transferir responsabilidade de um usuario (origem) para outro (destino).
// Reatribui: responsavel por departamento das empresas, gestor/responsavel de
// departamentos, demandas pendentes da Lista de Entregas e processos em aberto.
export async function transferirResponsabilidade(
  escritorioId: string,
  deUsuarioId: string,
  paraUsuarioId: string,
  opcoes: { departamentosEmpresa: boolean; entregasPendentes: boolean; processos: boolean; departamentosGestor: boolean },
) {
  if (deUsuarioId === paraUsuarioId) throw Errors.validacao('Origem e destino devem ser diferentes.');
  const origem = await prisma.usuario.findFirst({ where: { id: deUsuarioId, escritorioId, deletedAt: null } });
  const destino = await prisma.usuario.findFirst({ where: { id: paraUsuarioId, escritorioId, deletedAt: null } });
  if (!origem) throw Errors.naoEncontrado('Usuario origem');
  if (!destino) throw Errors.naoEncontrado('Usuario destino');

  const resultado = { responsaveisDepartamento: 0, entregas: 0, processos: 0, departamentos: 0 };

  if (opcoes.departamentosEmpresa) {
    const r = await prisma.empresaResponsavelDepartamento.updateMany({
      where: { escritorioId, usuarioId: deUsuarioId },
      data: { usuarioId: paraUsuarioId },
    });
    resultado.responsaveisDepartamento = r.count;
  }

  if (opcoes.entregasPendentes) {
    const pendentes: ('PENDENTE' | 'PENDENTE_ANTECIPADO' | 'EM_ATRASO_TECNICO' | 'EM_ATRASO_LEGAL')[] =
      ['PENDENTE', 'PENDENTE_ANTECIPADO', 'EM_ATRASO_TECNICO', 'EM_ATRASO_LEGAL'];
    const a = await prisma.entrega.updateMany({
      where: { escritorioId, responsavelPrazoId: deUsuarioId, status: { in: pendentes } },
      data: { responsavelPrazoId: paraUsuarioId },
    });
    const b = await prisma.entrega.updateMany({
      where: { escritorioId, responsavelEntregaId: deUsuarioId, status: { in: pendentes } },
      data: { responsavelEntregaId: paraUsuarioId },
    });
    resultado.entregas = a.count + b.count;
  }

  if (opcoes.processos) {
    const r = await prisma.processo.updateMany({
      where: { escritorioId, gestorId: deUsuarioId, status: { in: ['EM_ANDAMENTO', 'SUSPENSO'] } },
      data: { gestorId: paraUsuarioId },
    });
    resultado.processos = r.count;
  }

  if (opcoes.departamentosGestor) {
    const r = await prisma.departamento.updateMany({
      where: { escritorioId, responsavelId: deUsuarioId },
      data: { responsavelId: paraUsuarioId },
    });
    // gestoresIds e' Json (array): troca origem por destino mantendo unicidade
    const deps = await prisma.departamento.findMany({ where: { escritorioId } });
    for (const dep of deps) {
      const ids = Array.isArray(dep.gestoresIds) ? (dep.gestoresIds as string[]) : [];
      if (ids.includes(deUsuarioId)) {
        const novos = Array.from(new Set(ids.map((x) => (x === deUsuarioId ? paraUsuarioId : x))));
        await prisma.departamento.update({ where: { id: dep.id }, data: { gestoresIds: novos as object } });
      }
    }
    resultado.departamentos = r.count;
  }

  return resultado;
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
