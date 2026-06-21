import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Registra alteracoes do departamento no log de auditoria (entidade='Departamento').
const J = (v: unknown): Prisma.InputJsonValue => (v ?? {}) as Prisma.InputJsonValue;
async function auditarDep(escritorioId: string, usuarioId: string | undefined, acao: string, entidadeId: string, antes: unknown, depois: unknown) {
  await prisma.logAuditoria
    .create({ data: { escritorioId, usuarioId: usuarioId ?? null, acao, entidade: 'Departamento', entidadeId, antes: J(antes), depois: J(depois) } })
    .catch(() => undefined);
}

function publico(d: {
  id: string; nome: string; cor: string; responsavelId: string | null; gestoresIds: unknown; ativo: boolean;
  parentId: string | null; envioAgendado: string; disponivelSolicitacoes: boolean; responderPara: string | null;
  _count?: { obrigacoes: number };
}) {
  const gestores = Array.isArray(d.gestoresIds) ? (d.gestoresIds as string[]) : [];
  return {
    id: d.id,
    nome: d.nome,
    cor: d.cor,
    responsavelId: d.responsavelId,
    gestoresIds: gestores,
    ativo: d.ativo,
    parentId: d.parentId,
    envioAgendado: d.envioAgendado,
    disponivelSolicitacoes: d.disponivelSolicitacoes,
    responderPara: d.responderPara,
    obrigacoesCount: d._count?.obrigacoes ?? 0,
  };
}

// Listar departamentos do escritorio (com contagem de obrigacoes)
router.get('/', async (req, res) => {
  const itens = await prisma.departamento.findMany({
    where: { escritorioId: req.auth!.escritorioId },
    orderBy: { nome: 'asc' },
    include: { _count: { select: { obrigacoes: true } } },
  });
  return ok(res, itens.map(publico));
});

// Obter um departamento (para a tela de detalhe)
router.get('/:id', async (req, res) => {
  const dep = await prisma.departamento.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    include: { _count: { select: { obrigacoes: true } } },
  });
  if (!dep) throw Errors.naoEncontrado('Departamento');
  return ok(res, publico(dep));
});

const upsertSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto.'),
  cor: z.string().optional(),
  responsavelId: z.string().optional().nullable(),
  gestoresIds: z.array(z.string()).optional(),
  ativo: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
  envioAgendado: z.string().optional(),
  disponivelSolicitacoes: z.boolean().optional(),
  responderPara: z.string().email('E-mail invalido.').optional().nullable().or(z.literal('')),
});

router.post(
  '/',
  requirePermission('admin_escritorio'),
  validate({ body: upsertSchema }),
  async (req, res) => {
    const existe = await prisma.departamento.findFirst({
      where: { escritorioId: req.auth!.escritorioId, nome: req.body.nome },
    });
    if (existe) throw Errors.conflito('Ja existe um departamento com esse nome.');
    const gestores = req.body.gestoresIds ?? [];
    const dep = await prisma.departamento.create({
      data: {
        escritorioId: req.auth!.escritorioId,
        nome: req.body.nome,
        cor: req.body.cor ?? '#0f5c5e',
        gestoresIds: gestores,
        responsavelId: gestores[0] ?? req.body.responsavelId ?? null,
        ativo: req.body.ativo ?? true,
        parentId: req.body.parentId ?? null,
        envioAgendado: req.body.envioAgendado ?? 'De hora em hora',
        disponivelSolicitacoes: req.body.disponivelSolicitacoes ?? true,
        responderPara: req.body.responderPara || null,
      },
      include: { _count: { select: { obrigacoes: true } } },
    });
    await auditarDep(req.auth!.escritorioId, req.auth!.id, 'CREATE', dep.id, null, { nome: dep.nome });
    return ok(res, publico(dep), 201);
  },
);

router.put(
  '/:id',
  requirePermission('admin_escritorio'),
  validate({ body: upsertSchema.partial() }),
  async (req, res) => {
    const dep = await prisma.departamento.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!dep) throw Errors.naoEncontrado('Departamento');
    // evita ciclo: nao pode ser pai de si mesmo
    const parentId = req.body.parentId === undefined ? dep.parentId : req.body.parentId;
    if (parentId === dep.id) throw Errors.validacao('Um departamento nao pode ser pai de si mesmo.');
    const gestores = req.body.gestoresIds;
    const atualizado = await prisma.departamento.update({
      where: { id: dep.id },
      data: {
        nome: req.body.nome ?? dep.nome,
        cor: req.body.cor ?? dep.cor,
        gestoresIds: gestores === undefined ? undefined : gestores,
        responsavelId: gestores === undefined
          ? (req.body.responsavelId === undefined ? dep.responsavelId : req.body.responsavelId)
          : (gestores[0] ?? null),
        ativo: req.body.ativo ?? dep.ativo,
        parentId,
        envioAgendado: req.body.envioAgendado ?? dep.envioAgendado,
        disponivelSolicitacoes: req.body.disponivelSolicitacoes ?? dep.disponivelSolicitacoes,
        responderPara: req.body.responderPara === undefined ? dep.responderPara : (req.body.responderPara || null),
      },
      include: { _count: { select: { obrigacoes: true } } },
    });
    const campos = ['nome', 'envioAgendado', 'responderPara', 'disponivelSolicitacoes', 'parentId', 'gestoresIds', 'cor'] as const;
    const pick = (o: Record<string, unknown>) => Object.fromEntries(campos.map((c) => [c, o[c]]));
    await auditarDep(req.auth!.escritorioId, req.auth!.id, 'UPDATE', dep.id, pick(dep as unknown as Record<string, unknown>), pick(atualizado as unknown as Record<string, unknown>));
    return ok(res, publico(atualizado));
  },
);

// Log das alteracoes desse departamento (ultimas 15) - para o rodape da ficha
router.get('/:id/log', async (req, res) => {
  const logs = await prisma.logAuditoria.findMany({
    where: { escritorioId: req.auth!.escritorioId, entidade: 'Departamento', entidadeId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: { usuario: { select: { nome: true } } },
  });
  return ok(res, logs);
});

router.delete(
  '/:id',
  requirePermission('admin_escritorio'),
  async (req, res) => {
    const dep = await prisma.departamento.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    });
    if (!dep) throw Errors.naoEncontrado('Departamento');
    const [qtdObr, qtdResp, qtdFilhos] = await Promise.all([
      prisma.obrigacao.count({ where: { departamentoId: dep.id } }),
      prisma.empresaResponsavelDepartamento.count({ where: { departamentoId: dep.id } }),
      prisma.departamento.count({ where: { parentId: dep.id } }),
    ]);
    if (qtdObr > 0) throw Errors.conflito(`Ha ${qtdObr} obrigacao(oes) nesse departamento. Realoque antes de excluir.`);
    if (qtdResp > 0) throw Errors.conflito('Ha empresas com responsaveis nesse departamento. Remova antes de excluir.');
    if (qtdFilhos > 0) throw Errors.conflito('Ha sub-departamentos. Exclua-os antes.');
    await prisma.departamento.delete({ where: { id: dep.id } });
    return ok(res, { excluido: true });
  },
);

export default router;
