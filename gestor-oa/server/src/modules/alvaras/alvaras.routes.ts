import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { prisma } from '../../prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { consultarCnpj } from '../empresa/empresa.routes.js';
import * as svc from './alvaras.service.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('alvaras_ver'));
const operar = requirePermission('alvaras_operar');
const ator = (req: Express.Request) => ({ id: req.auth!.id, nome: req.auth!.nome });
const esc = (req: Express.Request) => req.auth!.escritorioId;

// ---------- Licencas ----------
router.get('/licencas', async (req, res) => ok(res, await svc.listarLicencas(esc(req))));
const licencaBody = z.object({
  empresaId: z.string(), tipo: z.string().optional(), orgao: z.string().nullable().optional(), protocolo: z.string().nullable().optional(),
  situacao: z.string().optional(), emissao: z.string().nullable().optional(), validade: z.string().nullable().optional(),
  responsavel: z.string().nullable().optional(), taxa: z.number().nullable().optional(), observacao: z.string().nullable().optional(),
});
router.post('/licencas', operar, validate({ body: licencaBody }), async (req, res) => ok(res, await svc.salvarLicenca(esc(req), ator(req), null, req.body), 201));
router.post('/licencas/corrigir-tipo', operar, validate({ body: z.object({ de: z.string(), para: z.string() }) }),
  async (req, res) => ok(res, await svc.corrigirTipo(esc(req), ator(req), req.body.de, req.body.para)));
router.post('/licencas/importar', operar, validate({ body: z.object({ linhas: z.array(z.object({
  cliente: z.string(), tipo: z.string().optional(), protocolo: z.string().optional(), orgao: z.string().optional(), validade: z.string().optional(),
  situacao: z.string().optional(), responsavel: z.string().optional(), observacao: z.string().optional(),
})).max(5000) }) }), async (req, res) => ok(res, await svc.importar(esc(req), ator(req), req.body.linhas)));
router.put('/licencas/:id', operar, validate({ body: licencaBody }), async (req, res) => ok(res, await svc.salvarLicenca(esc(req), ator(req), req.params.id, req.body)));
router.patch('/licencas/:id/observacao', operar, validate({ body: z.object({ observacao: z.string() }) }),
  async (req, res) => ok(res, await svc.observacaoLicenca(esc(req), req.params.id, req.body.observacao)));
router.delete('/licencas/:id', operar, async (req, res) => ok(res, await svc.excluirLicenca(esc(req), ator(req), req.params.id)));
router.post('/licencas/:id/renovar', operar, async (req, res) => ok(res, await svc.renovarUmAno(esc(req), ator(req), req.params.id)));
router.post('/licencas/:id/kanban', operar, async (req, res) => ok(res, await svc.mandarParaKanban(esc(req), ator(req), req.params.id)));
router.post('/empresas/:empresaId/inativar', operar, validate({ body: z.object({ motivo: z.string().nullable() }) }),
  async (req, res) => ok(res, await svc.inativarEmpresa(esc(req), ator(req), req.params.empresaId, req.body.motivo)));

// ---------- Legalizacoes (Kanban) ----------
router.get('/legalizacoes', async (req, res) => ok(res, await svc.listarLegalizacoes(esc(req))));
router.post('/legalizacoes', operar, validate({ body: z.object({ empresaId: z.string() }) }),
  async (req, res) => ok(res, await svc.novaLegalizacao(esc(req), ator(req), req.body.empresaId), 201));
router.put('/legalizacoes/:id', operar, validate({ body: z.object({
  alvaras: z.array(z.string()).optional(), tipo: z.string().optional(), observacao: z.string().nullable().optional(),
  protocolo: z.string().nullable().optional(), orgao: z.string().nullable().optional(),
}) }), async (req, res) => ok(res, await svc.salvarCartao(esc(req), ator(req), req.params.id, req.body)));
router.post('/legalizacoes/:id/taxa', operar, validate({ body: z.object({ paga: z.boolean() }) }),
  async (req, res) => ok(res, await svc.marcarTaxa(esc(req), ator(req), req.params.id, req.body.paga)));
router.post('/legalizacoes/:id/vencimento', operar, validate({ body: z.object({ vencimento: z.string().nullable() }) }),
  async (req, res) => ok(res, await svc.definirVencimento(esc(req), ator(req), req.params.id, req.body.vencimento)));
router.post('/legalizacoes/:id/mover', operar, validate({ body: z.object({ destino: z.string() }) }),
  async (req, res) => ok(res, await svc.moverCartao(esc(req), ator(req), req.params.id, req.body.destino)));
router.delete('/legalizacoes/:id', operar, async (req, res) => ok(res, await svc.tirarDoQuadro(esc(req), ator(req), req.params.id)));
router.get('/pendentes-societario', async (req, res) => ok(res, await svc.pendentesDoSocietario(esc(req))));
router.post('/puxar-concluidos', operar, async (req, res) => ok(res, await svc.puxarConcluidos(esc(req), ator(req))));

// ---------- Configuracao e apoio ----------
router.get('/config', async (req, res) => ok(res, await svc.obterConfig(esc(req))));
router.put('/config', operar, validate({ body: z.object({ parametros: z.unknown().optional(), checklists: z.unknown().optional(), acao: z.string().optional(), detalhe: z.string().optional() }) }),
  async (req, res) => ok(res, await svc.salvarConfig(esc(req), ator(req), req.body)));
router.get('/historico', async (req, res) => ok(res, await svc.historico(esc(req))));
router.get('/empresas', async (req, res) => ok(res, await svc.empresasParaSelect(esc(req))));
// Busca os CNAEs da empresa na Receita e guarda no cadastro (para a calculadora)
router.post('/empresas/:empresaId/cnaes', operar, async (req, res) => {
  const i = await prisma.empresaIdentificador.findFirst({ where: { escritorioId: esc(req), empresaId: req.params.empresaId, tipo: 'CNPJ' } });
  if (!i) throw Errors.validacao('Empresa sem CNPJ cadastrado.');
  const d = await consultarCnpj(i.valor);
  if (d.cnaes) await prisma.empresa.update({ where: { id: req.params.empresaId }, data: { cnaes: d.cnaes } });
  return ok(res, { cnaes: d.cnaes });
});

export default router;
