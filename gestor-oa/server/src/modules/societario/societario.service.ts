// Societario (abertura, alteracao e baixa) — regras transcritas do painel da Atuan
// (painel/js/paginas-societario.js). Especificacao completa em
// Downloads/atuan/_painel-servidor-20261022/SPEC-SOCIETARIO.md.
import { Prisma, type SocProcesso, type SocChecklistItem } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import * as empresaSvc from '../empresa/empresa.service.js';
import { ROTEIROS } from './roteiros.js';

export const ETAPAS = ['Formulário', 'Viabilidade', 'Documento Básico', 'Requerimento', 'Pagamento', 'Assinatura e arquivamento'] as const;
export const CONCLUIDOS = 'Concluídos';
export const SITUACOES = ['Aguardando cliente', 'Em análise', 'Em exigência', 'Finalizado'];
export const SERVICOS = ['Abertura', 'Alteração', 'Baixa'];
export const NATUREZAS = ['LTDA', 'EI', 'ASSOCIACAO', 'MEI'];
export const DEPENDE_DE = ['Escritório', 'Cliente', 'Junta Comercial', 'Receita Federal', 'Prefeitura', 'Cartório', 'Outro'];
export const HONORARIO_SIT = ['Não informado', 'Pendente', 'Parcial', 'Pago', 'Cortesia'];
export const FRENTES = ['digital', 'nauta', 'esporadico'];
export const TIPOS_CLIENTE = ['digital', 'nauta', 'mei', 'esporadico'];
const HORAS_SONECA = 10;
const AVISO_CAD_ECON = '⚠ Cadastro econômico: baixa pendente';
const I_PAGAMENTO = ETAPAS.indexOf('Pagamento');
const I_VIABILIDADE = ETAPAS.indexOf('Viabilidade');
const I_CONCLUIDOS = ETAPAS.length; // coluna extra

export interface Ator { id?: string; nome?: string }
type ProcComItens = SocProcesso & { checklist: SocChecklistItem[] };
type Tx = Prisma.TransactionClient;

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const idxEtapa = (e: string) => (e === CONCLUIDOS ? I_CONCLUIDOS : ETAPAS.indexOf(e as never));

// ─── Historico ──────────────────────────────────────────────────────────────
async function hist(tx: Tx, escritorioId: string, ator: Ator, processoId: string | null, acao: string, detalhe = '') {
  await tx.socHistorico.create({ data: { escritorioId, processoId, usuarioId: ator.id ?? null, usuarioNome: ator.nome ?? null, acao, detalhe } });
}

// ─── Roteiro / checklist ────────────────────────────────────────────────────
function roteiro(natureza: string, servico: string) {
  const n = NATUREZAS.includes(natureza) ? natureza : 'LTDA';
  const s = servico === 'Alteração' || servico === 'Baixa' ? servico : 'Abertura';
  return ROTEIROS[`${n}|${s}`] ?? [];
}
const assinatura = (p: Pick<SocProcesso, 'natureza' | 'servico'>) => `${p.natureza ?? ''}|${p.servico ?? ''}`;

// Monta (ou remonta, ao trocar natureza/servico) o checklist, preservando feito/na/nota pelo texto da tarefa.
async function garantirChecklist(tx: Tx, p: ProcComItens): Promise<ProcComItens> {
  if (p.checklistDe === assinatura(p) && p.checklist.length) return p;
  const antigos = new Map(p.checklist.map((i) => [i.tarefa, i]));
  await tx.socChecklistItem.deleteMany({ where: { processoId: p.id } });
  const itens = roteiro(p.natureza, p.servico).map(([etapa, tarefa], ordem) => {
    const a = antigos.get(tarefa);
    return { processoId: p.id, ordem, etapa, tarefa, feito: a?.feito ?? false, na: a?.na ?? false, nota: a?.nota ?? null };
  });
  if (itens.length) await tx.socChecklistItem.createMany({ data: itens });
  await tx.socProcesso.update({ where: { id: p.id }, data: { checklistDe: assinatura(p) } });
  return carregar(tx, p.escritorioId, p.id);
}

const tarefas = (itens: SocChecklistItem[], etapa?: string) => itens.filter((i) => !i.na && (!etapa || i.etapa === etapa));
export function progresso(itens: SocChecklistItem[]) {
  const t = tarefas(itens);
  return t.length ? Math.round((t.filter((i) => i.feito).length / t.length) * 100) : 0;
}
const passaPelaViabilidade = (itens: SocChecklistItem[]) => itens.some((i) => i.etapa === 'Viabilidade');
const formularioRecebido = (itens: SocChecklistItem[]) => {
  const t = tarefas(itens, 'Formulário');
  return t.length > 0 && t.every((i) => i.feito);
};

// Trava do protocolo REGIN para sair da Viabilidade
function travaRegin(p: ProcComItens, iDestino: number) {
  if (passaPelaViabilidade(p.checklist) && idxEtapa(p.etapa) <= I_VIABILIDADE && iDestino > I_VIABILIDADE && !(p.protocoloRegin ?? '').trim()) {
    return 'Informe o protocolo do REGIN no cartão da Viabilidade antes de avançar.';
  }
  return '';
}

// Etapa/situacao que o checklist determina (o processo so avanca, nunca recua sozinho)
function reconciliar(p: ProcComItens) {
  let alvo: string | null = null;
  for (const e of ETAPAS) {
    const t = tarefas(p.checklist, e);
    if (t.length && t.some((i) => !i.feito)) { alvo = e; break; }
  }
  let travado = false;
  const iAlvo = alvo === null ? I_CONCLUIDOS : idxEtapa(alvo);
  if (passaPelaViabilidade(p.checklist) && idxEtapa(p.etapa) <= I_VIABILIDADE && iAlvo > I_VIABILIDADE && !(p.protocoloRegin ?? '').trim()) {
    alvo = 'Viabilidade'; travado = true;
  }
  const completo = alvo === null && tarefas(p.checklist).length > 0;
  const data: Prisma.SocProcessoUpdateInput = {};
  if (completo && p.situacao !== 'Finalizado') { data.situacao = 'Finalizado'; data.concluidoEm = new Date(); }
  if (!completo && p.situacao === 'Finalizado') { data.situacao = 'Em análise'; data.concluidoEm = null; }
  if (alvo && idxEtapa(alvo) > idxEtapa(p.etapa)) data.etapa = alvo;
  return { data, travado, completo, finalizou: completo && p.situacao !== 'Finalizado' };
}

async function aplicarReconciliacao(tx: Tx, p: ProcComItens, ator: Ator) {
  const r = reconciliar(p);
  if (Object.keys(r.data).length) await tx.socProcesso.update({ where: { id: p.id }, data: r.data });
  if (r.finalizou) await encaminhar(tx, await carregar(tx, p.escritorioId, p.id), ator);
  return r;
}

// ─── Leitura ────────────────────────────────────────────────────────────────
const EMPRESA_SEL = {
  id: true, razaoSocial: true, nomeFantasia: true, frente: true, naCarteira: true, carteiraMei: true, ativo: true, emAbertura: true,
  identificadores: { where: { tipo: 'CNPJ' as const }, select: { valor: true } },
} satisfies Prisma.EmpresaSelect;

async function carregar(tx: Tx, escritorioId: string, id: string): Promise<ProcComItens> {
  const p = await tx.socProcesso.findFirst({ where: { id, escritorioId }, include: { checklist: { orderBy: { ordem: 'asc' } } } });
  if (!p) throw Errors.naoEncontrado('Processo');
  return p;
}

function serializar(p: ProcComItens & { empresa?: Prisma.EmpresaGetPayload<{ select: typeof EMPRESA_SEL }> | null }) {
  const { empresa, ...r } = p;
  return {
    ...r,
    honorario: r.honorario == null ? null : Number(r.honorario),
    progresso: progresso(p.checklist),
    formularioRecebido: formularioRecebido(p.checklist),
    passaPelaViabilidade: passaPelaViabilidade(p.checklist),
    empresa: empresa ? {
      id: empresa.id, razaoSocial: empresa.razaoSocial, nomeFantasia: empresa.nomeFantasia, frente: empresa.frente,
      naCarteira: empresa.naCarteira, carteiraMei: empresa.carteiraMei, ativo: empresa.ativo, emAbertura: empresa.emAbertura,
      cnpj: empresa.identificadores[0]?.valor ?? '',
    } : null,
  };
}

export async function listar(escritorioId: string) {
  // Garante checklist montado para processos antigos/importados
  const semRoteiro = await prisma.socProcesso.findMany({ where: { escritorioId, checklistDe: null }, select: { id: true } });
  for (const s of semRoteiro) await prisma.$transaction(async (tx) => { await garantirChecklist(tx, await carregar(tx, escritorioId, s.id)); });
  const ps = await prisma.socProcesso.findMany({
    where: { escritorioId },
    include: { checklist: { orderBy: { ordem: 'asc' } }, empresa: { select: EMPRESA_SEL } },
    orderBy: { createdAt: 'asc' },
  });
  return ps.map(serializar);
}

export async function obter(escritorioId: string, id: string) {
  const p = await prisma.socProcesso.findFirst({
    where: { id, escritorioId },
    include: { checklist: { orderBy: { ordem: 'asc' } }, empresa: { select: EMPRESA_SEL }, historico: { orderBy: { createdAt: 'desc' }, take: 200 } },
  });
  if (!p) throw Errors.naoEncontrado('Processo');
  const { historico, ...resto } = p;
  return { ...serializar(resto), historico };
}

async function obterSerializado(tx: Tx, escritorioId: string, id: string) {
  const p = await tx.socProcesso.findFirst({ where: { id, escritorioId }, include: { checklist: { orderBy: { ordem: 'asc' } }, empresa: { select: EMPRESA_SEL } } });
  if (!p) throw Errors.naoEncontrado('Processo');
  return serializar(p);
}

// ─── Codigo AAAA-NNN ─────────────────────────────────────────────────────────
async function proximoCodigo(tx: Tx, escritorioId: string) {
  const ano = new Date().getFullYear();
  const cods = await tx.socProcesso.findMany({ where: { escritorioId, codigo: { startsWith: `${ano}-` } }, select: { codigo: true } });
  let max = 0;
  for (const c of cods) { const m = /^\d{4}-(\d+)$/.exec(c.codigo); if (m) max = Math.max(max, Number(m[1])); }
  return `${ano}-${String(max + 1).padStart(3, '0')}`; // passa de 999 sem repetir (painel antigo repetia "000")
}

// ─── Empresa (cliente) ──────────────────────────────────────────────────────
export async function empresaPorCnpj(escritorioId: string, cnpj: string) {
  const d = soDigitos(cnpj);
  if (d.length !== 14) return null;
  const i = await prisma.empresaIdentificador.findFirst({ where: { escritorioId, tipo: 'CNPJ', valor: d, empresa: { deletedAt: null } }, select: { empresaId: true } });
  return i?.empresaId ?? null;
}

export interface DadosEmpresaNova {
  razaoSocial: string; nomeFantasia?: string; cnpj?: string; email?: string; telefone?: string;
  cep?: string; logradouro?: string; numeroEndereco?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string;
  atividade?: string; endereco?: string;
}
// Cria a empresa do processo (fora da carteira ate a conclusao dizer que vira cliente)
export async function criarEmpresa(escritorioId: string, d: DadosEmpresaNova, extra: { frente?: string | null; naCarteira?: boolean; emAbertura?: boolean; anotacao?: string; legadoAtuanId?: string }) {
  const cnpj = soDigitos(d.cnpj);
  let e;
  try {
    e = await empresaSvc.criar(escritorioId, {
      razaoSocial: d.razaoSocial.trim() || 'Empresa sem nome', nomeFantasia: d.nomeFantasia || null,
      emailPrincipal: d.email || null, telefone: d.telefone || null, cep: d.cep || null, logradouro: d.logradouro || null,
      numeroEndereco: d.numeroEndereco || null, complemento: d.complemento || null, bairro: d.bairro || null,
      cidade: d.cidade || null, uf: d.uf || null, endereco: d.endereco || null, atividade: d.atividade || null,
      emAbertura: extra.emAbertura ?? false, anotacoes: extra.anotacao || null,
      identificadores: cnpj.length === 14 ? [{ tipo: 'CNPJ', valor: cnpj }] : [],
    } as Parameters<typeof empresaSvc.criar>[1]);
  } catch (err) {
    if (cnpj.length === 14 && /invalido/i.test(String((err as Error).message))) throw Errors.validacao(`CNPJ inválido: ${d.cnpj}`);
    throw err;
  }
  await prisma.empresa.update({
    where: { id: e.id },
    data: { frente: extra.frente || null, naCarteira: extra.naCarteira ?? false, legadoAtuanId: extra.legadoAtuanId ?? null },
  });
  return e.id;
}

// ─── Novo processo (rapido) ─────────────────────────────────────────────────
export interface NovoProcessoInput {
  nome: string; carteira: string; servico: string; cpf?: string; senhaGov?: string; observacao?: string;
  empresaId?: string; dados?: Omit<DadosEmpresaNova, 'razaoSocial'>;
}
export async function criar(escritorioId: string, ator: Ator, input: NovoProcessoInput) {
  if (!input.nome?.trim()) throw Errors.validacao('Informe o nome da empresa.');
  if (!SERVICOS.includes(input.servico)) throw Errors.validacao('Escolha o tipo de processo.');
  if (!FRENTES.includes(input.carteira)) throw Errors.validacao('Escolha a carteira.');
  let empresaId = input.empresaId || (await empresaPorCnpj(escritorioId, input.dados?.cnpj ?? ''));
  const jaTinha = !!empresaId;
  if (!empresaId) {
    empresaId = await criarEmpresa(escritorioId, { razaoSocial: input.nome, ...(input.dados ?? {}) }, {
      frente: input.carteira, naCarteira: false, emAbertura: input.servico === 'Abertura' && soDigitos(input.dados?.cnpj).length !== 14,
      anotacao: 'Cadastrado ao abrir um processo no Societário.',
    });
  }
  return prisma.$transaction(async (tx) => {
    const codigo = await proximoCodigo(tx, escritorioId);
    const p = await tx.socProcesso.create({
      data: {
        escritorioId, empresaId, codigo, grupo: input.carteira, servico: input.servico, natureza: '', etapa: 'Formulário',
        situacao: 'Em análise', dependeDe: 'Escritório', proximaAcao: 'Iniciar o roteiro do processo', honorarioSit: 'Não informado',
        cpf: input.cpf || null, senhaGov: input.senhaGov || null, observacao: input.observacao || null,
      },
      include: { checklist: true },
    });
    const pc = await garantirChecklist(tx, p);
    await aplicarReconciliacao(tx, pc, ator);
    await hist(tx, escritorioId, ator, p.id, 'Processo criado pelo botão Novo processo', `${codigo} · ${input.nome}${jaTinha ? ' · cliente já cadastrado' : ''}`);
    return { ...(await obterSerializado(tx, escritorioId, p.id)), clienteJaCadastrado: jaTinha };
  });
}

// ─── Ficha (edicao completa) ────────────────────────────────────────────────
export interface FichaInput {
  empresaId?: string | null; grupo?: string | null; servico?: string; natureza?: string; etapa?: string; situacao?: string;
  responsavel?: string | null; dependeDe?: string; prazo?: string | null; proximaAcao?: string | null; foraDoQuadro?: boolean;
  protocoloRegin?: string | null; requerimento?: string | null; cpf?: string | null; senhaGov?: string | null;
  honorario?: number | null; honorarioSit?: string; observacao?: string | null; cnpj?: string | null;
}
export async function salvarFicha(escritorioId: string, ator: Ator, id: string, f: FichaInput) {
  const atual = await carregar(prisma, escritorioId, id);
  let empresaId = f.empresaId === undefined ? atual.empresaId : f.empresaId;
  if (!empresaId) throw Errors.validacao('Preencha: Cliente.');
  // CNPJ digitado na ficha: grava na empresa; se ja pertence a outra empresa, o processo passa a apontar para ela
  if (f.cnpj !== undefined && f.cnpj !== null) {
    const d = soDigitos(f.cnpj);
    if (d) {
      const dona = await empresaPorCnpj(escritorioId, d);
      if (dona && dona !== empresaId) empresaId = await unificarEmpresa(escritorioId, ator, empresaId, dona, atual.codigo);
      else if (!dona) {
        if (d.length !== 14) throw Errors.validacao('CNPJ deve ter 14 dígitos.');
        await empresaSvc.adicionarIdentificador(escritorioId, empresaId, { tipo: 'CNPJ', valor: d } as never);
        await prisma.empresa.update({ where: { id: empresaId }, data: { emAbertura: false } });
      }
    }
  }
  return prisma.$transaction(async (tx) => {
    const data: Prisma.SocProcessoUncheckedUpdateInput = { empresaId };
    if (f.grupo !== undefined) data.grupo = f.grupo && FRENTES.includes(f.grupo) ? f.grupo : null;
    if (f.servico && SERVICOS.includes(f.servico)) data.servico = f.servico;
    if (f.natureza !== undefined && (f.natureza === '' || NATUREZAS.includes(f.natureza))) data.natureza = f.natureza;
    if (f.situacao && SITUACOES.includes(f.situacao) && f.situacao !== 'Finalizado') data.situacao = f.situacao;
    if (f.responsavel !== undefined) data.responsavel = f.responsavel || null;
    if (f.dependeDe && DEPENDE_DE.includes(f.dependeDe)) data.dependeDe = f.dependeDe;
    if (f.prazo !== undefined) data.prazo = f.prazo ? new Date(`${f.prazo}T00:00:00Z`) : null;
    if (f.proximaAcao !== undefined) data.proximaAcao = f.proximaAcao || null;
    if (f.foraDoQuadro !== undefined) data.foraDoQuadro = !!f.foraDoQuadro;
    if (f.protocoloRegin !== undefined) data.protocoloRegin = f.protocoloRegin?.trim() || null;
    if (f.requerimento !== undefined) data.requerimento = f.requerimento?.trim() || null;
    if (f.cpf !== undefined) data.cpf = f.cpf || null;
    if (f.senhaGov !== undefined) data.senhaGov = f.senhaGov || null;
    if (f.honorario !== undefined) data.honorario = f.honorario ?? 0;
    if (f.honorarioSit && HONORARIO_SIT.includes(f.honorarioSit)) data.honorarioSit = f.honorarioSit;
    if (f.observacao !== undefined) data.observacao = f.observacao || null;
    await tx.socProcesso.update({ where: { id }, data });
    let p = await garantirChecklist(tx, await carregar(tx, escritorioId, id));
    // Troca de etapa pela ficha passa pelas mesmas travas do quadro
    if (f.etapa && f.etapa !== p.etapa && (ETAPAS as readonly string[]).includes(f.etapa)) {
      const erro = travasMovimento(p, f.etapa);
      if (erro) throw Errors.validacao(erro);
      await tx.socProcesso.update({ where: { id }, data: { etapa: f.etapa, ...(p.situacao === 'Finalizado' ? { situacao: 'Em análise', concluidoEm: null } : {}) } });
      await hist(tx, escritorioId, ator, id, 'Processo mudou de etapa', `${p.codigo}: ${p.etapa} → ${f.etapa}`);
      p = await carregar(tx, escritorioId, id);
    }
    await aplicarReconciliacao(tx, p, ator);
    await hist(tx, escritorioId, ator, id, 'Processo societário — alterado', p.codigo);
    return obterSerializado(tx, escritorioId, id);
  });
}

// Liga o processo a empresa que ja tem o CNPJ; apaga a ficha provisoria se ela so existia por causa do processo
async function unificarEmpresa(escritorioId: string, ator: Ator, deId: string, paraId: string, codigo: string) {
  const de = await prisma.empresa.findFirst({ where: { id: deId, escritorioId }, select: { razaoSocial: true, naCarteira: true, frente: true } });
  const para = await prisma.empresa.findFirst({ where: { id: paraId, escritorioId }, select: { razaoSocial: true, frente: true } });
  await prisma.socProcesso.updateMany({ where: { escritorioId, empresaId: deId }, data: { empresaId: paraId } });
  await prisma.legalizacao.updateMany({ where: { escritorioId, empresaId: deId }, data: { empresaId: paraId } });
  await prisma.socFormulario.updateMany({ where: { escritorioId, empresaId: deId }, data: { empresaId: paraId } });
  if (para && !para.frente && de?.frente) await prisma.empresa.update({ where: { id: paraId }, data: { frente: de.frente } });
  if (de && !de.naCarteira) {
    // ficha provisoria (so existia pelo processo) e sem outros vinculos no Obrigo: sai de cena
    const outros = (await prisma.processo.count({ where: { empresaId: deId } })) + (await prisma.entrega.count({ where: { empresaId: deId } }));
    if (!outros)await prisma.empresa.update({ where: { id: deId }, data: { deletedAt: new Date(), ativo: false } });
  }
  await prisma.$transaction((tx) => hist(tx, escritorioId, ator, null, 'Fichas unificadas pelo CNPJ', `${codigo}: ${de?.razaoSocial ?? deId} → ${para?.razaoSocial ?? paraId}`));
  return paraId;
}

// ─── Edicoes rapidas do cartao ──────────────────────────────────────────────
const CAMPOS_CARTAO = ['honorario', 'honorarioSit', 'requerimento', 'cpf', 'senhaGov', 'observacao', 'protocoloRegin', 'pagamentoFeito', 'mudaEndereco', 'mudaMunicipio', 'mudaAtividade', 'ocultar', 'formularioRecebido'] as const;
export type CampoCartao = (typeof CAMPOS_CARTAO)[number];
export async function editarCampo(escritorioId: string, ator: Ator, id: string, campo: CampoCartao, valor: unknown) {
  if (!CAMPOS_CARTAO.includes(campo)) throw Errors.validacao('Campo inválido.');
  return prisma.$transaction(async (tx) => {
    let p = await garantirChecklist(tx, await carregar(tx, escritorioId, id));
    const txt = (v: unknown) => String(v ?? '').trim() || null;
    const sim = (b: unknown) => (b ? 'sim' : 'não');
    let r: { travado?: boolean; completo?: boolean } = {};
    switch (campo) {
      case 'honorario': {
        const n = typeof valor === 'number' ? valor : parseFloat(String(valor ?? '').replace(/\./g, '').replace(',', '.'));
        await tx.socProcesso.update({ where: { id }, data: { honorario: Number.isFinite(n) ? n : 0 } });
        await hist(tx, escritorioId, ator, id, 'Processo alterado no Kanban', `${p.codigo} · honorario`);
        break;
      }
      case 'honorarioSit':
        if (!HONORARIO_SIT.includes(String(valor))) throw Errors.validacao('Situação inválida.');
        await tx.socProcesso.update({ where: { id }, data: { honorarioSit: String(valor) } });
        await hist(tx, escritorioId, ator, id, 'Processo alterado no Kanban', `${p.codigo} · honorarioSit`);
        break;
      case 'cpf': case 'senhaGov':
        await tx.socProcesso.update({ where: { id }, data: { [campo]: txt(valor) } });
        await hist(tx, escritorioId, ator, id, 'Processo alterado no Kanban', `${p.codigo} · ${campo}`);
        break;
      case 'requerimento':
        await tx.socProcesso.update({ where: { id }, data: { requerimento: txt(valor) } });
        await hist(tx, escritorioId, ator, id, 'Nº do requerimento no Kanban', `${p.codigo}: ${txt(valor) ?? '(apagado)'}`);
        break;
      case 'observacao':
        await tx.socProcesso.update({ where: { id }, data: { observacao: txt(valor) } });
        await hist(tx, escritorioId, ator, id, 'Observação do processo alterada', p.codigo);
        break;
      case 'protocoloRegin':
        await tx.socProcesso.update({ where: { id }, data: { protocoloRegin: txt(valor) } });
        p = await carregar(tx, escritorioId, id);
        r = await aplicarReconciliacao(tx, p, ator);
        await hist(tx, escritorioId, ator, id, 'Protocolo REGIN alterado', `${p.codigo}: ${txt(valor) ?? '(apagado)'}`);
        break;
      case 'pagamentoFeito':
        await tx.socProcesso.update({ where: { id }, data: { pagamentoFeito: !!valor } });
        await hist(tx, escritorioId, ator, id, valor ? 'Pagamento efetuado' : 'Pagamento desmarcado', p.codigo);
        break;
      case 'mudaEndereco': case 'mudaMunicipio': case 'mudaAtividade': {
        const data: Prisma.SocProcessoUpdateInput = { [campo]: !!valor };
        if (campo === 'mudaEndereco' && !valor) data.mudaMunicipio = false;
        await tx.socProcesso.update({ where: { id }, data });
        await hist(tx, escritorioId, ator, id, 'Classificação da alteração', `${p.codigo}: ${campo} = ${sim(valor)}`);
        break;
      }
      case 'ocultar': {
        const ate = valor ? new Date(Date.now() + HORAS_SONECA * 3600_000) : null;
        await tx.socProcesso.update({ where: { id }, data: { ocultoAte: ate } });
        await hist(tx, escritorioId, ator, id, valor ? 'Cartão oculto no Kanban' : 'Cartão trazido de volta ao Kanban', valor ? `${p.codigo} · volta em ${HORAS_SONECA}h` : p.codigo);
        break;
      }
      case 'formularioRecebido': {
        // Marca/desmarca todas as tarefas da etapa Formulario, sem reconciliar a etapa (igual ao painel)
        const ids = tarefas(p.checklist, 'Formulário').map((i) => i.id);
        await tx.socChecklistItem.updateMany({ where: { id: { in: ids } }, data: { feito: !!valor } });
        await hist(tx, escritorioId, ator, id, valor ? 'Formulário recebido' : 'Formulário desmarcado', p.codigo);
        break;
      }
    }
    return { processo: await obterSerializado(tx, escritorioId, id), ...r };
  });
}

// Renomear (cliente sem CNPJ): se outros processos usam a mesma ficha, separa numa ficha propria
export async function renomear(escritorioId: string, ator: Ator, id: string, nome: string) {
  const novo = nome.trim();
  if (!novo) throw Errors.validacao('Informe o nome.');
  const p = await carregar(prisma, escritorioId, id);
  if (p.situacao === 'Finalizado') throw Errors.validacao('Processo concluído não pode ser renomeado.');
  if (!p.empresaId) throw Errors.validacao('Processo sem cliente.');
  const emp = await prisma.empresa.findFirst({ where: { id: p.empresaId, escritorioId }, include: { identificadores: { where: { tipo: 'CNPJ' } } } });
  if (!emp) throw Errors.naoEncontrado('Empresa');
  if (emp.identificadores.length) throw Errors.validacao('Nome do cartão CNPJ — para corrigir, atualize pela Receita na ficha da empresa.');
  if (emp.razaoSocial === novo) return obter(escritorioId, id);
  const irmaos = await prisma.socProcesso.count({ where: { escritorioId, empresaId: emp.id, id: { not: id } } });
  if (irmaos) {
    const nova = await criarEmpresa(escritorioId, {
      razaoSocial: novo, nomeFantasia: emp.nomeFantasia ?? undefined, email: emp.emailPrincipal ?? undefined, telefone: emp.telefone ?? undefined,
      cidade: emp.cidade ?? undefined, uf: emp.uf ?? undefined, atividade: emp.atividade ?? undefined,
    }, {
      frente: emp.frente, naCarteira: emp.naCarteira, emAbertura: emp.emAbertura,
      anotacao: `${emp.anotacoes ? emp.anotacoes + ' · ' : ''}Separada de “${emp.razaoSocial}” ao renomear o cartão ${p.codigo}.`,
    });
    await prisma.socProcesso.update({ where: { id }, data: { empresaId: nova } });
    await prisma.$transaction((tx) => hist(tx, escritorioId, ator, id, 'Cartão separado em ficha própria', `${p.codigo}: ${emp.razaoSocial} → ${novo} (a ficha antiga seguiu com ${irmaos} processo(s))`));
  } else {
    await empresaSvc.editar(escritorioId, emp.id, { razaoSocial: novo } as never);
    await prisma.$transaction((tx) => hist(tx, escritorioId, ator, id, 'Nome do cliente alterado no Kanban', `${emp.razaoSocial} → ${novo}`));
  }
  return obter(escritorioId, id);
}

// ─── Checklist ──────────────────────────────────────────────────────────────
export async function marcarItem(escritorioId: string, ator: Ator, id: string, itemId: string, acao: { feito?: boolean; na?: boolean }) {
  return prisma.$transaction(async (tx) => {
    const p0 = await garantirChecklist(tx, await carregar(tx, escritorioId, id));
    const item = p0.checklist.find((i) => i.id === itemId);
    if (!item) throw Errors.naoEncontrado('Tarefa');
    if (acao.na !== undefined) await tx.socChecklistItem.update({ where: { id: itemId }, data: { na: acao.na, ...(acao.na ? { feito: false } : {}) } });
    else if (acao.feito !== undefined) {
      if (item.na) throw Errors.validacao('Tarefa marcada como não se aplica.');
      await tx.socChecklistItem.update({ where: { id: itemId }, data: { feito: acao.feito } });
    }
    const p = await carregar(tx, escritorioId, id);
    const r = await aplicarReconciliacao(tx, p, ator);
    if (acao.feito !== undefined) await hist(tx, escritorioId, ator, id, acao.feito ? 'Tarefa concluída' : 'Tarefa reaberta', `${p.codigo}: ${item.tarefa}`);
    else await hist(tx, escritorioId, ator, id, acao.na ? 'Tarefa marcada N/A' : 'Tarefa reativada', `${p.codigo}: ${item.tarefa}`);
    return { processo: await obterSerializado(tx, escritorioId, id), travado: r.travado, completo: r.completo };
  });
}

// ─── Movimento no quadro ────────────────────────────────────────────────────
// Travas do painel (na ordem). Valem para arrastar, para o botao Encerrar e para a troca de etapa na ficha.
function travasMovimento(p: ProcComItens, destino: string): string {
  const iDest = idxEtapa(destino);
  const iAtual = idxEtapa(p.etapa);
  if (p.etapa === 'Formulário' && destino !== 'Formulário' && tarefas(p.checklist, 'Formulário').length && !formularioRecebido(p.checklist)) {
    return 'Marque “Estou com o formulário” antes de tirar o processo do Formulário.';
  }
  // Nº do requerimento (Junta) — nao se aplica ao MEI, que e feito no Portal do Empreendedor
  if (p.natureza !== 'MEI' && iDest >= I_PAGAMENTO && iDest > iAtual && !(p.requerimento ?? '').trim()) {
    return 'Preencha o nº do requerimento no cartão antes de ir para Pagamento.';
  }
  if (p.etapa === 'Pagamento' && (p.servico === 'Abertura' || p.servico === 'Alteração') && iDest > I_PAGAMENTO && !p.pagamentoFeito) {
    return 'Marque “Pagamento efetuado” antes de tirar o processo do Pagamento.';
  }
  return travaRegin(p, iDest);
}

export interface MoverInput {
  destino: string;
  alteracao?: { mudaEndereco: boolean; mudaMunicipio: boolean; mudaAtividade: boolean };
}
export async function mover(escritorioId: string, ator: Ator, id: string, input: MoverInput) {
  const { destino } = input;
  if (destino !== CONCLUIDOS && !(ETAPAS as readonly string[]).includes(destino)) throw Errors.validacao('Etapa inválida.');
  return prisma.$transaction(async (tx) => {
    const p = await garantirChecklist(tx, await carregar(tx, escritorioId, id));
    const finalizado = p.situacao === 'Finalizado';
    if (!finalizado) {
      const erro = travasMovimento(p, destino);
      if (erro) throw Errors.validacao(erro);
    }
    // Alteracao saindo da Viabilidade: confirmar o que muda (define se vai para o Kanban de alvaras)
    if (!finalizado && p.servico === 'Alteração' && p.etapa === 'Viabilidade' && idxEtapa(destino) > I_VIABILIDADE) {
      if (!input.alteracao) return { precisa: 'confirmarAlteracao' as const, processo: serializar(p) };
      const a = input.alteracao;
      await tx.socProcesso.update({ where: { id }, data: { mudaEndereco: a.mudaEndereco, mudaMunicipio: a.mudaEndereco && a.mudaMunicipio, mudaAtividade: a.mudaAtividade } });
      await hist(tx, escritorioId, ator, id, 'Classificação da alteração confirmada', `${p.codigo}: endereço=${a.mudaEndereco ? 'sim' : 'não'}${a.mudaEndereco && a.mudaMunicipio ? ' (muda de município)' : ''}, atividade=${a.mudaAtividade ? 'sim' : 'não'}`);
    }
    if (destino === CONCLUIDOS) {
      if (finalizado) return { processo: serializar(p) };
      return { precisa: 'concluir' as const, processo: await obterSerializado(tx, escritorioId, id) };
    }
    if (destino === p.etapa && !finalizado) return { processo: serializar(p) };
    await tx.socProcesso.update({ where: { id }, data: { etapa: destino, ...(finalizado ? { situacao: 'Em análise', concluidoEm: null } : {}) } });
    await hist(tx, escritorioId, ator, id, 'Processo mudou de etapa', `${p.codigo}: ${finalizado ? CONCLUIDOS : p.etapa} → ${destino}`);
    return { processo: await obterSerializado(tx, escritorioId, id) };
  });
}

// ─── Conclusao ──────────────────────────────────────────────────────────────
export const precisaCadastroEconomico = (p: Pick<SocProcesso, 'mudaMunicipio' | 'servico'>) => p.mudaMunicipio || p.servico === 'Baixa';
const mexeComAlvara = (p: Pick<SocProcesso, 'servico' | 'mudaEndereco' | 'mudaAtividade'>) =>
  p.servico === 'Abertura' || (p.servico === 'Alteração' && (p.mudaEndereco || p.mudaAtividade));

export interface ConcluirInput { baixaCadEconomico?: boolean | null; viraCliente: boolean; tipo?: string }
export async function concluir(escritorioId: string, ator: Ator, id: string, input: ConcluirInput) {
  return prisma.$transaction(async (tx) => {
    const p = await garantirChecklist(tx, await carregar(tx, escritorioId, id));
    if (p.situacao === 'Finalizado') throw Errors.validacao('Processo já concluído.');
    const erro = travasMovimento(p, CONCLUIDOS);
    if (erro) throw Errors.validacao(erro);
    const data: Prisma.SocProcessoUpdateInput = { situacao: 'Finalizado', concluidoEm: new Date() };
    const avisos: string[] = [];
    if (precisaCadastroEconomico(p)) {
      if (input.baixaCadEconomico == null) throw Errors.validacao('Responda se foi dada baixa no cadastro econômico.');
      const obs = (p.observacao ?? '').split(' · ').filter((t) => t && t !== AVISO_CAD_ECON);
      if (input.baixaCadEconomico) {
        data.baixaCadEconomico = true; data.baixaCadEconomicoEm = new Date(new Date().toISOString().slice(0, 10));
      } else {
        data.baixaCadEconomico = false; data.baixaCadEconomicoEm = null; obs.push(AVISO_CAD_ECON); avisos.push('⚠ cadastro econômico a baixar');
      }
      data.observacao = obs.join(' · ') || null;
      await hist(tx, escritorioId, ator, id, 'Cadastro econômico na conclusão', `${p.codigo}: ${input.baixaCadEconomico ? 'baixa confirmada' : 'baixa PENDENTE'}`);
    }
    if (input.viraCliente) {
      const tipo = TIPOS_CLIENTE.includes(input.tipo ?? '') ? input.tipo! : 'digital';
      if (p.empresaId) {
        const emp = await tx.empresa.findUnique({ where: { id: p.empresaId }, select: { frente: true } });
        await tx.empresa.update({
          where: { id: p.empresaId },
          data: tipo === 'mei'
            ? { naCarteira: true, carteiraMei: true, frente: emp?.frente || 'digital' }
            : { naCarteira: true, carteiraMei: false, frente: tipo },
        });
      }
      await hist(tx, escritorioId, ator, id, 'Tipo de cliente definido na conclusão', `${p.codigo} · ${tipo}`);
      avisos.push(`entrou na carteira como ${ROTULO_TIPO[tipo]}`);
    } else {
      await hist(tx, escritorioId, ator, id, 'Concluído sem entrar na carteira', p.codigo);
      avisos.push('fora da carteira');
    }
    await tx.socProcesso.update({ where: { id }, data });
    await hist(tx, escritorioId, ator, id, 'Processo finalizado', p.codigo);
    const enc = await encaminhar(tx, await carregar(tx, escritorioId, id), ator);
    return { processo: await obterSerializado(tx, escritorioId, id), alvara: enc.alvara, avisos };
  });
}
const ROTULO_TIPO: Record<string, string> = { digital: 'ATUAN Digital', nauta: 'NAUTA', mei: 'MEI', esporadico: 'Esporádico' };

// Pos-conclusao (idempotente): abertura ativa a empresa; abertura/alteracao de endereco ou atividade gera cartao de alvara
async function encaminhar(tx: Tx, p: ProcComItens, ator: Ator) {
  let alvara = false;
  if (p.servico === 'Abertura' && p.empresaId) {
    const emp = await tx.empresa.findUnique({ where: { id: p.empresaId }, select: { ativo: true } });
    if (emp && !emp.ativo) {
      await tx.empresa.update({ where: { id: p.empresaId }, data: { ativo: true } });
      await hist(tx, p.escritorioId, ator, p.id, 'Abertura concluída — empresa ativada', p.codigo);
    }
  }
  if (mexeComAlvara(p)) {
    const existe = await tx.legalizacao.findFirst({ where: { escritorioId: p.escritorioId, processoId: p.id }, select: { id: true } });
    if (!existe) {
      const emp = p.empresaId ? await tx.empresa.findUnique({ where: { id: p.empresaId }, select: { razaoSocial: true } }) : null;
      const muda = p.servico === 'Alteração'
        ? ` — alteração de ${[p.mudaEndereco ? 'endereço' : '', p.mudaAtividade ? 'atividade' : ''].filter(Boolean).join(' e ')}`
        : '';
      await tx.legalizacao.create({
        data: {
          escritorioId: p.escritorioId, empresaId: p.empresaId, clienteNome: emp?.razaoSocial ?? null, processoId: p.id,
          tipo: 'Alvará de Funcionamento', orgao: null, protocolo: p.protocoloRegin || null,
          tipoProcesso: p.servico === 'Alteração' ? 'Alteração' : 'Abertura', etapa: 'A iniciar',
          observacao: `Originado do Societário (${p.codigo})${muda}`,
        },
      });
      await hist(tx, p.escritorioId, ator, p.id, 'Concluído enviado ao Kanban de alvarás', p.codigo);
      alvara = true;
    }
  }
  await tx.socProcesso.update({ where: { id: p.id }, data: { encaminhadoEm: new Date() } });
  return { alvara };
}

// ─── Carteira, fora do quadro, exclusao ─────────────────────────────────────
export async function definirCarteira(escritorioId: string, ator: Ator, id: string, naCarteira: boolean) {
  const p = await carregar(prisma, escritorioId, id);
  if (!p.empresaId) throw Errors.validacao('Sem cliente vinculado.');
  await prisma.empresa.update({ where: { id: p.empresaId }, data: { naCarteira } });
  await prisma.$transaction((tx) => hist(tx, escritorioId, ator, id, naCarteira ? 'Cliente adicionado à carteira' : 'Cliente retirado da carteira', p.codigo));
  return obter(escritorioId, id);
}

export async function devolverAoQuadro(escritorioId: string, ator: Ator, ids: string[]) {
  const ps = await prisma.socProcesso.findMany({ where: { escritorioId, id: { in: ids } }, select: { id: true, codigo: true } });
  await prisma.socProcesso.updateMany({ where: { escritorioId, id: { in: ps.map((x) => x.id) } }, data: { foraDoQuadro: false } });
  await prisma.$transaction((tx) => hist(tx, escritorioId, ator, null, 'Processos devolvidos ao Kanban', ps.map((x) => x.codigo).join(', ')));
  return { devolvidos: ps.length };
}

export async function excluir(escritorioId: string, ator: Ator, id: string) {
  const p = await carregar(prisma, escritorioId, id);
  await prisma.$transaction(async (tx) => {
    await tx.socFormulario.updateMany({ where: { escritorioId, processoId: id }, data: { processoId: null } });
    await tx.socProcesso.delete({ where: { id } });
    await hist(tx, escritorioId, ator, null, 'Processo societário — excluído', p.codigo);
  });
  return { excluido: true };
}

export async function historicoGeral(escritorioId: string) {
  return prisma.socHistorico.findMany({ where: { escritorioId }, orderBy: { createdAt: 'desc' }, take: 300 });
}

// Usado pela aprovacao de formulario
export async function criarDeFormulario(
  tx: Tx, escritorioId: string, ator: Ator,
  f: { empresaId: string; servico: string; natureza: string; observacao: string; formularioId: string; mudaEndereco: boolean; mudaAtividade: boolean },
) {
  const codigo = await proximoCodigo(tx, escritorioId);
  const p = await tx.socProcesso.create({
    data: {
      escritorioId, empresaId: f.empresaId, codigo, servico: SERVICOS.includes(f.servico) ? f.servico : 'Abertura',
      natureza: NATUREZAS.includes(f.natureza) ? f.natureza : 'LTDA', etapa: 'Formulário', situacao: 'Em análise',
      dependeDe: 'Escritório', proximaAcao: 'Conferir o formulário recebido e iniciar o roteiro', honorarioSit: 'Não informado',
      observacao: f.observacao, origemFormularioId: f.formularioId,
      ...(f.servico === 'Alteração' ? { mudaEndereco: f.mudaEndereco, mudaAtividade: f.mudaAtividade } : {}),
    },
    include: { checklist: true },
  });
  await garantirChecklist(tx, p);
  return { id: p.id, codigo };
}
export { hist as registrarHistorico };
