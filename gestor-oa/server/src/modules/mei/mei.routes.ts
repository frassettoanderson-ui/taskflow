import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import * as svc from './mei.service.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('mei_ver'));
const operar = requirePermission('mei_operar');
const ator = (req: Express.Request) => ({ id: req.auth!.id, nome: req.auth!.nome });
const esc = (req: Express.Request) => req.auth!.escritorioId;
const comp = z.string().regex(/^\d{4}-\d{2}$/);

router.get('/dados', async (req, res) => ok(res, await svc.dados(esc(req))));
router.get('/historico', async (req, res) => ok(res, await svc.historico(esc(req), req.query.meiId as string | undefined)));

// ---------- Cadastro ----------
const meiBody = z.object({
  empresaId: z.string().nullable().optional(), razaoSocial: z.string().nullable().optional(), apelido: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(), atividade: z.string().optional(), situacao: z.string().optional(), comissaoPct: z.number().optional(),
  abertura: z.string().nullable().optional(), temEmpregado: z.boolean().optional(), honorario: z.number().optional(), observacao: z.string().nullable().optional(),
  codigo: z.string().nullable().optional(), ocupacao: z.string().nullable().optional(),
});
router.post('/meis', operar, validate({ body: meiBody }), async (req, res) => ok(res, await svc.salvarMei(esc(req), ator(req), null, req.body), 201));
router.post('/meis/importar', operar, validate({ body: z.object({ linhas: z.array(z.record(z.string())).max(3000) }) }),
  async (req, res) => ok(res, await svc.importarMeis(esc(req), ator(req), req.body.linhas)));
router.put('/meis/:id', operar, validate({ body: meiBody }), async (req, res) => ok(res, await svc.salvarMei(esc(req), ator(req), req.params.id, req.body)));
router.delete('/meis/:id', operar, async (req, res) => ok(res, await svc.excluirMei(esc(req), ator(req), req.params.id)));
router.post('/meis/:id/inativar', operar, validate({ body: z.object({ situacao: z.string(), desde: z.string().nullable().optional(), motivo: z.string().nullable().optional(), simeiBaixa: z.string() }) }),
  async (req, res) => ok(res, await svc.inativar(esc(req), ator(req), req.params.id, req.body)));
router.post('/meis/:id/reativar', operar, async (req, res) => ok(res, await svc.reativar(esc(req), ator(req), req.params.id)));
router.post('/meis/:id/honorario', operar, validate({ body: z.object({ comp, pago: z.boolean() }) }),
  async (req, res) => ok(res, await svc.marcarHonorario(esc(req), ator(req), req.params.id, req.body.comp, req.body.pago)));
router.post('/meis/:id/comissao', operar, validate({ body: z.object({ comp, pct: z.number().min(0).max(100) }) }),
  async (req, res) => ok(res, await svc.definirComissao(esc(req), ator(req), req.params.id, req.body.comp, req.body.pct)));
router.post('/meis/:id/lancar-das', operar, validate({ body: z.object({ ano: z.number().int() }) }),
  async (req, res) => ok(res, await svc.lancarDasPago(esc(req), ator(req), req.params.id, req.body.ano)));

// ---------- Lancamentos ----------
router.get('/lancamentos', async (req, res) => ok(res, await svc.listarLancamentos(esc(req), req.query.meiId as string | undefined, Number(req.query.ano) || new Date().getFullYear())));
const lancBody = z.object({ meiId: z.string(), data: z.string().nullable().optional(), conta: z.string(), descricao: z.string().nullable().optional(), valor: z.number() });
router.post('/lancamentos', operar, validate({ body: lancBody }), async (req, res) => ok(res, await svc.salvarLancamento(esc(req), ator(req), null, req.body), 201));
router.post('/lancamentos/importar', operar, validate({ body: z.object({ meiId: z.string(), linhas: z.array(z.record(z.string())).max(10000) }) }),
  async (req, res) => ok(res, await svc.importarLancamentos(esc(req), ator(req), req.body.meiId, req.body.linhas)));
router.put('/lancamentos/:id', operar, validate({ body: lancBody }), async (req, res) => ok(res, await svc.salvarLancamento(esc(req), ator(req), req.params.id, req.body)));
router.delete('/lancamentos/:id', operar, async (req, res) => ok(res, await svc.excluirLancamento(esc(req), ator(req), req.params.id)));

// ---------- DAS / DASN ----------
router.post('/das/alternar', operar, validate({ body: z.object({ meiId: z.string(), competencia: comp }) }),
  async (req, res) => ok(res, await svc.alternarDas(esc(req), ator(req), req.body.meiId, req.body.competencia)));
router.post('/das/tirar-parcelamento', operar, validate({ body: z.object({ meiId: z.string(), competencias: z.array(comp) }) }),
  async (req, res) => ok(res, await svc.tirarDoParcelamento(esc(req), ator(req), req.body.meiId, req.body.competencias)));
router.post('/dasn', operar, validate({ body: z.object({ meiId: z.string(), ano: z.number().int(), alternar: z.boolean().optional(), receitaInformada: z.number().nullable().optional() }) }),
  async (req, res) => ok(res, await svc.dasn(esc(req), ator(req), req.body.meiId, req.body.ano, req.body)));

// ---------- Parcelamentos ----------
const acordoBody = z.object({
  meiId: z.string(), competencias: z.array(z.object({ competencia: comp, valor: z.number() })), total: z.number(), parcelas: z.number(),
  valorPrimeira: z.number().nullable(), parcelasPagas: z.number(), adesao: z.string().nullable().optional(), protocolo: z.string().nullable().optional(),
  observacao: z.string().nullable().optional(), situacao: z.string(),
});
router.post('/parcelamentos', operar, validate({ body: acordoBody }), async (req, res) => ok(res, await svc.salvarAcordo(esc(req), ator(req), null, req.body), 201));
router.put('/parcelamentos/:id', operar, validate({ body: acordoBody }), async (req, res) => ok(res, await svc.salvarAcordo(esc(req), ator(req), req.params.id, req.body)));
router.post('/parcelamentos/:id/:acao', operar, validate({ body: z.object({ pagas: z.number().optional() }) }), async (req, res) => {
  const acao = req.params.acao as 'pagas' | 'quitar' | 'cancelar' | 'reativar';
  if (!['pagas', 'quitar', 'cancelar', 'reativar'].includes(acao)) return res.status(404).end();
  return ok(res, await svc.acaoAcordo(esc(req), ator(req), req.params.id, acao, req.body.pagas));
});
router.delete('/parcelamentos/:id', operar, async (req, res) => ok(res, await svc.acaoAcordo(esc(req), ator(req), req.params.id, 'excluir')));

// ---------- Configuracao ----------
router.post('/config/salario-minimo', operar, validate({ body: z.object({ ano: z.number().int(), valor: z.number() }) }),
  async (req, res) => ok(res, await svc.salvarSalarioMinimo(esc(req), ator(req), req.body.ano, req.body.valor)));

export default router;
