// Situação Fiscal (e-CAC) — regras do painel da Atuan (FiscalView + Puxar do e-CAC + optantes).
// Relatórios por escritório (perfil), um por CNPJ: o mais recente fica (mesma regra do upsert
// do FiscalView). O robô e a fila são da ponte ecac-bridge (127.0.0.1:8790), compartilhada.
import fs from 'node:fs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { Errors } from '../../lib/errors.js';
import { consultarCnpj } from '../empresa/empresa.routes.js';
import { finalize, lerRelatorio, type RelatorioFiscal } from './fiscal.parser.js';

type Ator = { id: string; nome: string };
const dig = (v: unknown) => String(v ?? '').replace(/\D/g, '');

// ─── Carteira: empresas do escritório com CNPJ + grupo do painel ─────────────
// Grupo = carteira do painel: MEI (carteira própria), ATUAN Digital, Esporádicos ou NAUTA.
function grupoDe(e: { carteiraMei: boolean; frente: string | null }) {
  if (e.carteiraMei) return 'mei';
  if (e.frente === 'digital') return 'digital';
  if (e.frente === 'esporadico') return 'esporadico';
  return 'nauta';
}

export async function carteira(escritorioId: string) {
  const emps = await prisma.empresa.findMany({
    where: { escritorioId, deletedAt: null },
    select: {
      id: true, razaoSocial: true, nomeFantasia: true, ativo: true, naCarteira: true, carteiraMei: true, frente: true,
      simplesOptante: true, simplesDesde: true, simplesSaida: true, simeiOptante: true, simeiDesde: true, simeiSaida: true, receitaEm: true,
      identificadores: { where: { tipo: 'CNPJ' }, select: { valor: true } },
    },
    orderBy: { razaoSocial: 'asc' },
  });
  return emps.map((e) => ({
    id: e.id, nome: e.razaoSocial, fantasia: e.nomeFantasia, ativo: e.ativo, naCarteira: e.naCarteira,
    cnpj: dig(e.identificadores[0]?.valor), grupo: grupoDe(e), carteiraMei: e.carteiraMei,
    simplesOptante: e.simplesOptante, simplesDesde: e.simplesDesde, simplesSaida: e.simplesSaida,
    simeiOptante: e.simeiOptante, simeiDesde: e.simeiDesde, simeiSaida: e.simeiSaida, receitaEm: e.receitaEm,
  }));
}

export async function dados(escritorioId: string) {
  const [rels, emps, hist] = await Promise.all([
    prisma.sitFiscalRelatorio.findMany({ where: { escritorioId }, select: { id: true, empresaId: true, dados: true } }),
    carteira(escritorioId),
    prisma.sitFiscalImportacao.findMany({ where: { escritorioId }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  // finalize() de novo na leitura, como o FiscalView fazia a cada render (regras sempre atuais)
  const relatorios = rels.map((r) => ({ ...finalize(r.dados as unknown as RelatorioFiscal), id: r.id, empresaId: r.empresaId }));
  return { relatorios, carteira: emps, historico: hist };
}

// ─── Gravação (upsert do FiscalView: relatório mais recente vence) ───────────
async function empresaPorCnpj(escritorioId: string, cnpj: string) {
  const i = await prisma.empresaIdentificador.findFirst({
    where: { escritorioId, tipo: 'CNPJ', valor: { in: [cnpj, cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')] }, empresa: { deletedAt: null } },
    select: { empresaId: true },
  });
  return i?.empresaId ?? null;
}

export async function gravar(escritorioId: string, r: RelatorioFiscal, por: string | null): Promise<'inserted' | 'updated' | 'ignored'> {
  const cnpj = dig(r.cnpj);
  const atual = await prisma.sitFiscalRelatorio.findUnique({ where: { escritorioId_cnpj: { escritorioId, cnpj } } });
  const ts = r.reportTimestamp || 0;
  if (atual && ts < (atual.reportEm?.getTime() ?? 0)) return 'ignored';
  const data = {
    companyName: r.companyName, priority: r.priority, exigivel: new Prisma.Decimal(r.exigibleAmount.toFixed(2)),
    reportEm: ts ? new Date(ts) : null, fileName: r.fileName || null, dados: r as unknown as Prisma.InputJsonValue,
    importadoEm: new Date(r.importedAt || Date.now()), importadoPor: por, empresaId: await empresaPorCnpj(escritorioId, cnpj),
  };
  if (atual) { await prisma.sitFiscalRelatorio.update({ where: { id: atual.id }, data }); return 'updated'; }
  await prisma.sitFiscalRelatorio.create({ data: { escritorioId, cnpj, ...data } });
  return 'inserted';
}

export interface ItemImportado { arquivo: string; empresa?: string; status: 'ok' | 'replaced' | 'ignored' | 'error'; mensagem: string }

export async function importarArquivos(escritorioId: string, ator: Ator, arquivos: { nome: string; buf: Buffer }[]) {
  const itens: ItemImportado[] = [];
  for (const a of arquivos) {
    try {
      const r = await lerRelatorio(a.buf, a.nome);
      const res = await gravar(escritorioId, r, ator.nome);
      itens.push({ arquivo: a.nome, empresa: r.companyName, status: res === 'updated' ? 'replaced' : res === 'ignored' ? 'ignored' : 'ok',
        mensagem: res === 'updated' ? 'Versão anterior atualizada' : res === 'ignored' ? 'Ignorado: existe relatório mais recente' : r.companyName });
    } catch (e) {
      itens.push({ arquivo: a.nome, status: 'error', mensagem: (e as Error).message || 'Falha na leitura.' });
    }
  }
  if (itens.length) {
    await prisma.sitFiscalImportacao.createMany({ data: itens.map((i) => ({ escritorioId, arquivo: i.arquivo, empresa: i.empresa ?? null, status: i.status, mensagem: i.mensagem, usuarioNome: ator.nome })) });
  }
  const total = await prisma.sitFiscalRelatorio.count({ where: { escritorioId } });
  return {
    itens, total,
    concluidos: itens.filter((i) => i.status !== 'error').length,
    novos: itens.filter((i) => i.status === 'ok').length,
    atualizados: itens.filter((i) => i.status === 'replaced').length,
    erros: itens.filter((i) => i.status === 'error').length,
  };
}

export async function excluir(escritorioId: string, id: string) {
  const r = await prisma.sitFiscalRelatorio.findFirst({ where: { id, escritorioId } });
  if (!r) throw Errors.naoEncontrado('Relatório');
  await prisma.sitFiscalRelatorio.delete({ where: { id } });
  return { excluido: true };
}

// ─── Ponte do robô (ecac-bridge) ─────────────────────────────────────────────
let tokenCache = '';
function token(): string {
  if (env.ecac.token) return env.ecac.token;
  if (!tokenCache) { try { tokenCache = fs.readFileSync(env.ecac.tokenFile, 'utf8').trim(); } catch { tokenCache = ''; } }
  return tokenCache;
}

export async function ponte(caminho: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const t = token();
  if (!t) throw Errors.validacao('Ponte do e-CAC não configurada no servidor.');
  let r: Response;
  try {
    r = await fetch(env.ecac.url + caminho, {
      method: init.method ?? 'GET',
      headers: { 'x-ecac-token': t, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw Errors.validacao('A ponte do e-CAC não respondeu.'); }
  if (r.status === 204) return null;
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok) throw Errors.validacao(String(j?.error ?? `Ponte do e-CAC: HTTP ${r.status}`));
  return j;
}

async function pdfDaPonte(jobId: string, nome: string): Promise<Buffer> {
  const r = await fetch(`${env.ecac.url}/jobs/${encodeURIComponent(jobId)}/pdf/${encodeURIComponent(nome)}`, { headers: { 'x-ecac-token': token() }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`PDF ${nome}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Baixa da ponte e importa (o "importarViaFiscalView" do painel, agora no servidor).
// O mesmo arquivo em dois lotes entra uma vez só.
export async function importarDoRobo(escritorioId: string, ator: Ator, itens: { jobId: string; nome: string }[]) {
  const vistos = new Set<string>();
  const arquivos: { nome: string; buf: Buffer }[] = [];
  const falhas: ItemImportado[] = [];
  for (const it of itens) {
    if (vistos.has(it.nome)) continue;
    vistos.add(it.nome);
    try { arquivos.push({ nome: it.nome, buf: await pdfDaPonte(it.jobId, it.nome) }); }
    catch (e) { falhas.push({ arquivo: it.nome, status: 'error', mensagem: (e as Error).message }); }
  }
  const r = await importarArquivos(escritorioId, ator, arquivos);
  return { ...r, itens: [...r.itens, ...falhas], erros: r.erros + falhas.length, baixados: arquivos.length };
}

// ─── Consulta de optantes: cartão CNPJ (Receita) de uma empresa ──────────────
export async function atualizarOptante(escritorioId: string, empresaId: string) {
  const e = await prisma.empresa.findFirst({ where: { id: empresaId, escritorioId, deletedAt: null }, select: { id: true, razaoSocial: true, simplesOptante: true, simeiOptante: true, identificadores: { where: { tipo: 'CNPJ' }, select: { valor: true } } } });
  if (!e) throw Errors.naoEncontrado('Empresa');
  const cnpj = dig(e.identificadores[0]?.valor);
  if (cnpj.length !== 14) throw Errors.validacao('Empresa sem CNPJ.');
  const d = await consultarCnpj(cnpj);
  const s = d.simples;
  const data: Prisma.EmpresaUpdateInput = { receitaEm: new Date() };
  // só o que veio preenchido (mesma regra do painel)
  if (s) for (const k of ['simplesOptante', 'simplesDesde', 'simplesSaida', 'simeiOptante', 'simeiDesde', 'simeiSaida'] as const) if (s[k]) (data as Record<string, unknown>)[k] = s[k];
  const novo = await prisma.empresa.update({ where: { id: e.id }, data, select: { simplesOptante: true, simplesDesde: true, simplesSaida: true, simeiOptante: true, simeiDesde: true, simeiSaida: true, receitaEm: true } });
  return { ...novo, nome: e.razaoSocial, mudou: `${e.simplesOptante}|${e.simeiOptante}` !== `${novo.simplesOptante}|${novo.simeiOptante}` };
}
