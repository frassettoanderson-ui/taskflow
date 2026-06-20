import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import archiver from 'archiver';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { hashPassword, verifyPassword, generateToken, sha256 } from '../../lib/password.js';
import { isInsideStorage, ensureDir, STORAGE_ROOT } from '../../lib/storage.js';
import { statusEfetivo, type StatusEntrega } from '../entrega/entrega.status.js';
import { signContatoToken, authenticateContato, permissaoContato } from './contatoAuth.js';
import * as processoSvc from '../processo/processo.service.js';
import * as acdoxSvc from '../acdox/acdox.service.js';

const router = Router();

// ---------- Branding (publico) ----------
router.get('/config', async (_req, res) => {
  const e = await prisma.escritorio.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } });
  if (!e) throw Errors.naoEncontrado('Escritorio');
  const cfg = (e.config as Record<string, unknown>).portal as Record<string, unknown> | undefined;
  return ok(res, {
    nome: (cfg?.nome as string) || e.nome,
    cor: (cfg?.cor as string) || '#0f5c5e',
    logoUrl: e.logoUrl,
  });
});

// ---------- Login ----------
router.post('/login', validate({ body: z.object({ email: z.string().email(), senha: z.string().min(1) }) }), async (req, res) => {
  const email = req.body.email.toLowerCase();
  const rows = await prisma.empresaContato.findMany({ where: { email, ativo: true } });
  const comSenha = rows.filter((r) => r.senhaHash);
  if (comSenha.length === 0) throw Errors.credenciaisInvalidas();
  const okSenha = await verifyPassword(req.body.senha, comSenha[0].senhaHash!);
  if (!okSenha) throw Errors.credenciaisInvalidas();
  const escritorioId = comSenha[0].escritorioId;
  const token = signContatoToken(email, escritorioId);
  return ok(res, { token });
});

// ---------- Definir senha (convite/reset) ----------
router.post('/definir-senha', validate({ body: z.object({ token: z.string(), senha: z.string().min(8) }) }), async (req, res) => {
  const registro = await prisma.contatoToken.findUnique({ where: { tokenHash: sha256(req.body.token) } });
  if (!registro || registro.usedAt || registro.expiresAt < new Date()) throw Errors.validacao('Token invalido ou expirado.');
  const senhaHash = await hashPassword(req.body.senha);
  await prisma.empresaContato.updateMany({ where: { escritorioId: registro.escritorioId, email: registro.contatoEmail }, data: { senhaHash } });
  await prisma.contatoToken.update({ where: { id: registro.id }, data: { usedAt: new Date() } });
  return ok(res, { definida: true });
});

// ---------- Rotas autenticadas ----------
router.use(authenticateContato);

router.get('/me', async (req, res) => {
  return ok(res, { nome: req.contato!.nome, email: req.contato!.email, empresas: req.contato!.empresas, empresaAtual: req.contato!.empresaAtual });
});

router.get('/home', async (req, res) => {
  const empresaId = req.contato!.empresaAtual;
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const [docsNovos, solicitacoesAbertas, comunicados] = await Promise.all([
    prisma.documentoGED.count({ where: { empresaId, createdAt: { gte: inicioMes } } }),
    prisma.solicitacaoPortal.count({ where: { empresaId, contatoEmail: req.contato!.email, status: { not: 'FINALIZADA' } } }),
    prisma.comunicado.count({ where: { escritorioId: req.contato!.escritorioId, ativo: true } }),
  ]);
  return ok(res, { docsNovos, solicitacoesAbertas, comunicados });
});

// ---------- Documentos ----------
router.get('/documentos', async (req, res) => {
  const empresaId = req.contato!.empresaAtual;
  const raiz = req.query.raiz as string | undefined;
  const busca = req.query.busca as string | undefined;
  const docs = await prisma.documentoGED.findMany({
    where: { empresaId, ...(raiz ? { raiz } : {}), ...(busca ? { nomeArquivo: { contains: busca, mode: 'insensitive' } } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  // filtra DocsEntregas pelas permissoes do contato
  const perm = permissaoContato(req);
  let visiveis = docs;
  if (perm.departamentoIds.length || perm.obrigacaoIds.length) {
    const entregaIds = docs.map((d) => d.entregaId).filter(Boolean) as string[];
    const entregas = entregaIds.length
      ? await prisma.entrega.findMany({ where: { id: { in: entregaIds } }, include: { obrigacao: { select: { departamentoId: true } } } })
      : [];
    const mapaEntrega = new Map(entregas.map((e) => [e.id, e]));
    visiveis = docs.filter((d) => {
      if (d.raiz !== 'DocsEntregas' || !d.entregaId) return true;
      const e = mapaEntrega.get(d.entregaId);
      if (!e) return true;
      if (perm.departamentoIds.length && e.obrigacao.departamentoId && !perm.departamentoIds.includes(e.obrigacao.departamentoId)) return false;
      if (perm.obrigacaoIds.length && !perm.obrigacaoIds.includes(e.obrigacaoId)) return false;
      return true;
    });
  }
  return ok(res, visiveis.map((d) => ({ id: d.id, raiz: d.raiz, pasta: d.pasta, nomeArquivo: d.nomeArquivo, tamanho: d.tamanho, createdAt: d.createdAt })));
});

router.get('/documentos/:id/download', async (req, res) => {
  const doc = await prisma.documentoGED.findFirst({ where: { id: req.params.id, empresaId: req.contato!.empresaAtual } });
  if (!doc || !isInsideStorage(doc.caminho) || !fs.existsSync(doc.caminho)) throw Errors.naoEncontrado('Documento');
  // registra protocolo de visualizacao
  let protocolo = await prisma.protocolo.findFirst({ where: { documentoId: doc.id, contatoId: null, destinatario: req.contato!.email } });
  if (!protocolo) {
    protocolo = await prisma.protocolo.create({
      data: { escritorioId: req.contato!.escritorioId, empresaId: doc.empresaId, documentoId: doc.id, destinatario: req.contato!.email, canal: 'AREA_VIP', token: generateToken(20) },
    });
  }
  await prisma.protocoloVisualizacao.create({ data: { protocoloId: protocolo.id, ip: req.ip, userAgent: (req.headers['user-agent'] ?? '').slice(0, 255) } }).catch(() => undefined);
  return res.download(doc.caminho, doc.nomeArquivo);
});

router.get('/documentos/zip', async (req, res) => {
  const raiz = req.query.raiz as string | undefined;
  const docs = await prisma.documentoGED.findMany({ where: { empresaId: req.contato!.empresaAtual, ...(raiz ? { raiz } : {}) } });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="meus-documentos.zip"');
  const zip = archiver('zip', { zlib: { level: 9 } });
  zip.pipe(res);
  for (const d of docs) if (isInsideStorage(d.caminho) && fs.existsSync(d.caminho)) zip.file(d.caminho, { name: path.join(d.raiz, d.pasta, d.nomeArquivo) });
  await zip.finalize();
});

// ---------- Calendario ----------
router.get('/calendario', async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  const mes = Number(req.query.mes) || new Date().getMonth() + 1;
  const entregas = await prisma.entrega.findMany({
    where: { empresaId: req.contato!.empresaAtual, competenciaAno: ano, competenciaMes: mes },
    include: { obrigacao: { select: { nome: true } } },
    orderBy: { prazoLegal: 'asc' },
  });
  return ok(res, entregas.map((e) => ({
    id: e.id, obrigacao: e.obrigacao.nome, prazoLegal: e.prazoLegal,
    status: statusEfetivo(e.status as StatusEntrega, e.prazoTecnico, e.prazoLegal),
  })));
});

// ---------- Comunicados ----------
router.get('/comunicados', async (req, res) => {
  const comunicados = await prisma.comunicado.findMany({
    where: { escritorioId: req.contato!.escritorioId, ativo: true, OR: [{ publicarEm: null }, { publicarEm: { lte: new Date() } }] },
    orderBy: { createdAt: 'desc' },
    include: { leituras: { where: { contatoEmail: req.contato!.email } } },
  });
  return ok(res, comunicados.map((c) => ({ id: c.id, titulo: c.titulo, conteudo: c.conteudo, createdAt: c.createdAt, lido: c.leituras.length > 0 })));
});

router.post('/comunicados/:id/ler', async (req, res) => {
  await prisma.comunicadoLeitura.upsert({
    where: { comunicadoId_contatoEmail: { comunicadoId: req.params.id, contatoEmail: req.contato!.email } },
    create: { comunicadoId: req.params.id, contatoEmail: req.contato!.email },
    update: {},
  }).catch(() => undefined);
  return ok(res, { lido: true });
});

// ---------- Solicitacoes ----------
router.get('/solicitacoes', async (req, res) => {
  const itens = await prisma.solicitacaoPortal.findMany({
    where: { empresaId: req.contato!.empresaAtual, contatoEmail: req.contato!.email },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, itens);
});

router.post('/solicitacoes', validate({ body: z.object({ titulo: z.string().min(2), descricao: z.string().min(2) }) }), async (req, res) => {
  const s = await prisma.solicitacaoPortal.create({
    data: {
      escritorioId: req.contato!.escritorioId, empresaId: req.contato!.empresaAtual,
      contatoEmail: req.contato!.email, contatoNome: req.contato!.nome,
      titulo: req.body.titulo, descricao: req.body.descricao,
      mensagens: { create: { autorTipo: 'CONTATO', autorNome: req.contato!.nome, texto: req.body.descricao } },
    },
  });
  return ok(res, s, 201);
});

router.get('/solicitacoes/:id', async (req, res) => {
  const s = await prisma.solicitacaoPortal.findFirst({
    where: { id: req.params.id, contatoEmail: req.contato!.email },
    include: { mensagens: { orderBy: { createdAt: 'asc' } } },
  });
  if (!s) throw Errors.naoEncontrado('Solicitacao');
  return ok(res, s);
});

router.post('/solicitacoes/:id/mensagem', validate({ body: z.object({ texto: z.string().min(1) }) }), async (req, res) => {
  const s = await prisma.solicitacaoPortal.findFirst({ where: { id: req.params.id, contatoEmail: req.contato!.email } });
  if (!s) throw Errors.naoEncontrado('Solicitacao');
  await prisma.solicitacaoMensagem.create({ data: { solicitacaoId: s.id, autorTipo: 'CONTATO', autorNome: req.contato!.nome, texto: req.body.texto } });
  return ok(res, { enviado: true });
});

router.post('/solicitacoes/:id/avaliar', validate({ body: z.object({ nota: z.number().int().min(1).max(5), comentario: z.string().optional() }) }), async (req, res) => {
  const s = await prisma.solicitacaoPortal.findFirst({ where: { id: req.params.id, contatoEmail: req.contato!.email } });
  if (!s) throw Errors.naoEncontrado('Solicitacao');
  await prisma.solicitacaoPortal.update({ where: { id: s.id }, data: { avaliacaoNota: req.body.nota, avaliacaoComentario: req.body.comentario || null, status: 'FINALIZADA' } });
  return ok(res, { avaliado: true });
});

// ---------- LGPD ----------
router.get('/lgpd', async (req, res) => {
  const e = await prisma.escritorio.findUniqueOrThrow({ where: { id: req.contato!.escritorioId } });
  const cfg = (e.config as Record<string, unknown>).lgpd as { texto?: string; versao?: string } | undefined;
  const versao = cfg?.versao || '1';
  const aceite = await prisma.aceiteLGPD.findFirst({ where: { escritorioId: e.id, contatoEmail: req.contato!.email, versao } });
  return ok(res, { texto: cfg?.texto || 'Politica de privacidade nao configurada.', versao, aceito: !!aceite });
});

router.post('/lgpd/aceitar', async (req, res) => {
  const e = await prisma.escritorio.findUniqueOrThrow({ where: { id: req.contato!.escritorioId } });
  const cfg = (e.config as Record<string, unknown>).lgpd as { versao?: string } | undefined;
  const versao = cfg?.versao || '1';
  await prisma.aceiteLGPD.create({ data: { escritorioId: e.id, contatoEmail: req.contato!.email, versao, ip: req.ip } });
  return ok(res, { aceito: true });
});

// ---------- Cadastro preliminar de colaborador -> inicia processo Admissao ----------
router.post('/colaborador', validate({ body: z.object({ nome: z.string().min(2), cpf: z.string().optional(), cargo: z.string().optional(), salario: z.string().optional(), admissao: z.string().optional() }) }), async (req, res) => {
  const matriz = await prisma.matrizProcesso.findFirst({ where: { escritorioId: req.contato!.escritorioId, nome: 'Admissao de Funcionario' } });
  if (!matriz) throw Errors.validacao('Matriz de admissao nao configurada.');
  const proc = await processoSvc.instanciar(req.contato!.escritorioId, matriz.id, req.contato!.empresaAtual);
  const b = req.body;
  await prisma.processoComentario.create({
    data: { processoId: proc.id, texto: `Cadastro preliminar (Area VIP): ${b.nome} | CPF ${b.cpf ?? '-'} | Cargo ${b.cargo ?? '-'} | Salario ${b.salario ?? '-'} | Admissao ${b.admissao ?? '-'}` },
  });
  return ok(res, { processoId: proc.id }, 201);
});

// ---------- Processos da empresa (acompanhamento, somente leitura) ----------
router.get('/processos', async (req, res) => {
  const empresaId = req.contato!.empresaAtual;
  const processos = await prisma.processo.findMany({
    where: { escritorioId: req.contato!.escritorioId, empresaId },
    orderBy: { dataInicio: 'desc' },
    include: { passos: { select: { status: true } } },
  });
  const gestorIds = [...new Set(processos.map((p) => p.gestorId).filter(Boolean) as string[])];
  const gestores = await prisma.usuario.findMany({ where: { id: { in: gestorIds } }, select: { id: true, nome: true } });
  const gMap = new Map(gestores.map((g) => [g.id, g.nome]));
  return ok(res, processos.map((p) => {
    const total = p.passos.length;
    const concluidos = p.passos.filter((s) => s.status === 'CONCLUIDO' || s.status === 'DISPENSADO').length;
    return {
      id: p.id, nome: p.titulo || p.nome, status: p.status,
      gestor: p.gestorId ? gMap.get(p.gestorId) ?? null : null,
      dataInicio: p.dataInicio, previsaoConclusao: p.previsaoConclusao, dataConclusao: p.dataConclusao,
      progresso: total ? Math.round((concluidos / total) * 100) : 0, total, concluidos,
    };
  }));
});

router.get('/processos/:id', async (req, res) => {
  const empresaId = req.contato!.empresaAtual;
  const p = await prisma.processo.findFirst({
    where: { id: req.params.id, escritorioId: req.contato!.escritorioId, empresaId },
    include: { passos: { where: { visivelCliente: true }, orderBy: { ordem: 'asc' } } },
  });
  if (!p) throw Errors.naoEncontrado('Processo');
  const gestor = p.gestorId ? await prisma.usuario.findUnique({ where: { id: p.gestorId }, select: { nome: true } }) : null;
  return ok(res, {
    id: p.id, nome: p.titulo || p.nome, status: p.status, gestor: gestor?.nome ?? null,
    dataInicio: p.dataInicio, previsaoConclusao: p.previsaoConclusao, dataConclusao: p.dataConclusao,
    passos: p.passos.map((s) => ({ id: s.id, titulo: s.titulo, descricao: s.descricao, status: s.status, prazo: s.prazo, concluidoEm: s.concluidoEm })),
  });
});

// ---------- NPS / Avalie-nos ----------
router.post('/nps', validate({ body: z.object({ nota: z.number().int().min(0).max(10), comentario: z.string().optional() }) }), async (req, res) => {
  if (req.body.nota <= 8 && !req.body.comentario?.trim()) throw Errors.validacao('Para notas ate 8, conte-nos o motivo.');
  await prisma.npsAvaliacao.create({
    data: {
      escritorioId: req.contato!.escritorioId, empresaId: req.contato!.empresaAtual,
      contatoEmail: req.contato!.email, contatoNome: req.contato!.nome,
      nota: req.body.nota, comentario: req.body.comentario?.trim() || null,
    },
  });
  return ok(res, { registrado: true });
});

// ---------- Meus dados (perfil do contato) ----------
router.put('/perfil', validate({ body: z.object({ nome: z.string().min(2).optional(), senhaAtual: z.string().optional(), novaSenha: z.string().min(8).optional() }) }), async (req, res) => {
  const { escritorioId, email } = req.contato!;
  const rows = await prisma.empresaContato.findMany({ where: { escritorioId, email } });
  if (rows.length === 0) throw Errors.naoEncontrado('Contato');
  const data: { nome?: string; senhaHash?: string } = {};
  if (req.body.nome) data.nome = req.body.nome;
  if (req.body.novaSenha) {
    const atual = rows.find((r) => r.senhaHash)?.senhaHash;
    if (atual && !(await verifyPassword(req.body.senhaAtual ?? '', atual))) throw Errors.validacao('Senha atual incorreta.');
    data.senhaHash = await hashPassword(req.body.novaSenha);
  }
  if (Object.keys(data).length === 0) throw Errors.validacao('Nada para atualizar.');
  await prisma.empresaContato.updateMany({ where: { escritorioId, email }, data });
  return ok(res, { atualizado: true });
});

// ---------- ACDOX: documentos a enviar (recepcao pelo cliente) ----------
router.get('/cobrancas', async (req, res) => {
  const lista = await acdoxSvc.listarCobrancasCliente(req.contato!.escritorioId, req.contato!.empresaAtual);
  return ok(res, lista);
});

const uploadCobranca = multer({
  storage: multer.diskStorage({
    destination: (req, _f, cb) => cb(null, ensureDir(path.join(STORAGE_ROOT, 'acdox', req.params.id))),
    filename: (_r, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/cobrancas/:id/itens/:itemId/enviar', uploadCobranca.single('arquivo'), async (req, res) => {
  const arquivo = (req.file as Express.Multer.File | undefined)?.path;
  if (!arquivo) throw Errors.validacao('Anexe o documento.');
  const r = await acdoxSvc.enviarItemCliente(req.contato!.escritorioId, req.contato!.empresaAtual, req.params.id, req.params.itemId, arquivo);
  return ok(res, r);
});

export default router;
