// Formularios societarios enviados pelo cliente (site da Atuan). Durante a transicao o
// formulario publico continua postando no servico antigo (atuan-formularios); o Obrigo le
// o arquivo dele (somente leitura) e traz os envios novos para a fila de aprovacao.
import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import { escritorioDir, ensureDir } from '../../lib/storage.js';
import * as soc from './societario.service.js';

const ARQUIVO = process.env.ATUAN_FORM_ARQUIVO || '/var/lib/atuan-formularios/formularios.json';
// Envios ja baixados pelo painel antigo antes desta data ficaram la (vieram na importacao)
const DESDE = new Date(process.env.ATUAN_FORM_DESDE || '2026-10-23T00:00:00-03:00');
const MARCA = 'ATUAN-SOC:';
const NATUREZAS: Record<string, string> = { LTDA: 'Sociedade Limitada', EI: 'Empresário Individual', ASSOCIACAO: 'Associação Privada', MEI: 'Microempreendedor Individual' };

interface Payload {
  origem?: string; enviadoEm?: string; servico?: string; natureza?: string;
  alteracao?: { endereco?: boolean; atividade?: boolean; outro?: boolean };
  empresa?: { razao?: string; fantasia?: string; cnpj?: string; capital?: string; atividades?: string; endereco?: string; cidade?: string; uf?: string; cep?: string; imovel?: string; iptu?: string };
  documento?: { nome?: string; tipo?: string; dados?: string; tamanho?: number } | null;
  contato?: { responsavel?: string; telefone?: string; email?: string };
  socios?: { nome?: string; cpf?: string; pct?: string; funcao?: string; email?: string }[];
  observacao?: string;
}
type Ator = soc.Ator;
const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

export async function listar(escritorioId: string) {
  const fs_ = await prisma.socFormulario.findMany({ where: { escritorioId }, orderBy: { recebidoEm: 'desc' } });
  const procs = await prisma.socProcesso.findMany({ where: { escritorioId, id: { in: fs_.map((f) => f.processoId).filter(Boolean) as string[] } }, select: { id: true, codigo: true } });
  const cod = new Map(procs.map((p) => [p.id, p.codigo]));
  return fs_.map((f) => ({ ...f, documentoArquivo: undefined, temDocumento: !!f.documentoArquivo, processoCodigo: f.processoId ? cod.get(f.processoId) ?? null : null }));
}

function registro(dados: Payload) {
  return {
    servico: dados.servico || 'Abertura', empresaNome: dados.empresa?.razao || '—',
    contato: dados.contato?.responsavel || null, telefone: dados.contato?.telefone || null,
  };
}

function salvarDocumento(escritorioId: string, formId: string, doc: Payload['documento']) {
  if (!doc?.dados) return {};
  const buf = Buffer.from(doc.dados, 'base64');
  if (!buf.length) return {};
  const ext = path.extname(doc.nome || '') || (doc.tipo === 'application/pdf' ? '.pdf' : '.jpg');
  const dir = ensureDir(escritorioDir(escritorioId, 'societario', 'formularios'));
  const arq = path.join(dir, `${formId}${ext}`);
  fs.writeFileSync(arq, buf);
  return { documentoArquivo: arq, documentoNome: doc.nome || `documento${ext}`, documentoTipo: doc.tipo || 'application/octet-stream', documentoTamanho: buf.length };
}

// Le o arquivo do servico de formularios e traz os envios que ainda nao estao aqui
export async function buscar(escritorioId: string) {
  if (!fs.existsSync(ARQUIVO)) throw Errors.validacao('Não consegui falar com o serviço de formulários. Use a caixa de código.');
  let lista: { id: string; protocolo: string; recebidoEm: string; baixadoEm?: string; dados: Payload }[];
  try {
    const j = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
    lista = Array.isArray(j) ? j : j.formularios ?? j.registros ?? [];
  } catch { throw Errors.validacao('O arquivo do serviço de formulários está ilegível agora. Tente de novo.'); }
  const conhecidos = new Set((await prisma.socFormulario.findMany({ where: { escritorioId, servidorId: { not: null } }, select: { servidorId: true } })).map((x) => x.servidorId));
  let novos = 0; let jaEstavam = 0;
  for (const r of lista) {
    if (!r?.id || r.dados?.origem !== 'formulario-societario') continue;
    if (conhecidos.has(r.id)) { jaEstavam++; continue; }
    if (r.baixadoEm && new Date(r.recebidoEm) < DESDE) continue;
    const f = await prisma.socFormulario.create({
      data: {
        escritorioId, servidorId: r.id, protocolo: r.protocolo || null, recebidoEm: new Date(r.recebidoEm || Date.now()),
        enviadoEm: r.dados.enviadoEm || null, ...registro(r.dados),
        dados: { ...r.dados, documento: r.dados.documento ? { nome: r.dados.documento.nome, tipo: r.dados.documento.tipo, tamanho: r.dados.documento.tamanho ?? 0 } : null } as Prisma.InputJsonValue,
      },
    });
    const doc = salvarDocumento(escritorioId, f.id, r.dados.documento);
    if (doc.documentoArquivo) await prisma.socFormulario.update({ where: { id: f.id }, data: doc });
    novos++;
  }
  return { novos, jaEstavam };
}

// Plano B: o cliente manda o codigo ATUAN-SOC:<base64 do JSON> por WhatsApp/e-mail
export function decodificar(texto: string): Payload | null {
  const t = String(texto || '');
  const i = t.indexOf(MARCA);
  const resto = i >= 0 ? t.slice(i + MARCA.length) : t;
  const tentativas = [resto.trim().split(/\s+/)[0] ?? '', resto.replace(/[^A-Za-z0-9+/=]/g, '')];
  for (const b of tentativas) {
    try {
      const j = JSON.parse(Buffer.from(b, 'base64').toString('utf8')) as Payload;
      if (j?.origem === 'formulario-societario') return j;
    } catch { /* tenta a proxima */ }
  }
  return null;
}

export async function colar(escritorioId: string, codigo: string) {
  const dados = decodificar(codigo);
  if (!dados) throw Errors.validacao('Código não reconhecido. Confira se veio inteiro — ele começa com “ATUAN-SOC:”.');
  if (dados.enviadoEm) {
    const dup = await prisma.socFormulario.findFirst({ where: { escritorioId, enviadoEm: dados.enviadoEm } });
    if (dup) {
      const p = dup.processoId ? await prisma.socProcesso.findUnique({ where: { id: dup.processoId }, select: { codigo: true } }) : null;
      throw Errors.validacao(`Este formulário já está na lista${p ? ` (e virou o processo ${p.codigo})` : ''}.`);
    }
  }
  return prisma.socFormulario.create({
    data: { escritorioId, recebidoEm: new Date(), enviadoEm: dados.enviadoEm || null, ...registro(dados), dados: { ...dados, documento: dados.documento ? { nome: dados.documento.nome, tipo: dados.documento.tipo, dados: '' } : null } as Prisma.InputJsonValue },
  });
}

// Texto que vai para a observacao do processo criado
export function textoDoForm(f: { recebidoEm: Date; documentoNome?: string | null; documentoTamanho?: number | null; servidorId?: string | null }, d: Payload) {
  const e = d.empresa ?? {}; const c = d.contato ?? {};
  const quando = new Date(d.enviadoEm || f.recebidoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const l: string[] = [`FORMULÁRIO DO CLIENTE — ${d.servico ?? ''} · enviado em ${quando}`, `Razão social: ${e.razao ?? ''}`];
  if (e.fantasia || e.cnpj) l.push(`Fantasia: ${e.fantasia || '—'} | CNPJ: ${e.cnpj || '—'}`);
  if (e.capital || e.imovel) l.push(`Capital (R$): ${e.capital || '—'} | Imóvel: ${e.imovel || '—'}`);
  l.push(`Endereço: ${e.endereco ?? ''} — ${e.cidade ?? ''}/${e.uf ?? ''}${e.cep ? ' · CEP ' + e.cep : ''}`);
  if (e.iptu) l.push(`Inscrição imobiliária (IPTU): ${e.iptu}`);
  if (e.atividades) l.push('Atividades informadas:', e.atividades);
  l.push(`Contato: ${c.responsavel ?? ''} · ${c.telefone ?? ''} · ${c.email ?? ''}`);
  if (d.servico === 'Alteração') {
    const m = [d.alteracao?.endereco ? 'endereço' : '', d.alteracao?.atividade ? 'atividade (CNAE)' : '', d.alteracao?.outro ? 'contrato/sócios/capital' : ''].filter(Boolean);
    l.push(`A alteração muda: ${m.join(', ') || '—'}`);
  }
  if (d.socios?.length) {
    l.push('Sócios / titular:');
    for (const s of d.socios) l.push(`· ${s.nome ?? ''} — CPF ${s.cpf || '—'} — ${s.pct || '—'}% — ${s.funcao || '—'} — ${s.email || '—'}`);
  }
  if (f.documentoNome) l.push(`Documento pessoal enviado: ${f.documentoNome} (${Math.round((f.documentoTamanho ?? 0) / 1024)} KB) — abra pelo botão na tela de Formulário.`);
  else if (!f.servidorId) l.push('Documento pessoal: veio por código colado — peça o arquivo ao cliente.');
  if (d.observacao) l.push('Observações do cliente:', d.observacao);
  return l.join('\n');
}

export async function aprovar(escritorioId: string, ator: Ator, id: string) {
  const f = await prisma.socFormulario.findFirst({ where: { id, escritorioId } });
  if (!f) throw Errors.naoEncontrado('Formulário');
  if (f.processoId) throw Errors.validacao('Este formulário já foi aprovado.');
  const d = f.dados as Payload;
  const e = d.empresa ?? {}; const c = d.contato ?? {};
  // Cliente: pelo CNPJ; sem CNPJ, pelo nome exato
  const cnpj = soDigitos(e.cnpj);
  let empresaId = cnpj ? await soc.empresaPorCnpj(escritorioId, cnpj) : null;
  if (!empresaId && !cnpj && e.razao) {
    const porNome = await prisma.empresa.findFirst({ where: { escritorioId, deletedAt: null, razaoSocial: { equals: e.razao.trim(), mode: 'insensitive' } }, select: { id: true } });
    empresaId = porNome?.id ?? null;
  }
  const nova = !empresaId;
  if (empresaId) {
    // completa so o que estiver vazio
    const atual = await prisma.empresa.findUnique({ where: { id: empresaId } });
    const data: Prisma.EmpresaUpdateInput = {};
    if (!atual?.nomeFantasia && e.fantasia) data.nomeFantasia = e.fantasia;
    if (!atual?.emailPrincipal && c.email) data.emailPrincipal = c.email;
    if (!atual?.telefone && c.telefone) data.telefone = c.telefone;
    if (!atual?.cidade && e.cidade) data.cidade = e.cidade;
    if (!atual?.uf && e.uf) data.uf = e.uf;
    if (Object.keys(data).length) await prisma.empresa.update({ where: { id: empresaId }, data });
  } else {
    empresaId = await soc.criarEmpresa(escritorioId, {
      razaoSocial: e.razao || 'Empresa sem nome', nomeFantasia: e.fantasia, cnpj: cnpj.length === 14 ? cnpj : undefined,
      email: c.email, telefone: c.telefone, cidade: e.cidade, uf: e.uf, cep: e.cep, endereco: e.endereco,
    }, { frente: 'digital', naCarteira: false, emAbertura: d.servico === 'Abertura', anotacao: 'Cadastrado pelo formulário do cliente.' });
  }
  return prisma.$transaction(async (tx) => {
    const p = await soc.criarDeFormulario(tx, escritorioId, ator, {
      empresaId: empresaId!, servico: d.servico ?? 'Abertura', natureza: d.natureza ?? 'LTDA', observacao: textoDoForm(f, d),
      formularioId: f.id, mudaEndereco: !!d.alteracao?.endereco, mudaAtividade: !!d.alteracao?.atividade,
    });
    await tx.socFormulario.update({ where: { id }, data: { processoId: p.id, empresaId, empresaNova: nova, aprovadoEm: new Date(), aprovadoPor: ator.nome ?? null } });
    await soc.registrarHistorico(tx, escritorioId, ator, p.id, 'Processo criado por formulário do cliente', `${p.codigo} · ${e.razao ?? ''} · ${d.servico ?? ''}`);
    return { processoId: p.id, codigo: p.codigo, empresaNova: nova };
  });
}

export async function excluir(escritorioId: string, ator: Ator, id: string) {
  const f = await prisma.socFormulario.findFirst({ where: { id, escritorioId } });
  if (!f) throw Errors.naoEncontrado('Formulário');
  await prisma.$transaction(async (tx) => {
    await tx.socFormulario.delete({ where: { id } });
    await soc.registrarHistorico(tx, escritorioId, ator, null, 'Formulário excluído', `${f.empresaNome}${f.protocolo ? ' · ' + f.protocolo : ''}`);
  });
  if (f.documentoArquivo) try { fs.unlinkSync(f.documentoArquivo); } catch { /* ja nao existe */ }
  return { excluido: true };
}

export async function documento(escritorioId: string, id: string) {
  const f = await prisma.socFormulario.findFirst({ where: { id, escritorioId } });
  if (!f?.documentoArquivo || !fs.existsSync(f.documentoArquivo)) throw Errors.naoEncontrado('Documento');
  return { caminho: f.documentoArquivo, nome: f.documentoNome || 'documento', tipo: f.documentoTipo || 'application/octet-stream' };
}

export const rotuloNatureza = (k?: string) => NATUREZAS[k ?? ''] ?? NATUREZAS.LTDA;
