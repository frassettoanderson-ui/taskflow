import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../../prisma.js';
import { ok, parsePagination, paginated } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { empresaDir, isInsideStorage } from '../../lib/storage.js';
import * as svc from './empresa.service.js';
import {
  criarEmpresaSchema,
  editarEmpresaSchema,
  identificadorInput,
  contatoSchema,
  comentarioSchema,
  responsavelSchema,
  acaoMassaSchema,
  importarCsvSchema,
  listarEmpresasQuery,
} from './empresa.schemas.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('empresas_ver'));

// ---------- Listagem ----------
router.get('/', validate({ query: listarEmpresasQuery }), async (req, res) => {
  const pag = parsePagination(req.query);
  const { items, total } = await svc.listar(
    req.auth!.escritorioId,
    req.auth!.filtrosForcados,
    {
      busca: req.query.busca as string | undefined,
      tagId: req.query.tagId as string | undefined,
      regimeId: req.query.regimeId as string | undefined,
      departamentoId: req.query.departamentoId as string | undefined,
      status: req.query.status as 'ativos' | 'inativos' | 'todos' | undefined,
    },
    pag,
  );
  return ok(res, paginated(items, total, pag));
});

// ---------- Acoes em massa ----------
router.post(
  '/acoes-massa',
  requirePermission('empresas_editar'),
  validate({ body: acaoMassaSchema }),
  async (req, res) => {
    const r = await svc.acaoEmMassa(req.auth!.escritorioId, req.body);
    return ok(res, r);
  },
);

// ---------- Importacao CSV ----------
router.post(
  '/importar',
  requirePermission('empresas_importar'),
  validate({ body: importarCsvSchema }),
  async (req, res) => {
    const r = await svc.importarCsv(req.auth!.escritorioId, req.body.linhas);
    return ok(res, r);
  },
);

// ---------- CRUD ----------
router.post(
  '/',
  requirePermission('empresas_criar'),
  validate({ body: criarEmpresaSchema }),
  async (req, res) => {
    const e = await svc.criar(req.auth!.escritorioId, req.body);
    return ok(res, e, 201);
  },
);

router.get('/:id', async (req, res) => {
  const e = await svc.obter(req.auth!.escritorioId, req.params.id);
  return ok(res, e);
});

router.put(
  '/:id',
  requirePermission('empresas_editar'),
  validate({ body: editarEmpresaSchema }),
  async (req, res) => {
    const e = await svc.editar(req.auth!.escritorioId, req.params.id, req.body);
    return ok(res, e);
  },
);

// Exclusao exige permissao especifica + confirmacao pelo nome
router.delete(
  '/:id',
  requirePermission('empresas_excluir'),
  async (req, res) => {
    const confirmacao = (req.query.confirmacao as string) ?? '';
    const empresa = await prisma.empresa.findFirst({
      where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
      select: { razaoSocial: true },
    });
    if (!empresa) throw Errors.naoEncontrado('Empresa');
    if (confirmacao.trim() !== empresa.razaoSocial) {
      throw Errors.validacao(
        'Digite exatamente a razao social para confirmar a exclusao.',
      );
    }
    await svc.excluir(req.auth!.escritorioId, req.params.id);
    return ok(res, { excluida: true });
  },
);

// ---------- Identificadores ----------
router.post(
  '/:id/identificadores',
  requirePermission('empresas_editar'),
  validate({ body: identificadorInput }),
  async (req, res) => {
    const r = await svc.adicionarIdentificador(
      req.auth!.escritorioId,
      req.params.id,
      req.body,
    );
    return ok(res, r, 201);
  },
);

router.delete(
  '/:id/identificadores/:identId',
  requirePermission('empresas_editar'),
  async (req, res) => {
    await svc.removerIdentificador(
      req.auth!.escritorioId,
      req.params.id,
      req.params.identId,
    );
    return ok(res, { removido: true });
  },
);

router.post(
  '/:id/identificadores/:identId/transferir',
  requirePermission('empresas_editar'),
  async (req, res) => {
    const destino = req.body?.destinoEmpresaId as string;
    if (!destino) throw Errors.validacao('Informe a empresa de destino.');
    const r = await svc.transferirIdentificador(
      req.auth!.escritorioId,
      req.params.identId,
      destino,
    );
    return ok(res, r);
  },
);

// ---------- Contatos ----------
router.get('/:id/contatos', async (req, res) => {
  const r = await svc.listarContatos(req.auth!.escritorioId, req.params.id);
  return ok(res, r);
});

router.post(
  '/:id/contatos',
  requirePermission('empresas_editar'),
  validate({ body: contatoSchema }),
  async (req, res) => {
    const r = await svc.salvarContato(
      req.auth!.escritorioId,
      req.params.id,
      req.body,
    );
    return ok(res, r, 201);
  },
);

router.put(
  '/:id/contatos/:contatoId',
  requirePermission('empresas_editar'),
  validate({ body: contatoSchema }),
  async (req, res) => {
    const r = await svc.salvarContato(
      req.auth!.escritorioId,
      req.params.id,
      req.body,
      req.params.contatoId,
    );
    return ok(res, r);
  },
);

router.delete(
  '/:id/contatos/:contatoId',
  requirePermission('empresas_editar'),
  async (req, res) => {
    await svc.removerContato(
      req.auth!.escritorioId,
      req.params.id,
      req.params.contatoId,
    );
    return ok(res, { removido: true });
  },
);

// ---------- Comentarios ----------
router.post(
  '/:id/comentarios',
  validate({ body: comentarioSchema }),
  async (req, res) => {
    const r = await svc.adicionarComentario(
      req.auth!.escritorioId,
      req.params.id,
      req.auth!.id,
      req.body.texto,
      req.body.departamentoId,
    );
    return ok(res, r, 201);
  },
);

// ---------- Responsaveis por departamento ----------
router.put(
  '/:id/responsaveis',
  requirePermission('empresas_editar'),
  validate({ body: responsavelSchema }),
  async (req, res) => {
    const r = await svc.definirResponsavel(
      req.auth!.escritorioId,
      req.params.id,
      req.body.departamentoId,
      req.body.usuarioId,
    );
    return ok(res, r);
  },
);

// ---------- Anexos ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) =>
      cb(null, empresaDir(req.params.id, 'DocsEmpresa', 'anexos')),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post(
  '/:id/anexos',
  requirePermission('documentos_upload'),
  upload.array('arquivos', 20),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw Errors.validacao('Envie ao menos um arquivo.');
    await svc.obter(req.auth!.escritorioId, req.params.id); // garante tenant
    const criados = await prisma.$transaction(
      files.map((f) =>
        prisma.empresaAnexo.create({
          data: {
            escritorioId: req.auth!.escritorioId,
            empresaId: req.params.id,
            nomeArquivo: f.originalname,
            caminho: f.path,
            tamanho: f.size,
            mimeType: f.mimetype,
            uploadedById: req.auth!.id,
          },
        }),
      ),
    );
    return ok(res, criados, 201);
  },
);

router.get('/:id/anexos/:anexoId/download', async (req, res) => {
  const anexo = await prisma.empresaAnexo.findFirst({
    where: {
      id: req.params.anexoId,
      empresaId: req.params.id,
      escritorioId: req.auth!.escritorioId,
    },
  });
  if (!anexo || !isInsideStorage(anexo.caminho) || !fs.existsSync(anexo.caminho)) {
    throw Errors.naoEncontrado('Anexo');
  }
  return res.download(anexo.caminho, anexo.nomeArquivo);
});

router.delete(
  '/:id/anexos/:anexoId',
  requirePermission('documentos_excluir'),
  async (req, res) => {
    const anexo = await prisma.empresaAnexo.findFirst({
      where: {
        id: req.params.anexoId,
        empresaId: req.params.id,
        escritorioId: req.auth!.escritorioId,
      },
    });
    if (!anexo) throw Errors.naoEncontrado('Anexo');
    if (isInsideStorage(anexo.caminho)) {
      fs.promises.unlink(anexo.caminho).catch(() => undefined);
    }
    await prisma.empresaAnexo.delete({ where: { id: anexo.id } });
    return ok(res, { removido: true });
  },
);

// ---------- Historico (auditoria) da empresa ----------
router.get('/:id/historico', async (req, res) => {
  const logs = await prisma.logAuditoria.findMany({
    where: {
      escritorioId: req.auth!.escritorioId,
      entidade: 'Empresa',
      entidadeId: req.params.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { usuario: { select: { nome: true } } },
  });
  return ok(res, logs);
});

export default router;
