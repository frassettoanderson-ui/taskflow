import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';

export interface NovoDocumento {
  raiz: string;
  pasta: string;
  nomeArquivo: string;
  caminho: string;
  tamanho: number;
  mimeType?: string | null;
  origem: 'MANUAL' | 'ENTREGA' | 'ROBO';
  entregaId?: string | null;
  uploadedById?: string | null;
}

export async function adicionar(escritorioId: string, empresaId: string, doc: NovoDocumento) {
  return prisma.documentoGED.create({
    data: {
      escritorioId,
      empresaId,
      raiz: doc.raiz,
      pasta: doc.pasta,
      nomeArquivo: doc.nomeArquivo,
      caminho: doc.caminho,
      tamanho: doc.tamanho,
      mimeType: doc.mimeType ?? null,
      origem: doc.origem,
      entregaId: doc.entregaId ?? null,
      uploadedById: doc.uploadedById ?? null,
    },
  });
}

export async function listar(
  escritorioId: string,
  empresaId: string,
  filtros: { raiz?: string; busca?: string },
) {
  const e = await prisma.empresa.findFirst({ where: { id: empresaId, escritorioId, deletedAt: null }, select: { id: true } });
  if (!e) throw Errors.naoEncontrado('Empresa');
  return prisma.documentoGED.findMany({
    where: {
      escritorioId,
      empresaId,
      ...(filtros.raiz ? { raiz: filtros.raiz } : {}),
      ...(filtros.busca ? { nomeArquivo: { contains: filtros.busca, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ pasta: 'asc' }, { createdAt: 'desc' }],
  });
}

// Painel de armazenamento: espaco por empresa + total + limite.
export async function painelArmazenamento(escritorioId: string) {
  const grupos = await prisma.documentoGED.groupBy({
    by: ['empresaId'],
    where: { escritorioId },
    _sum: { tamanho: true },
    _count: true,
  });
  const empresas = await prisma.empresa.findMany({
    where: { escritorioId, deletedAt: null },
    select: { id: true, razaoSocial: true },
  });
  const mapaNome = new Map(empresas.map((e) => [e.id, e.razaoSocial]));

  const cfg = (await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } })).config as Record<string, unknown>;
  const limiteMB = typeof cfg.limiteArmazenamentoMB === 'number' ? cfg.limiteArmazenamentoMB : null;

  const porEmpresa = grupos
    .map((g) => ({
      empresaId: g.empresaId,
      razaoSocial: mapaNome.get(g.empresaId) ?? '—',
      bytes: g._sum.tamanho ?? 0,
      arquivos: g._count,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const totalBytes = porEmpresa.reduce((s, e) => s + e.bytes, 0);
  return { porEmpresa, totalBytes, limiteMB };
}
