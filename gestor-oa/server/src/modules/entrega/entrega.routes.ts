import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ok, parsePagination, paginated } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { ensureDir, STORAGE_ROOT } from '../../lib/storage.js';
import * as svc from './entrega.service.js';
import * as ged from '../ged/ged.service.js';
import * as comunicacao from '../comunicacao/comunicacao.service.js';
import type { StatusEntrega } from './entrega.status.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('entregas_ver'));

// ---------- Listagem ----------
const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  ano: z.coerce.number().optional(),
  mes: z.coerce.number().optional(),
  empresaId: z.string().optional(),
  obrigacaoId: z.string().optional(),
  departamentoId: z.string().optional(),
  responsavelId: z.string().optional(),
  tagId: z.string().optional(),
  status: z.string().optional(),
  // tela [F2]
  q: z.string().optional(),
  statusList: z.string().optional(),       // CSV de StatusEntrega
  compDe: z.string().optional(),           // "YYYY-MM"
  compAte: z.string().optional(),
  prazoTecDe: z.string().optional(),
  prazoTecAte: z.string().optional(),
  prazoLegalDe: z.string().optional(),
  prazoLegalAte: z.string().optional(),
  entregaDe: z.string().optional(),
  entregaAte: z.string().optional(),
  ordem: z.string().optional(),
  dir: z.string().optional(),
});

function parseComp(s?: string): { ano: number; mes: number } | undefined {
  if (!s) return undefined;
  const [ano, mes] = s.split('-').map(Number);
  if (!ano || !mes) return undefined;
  return { ano, mes };
}

router.get('/', validate({ query: listQuery }), async (req, res) => {
  const pag = parsePagination(req.query);
  const q = req.query as Record<string, string>;
  const { items, total } = await svc.listar(
    req.auth!.escritorioId,
    {
      ano: q.ano ? Number(q.ano) : undefined,
      mes: q.mes ? Number(q.mes) : undefined,
      empresaId: q.empresaId,
      obrigacaoId: q.obrigacaoId,
      departamentoId: q.departamentoId,
      responsavelId: q.responsavelId,
      tagId: q.tagId,
      status: q.status as StatusEntrega | undefined,
      q: q.q,
      statusList: q.statusList ? (q.statusList.split(',').filter(Boolean) as StatusEntrega[]) : undefined,
      compDe: parseComp(q.compDe),
      compAte: parseComp(q.compAte),
      prazoTecDe: q.prazoTecDe,
      prazoTecAte: q.prazoTecAte,
      prazoLegalDe: q.prazoLegalDe,
      prazoLegalAte: q.prazoLegalAte,
      entregaDe: q.entregaDe,
      entregaAte: q.entregaAte,
      ordem: q.ordem as svc.OrdemEntrega | undefined,
      dir: q.dir === 'desc' ? 'desc' : 'asc',
    },
    req.auth!.filtrosForcados,
    pag,
  );
  return ok(res, paginated(items, total, pag));
});

router.get('/calendario', async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  const mes = Number(req.query.mes) || new Date().getMonth() + 1;
  const dias = await svc.calendario(req.auth!.escritorioId, ano, mes, req.auth!.filtrosForcados);
  return ok(res, { ano, mes, dias });
});

// ---------- Gerar competencia ----------
router.post(
  '/gerar',
  requirePermission('entregas_editar_prazos'),
  validate({ body: z.object({ ano: z.number().int(), mes: z.number().int().min(1).max(12) }) }),
  async (req, res) => {
    const r = await svc.gerarCompetencia(req.auth!.escritorioId, req.body.ano, req.body.mes);
    return ok(res, r);
  },
);

router.post('/recalcular', requirePermission('entregas_editar_prazos'), async (req, res) => {
  const r = await svc.recalcular(req.auth!.escritorioId);
  return ok(res, r);
});

// ---------- Export CSV ----------
router.get('/export', requirePermission('relatorios_ver'), async (req, res) => {
  const q = req.query as Record<string, string>;
  const pag = { page: 1, limit: 100000, skip: 0, take: 100000 };
  const { items } = await svc.listar(
    req.auth!.escritorioId,
    {
      ano: q.ano ? Number(q.ano) : undefined,
      mes: q.mes ? Number(q.mes) : undefined,
      status: q.status as StatusEntrega | undefined,
    },
    req.auth!.filtrosForcados,
    pag,
  );
  const linhas = ['Empresa;Obrigacao;Departamento;Competencia;Prazo tecnico;Prazo legal;Status;Data entrega'];
  for (const e of items) {
    linhas.push(
      [
        e.empresa.razaoSocial,
        e.obrigacao.nome,
        e.obrigacao.departamento?.nome ?? '-',
        e.competencia,
        new Date(e.prazoTecnico).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
        new Date(e.prazoLegal).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
        e.status,
        e.dataEntrega ? new Date(e.dataEntrega).toLocaleDateString('pt-BR') : '',
      ].join(';'),
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="entregas.csv"');
  return res.send('﻿' + linhas.join('\n'));
});

// ---------- Baixa (OK) com anexos ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) =>
      cb(null, ensureDir(path.join(STORAGE_ROOT, 'entregas', req.params.id))),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post(
  '/:id/baixar',
  requirePermission('entregas_baixar'),
  upload.array('anexos', 20),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const entrega = await svc.baixar(
      req.auth!.escritorioId,
      req.params.id,
      {
        dataEntrega: req.body.dataEntrega,
        atualizarResponsavel: req.body.atualizarResponsavel === 'true' || req.body.atualizarResponsavel === true,
        justificativa: req.body.justificativa,
        numeroProtocolo: req.body.numeroProtocolo,
        vencimentoGuia: req.body.vencimentoGuia,
        comentario: req.body.comentario,
        anexosCount: files.length,
      },
      req.auth!.id,
    );
    // registra anexos + copia para a GED (DocsEntregas/{ano}/{comp}/{obrigacao})
    if (files.length) {
      await prisma.entregaAnexo.createMany({
        data: files.map((f) => ({
          escritorioId: req.auth!.escritorioId,
          entregaId: req.params.id,
          nomeArquivo: f.originalname,
          caminho: f.path,
          tamanho: f.size,
          mimeType: f.mimetype,
        })),
      });
      const det = await prisma.entrega.findUnique({
        where: { id: req.params.id },
        include: { obrigacao: { select: { nome: true } } },
      });
      if (det) {
        const comp = `${det.competenciaAno}/${String(det.competenciaMes).padStart(2, '0')}`;
        for (const f of files) {
          await ged.adicionar(req.auth!.escritorioId, det.empresaId, {
            raiz: 'DocsEntregas',
            pasta: `${comp}/${det.obrigacao.nome}`,
            nomeArquivo: f.originalname,
            caminho: f.path,
            tamanho: f.size,
            mimeType: f.mimetype,
            origem: 'ENTREGA',
            entregaId: det.id,
            uploadedById: req.auth!.id,
          });
        }
      }
    }
    // checkbox "enviar ao cliente agora" -> Modulo 8
    let enviados = 0;
    if (req.body.enviarCliente === 'true' || req.body.enviarCliente === true) {
      const r = await comunicacao.enviarEntrega(req.auth!.escritorioId, req.params.id, req.auth!.id).catch(() => ({ enviados: 0 }));
      enviados = r.enviados;
    }
    return ok(res, { entrega, enviados });
  },
);

router.post('/:id/desfazer', requirePermission('entregas_baixar'), async (req, res) => {
  const entrega = await prisma.entrega.findFirst({
    where: { id: req.params.id, escritorioId: req.auth!.escritorioId },
    select: { origemBaixa: true },
  });
  if (!entrega) throw Errors.naoEncontrado('Entrega');
  if (entrega.origemBaixa === 'ROBO' && !req.auth!.permissoes['entregas_desfazer_robo']) {
    throw Errors.semPermissao('entregas_desfazer_robo');
  }
  const r = await svc.desfazer(req.auth!.escritorioId, req.params.id);
  return ok(res, r);
});

router.post(
  '/:id/dispensar',
  requirePermission('entregas_dispensar'),
  validate({ body: z.object({ motivo: z.string().optional() }) }),
  async (req, res) => {
    const r = await svc.dispensar(req.auth!.escritorioId, req.params.id, req.body.motivo ?? '');
    return ok(res, r);
  },
);

router.put(
  '/:id/prazo',
  requirePermission('entregas_editar_prazos'),
  validate({ body: z.object({ prazoLegal: z.string().optional(), prazoTecnico: z.string().optional() }) }),
  async (req, res) => {
    const r = await svc.editarPrazo(req.auth!.escritorioId, req.params.id, req.body);
    return ok(res, r);
  },
);

router.post(
  '/acoes-massa',
  requirePermission('entregas_acoes_massa'),
  validate({
    body: z.object({
      entregaIds: z.array(z.string()).min(1, 'Selecione ao menos uma entrega.'),
      acao: z.enum(['postergar', 'transferir', 'baixar', 'dispensar']),
      novaData: z.string().optional(),
      dias: z.number().int().optional(),
      responsavelId: z.string().optional(),
      motivo: z.string().optional(),
    }),
  }),
  async (req, res) => {
    const r = await svc.acoesMassa(req.auth!.escritorioId, req.body, req.auth!.id);
    return ok(res, r);
  },
);

export default router;
