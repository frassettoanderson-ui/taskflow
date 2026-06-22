import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../../prisma.js';
import { ok, parsePagination, paginated } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { empresaDir, isInsideStorage } from '../../lib/storage.js';
import { generateToken, sha256, hashPassword } from '../../lib/password.js';
import { sendMail } from '../../lib/mailer.js';
import { env } from '../../env.js';
import { addMinutes } from 'date-fns';
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
  tarefaSchema,
  inativarAssistidoSchema,
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
      motivoId: req.query.motivoId as string | undefined,
      grupoId: req.query.grupoId as string | undefined,
      status: req.query.status as 'ativos' | 'inativos' | 'todos' | undefined,
    },
    pag,
  );
  return ok(res, paginated(items, total, pag));
});

// ---------- Proximo [ID] sugerido (cadastro de nova empresa) ----------
router.get('/proximo-numero', async (req, res) => {
  const r = await svc.proximoNumero(req.auth!.escritorioId);
  return ok(res, r);
});

// ---------- Consulta CNPJ (autofill no cadastro) ----------
// Busca dados publicos do CNPJ em 3 provedores (com fallback por causa de rate-limit).
const sTxt = (v: unknown) => (v == null ? '' : String(v).trim());
const fmtCep = (v: unknown) => { const d = sTxt(v).replace(/\D/g, ''); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const fmtTel = (v: unknown) => { const d = sTxt(v).replace(/\D/g, ''); return /^\d{10,11}$/.test(d) ? d.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : d; };
interface DadosCnpj { razaoSocial: string; nomeFantasia: string; cep: string; logradouro: string; numeroEndereco: string; complemento: string; bairro: string; cidade: string; uf: string; telefone: string; email: string }

async function buscarJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'GestorOA/1.0', Accept: 'application/json' } });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch { return null; }
}
// Formato "plano" da Receita (minhareceita.org / BrasilAPI)
function normPlano(d: Record<string, unknown>): DadosCnpj {
  return {
    razaoSocial: sTxt(d.razao_social), nomeFantasia: sTxt(d.nome_fantasia), cep: fmtCep(d.cep),
    logradouro: [sTxt(d.descricao_tipo_de_logradouro), sTxt(d.logradouro)].filter(Boolean).join(' ').trim(),
    numeroEndereco: sTxt(d.numero), complemento: sTxt(d.complemento), bairro: sTxt(d.bairro),
    cidade: sTxt(d.municipio), uf: sTxt(d.uf), telefone: fmtTel(d.ddd_telefone_1), email: sTxt(d.email).toLowerCase(),
  };
}
// Formato aninhado da publica.cnpj.ws
function normCnpjWs(d: Record<string, unknown>): DadosCnpj {
  const e = (d.estabelecimento ?? {}) as Record<string, unknown>;
  const cid = (e.cidade ?? {}) as Record<string, unknown>;
  const est = (e.estado ?? {}) as Record<string, unknown>;
  return {
    razaoSocial: sTxt(d.razao_social), nomeFantasia: sTxt(e.nome_fantasia), cep: fmtCep(e.cep),
    logradouro: [sTxt(e.tipo_logradouro), sTxt(e.logradouro)].filter(Boolean).join(' ').trim(),
    numeroEndereco: sTxt(e.numero), complemento: sTxt(e.complemento), bairro: sTxt(e.bairro),
    cidade: sTxt(cid.nome), uf: sTxt(est.sigla), telefone: fmtTel(`${sTxt(e.ddd1)}${sTxt(e.telefone1)}`), email: sTxt(e.email).toLowerCase(),
  };
}

router.get('/consulta-cnpj/:cnpj', async (req, res) => {
  const cnpj = (req.params.cnpj || '').replace(/\D/g, '');
  if (cnpj.length !== 14) throw Errors.validacao('Informe um CNPJ valido (14 digitos).');

  let dados: DadosCnpj | null = null;
  const a = await buscarJson(`https://minhareceita.org/${cnpj}`);
  if (a && a.razao_social) dados = normPlano(a);
  if (!dados) { const b = await buscarJson(`https://publica.cnpj.ws/cnpj/${cnpj}`); if (b && b.razao_social) dados = normCnpjWs(b); }
  if (!dados) { const c = await buscarJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`); if (c && c.razao_social) dados = normPlano(c); }

  if (!dados) throw Errors.validacao('Nao foi possivel consultar o CNPJ agora (servicos indisponiveis ou limite atingido). Tente de novo em instantes.');
  return ok(res, dados);
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

// ---------- Tarefas agendadas ----------
router.get('/:id/tarefas', async (req, res) => {
  const r = await svc.listarTarefas(req.auth!.escritorioId, req.params.id);
  return ok(res, r);
});

router.post(
  '/:id/tarefas',
  requirePermission('empresas_editar'),
  validate({ body: tarefaSchema }),
  async (req, res) => {
    const r = await svc.criarTarefa(req.auth!.escritorioId, req.params.id, req.body, req.auth!.id);
    return ok(res, r, 201);
  },
);

router.put(
  '/:id/tarefas/:tarefaId',
  requirePermission('empresas_editar'),
  validate({ body: tarefaSchema.partial().extend({ concluida: z.boolean().optional() }) }),
  async (req, res) => {
    const r = await svc.atualizarTarefa(req.auth!.escritorioId, req.params.id, req.params.tarefaId, req.body);
    return ok(res, r);
  },
);

router.delete('/:id/tarefas/:tarefaId', requirePermission('empresas_editar'), async (req, res) => {
  await svc.removerTarefa(req.auth!.escritorioId, req.params.id, req.params.tarefaId);
  return ok(res, { removida: true });
});

// ---------- Assistente de inativacao ----------
router.post(
  '/:id/inativar-assistido',
  requirePermission('empresas_editar'),
  validate({ body: inativarAssistidoSchema }),
  async (req, res) => {
    const r = await svc.inativarAssistido(req.auth!.escritorioId, req.params.id, req.body);
    return ok(res, r);
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

// ---------- Convite do contato para a Area VIP ----------
router.post('/:id/contatos/:contatoId/convidar', requirePermission('portal_configurar'), async (req, res) => {
  const contato = await prisma.empresaContato.findFirst({
    where: { id: req.params.contatoId, empresaId: req.params.id, escritorioId: req.auth!.escritorioId },
  });
  if (!contato) throw Errors.naoEncontrado('Contato');
  if (!contato.email) throw Errors.validacao('Contato sem e-mail.');
  const token = generateToken(24);
  await prisma.contatoToken.create({
    data: { escritorioId: req.auth!.escritorioId, contatoEmail: contato.email, tokenHash: sha256(token), tipo: 'CONVITE', expiresAt: addMinutes(new Date(), 60 * 24 * 7) },
  });
  const link = `${env.appUrl}/portal/definir-senha?token=${token}`;
  await sendMail({
    to: contato.email,
    subject: 'Convite para a Area VIP',
    html: `<p>Ola ${contato.nome},</p><p>Voce foi convidado a acessar a Area VIP. Defina sua senha:</p><p><a href="${link}">${link}</a></p>`,
  }).catch(() => undefined);
  return ok(res, { link });
});

// ---------- Ativar acesso direto (senha provisoria, sem e-mail) ----------
router.post('/:id/contatos/:contatoId/ativar-acesso', requirePermission('portal_configurar'), async (req, res) => {
  const contato = await prisma.empresaContato.findFirst({
    where: { id: req.params.contatoId, empresaId: req.params.id, escritorioId: req.auth!.escritorioId },
  });
  if (!contato) throw Errors.naoEncontrado('Contato');
  if (!contato.email) throw Errors.validacao('Contato sem e-mail (necessario para o login).');
  const senha = (req.body?.senha as string)?.trim() || '123';
  await prisma.empresaContato.update({ where: { id: contato.id }, data: { senhaHash: await hashPassword(senha), ativo: true } });
  return ok(res, { ativado: true, email: contato.email, senha });
});

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
