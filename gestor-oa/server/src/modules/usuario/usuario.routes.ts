import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import * as svc from './usuario.service.js';

const router = Router();
router.use(authenticate);

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

export default router;
