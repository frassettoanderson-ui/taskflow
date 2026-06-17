import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import type { OrigemObrigacao } from '@gestoroa/shared';

interface Origem {
  origem: OrigemObrigacao;
  refId?: string | null;
}

// Serializa origens para o tipo Json esperado pelo Prisma.
const J = (o: Origem[]): Prisma.InputJsonValue => o as unknown as Prisma.InputJsonValue;

function lerOrigens(json: unknown): Origem[] {
  if (Array.isArray(json)) return json as Origem[];
  return [];
}

function temOrigem(origens: Origem[], origem: OrigemObrigacao, refId?: string | null): boolean {
  return origens.some((o) => o.origem === origem && (refId === undefined || o.refId === refId));
}

function addOrigem(origens: Origem[], nova: Origem): Origem[] {
  if (temOrigem(origens, nova.origem, nova.refId)) return origens;
  return [...origens, nova];
}

function removerOrigens(
  origens: Origem[],
  origem: OrigemObrigacao,
  refId?: string | null,
): Origem[] {
  return origens.filter((o) => {
    if (o.origem !== origem) return true;
    if (refId === undefined) return false; // remove todas daquela origem
    return o.refId !== refId;
  });
}

async function garantirEmpresa(escritorioId: string, empresaId: string) {
  const e = await prisma.empresa.findFirst({
    where: { id: empresaId, escritorioId, deletedAt: null },
    select: { id: true },
  });
  if (!e) throw Errors.naoEncontrado('Empresa');
}

// Upsert do vinculo aplicando uma transformacao nas origens.
async function aplicarNoVinculo(
  tx: typeof prisma,
  escritorioId: string,
  empresaId: string,
  obrigacaoId: string,
  transform: (origens: Origem[]) => Origem[],
) {
  const existente = await tx.empresaObrigacao.findUnique({
    where: { empresaId_obrigacaoId: { empresaId, obrigacaoId } },
  });
  const origensAtuais = existente ? lerOrigens(existente.origens) : [];
  const novasOrigens = transform(origensAtuais);
  const ativo = novasOrigens.length > 0;

  if (existente) {
    await tx.empresaObrigacao.update({
      where: { id: existente.id },
      data: { origens: J(novasOrigens), ativo },
    });
  } else if (novasOrigens.length > 0) {
    await tx.empresaObrigacao.create({
      data: { escritorioId, empresaId, obrigacaoId, origens: J(novasOrigens), ativo },
    });
  }
}

// ---------- Listagem ----------
export async function listarPorEmpresa(escritorioId: string, empresaId: string) {
  await garantirEmpresa(escritorioId, empresaId);
  const itens = await prisma.empresaObrigacao.findMany({
    where: { empresaId, escritorioId },
    include: {
      obrigacao: { include: { departamento: { select: { id: true, nome: true, cor: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return itens.map((eo) => ({
    id: eo.id,
    obrigacaoId: eo.obrigacaoId,
    obrigacao: eo.obrigacao,
    origens: lerOrigens(eo.origens),
    ativo: eo.ativo,
    responsavelId: eo.responsavelId,
    diaPrazoOverride: eo.diaPrazoOverride,
    honorario: eo.honorario ? Number(eo.honorario) : null,
    tempoPrevistoOverride: eo.tempoPrevistoOverride,
  }));
}

// ---------- Regime: SUBSTITUI as obrigacoes de origem REGIME ----------
export async function aplicarRegime(
  escritorioId: string,
  empresaId: string,
  regimeId: string | null,
) {
  await garantirEmpresa(escritorioId, empresaId);

  let obrigacoesDoRegime: string[] = [];
  if (regimeId) {
    const regime = await prisma.regimeTributario.findFirst({
      where: { id: regimeId, escritorioId },
      include: { obrigacoes: true },
    });
    if (!regime) throw Errors.naoEncontrado('Regime');
    obrigacoesDoRegime = regime.obrigacoes.map((o) => o.obrigacaoId);
  }

  await prisma.$transaction(async (tx) => {
    const eos = await tx.empresaObrigacao.findMany({ where: { empresaId, escritorioId } });

    // 1. Remove a origem REGIME de TODOS (tira o regime anterior).
    for (const eo of eos) {
      const novas = removerOrigens(lerOrigens(eo.origens), 'REGIME');
      await tx.empresaObrigacao.update({
        where: { id: eo.id },
        data: { origens: J(novas), ativo: novas.length > 0 },
      });
    }

    // 2. Adiciona as do novo regime.
    for (const obrigacaoId of obrigacoesDoRegime) {
      await aplicarNoVinculo(tx as typeof prisma, escritorioId, empresaId, obrigacaoId, (o) =>
        addOrigem(o, { origem: 'REGIME', refId: regimeId }),
      );
    }

    // 3. Atualiza o regime da empresa.
    await tx.empresa.update({
      where: { id: empresaId },
      data: { regimeTributarioId: regimeId },
    });
  });

  return listarPorEmpresa(escritorioId, empresaId);
}

// ---------- Grupo: apenas ADICIONA ----------
export async function aplicarGrupo(escritorioId: string, empresaId: string, grupoId: string) {
  await garantirEmpresa(escritorioId, empresaId);
  const grupo = await prisma.grupoObrigacoes.findFirst({
    where: { id: grupoId, escritorioId },
    include: { obrigacoes: true },
  });
  if (!grupo) throw Errors.naoEncontrado('Grupo');

  await prisma.$transaction(async (tx) => {
    for (const go of grupo.obrigacoes) {
      await aplicarNoVinculo(tx as typeof prisma, escritorioId, empresaId, go.obrigacaoId, (o) =>
        addOrigem(o, { origem: 'GRUPO', refId: grupoId }),
      );
    }
  });
  return listarPorEmpresa(escritorioId, empresaId);
}

// Remover grupo: tira a origem GRUPO daquele grupo; se ficar sem origens, inativa.
export async function removerGrupo(escritorioId: string, empresaId: string, grupoId: string) {
  await garantirEmpresa(escritorioId, empresaId);
  await prisma.$transaction(async (tx) => {
    const eos = await tx.empresaObrigacao.findMany({ where: { empresaId, escritorioId } });
    for (const eo of eos) {
      const origens = lerOrigens(eo.origens);
      if (!temOrigem(origens, 'GRUPO', grupoId)) continue;
      const novas = removerOrigens(origens, 'GRUPO', grupoId);
      await tx.empresaObrigacao.update({
        where: { id: eo.id },
        data: { origens: J(novas), ativo: novas.length > 0 },
      });
    }
  });
  return listarPorEmpresa(escritorioId, empresaId);
}

// ---------- Manual ----------
export async function adicionarManual(escritorioId: string, empresaId: string, obrigacaoId: string) {
  await garantirEmpresa(escritorioId, empresaId);
  const obrig = await prisma.obrigacao.findFirst({
    where: { id: obrigacaoId, escritorioId, deletedAt: null },
  });
  if (!obrig) throw Errors.naoEncontrado('Obrigacao');
  await prisma.$transaction(async (tx) => {
    await aplicarNoVinculo(tx as typeof prisma, escritorioId, empresaId, obrigacaoId, (o) =>
      addOrigem(o, { origem: 'MANUAL', refId: null }),
    );
  });
  return listarPorEmpresa(escritorioId, empresaId);
}

// Remover origem MANUAL (ou inativar de vez).
export async function removerManual(escritorioId: string, empresaObrigacaoId: string) {
  const eo = await prisma.empresaObrigacao.findFirst({
    where: { id: empresaObrigacaoId, escritorioId },
  });
  if (!eo) throw Errors.naoEncontrado('Vinculo');
  const novas = removerOrigens(lerOrigens(eo.origens), 'MANUAL');
  await prisma.empresaObrigacao.update({
    where: { id: eo.id },
    data: { origens: J(novas), ativo: novas.length > 0 },
  });
  return { ok: true };
}

export async function atualizarOverrides(
  escritorioId: string,
  empresaObrigacaoId: string,
  dados: {
    responsavelId?: string | null;
    diaPrazoOverride?: number | null;
    honorario?: number | null;
    tempoPrevistoOverride?: number | null;
  },
) {
  const eo = await prisma.empresaObrigacao.findFirst({
    where: { id: empresaObrigacaoId, escritorioId },
  });
  if (!eo) throw Errors.naoEncontrado('Vinculo');
  return prisma.empresaObrigacao.update({
    where: { id: eo.id },
    data: {
      responsavelId: dados.responsavelId === undefined ? eo.responsavelId : dados.responsavelId,
      diaPrazoOverride: dados.diaPrazoOverride === undefined ? eo.diaPrazoOverride : dados.diaPrazoOverride,
      honorario: dados.honorario === undefined ? eo.honorario : dados.honorario,
      tempoPrevistoOverride:
        dados.tempoPrevistoOverride === undefined ? eo.tempoPrevistoOverride : dados.tempoPrevistoOverride,
    },
  });
}

// ---------- Alocacao em massa ----------
// Aloca uma obrigacao (MANUAL) em N empresas, ou aplica um grupo em N empresas.
export async function alocarEmMassa(
  escritorioId: string,
  input: { empresaIds: string[]; obrigacaoId?: string; grupoId?: string },
) {
  const empresas = await prisma.empresa.findMany({
    where: { id: { in: input.empresaIds }, escritorioId, deletedAt: null },
    select: { id: true },
  });
  let afetadas = 0;
  for (const e of empresas) {
    if (input.grupoId) await aplicarGrupo(escritorioId, e.id, input.grupoId);
    else if (input.obrigacaoId) await adicionarManual(escritorioId, e.id, input.obrigacaoId);
    afetadas++;
  }
  return { afetadas };
}
