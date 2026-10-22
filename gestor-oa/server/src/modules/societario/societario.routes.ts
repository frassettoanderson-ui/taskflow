import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import * as svc from './societario.service.js';
import * as forms from './formularios.service.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('societario_ver'));
const operar = requirePermission('societario_operar');
const ator = (req: Express.Request) => ({ id: req.auth!.id, nome: req.auth!.nome });

// ---------- Processos ----------
router.get('/processos', async (req, res) => ok(res, await svc.listar(req.auth!.escritorioId)));
router.get('/historico', async (req, res) => ok(res, await svc.historicoGeral(req.auth!.escritorioId)));
router.get('/processos/:id', async (req, res) => ok(res, await svc.obter(req.auth!.escritorioId, req.params.id)));

const dadosEmpresa = z.object({
  nomeFantasia: z.string().optional(), cnpj: z.string().optional(), email: z.string().optional(), telefone: z.string().optional(),
  cep: z.string().optional(), logradouro: z.string().optional(), numeroEndereco: z.string().optional(), complemento: z.string().optional(),
  bairro: z.string().optional(), cidade: z.string().optional(), uf: z.string().optional(), atividade: z.string().optional(), endereco: z.string().optional(),
}).partial();

router.post('/processos', operar, validate({ body: z.object({
  nome: z.string(), carteira: z.string(), servico: z.string(), cpf: z.string().optional(), senhaGov: z.string().optional(),
  observacao: z.string().optional(), empresaId: z.string().optional(), dados: dadosEmpresa.optional(),
}) }), async (req, res) => ok(res, await svc.criar(req.auth!.escritorioId, ator(req), req.body), 201));

router.put('/processos/:id', operar, validate({ body: z.object({
  empresaId: z.string().nullable().optional(), grupo: z.string().nullable().optional(), servico: z.string().optional(),
  natureza: z.string().optional(), etapa: z.string().optional(), situacao: z.string().optional(),
  responsavel: z.string().nullable().optional(), dependeDe: z.string().optional(), prazo: z.string().nullable().optional(),
  proximaAcao: z.string().nullable().optional(), foraDoQuadro: z.boolean().optional(), protocoloRegin: z.string().nullable().optional(),
  requerimento: z.string().nullable().optional(), cpf: z.string().nullable().optional(), senhaGov: z.string().nullable().optional(),
  honorario: z.number().nullable().optional(), honorarioSit: z.string().optional(), observacao: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
}) }), async (req, res) => ok(res, await svc.salvarFicha(req.auth!.escritorioId, ator(req), req.params.id, req.body)));

router.patch('/processos/:id/campo', operar, validate({ body: z.object({ campo: z.string(), valor: z.unknown() }) }),
  async (req, res) => ok(res, await svc.editarCampo(req.auth!.escritorioId, ator(req), req.params.id, req.body.campo, req.body.valor)));

router.post('/processos/:id/renomear', operar, validate({ body: z.object({ nome: z.string() }) }),
  async (req, res) => ok(res, await svc.renomear(req.auth!.escritorioId, ator(req), req.params.id, req.body.nome)));

router.post('/processos/:id/checklist/:itemId', operar, validate({ body: z.object({ feito: z.boolean().optional(), na: z.boolean().optional() }) }),
  async (req, res) => ok(res, await svc.marcarItem(req.auth!.escritorioId, ator(req), req.params.id, req.params.itemId, req.body)));

router.post('/processos/:id/mover', operar, validate({ body: z.object({
  destino: z.string(),
  alteracao: z.object({ mudaEndereco: z.boolean(), mudaMunicipio: z.boolean(), mudaAtividade: z.boolean() }).optional(),
}) }), async (req, res) => ok(res, await svc.mover(req.auth!.escritorioId, ator(req), req.params.id, req.body)));

router.post('/processos/:id/concluir', operar, validate({ body: z.object({
  baixaCadEconomico: z.boolean().nullable().optional(), viraCliente: z.boolean(), tipo: z.string().optional(),
}) }), async (req, res) => ok(res, await svc.concluir(req.auth!.escritorioId, ator(req), req.params.id, req.body)));

router.post('/processos/:id/carteira', operar, validate({ body: z.object({ naCarteira: z.boolean() }) }),
  async (req, res) => ok(res, await svc.definirCarteira(req.auth!.escritorioId, ator(req), req.params.id, req.body.naCarteira)));

router.post('/devolver', operar, validate({ body: z.object({ ids: z.array(z.string()) }) }),
  async (req, res) => ok(res, await svc.devolverAoQuadro(req.auth!.escritorioId, ator(req), req.body.ids)));

router.delete('/processos/:id', operar, async (req, res) => ok(res, await svc.excluir(req.auth!.escritorioId, ator(req), req.params.id)));

// ---------- Formularios do cliente ----------
router.get('/formularios', async (req, res) => ok(res, await forms.listar(req.auth!.escritorioId)));
router.post('/formularios/buscar', operar, async (req, res) => ok(res, await forms.buscar(req.auth!.escritorioId)));
router.post('/formularios/colar', operar, validate({ body: z.object({ codigo: z.string() }) }),
  async (req, res) => ok(res, await forms.colar(req.auth!.escritorioId, req.body.codigo), 201));
router.post('/formularios/:id/aprovar', operar, async (req, res) => ok(res, await forms.aprovar(req.auth!.escritorioId, ator(req), req.params.id)));
router.delete('/formularios/:id', operar, async (req, res) => ok(res, await forms.excluir(req.auth!.escritorioId, ator(req), req.params.id)));
router.get('/formularios/:id/documento', async (req, res) => {
  const d = await forms.documento(req.auth!.escritorioId, req.params.id);
  const nome = d.nome.replace(/[^\w.\- ]+/g, '_');
  res.setHeader('Content-Type', d.tipo);
  res.setHeader('Content-Disposition', `${req.query.baixar ? 'attachment' : 'inline'}; filename="${nome}"`);
  res.sendFile(d.caminho);
});

export default router;
