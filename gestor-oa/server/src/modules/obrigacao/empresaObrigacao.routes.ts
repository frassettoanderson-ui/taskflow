import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import * as svc from './empresaObrigacao.service.js';

const router = Router();
router.use(authenticate);

const gerenciar = requirePermission('obrigacoes_gerenciar');

// Listar vinculos de uma empresa
router.get('/empresa/:empresaId', async (req, res) => {
  const r = await svc.listarPorEmpresa(req.auth!.escritorioId, req.params.empresaId);
  return ok(res, r);
});

// Painel da empresa: setores + obrigacoes com contadores (4 cores)
router.get('/empresa/:empresaId/painel', async (req, res) => {
  const r = await svc.painelPorEmpresa(req.auth!.escritorioId, req.params.empresaId);
  return ok(res, r);
});

// Aplicar/trocar regime (substitui origens REGIME)
router.put(
  '/empresa/:empresaId/regime',
  gerenciar,
  validate({ body: z.object({ regimeId: z.string().nullable() }) }),
  async (req, res) => {
    const r = await svc.aplicarRegime(req.auth!.escritorioId, req.params.empresaId, req.body.regimeId);
    return ok(res, r);
  },
);

// Aplicar grupo (adiciona)
router.post(
  '/empresa/:empresaId/grupo',
  gerenciar,
  validate({ body: z.object({ grupoId: z.string() }) }),
  async (req, res) => {
    const r = await svc.aplicarGrupo(req.auth!.escritorioId, req.params.empresaId, req.body.grupoId);
    return ok(res, r);
  },
);

// Remover grupo
router.delete('/empresa/:empresaId/grupo/:grupoId', gerenciar, async (req, res) => {
  const r = await svc.removerGrupo(req.auth!.escritorioId, req.params.empresaId, req.params.grupoId);
  return ok(res, r);
});

// Adicionar obrigacao manual
router.post(
  '/empresa/:empresaId/manual',
  gerenciar,
  validate({ body: z.object({ obrigacaoId: z.string() }) }),
  async (req, res) => {
    const r = await svc.adicionarManual(req.auth!.escritorioId, req.params.empresaId, req.body.obrigacaoId);
    return ok(res, r);
  },
);

// Remover origem manual de um vinculo
router.delete('/vinculo/:eoId/manual', gerenciar, async (req, res) => {
  const r = await svc.removerManual(req.auth!.escritorioId, req.params.eoId);
  return ok(res, r);
});

// Atualizar overrides do vinculo
router.put(
  '/vinculo/:eoId/overrides',
  gerenciar,
  validate({
    body: z.object({
      responsavelId: z.string().nullable().optional(),
      diaPrazoOverride: z.number().int().min(1).max(31).nullable().optional(),
      honorario: z.number().min(0).nullable().optional(),
      tempoPrevistoOverride: z.number().int().min(0).nullable().optional(),
      ativo: z.boolean().optional(),
    }),
  }),
  async (req, res) => {
    const r = await svc.atualizarOverrides(req.auth!.escritorioId, req.params.eoId, req.body);
    return ok(res, r);
  },
);

// Alocacao em massa (uma obrigacao OU um grupo em N empresas)
router.post(
  '/alocar-massa',
  gerenciar,
  validate({
    body: z.object({
      empresaIds: z.array(z.string()).min(1, 'Selecione ao menos uma empresa.'),
      obrigacaoId: z.string().optional(),
      grupoId: z.string().optional(),
    }),
  }),
  async (req, res) => {
    const r = await svc.alocarEmMassa(req.auth!.escritorioId, req.body);
    return ok(res, r);
  },
);

export default router;
