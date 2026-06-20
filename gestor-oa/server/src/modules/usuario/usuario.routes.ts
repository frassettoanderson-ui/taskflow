import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { escritorioDir } from '../../lib/storage.js';
import * as svc from './usuario.service.js';

const router = Router();
router.use(authenticate);

const uploadAssinatura = multer({
  storage: multer.diskStorage({
    destination: (req, _f, cb) => cb(null, escritorioDir(req.auth!.escritorioId, 'assinaturas-usuario')),
    filename: (req, file, cb) => cb(null, `${req.params.id}${path.extname(file.originalname) || '.png'}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_r, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const uploadFoto = multer({
  storage: multer.diskStorage({
    destination: (req, _f, cb) => cb(null, escritorioDir(req.auth!.escritorioId, 'fotos-usuario')),
    filename: (req, file, cb) => cb(null, `${req.params.id}${path.extname(file.originalname) || '.png'}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_r, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const janelaSchema = z.object({
  diaSemana: z.number().int().min(0).max(6),
  inicio: z.string(),
  fim: z.string(),
});
const filtrosSchema = z.object({
  departamentos: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});
const permissoesSchema = z.record(z.boolean());

// Listagem (qualquer autenticado vê para seletores; detalhes sensiveis so admin).
router.get('/', async (req, res) => {
  const incluirInativos =
    req.query.incluirInativos === 'true' && !!req.auth!.permissoes['admin_usuarios'];
  const usuarios = await svc.listar(req.auth!.escritorioId, incluirInativos);
  return ok(res, usuarios);
});

// Export CSV
router.get('/export', requirePermission('admin_usuarios'), async (req, res) => {
  const usuarios = await svc.listar(req.auth!.escritorioId, true);
  const linhas = ['Nome;Email;Ativo;Permissoes ativas'];
  for (const u of usuarios) {
    const ativas = Object.entries(u.permissoes).filter(([, v]) => v).length;
    linhas.push([u.nome, u.email, u.ativo ? 'Sim' : 'Nao', String(ativas)].join(';'));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="usuarios.csv"');
  return res.send('﻿' + linhas.join('\n'));
});

router.get('/:id', requirePermission('admin_usuarios'), async (req, res) => {
  const u = await svc.obter(req.auth!.escritorioId, req.params.id);
  return ok(res, u);
});

const criarSchema = z.object({
  nome: z.string().min(2, 'Nome e obrigatorio.'),
  email: z.string().email('E-mail invalido.'),
  senha: z.string().min(3, 'Senha deve ter ao menos 3 caracteres.'),
  ativo: z.boolean().optional(),
  tipo: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  custoHora: z.number().min(0).optional().nullable(),
  minutosUteisMes: z.number().int().min(0).optional().nullable(),
  salario: z.number().min(0).optional().nullable(),
  encargos: z.number().min(0).optional().nullable(),
  beneficios: z.number().min(0).optional().nullable(),
  smtpHost: z.string().optional().nullable(),
  smtpPorta: z.number().int().optional().nullable(),
  smtpUsuario: z.string().optional().nullable(),
  smtpSenha: z.string().optional().nullable(),
  ccoEmails: z.string().optional().nullable(),
  horariosAcesso: z.array(janelaSchema).optional(),
  filtrosForcados: filtrosSchema.optional(),
  permissoes: permissoesSchema.optional(),
  niveis: z.record(z.number().int().min(0)).optional(),
});

router.post('/', requirePermission('admin_usuarios'), validate({ body: criarSchema }), async (req, res) => {
  const u = await svc.criar(req.auth!.escritorioId, req.body);
  return ok(res, u, 201);
});

const editarSchema = criarSchema.partial().omit({ senha: true });

router.put('/:id', requirePermission('admin_usuarios'), validate({ body: editarSchema }), async (req, res) => {
  const u = await svc.editar(req.auth!.escritorioId, req.params.id, req.body);
  return ok(res, u);
});

router.delete('/:id', requirePermission('admin_usuarios'), async (req, res) => {
  await svc.inativar(req.auth!.escritorioId, req.params.id, req.auth!.id);
  return ok(res, { inativado: true });
});

router.put(
  '/:id/senha',
  requirePermission('admin_usuarios'),
  validate({ body: z.object({ novaSenha: z.string().min(8, 'Minimo 8 caracteres.') }) }),
  async (req, res) => {
    await svc.redefinirSenha(req.auth!.escritorioId, req.params.id, req.body.novaSenha);
    return ok(res, { redefinida: true });
  },
);

// Upload da assinatura do usuario (imagem)
router.post('/:id/assinatura', requirePermission('admin_usuarios'), uploadAssinatura.single('arquivo'), async (req, res) => {
  const u = await prisma.usuario.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId, deletedAt: null } });
  if (!u) throw Errors.naoEncontrado('Usuario');
  if (!req.file) throw Errors.validacao('Envie uma imagem.');
  await prisma.usuario.update({ where: { id: u.id }, data: { assinaturaArquivo: req.file.filename } });
  return ok(res, { assinaturaArquivo: req.file.filename });
});

// Servir a assinatura do usuario
router.get('/:id/assinatura', async (req, res) => {
  const u = await prisma.usuario.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId, deletedAt: null } });
  if (!u || !u.assinaturaArquivo) throw Errors.naoEncontrado('Assinatura');
  const arquivo = path.join(escritorioDir(req.auth!.escritorioId, 'assinaturas-usuario'), u.assinaturaArquivo);
  if (!fs.existsSync(arquivo)) throw Errors.naoEncontrado('Assinatura');
  return res.sendFile(arquivo);
});

// Foto de perfil do usuario (upload + servir)
router.post('/:id/foto', uploadFoto.single('arquivo'), async (req, res) => {
  if (req.params.id !== req.auth!.id && !req.auth!.permissoes['admin_usuarios']) throw Errors.semPermissao('admin_usuarios');
  const u = await prisma.usuario.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId, deletedAt: null } });
  if (!u) throw Errors.naoEncontrado('Usuario');
  if (!req.file) throw Errors.validacao('Envie uma imagem.');
  await prisma.usuario.update({ where: { id: u.id }, data: { fotoPerfilArquivo: req.file.filename } });
  return ok(res, { fotoPerfilArquivo: req.file.filename });
});

router.get('/:id/foto', async (req, res) => {
  const u = await prisma.usuario.findFirst({ where: { id: req.params.id, escritorioId: req.auth!.escritorioId, deletedAt: null } });
  if (!u || !u.fotoPerfilArquivo) throw Errors.naoEncontrado('Foto');
  const arquivo = path.join(escritorioDir(req.auth!.escritorioId, 'fotos-usuario'), u.fotoPerfilArquivo);
  if (!fs.existsSync(arquivo)) throw Errors.naoEncontrado('Foto');
  return res.sendFile(arquivo);
});

// Atualizar apenas permissoes (flag separada)
router.put(
  '/:id/permissoes',
  requirePermission('admin_permissoes'),
  validate({ body: z.object({ permissoes: permissoesSchema }) }),
  async (req, res) => {
    const u = await svc.editar(req.auth!.escritorioId, req.params.id, { permissoes: req.body.permissoes });
    return ok(res, u);
  },
);

// Replicar permissoes/horarios/filtros para N usuarios
router.post(
  '/replicar',
  requirePermission('admin_permissoes'),
  validate({
    body: z.object({
      origemId: z.string(),
      destinos: z.array(z.string()).min(1, 'Selecione ao menos um destino.'),
      permissoes: z.boolean().default(true),
      horarios: z.boolean().default(false),
      filtros: z.boolean().default(false),
    }),
  }),
  async (req, res) => {
    const r = await svc.replicar(req.auth!.escritorioId, req.body.origemId, req.body.destinos, {
      permissoes: req.body.permissoes,
      horarios: req.body.horarios,
      filtros: req.body.filtros,
    });
    return ok(res, r);
  },
);

// Transferir responsabilidade de um usuario para outro (Acessorias: nivel [2] de Usuarios)
router.post(
  '/transferir-responsabilidade',
  requirePermission('admin_transferir_resp'),
  validate({
    body: z.object({
      deUsuarioId: z.string(),
      paraUsuarioId: z.string(),
      departamentosEmpresa: z.boolean().default(true),
      entregasPendentes: z.boolean().default(true),
      processos: z.boolean().default(true),
      departamentosGestor: z.boolean().default(false),
    }),
  }),
  async (req, res) => {
    const r = await svc.transferirResponsabilidade(req.auth!.escritorioId, req.body.deUsuarioId, req.body.paraUsuarioId, {
      departamentosEmpresa: req.body.departamentosEmpresa,
      entregasPendentes: req.body.entregasPendentes,
      processos: req.body.processos,
      departamentosGestor: req.body.departamentosGestor,
    });
    return ok(res, r);
  },
);

export default router;
