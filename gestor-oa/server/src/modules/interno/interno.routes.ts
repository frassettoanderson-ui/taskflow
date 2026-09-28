import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../env.js';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { empresaDir } from '../../lib/storage.js';
import { sincronizarDoNauta } from '../../lib/nautaBridge.js';

// Rotas internas server-to-server (a Nauta chama após salvar cadastro / concluir onboarding).
// Autenticação: header x-internal-secret == SSO_SHARED_SECRET (mesmo segredo do SSO).
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Resolve a Empresa do Obrigô pelo vínculo com o ERP; cria/sincroniza se ainda não existir.
async function resolverEmpresa(nautaClienteId: string): Promise<{ id: string; escritorioId: string } | null> {
  let e = await prisma.empresa.findUnique({ where: { nautaClienteId }, select: { id: true, escritorioId: true } });
  if (!e) { await sincronizarDoNauta(nautaClienteId); e = await prisma.empresa.findUnique({ where: { nautaClienteId }, select: { id: true, escritorioId: true } }); }
  return e;
}

router.use((req, _res, next) => {
  const secret = env.sso.secret;
  if (!secret || req.header('x-internal-secret') !== secret) throw Errors.naoAutenticado();
  next();
});

// Sobe o cadastro do ERP (link público / tela antiga / conclusão de onboarding) para a Empresa do Obrigô.
router.post('/sync-from-nauta', async (req, res) => {
  const nautaClienteId = String(req.body?.nautaClienteId ?? '').trim();
  if (!nautaClienteId) throw Errors.validacao('nautaClienteId ausente.');
  const empresaId = await sincronizarDoNauta(nautaClienteId);
  return ok(res, { sincronizado: !!empresaId, empresaId });
});

// Anexa um arquivo (ex.: contrato assinado) aos Arquivos anexos da empresa do Obrigô.
// multipart: campo 'arquivo' + body { nautaClienteId, nomeArquivo }. Substitui anexo de mesmo nome.
router.post('/anexo-from-nauta', upload.single('arquivo'), async (req, res) => {
  const nautaClienteId = String(req.body?.nautaClienteId ?? '').trim();
  const nomeArquivo = String(req.body?.nomeArquivo ?? '').trim() || (req.file?.originalname ?? 'arquivo');
  if (!nautaClienteId) throw Errors.validacao('nautaClienteId ausente.');
  if (!req.file) throw Errors.validacao('arquivo ausente.');

  const emp = await resolverEmpresa(nautaClienteId);
  if (!emp) throw Errors.naoEncontrado('Empresa');

  // Remove versão anterior com o mesmo nome (re-assinatura substitui)
  const antigos = await prisma.empresaAnexo.findMany({ where: { empresaId: emp.id, nomeArquivo } });
  for (const a of antigos) { try { fs.unlinkSync(a.caminho); } catch { /* ignora */ } }
  if (antigos.length) await prisma.empresaAnexo.deleteMany({ where: { id: { in: antigos.map((a) => a.id) } } });

  const dir = empresaDir(emp.id, 'DocsEmpresa', 'anexos');
  const safe = `${Date.now()}_${nomeArquivo.replace(/[^\w.\-]/g, '_')}`;
  const dest = path.join(dir, safe);
  fs.writeFileSync(dest, req.file.buffer);

  const criado = await prisma.empresaAnexo.create({
    data: { escritorioId: emp.escritorioId, empresaId: emp.id, nomeArquivo, caminho: dest, tamanho: req.file.size, mimeType: req.file.mimetype },
  });
  return ok(res, { anexoId: criado.id }, 201);
});

export default router;
