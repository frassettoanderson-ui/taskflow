import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import { soDigitos, identificadorValido } from '../../lib/identificadores.js';
import type { AuthUser } from '../../middleware/auth.js';
import type { ParsedPagination } from '../../lib/http.js';

type FiltrosForcados = AuthUser['filtrosForcados'];

// Monta o filtro de tenant + filtros forcados do usuario (departamentos/tags).
function baseWhere(
  escritorioId: string,
  filtros: FiltrosForcados,
): Prisma.EmpresaWhereInput {
  const where: Prisma.EmpresaWhereInput = { escritorioId, deletedAt: null };
  const and: Prisma.EmpresaWhereInput[] = [];

  if (filtros?.tags?.length) {
    and.push({ tags: { some: { tagId: { in: filtros.tags } } } });
  }
  if (filtros?.departamentos?.length) {
    and.push({
      responsaveis: { some: { departamentoId: { in: filtros.departamentos } } },
    });
  }
  if (and.length) where.AND = and;
  return where;
}

export interface ListarParams {
  busca?: string;
  tagId?: string;
  regimeId?: string;
  departamentoId?: string;
  status?: 'ativos' | 'inativos' | 'todos';
}

export async function listar(
  escritorioId: string,
  filtrosForcados: FiltrosForcados,
  params: ListarParams,
  pag: ParsedPagination,
) {
  const where = baseWhere(escritorioId, filtrosForcados);
  const and: Prisma.EmpresaWhereInput[] = Array.isArray(where.AND)
    ? [...where.AND]
    : where.AND
      ? [where.AND]
      : [];

  if (params.status === 'ativos' || !params.status) and.push({ ativo: true });
  else if (params.status === 'inativos') and.push({ ativo: false });

  if (params.tagId) and.push({ tags: { some: { tagId: params.tagId } } });
  if (params.regimeId) and.push({ regimeTributarioId: params.regimeId });
  if (params.departamentoId)
    and.push({
      responsaveis: { some: { departamentoId: params.departamentoId } },
    });

  if (params.busca?.trim()) {
    const termo = params.busca.trim();
    const digitos = soDigitos(termo);
    const ors: Prisma.EmpresaWhereInput[] = [
      { razaoSocial: { contains: termo, mode: 'insensitive' } },
      { nomeFantasia: { contains: termo, mode: 'insensitive' } },
    ];
    if (digitos.length >= 2) {
      ors.push({
        identificadores: { some: { valor: { contains: digitos } } },
      });
    }
    and.push({ OR: ors });
  }

  if (and.length) where.AND = and;

  const [items, total] = await Promise.all([
    prisma.empresa.findMany({
      where,
      orderBy: { razaoSocial: 'asc' },
      skip: pag.skip,
      take: pag.take,
      include: {
        identificadores: { where: { tipo: 'CNPJ' }, take: 1 },
        tags: { include: { tag: true } },
        regimeTributario: { select: { nome: true } },
        _count: { select: { contatos: true } },
      },
    }),
    prisma.empresa.count({ where }),
  ]);

  return {
    items: items.map((e) => ({
      id: e.id,
      razaoSocial: e.razaoSocial,
      nomeFantasia: e.nomeFantasia,
      ativo: e.ativo,
      cnpj: e.identificadores[0]?.valor ?? null,
      telefone: e.telefone ?? null,
      cidade: e.endereco ?? null,
      regimeTributarioId: e.regimeTributarioId,
      regimeNome: e.regimeTributario?.nome ?? null,
      tags: e.tags.map((t) => ({ id: t.tag.id, nome: t.tag.nome, cor: t.tag.cor })),
      qtdContatos: e._count.contatos,
    })),
    total,
  };
}

export async function obter(escritorioId: string, id: string) {
  const empresa = await prisma.empresa.findFirst({
    where: { id, escritorioId, deletedAt: null },
    include: {
      identificadores: { orderBy: { createdAt: 'asc' } },
      contatos: { orderBy: { nome: 'asc' } },
      anexos: { orderBy: { createdAt: 'desc' } },
      comentarios: {
        orderBy: { createdAt: 'desc' },
        include: { departamento: { select: { nome: true, cor: true } } },
      },
      responsaveis: true,
      tags: { include: { tag: true } },
    },
  });
  if (!empresa) throw Errors.naoEncontrado('Empresa');
  return empresa;
}

async function validarIdentificadores(
  escritorioId: string,
  ids: { tipo: string; valor: string }[],
  ignorarEmpresaId?: string,
) {
  for (const item of ids) {
    const valor = soDigitos(item.valor);
    if (!identificadorValido(item.tipo as never, valor)) {
      throw Errors.validacao(
        `Identificador ${item.tipo} invalido: ${item.valor}`,
      );
    }
    const existe = await prisma.empresaIdentificador.findFirst({
      where: {
        escritorioId,
        tipo: item.tipo as never,
        valor,
        ...(ignorarEmpresaId ? { empresaId: { not: ignorarEmpresaId } } : {}),
      },
      include: { empresa: { select: { razaoSocial: true } } },
    });
    if (existe) {
      throw Errors.conflito(
        `O ${item.tipo} ${item.valor} ja pertence a "${existe.empresa.razaoSocial}".`,
      );
    }
  }
}

interface CriarInput {
  razaoSocial: string;
  nomeFantasia?: string | null;
  emailPrincipal?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  regimeTributarioId?: string | null;
  anotacoes?: string | null;
  ativo?: boolean;
  dataEntrada?: string | null;
  dataSaida?: string | null;
  tagIds?: string[];
  identificadores?: { tipo: string; valor: string; apelido?: string | null }[];
}

export async function criar(escritorioId: string, input: CriarInput) {
  const ids = input.identificadores ?? [];
  await validarIdentificadores(escritorioId, ids);

  return prisma.empresa.create({
    data: {
      escritorioId,
      razaoSocial: input.razaoSocial,
      nomeFantasia: input.nomeFantasia || null,
      emailPrincipal: input.emailPrincipal || null,
      telefone: input.telefone || null,
      endereco: input.endereco || null,
      regimeTributarioId: input.regimeTributarioId || null,
      anotacoes: input.anotacoes || null,
      ativo: input.ativo ?? true,
      dataEntrada: input.dataEntrada ? new Date(input.dataEntrada) : null,
      dataSaida: input.dataSaida ? new Date(input.dataSaida) : null,
      tags: input.tagIds?.length
        ? { create: input.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
      identificadores: ids.length
        ? {
            create: ids.map((i) => ({
              escritorioId,
              tipo: i.tipo as never,
              valor: soDigitos(i.valor),
              apelido: i.apelido || null,
            })),
          }
        : undefined,
    },
    include: { identificadores: true, tags: { include: { tag: true } } },
  });
}

export async function editar(
  escritorioId: string,
  id: string,
  input: Partial<CriarInput>,
) {
  const empresa = await prisma.empresa.findFirst({
    where: { id, escritorioId, deletedAt: null },
  });
  if (!empresa) throw Errors.naoEncontrado('Empresa');

  // tags: substitui o conjunto se enviado
  const tagOps = input.tagIds
    ? {
        deleteMany: {},
        create: input.tagIds.map((tagId) => ({ tagId })),
      }
    : undefined;

  return prisma.empresa.update({
    where: { id },
    data: {
      razaoSocial: input.razaoSocial ?? empresa.razaoSocial,
      nomeFantasia:
        input.nomeFantasia === undefined ? empresa.nomeFantasia : input.nomeFantasia || null,
      emailPrincipal:
        input.emailPrincipal === undefined ? empresa.emailPrincipal : input.emailPrincipal || null,
      telefone: input.telefone === undefined ? empresa.telefone : input.telefone || null,
      endereco: input.endereco === undefined ? empresa.endereco : input.endereco || null,
      regimeTributarioId:
        input.regimeTributarioId === undefined
          ? empresa.regimeTributarioId
          : input.regimeTributarioId || null,
      anotacoes: input.anotacoes === undefined ? empresa.anotacoes : input.anotacoes || null,
      ativo: input.ativo ?? empresa.ativo,
      dataEntrada:
        input.dataEntrada === undefined
          ? empresa.dataEntrada
          : input.dataEntrada
            ? new Date(input.dataEntrada)
            : null,
      dataSaida:
        input.dataSaida === undefined
          ? empresa.dataSaida
          : input.dataSaida
            ? new Date(input.dataSaida)
            : null,
      tags: tagOps,
    },
    include: { identificadores: true, tags: { include: { tag: true } } },
  });
}

export async function excluir(escritorioId: string, id: string) {
  const empresa = await prisma.empresa.findFirst({
    where: { id, escritorioId, deletedAt: null },
  });
  if (!empresa) throw Errors.naoEncontrado('Empresa');
  await prisma.empresa.update({
    where: { id },
    data: { deletedAt: new Date(), ativo: false },
  });
}

// ---------- Identificadores ----------
export async function adicionarIdentificador(
  escritorioId: string,
  empresaId: string,
  input: { tipo: string; valor: string; apelido?: string | null },
) {
  await garantirEmpresa(escritorioId, empresaId);
  await validarIdentificadores(escritorioId, [input]);
  return prisma.empresaIdentificador.create({
    data: {
      escritorioId,
      empresaId,
      tipo: input.tipo as never,
      valor: soDigitos(input.valor),
      apelido: input.apelido || null,
    },
  });
}

export async function removerIdentificador(
  escritorioId: string,
  empresaId: string,
  identId: string,
) {
  const ident = await prisma.empresaIdentificador.findFirst({
    where: { id: identId, empresaId, escritorioId },
  });
  if (!ident) throw Errors.naoEncontrado('Identificador');
  // Modulo 5/3: bloquear exclusao se houver historico vinculado (entregas/robo).
  // Ainda nao existe historico nesta fase; quando existir, validar aqui e exigir transferencia.
  await prisma.empresaIdentificador.delete({ where: { id: identId } });
}

// Transferir um identificador para outra empresa (alternativa a exclusao).
export async function transferirIdentificador(
  escritorioId: string,
  identId: string,
  destinoEmpresaId: string,
) {
  const ident = await prisma.empresaIdentificador.findFirst({
    where: { id: identId, escritorioId },
  });
  if (!ident) throw Errors.naoEncontrado('Identificador');
  await garantirEmpresa(escritorioId, destinoEmpresaId);
  return prisma.empresaIdentificador.update({
    where: { id: identId },
    data: { empresaId: destinoEmpresaId },
  });
}

// ---------- Contatos ----------
export async function listarContatos(escritorioId: string, empresaId: string) {
  await garantirEmpresa(escritorioId, empresaId);
  return prisma.empresaContato.findMany({
    where: { empresaId, escritorioId },
    orderBy: { nome: 'asc' },
  });
}

export async function salvarContato(
  escritorioId: string,
  empresaId: string,
  input: {
    nome: string;
    email?: string | null;
    whatsapp?: string | null;
    cargo?: string | null;
    departamentoIds?: string[];
    obrigacaoIds?: string[];
    ativo?: boolean;
  },
  contatoId?: string,
) {
  await garantirEmpresa(escritorioId, empresaId);
  const data = {
    nome: input.nome,
    email: input.email || null,
    whatsapp: input.whatsapp ? soDigitos(input.whatsapp) : null,
    cargo: input.cargo || null,
    departamentoIds: input.departamentoIds ?? [],
    obrigacaoIds: input.obrigacaoIds ?? [],
    ativo: input.ativo ?? true,
  };
  if (contatoId) {
    const existe = await prisma.empresaContato.findFirst({
      where: { id: contatoId, empresaId, escritorioId },
    });
    if (!existe) throw Errors.naoEncontrado('Contato');
    return prisma.empresaContato.update({ where: { id: contatoId }, data });
  }
  return prisma.empresaContato.create({
    data: { escritorioId, empresaId, ...data },
  });
}

export async function removerContato(
  escritorioId: string,
  empresaId: string,
  contatoId: string,
) {
  const c = await prisma.empresaContato.findFirst({
    where: { id: contatoId, empresaId, escritorioId },
  });
  if (!c) throw Errors.naoEncontrado('Contato');
  await prisma.empresaContato.delete({ where: { id: contatoId } });
}

// ---------- Comentarios ----------
export async function adicionarComentario(
  escritorioId: string,
  empresaId: string,
  autorId: string,
  texto: string,
  departamentoId?: string | null,
) {
  await garantirEmpresa(escritorioId, empresaId);
  return prisma.empresaComentario.create({
    data: {
      escritorioId,
      empresaId,
      autorId,
      texto,
      departamentoId: departamentoId || null,
    },
    include: { departamento: { select: { nome: true, cor: true } } },
  });
}

// ---------- Responsaveis por departamento ----------
export async function definirResponsavel(
  escritorioId: string,
  empresaId: string,
  departamentoId: string,
  usuarioId: string,
) {
  await garantirEmpresa(escritorioId, empresaId);
  return prisma.empresaResponsavelDepartamento.upsert({
    where: { empresaId_departamentoId: { empresaId, departamentoId } },
    create: { escritorioId, empresaId, departamentoId, usuarioId },
    update: { usuarioId },
  });
}

// ---------- Acoes em massa ----------
export async function acaoEmMassa(
  escritorioId: string,
  input: {
    empresaIds: string[];
    acao: 'aplicar_tags' | 'alterar_responsavel' | 'inativar' | 'ativar';
    tagIds?: string[];
    departamentoId?: string;
    usuarioId?: string;
  },
) {
  // Garante que todas as empresas sao do tenant.
  const empresas = await prisma.empresa.findMany({
    where: { id: { in: input.empresaIds }, escritorioId, deletedAt: null },
    select: { id: true },
  });
  const ids = empresas.map((e) => e.id);
  if (!ids.length) throw Errors.naoEncontrado('Empresas');

  if (input.acao === 'inativar' || input.acao === 'ativar') {
    await prisma.empresa.updateMany({
      where: { id: { in: ids } },
      data: { ativo: input.acao === 'ativar' },
    });
  } else if (input.acao === 'aplicar_tags') {
    if (!input.tagIds?.length) throw Errors.validacao('Selecione as tags.');
    for (const empresaId of ids) {
      for (const tagId of input.tagIds) {
        await prisma.empresaTag
          .create({ data: { empresaId, tagId } })
          .catch(() => undefined); // ignora duplicatas
      }
    }
  } else if (input.acao === 'alterar_responsavel') {
    if (!input.departamentoId || !input.usuarioId)
      throw Errors.validacao('Informe departamento e usuario.');
    for (const empresaId of ids) {
      await prisma.empresaResponsavelDepartamento.upsert({
        where: {
          empresaId_departamentoId: {
            empresaId,
            departamentoId: input.departamentoId,
          },
        },
        create: {
          escritorioId,
          empresaId,
          departamentoId: input.departamentoId,
          usuarioId: input.usuarioId,
        },
        update: { usuarioId: input.usuarioId },
      });
    }
  }
  return { afetadas: ids.length };
}

// ---------- Importacao CSV ----------
export async function importarCsv(
  escritorioId: string,
  linhas: {
    razaoSocial: string;
    nomeFantasia?: string;
    emailPrincipal?: string;
    telefone?: string;
    endereco?: string;
    chaveTipo?: string;
    chaveValor?: string;
  }[],
) {
  const resultado = {
    criadas: 0,
    erros: [] as { linha: number; erro: string }[],
  };

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    try {
      const ids =
        l.chaveTipo && l.chaveValor
          ? [{ tipo: l.chaveTipo, valor: l.chaveValor }]
          : [];
      await criar(escritorioId, {
        razaoSocial: l.razaoSocial,
        nomeFantasia: l.nomeFantasia,
        emailPrincipal: l.emailPrincipal,
        telefone: l.telefone,
        endereco: l.endereco,
        identificadores: ids,
      });
      resultado.criadas++;
    } catch (err) {
      resultado.erros.push({
        linha: i + 1,
        erro: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }
  return resultado;
}

async function garantirEmpresa(escritorioId: string, empresaId: string) {
  const e = await prisma.empresa.findFirst({
    where: { id: empresaId, escritorioId, deletedAt: null },
    select: { id: true },
  });
  if (!e) throw Errors.naoEncontrado('Empresa');
}
