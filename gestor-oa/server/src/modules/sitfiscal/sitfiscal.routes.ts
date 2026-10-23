import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import * as svc from './sitfiscal.service.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('ecac_ver'));
const operar = requirePermission('ecac_operar');
const ator = (req: Express.Request) => ({ id: req.auth!.id, nome: req.auth!.nome });
const esc = (req: Express.Request) => req.auth!.escritorioId;
const cnpjs = z.object({ cnpjs: z.array(z.string()).min(1).max(1000) });

router.get('/dados', async (req, res) => ok(res, await svc.dados(esc(req))));

// ---------- Relatórios (FiscalView) ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 300 } });
router.post('/importar', operar, upload.array('arquivos', 300), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw Errors.validacao('Nenhum arquivo foi selecionado.');
  // multer entrega o nome em latin1; os PDFs do robô têm acento só raramente, mas o nome aparece no histórico
  const arquivos = files.map((f) => ({ nome: Buffer.from(f.originalname, 'latin1').toString('utf8'), buf: f.buffer }));
  return ok(res, await svc.importarArquivos(esc(req), ator(req), arquivos));
});
router.delete('/relatorios/:id', operar, async (req, res) => ok(res, await svc.excluir(esc(req), req.params.id)));

// ---------- Robô do e-CAC (ponte) ----------
router.get('/robo/situacoes', async (_req, res) => ok(res, await svc.ponte('/situacoes')));
router.get('/robo/jobs', async (_req, res) => ok(res, await svc.ponte('/jobs/recent')));
router.get('/robo/jobs/:id', async (req, res) => ok(res, await svc.ponte(`/jobs/${encodeURIComponent(req.params.id)}`)));
router.post('/robo/jobs', operar, validate({ body: cnpjs }), async (req, res) =>
  ok(res, await svc.ponte('/jobs', { method: 'POST', body: { cnpjs: req.body.cnpjs, by: req.auth!.nome || 'Obrigô' } })));
router.post('/robo/limpar', operar, async (_req, res) => ok(res, await svc.ponte('/jobs/clear', { method: 'POST', body: {} })));
router.post('/robo/parar', operar, async (_req, res) => ok(res, await svc.ponte('/stop', { method: 'POST', body: {} })));
router.post('/robo/importar', operar, validate({ body: z.object({ itens: z.array(z.object({ jobId: z.string(), nome: z.string() })).min(1).max(2000) }) }),
  async (req, res) => ok(res, await svc.importarDoRobo(esc(req), ator(req), req.body.itens)));

// ---------- Eventos futuros (Consulta Optantes da Receita, via robô) ----------
router.get('/optantes', async (_req, res) => ok(res, await svc.ponte('/optantes')));
router.get('/optantes/obs', async (_req, res) => ok(res, await svc.ponte('/optantes/obs')));
router.post('/optantes/obs', operar, validate({ body: z.object({ cnpj: z.string(), texto: z.string().max(500) }) }), async (req, res) =>
  ok(res, await svc.ponte('/optantes/obs', { method: 'POST', body: { cnpj: req.body.cnpj, texto: req.body.texto, por: req.auth!.nome || 'Obrigô' } })));
router.post('/optantes/jobs', operar, validate({ body: cnpjs }), async (req, res) =>
  ok(res, await svc.ponte('/optantes/jobs', { method: 'POST', body: { cnpjs: req.body.cnpjs, by: req.auth!.nome || 'Obrigô' } })));
router.get('/optantes/jobs/:id', async (req, res) => ok(res, await svc.ponte(`/optantes/jobs/${encodeURIComponent(req.params.id)}`)));

// ---------- Consulta de optantes (cartão CNPJ) ----------
router.post('/receita/:empresaId', operar, async (req, res) => ok(res, await svc.atualizarOptante(esc(req), req.params.empresaId)));

export default router;
