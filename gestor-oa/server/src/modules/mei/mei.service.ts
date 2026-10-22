// MEI — regras transcritas do painel da Atuan (paginas-mei.js / motor-mei.js). Especificacao:
// Downloads/atuan/_painel-servidor-20261022/SPEC-MEI.md. Correcoes em relacao ao painel: honorario com
// historico, excluir MEI apaga o que e dele (com confirmacao no front), cancelar acordo pelo formulario
// devolve as guias, acordo sem foto da guia devolve como "Em aberto" (nao apaga), reativar limpa a baixa
// no SIMEI, "Lancar DAS pago" usa o valor da guia, guias/DASN unicas por competencia/ano.
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { Errors } from '../../lib/errors.js';
import { empresaPorCnpj, criarEmpresa } from '../societario/societario.service.js';
import { ATIVIDADES, SITUACOES_MEI, CONTAS, LIMITE_ANUAL, r2, das, vencimento, ultimoDia, hojeISO, hojeData } from './mei.motor.js';

export interface Ator { id?: string; nome?: string }
type Tx = Prisma.TransactionClient;
const dig = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const dataISO = (v?: string | null) => (v ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null);
const n = (v: unknown) => Number(v) || 0;

async function hist(tx: Tx, escritorioId: string, ator: Ator, meiId: string | null, acao: string, detalhe = '') {
  await tx.meiHistorico.create({ data: { escritorioId, meiId, usuarioId: ator.id ?? null, usuarioNome: ator.nome ?? null, acao, detalhe } });
}
async function carregarMei(tx: Tx, escritorioId: string, id: string) {
  const m = await tx.mei.findFirst({ where: { id, escritorioId }, include: { empresa: { select: { razaoSocial: true } } } });
  if (!m) throw Errors.naoEncontrado('MEI');
  return m;
}
const nomeMei = (m: { apelido: string | null; empresa: { razaoSocial: string } | null }) => m.empresa?.razaoSocial ?? m.apelido ?? 'MEI';
async function tabelaSm(escritorioId: string, tx: Tx = prisma) {
  const c = await tx.meiConfig.findUnique({ where: { escritorioId } });
  return { salarioMinimo: (c?.salarioMinimo ?? {}) as Record<string, number>, limiteAnual: c ? Number(c.limiteAnual) : LIMITE_ANUAL };
}

// ─── Leitura ────────────────────────────────────────────────────────────────
export async function dados(escritorioId: string) {
  const [meis, guias, dasn, parcelamentos, config] = await Promise.all([
    prisma.mei.findMany({ where: { escritorioId }, include: { empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } } } }),
    prisma.meiDas.findMany({ where: { mei: { escritorioId } } }),
    prisma.meiDasn.findMany({ where: { mei: { escritorioId } } }),
    prisma.meiParcelamento.findMany({ where: { mei: { escritorioId } }, orderBy: { createdAt: 'desc' } }),
    tabelaSm(escritorioId),
  ]);
  // Receita bruta (rec_vendas + rec_servicos) por MEI e ano — base unica de faturamento (teto, painel, DASN)
  const rec = await prisma.meiLancamento.groupBy({
    by: ['meiId', 'competencia'], where: { mei: { escritorioId }, conta: { in: ['rec_vendas', 'rec_servicos'] } }, _sum: { valor: true },
  });
  const receitaMes: Record<string, Record<string, number>> = {};
  for (const r of rec) (receitaMes[r.meiId] ??= {})[r.competencia] = n(r._sum.valor);
  const num = <T extends Record<string, unknown>>(o: T, ks: string[]) => { const c = { ...o } as Record<string, unknown>; for (const k of ks) c[k] = c[k] == null ? null : n(c[k]); return c; };
  return {
    meis: meis.map((m) => num(m, ['honorario', 'comissaoPct'])),
    das: guias.map((g) => num(g, ['valor'])),
    dasn: dasn.map((d) => num(d, ['receitaInformada'])),
    parcelamentos: parcelamentos.map((p) => num(p, ['principal', 'juros', 'total', 'valorParcela', 'valorPrimeira'])),
    config, receitaMes,
  };
}

// ─── Cadastro ───────────────────────────────────────────────────────────────
export interface MeiInput {
  empresaId?: string | null; apelido?: string | null; cnpj?: string | null; atividade?: string; situacao?: string; comissaoPct?: number;
  abertura?: string | null; temEmpregado?: boolean; honorario?: number; observacao?: string | null; codigo?: string | null; ocupacao?: string | null;
  // quando nao ha empresa no Obrigo: cria pela razao social / CNPJ
  razaoSocial?: string | null;
}
async function resolverEmpresa(escritorioId: string, f: MeiInput) {
  if (f.empresaId) return f.empresaId;
  const porCnpj = await empresaPorCnpj(escritorioId, f.cnpj ?? '');
  if (porCnpj) return porCnpj;
  if (!f.razaoSocial?.trim()) throw Errors.validacao('Preencha: Cliente.');
  return criarEmpresa(escritorioId, { razaoSocial: f.razaoSocial, cnpj: dig(f.cnpj).length === 14 ? dig(f.cnpj) : undefined }, { frente: 'digital', naCarteira: true, anotacao: 'Cadastrado pelo módulo MEI.' });
}
export async function salvarMei(escritorioId: string, ator: Ator, id: string | null, f: MeiInput) {
  const empresaId = await resolverEmpresa(escritorioId, f);
  return prisma.$transaction(async (tx) => {
    const atual = id ? await carregarMei(tx, escritorioId, id) : null;
    const compAtual = hojeISO().slice(0, 7);
    const data: Prisma.MeiUncheckedUpdateInput = {
      empresaId, apelido: f.apelido?.trim() || null, cnpj: f.cnpj?.trim() || null, atividade: ATIVIDADES.includes(f.atividade ?? '') ? f.atividade : 'servicos',
      abertura: dataISO(f.abertura), temEmpregado: !!f.temEmpregado, observacao: f.observacao?.trim() || null,
    };
    if (f.codigo !== undefined) data.codigo = f.codigo?.trim() || null;
    if (f.ocupacao !== undefined) data.ocupacao = f.ocupacao?.trim() || null;
    // Situacao pela ficha so volta para Ativo; inativar e pelo botao (pergunta da baixa no SIMEI)
    if (!atual) data.situacao = 'Ativo';
    else if (f.situacao === 'Ativo' && atual.situacao !== 'Ativo') Object.assign(data, { situacao: 'Ativo', inativoEm: null, inativoMotivo: null, simeiBaixa: null, simeiBaixaEm: null });
    // Honorario e comissao com historico: a mudanca vale a partir da competencia atual
    const hon = r2(n(f.honorario));
    if (!atual || n(atual.honorario) !== hon) {
      data.honorario = hon;
      data.honorarioHist = { ...((atual?.honorarioHist as object) ?? {}), [atual ? compAtual : '0000-00']: hon };
    }
    if (f.comissaoPct !== undefined && (!atual || n(atual.comissaoPct) !== n(f.comissaoPct))) {
      data.comissaoPct = n(f.comissaoPct);
      data.comissaoPctHist = { ...((atual?.comissaoPctHist as object) ?? {}), [atual ? compAtual : '0000-00']: n(f.comissaoPct) };
    }
    const m = atual
      ? await tx.mei.update({ where: { id: atual.id }, data })
      : await tx.mei.create({ data: { ...(data as Prisma.MeiUncheckedCreateInput), escritorioId } });
    await tx.empresa.update({ where: { id: empresaId }, data: { carteiraMei: true } });
    const nome = (await tx.empresa.findUnique({ where: { id: empresaId }, select: { razaoSocial: true } }))?.razaoSocial ?? '';
    await hist(tx, escritorioId, ator, m.id, atual ? 'MEI — alterado' : 'MEI — criado', nome);
    return m;
  });
}

export async function excluirMei(escritorioId: string, ator: Ator, id: string) {
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, id);
    await tx.mei.delete({ where: { id } }); // lancamentos, guias, DASN e acordos saem junto (cascade)
    await hist(tx, escritorioId, ator, null, 'MEI — excluído', nomeMei(m));
    return { excluido: true };
  });
}

export async function inativar(escritorioId: string, ator: Ator, id: string, b: { situacao: string; desde?: string | null; motivo?: string | null; simeiBaixa: string }) {
  if (!['Baixado', 'Desenquadrado', 'Inativo'].includes(b.situacao)) throw Errors.validacao('Situação inválida.');
  if (!['sim', 'nao', 'na'].includes(b.simeiBaixa)) throw Errors.validacao('Obrigatório: responda se a baixa no SIMEI foi feita.');
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, id);
    await tx.mei.update({ where: { id }, data: { situacao: b.situacao, inativoEm: dataISO(b.desde) ?? hojeData(), inativoMotivo: b.motivo?.trim() || null, simeiBaixa: b.simeiBaixa, simeiBaixaEm: hojeData() } });
    const rot = { sim: 'concluída', nao: 'PENDENTE', na: 'não se aplica' }[b.simeiBaixa];
    await hist(tx, escritorioId, ator, id, 'MEI inativado', `${nomeMei(m)} — ${b.situacao} · baixa no SIMEI: ${rot}${b.motivo ? ` (${b.motivo})` : ''}`);
    return { ok: true };
  });
}
export async function reativar(escritorioId: string, ator: Ator, id: string) {
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, id);
    await tx.mei.update({ where: { id }, data: { situacao: 'Ativo', inativoEm: null, inativoMotivo: null, simeiBaixa: null, simeiBaixaEm: null } });
    await hist(tx, escritorioId, ator, id, 'MEI reativado', nomeMei(m));
    return { ok: true };
  });
}

export async function marcarHonorario(escritorioId: string, ator: Ator, id: string, comp: string, pago: boolean) {
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, id);
    const hp = { ...((m.honPago as Record<string, unknown>) ?? {}) };
    if (pago) hp[comp] = { pagoEm: hojeISO() }; else delete hp[comp];
    await tx.mei.update({ where: { id }, data: { honPago: hp as Prisma.InputJsonValue } });
    await hist(tx, escritorioId, ator, id, pago ? 'Honorário MEI recebido' : 'Honorário MEI desmarcado', `${nomeMei(m)} · ${comp}`);
    return { ok: true };
  });
}
export async function definirComissao(escritorioId: string, ator: Ator, id: string, comp: string, pct: number) {
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, id);
    const h = { ...((m.comissaoPctHist as Record<string, number>) ?? {}), [comp]: n(pct) };
    await tx.mei.update({ where: { id }, data: { comissaoPct: n(pct), comissaoPctHist: h } });
    await hist(tx, escritorioId, ator, id, 'Comissão do MEI alterada', `${nomeMei(m)} · ${pct}% a partir de ${comp}`);
    return { ok: true };
  });
}

// Importacao CSV de MEIs (linhas ja lidas no navegador)
export interface LinhaMei { nome?: string; cnpj?: string; codigo?: string; abertura?: string; ocupacao?: string; atividade?: string; situacao?: string; empregado?: string; honorario?: string; comissao?: string; observacao?: string }
const numeroBR = (s?: string) => { const t = String(s ?? '').replace(/[^\d,.-]/g, ''); const v = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t); return Number.isFinite(v) ? v : 0; };
const dataBRouISO = (s?: string) => { const t = String(s ?? '').trim(); let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
export function atividadeDeTexto(t?: string) {
  const s = String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (ATIVIDADES.includes(s)) return s;
  if (s === 'comercio e servicos' || s === 'ambos') return 'ambos';
  if (s.startsWith('comercio') || s.startsWith('industria')) return 'comercio';
  if (s.startsWith('servico')) return 'servicos';
  if (s.startsWith('transporte')) return 'transporte';
  return '';
}
export async function importarMeis(escritorioId: string, ator: Ator, linhas: LinhaMei[]) {
  const meis = await prisma.mei.findMany({ where: { escritorioId } });
  let novos = 0, atualizados = 0, ignoradas = 0;
  for (const l of linhas) {
    if (!l.nome?.trim() && !dig(l.cnpj) && !l.codigo?.trim()) { ignoradas++; continue; }
    let m = meis.find((x) => (dig(l.cnpj) && dig(x.cnpj) === dig(l.cnpj)) || (l.codigo?.trim() && x.codigo === l.codigo.trim()));
    const data: MeiInput = {};
    if (l.cnpj?.trim()) data.cnpj = l.cnpj.trim();
    if (l.codigo?.trim()) data.codigo = l.codigo.trim();
    if (l.abertura) data.abertura = dataBRouISO(l.abertura) || null;
    if (l.ocupacao?.trim()) data.ocupacao = l.ocupacao.trim();
    if (l.atividade?.trim()) data.atividade = atividadeDeTexto(l.atividade) || undefined;
    if (l.empregado?.trim()) data.temEmpregado = /sim|^s$|^x$|^1$/i.test(l.empregado.trim());
    if (l.honorario?.trim()) data.honorario = numeroBR(l.honorario);
    if (l.comissao?.trim()) data.comissaoPct = numeroBR(l.comissao);
    if (l.observacao?.trim()) data.observacao = l.observacao.trim();
    if (m) {
      await salvarMei(escritorioId, ator, m.id, {
        empresaId: m.empresaId, apelido: m.apelido, cnpj: data.cnpj ?? m.cnpj, atividade: data.atividade ?? m.atividade,
        abertura: data.abertura ?? (m.abertura ? m.abertura.toISOString().slice(0, 10) : null), temEmpregado: data.temEmpregado ?? m.temEmpregado,
        honorario: data.honorario ?? n(m.honorario), comissaoPct: data.comissaoPct ?? n(m.comissaoPct), observacao: data.observacao ?? m.observacao,
        codigo: data.codigo ?? m.codigo, ocupacao: data.ocupacao ?? m.ocupacao,
      });
      atualizados++;
    } else {
      const novo = await salvarMei(escritorioId, ator, null, { ...data, razaoSocial: l.nome?.trim() || l.cnpj || l.codigo, honorario: data.honorario ?? 0 });
      meis.push(novo);
      novos++;
    }
  }
  await prisma.$transaction((tx) => hist(tx, escritorioId, ator, null, 'MEIs importados por CSV', `${novos} novos, ${atualizados} atualizados`));
  return { novos, atualizados, ignoradas };
}

// ─── Lancamentos ────────────────────────────────────────────────────────────
export async function listarLancamentos(escritorioId: string, meiId: string | undefined, ano: number) {
  const ls = await prisma.meiLancamento.findMany({
    where: { mei: { escritorioId }, ...(meiId ? { meiId } : {}), competencia: { startsWith: `${ano}-` } },
    orderBy: [{ data: 'asc' }, { createdAt: 'asc' }],
  });
  return ls.map((l) => ({ ...l, valor: n(l.valor) }));
}
export interface LancInput { meiId: string; data?: string | null; conta: string; descricao?: string | null; valor: number }
export async function salvarLancamento(escritorioId: string, ator: Ator, id: string | null, f: LancInput) {
  if (!CONTAS[f.conta]) throw Errors.validacao('Selecione uma conta.');
  const valor = r2(n(f.valor));
  if (valor <= 0) throw Errors.validacao('Informe um valor maior que zero.');
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, f.meiId);
    const d = dataISO(f.data) ?? hojeData();
    const data = { meiId: m.id, data: d, competencia: d.toISOString().slice(0, 7), conta: f.conta, descricao: f.descricao?.trim() || null, valor, automatico: false };
    if (id) {
      const l = await tx.meiLancamento.findFirst({ where: { id, mei: { escritorioId } } });
      if (!l) throw Errors.naoEncontrado('Lançamento');
      await tx.meiLancamento.update({ where: { id }, data });
      await hist(tx, escritorioId, ator, m.id, 'Lançamento do MEI alterado', `${nomeMei(m)} · ${CONTAS[f.conta].rotulo} · ${valor}`);
    } else {
      await tx.meiLancamento.create({ data });
      await hist(tx, escritorioId, ator, m.id, 'Lançamento do MEI', `${nomeMei(m)} · ${CONTAS[f.conta].rotulo} · ${valor}`);
    }
    return { ok: true };
  });
}
export async function excluirLancamento(escritorioId: string, ator: Ator, id: string) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.meiLancamento.findFirst({ where: { id, mei: { escritorioId } }, include: { mei: { include: { empresa: { select: { razaoSocial: true } } } } } });
    if (!l) throw Errors.naoEncontrado('Lançamento');
    await tx.meiLancamento.delete({ where: { id } });
    await hist(tx, escritorioId, ator, l.meiId, 'Lançamento do MEI excluído', `${nomeMei(l.mei)} · ${CONTAS[l.conta]?.rotulo ?? l.conta} · ${n(l.valor)}`);
    return { ok: true };
  });
}
// Importa lancamentos para um MEI. Deduplica: mesma data + conta + valor + descricao nao entra de novo.
export async function importarLancamentos(escritorioId: string, ator: Ator, meiId: string, linhas: { data?: string; conta?: string; descricao?: string; valor?: string }[]) {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^\((−|-)\)\s*/, '').trim();
  const porRotulo = new Map(Object.entries(CONTAS).flatMap(([k, c]) => [[norm(k), k], [norm(c.rotulo), k]]));
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, meiId);
    const existentes = await tx.meiLancamento.findMany({ where: { meiId } });
    const chave = (d: string, c: string, v: number, ds: string) => `${d}|${c}|${v.toFixed(2)}|${ds}`;
    const ja = new Set(existentes.map((l) => chave(l.data.toISOString().slice(0, 10), l.conta, n(l.valor), l.descricao ?? '')));
    let criados = 0, ignoradas = 0, repetidos = 0;
    for (const l of linhas) {
      const d = dataBRouISO(l.data); const conta = porRotulo.get(norm(l.conta ?? '')); const valor = r2(numeroBR(l.valor));
      if (!d || !conta || valor <= 0) { ignoradas++; continue; }
      const k = chave(d, conta, valor, l.descricao?.trim() ?? '');
      if (ja.has(k)) { repetidos++; continue; }
      ja.add(k);
      await tx.meiLancamento.create({ data: { meiId, data: dataISO(d)!, competencia: d.slice(0, 7), conta, descricao: l.descricao?.trim() || null, valor } });
      criados++;
    }
    if (criados) await hist(tx, escritorioId, ator, meiId, 'Lançamentos do MEI importados', `${nomeMei(m)} · ${criados} linha(s)`);
    return { criados, ignoradas, repetidos };
  });
}
// "Lancar DAS pago como imposto": refaz os lancamentos automaticos do ano com o valor de cada guia paga
export async function lancarDasPago(escritorioId: string, ator: Ator, meiId: string, ano: number) {
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, meiId);
    await tx.meiLancamento.deleteMany({ where: { meiId, automatico: true, competencia: { startsWith: `${ano}-` } } });
    const pagos = await tx.meiDas.findMany({ where: { meiId, situacao: 'Pago', competencia: { startsWith: `${ano}-` } }, orderBy: { competencia: 'asc' } });
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (const g of pagos) {
      await tx.meiLancamento.create({
        data: { meiId, data: ultimoDia(g.competencia), competencia: g.competencia, conta: 'ded_impostos', descricao: `DAS ${MESES[Number(g.competencia.slice(5)) - 1]}/${ano}`, valor: n(g.valor), automatico: true },
      });
    }
    await hist(tx, escritorioId, ator, meiId, 'DAS pago lançado como imposto', `${nomeMei(m)} · ${ano} · ${pagos.length} competência(s)`);
    return { lancados: pagos.length };
  });
}

// ─── DAS ────────────────────────────────────────────────────────────────────
export async function alternarDas(escritorioId: string, ator: Ator, meiId: string, competencia: string) {
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw Errors.validacao('Competência inválida.');
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, meiId);
    if (m.abertura && competencia < m.abertura.toISOString().slice(0, 7)) throw Errors.validacao('Competência anterior à abertura do MEI.');
    const g = await tx.meiDas.findUnique({ where: { meiId_competencia: { meiId, competencia } } });
    if (g?.situacao === 'Parcelado') throw Errors.validacao('Esta competência está em parcelamento — trate em “Débitos e parcelamento”.');
    if (g?.situacao === 'Pago') {
      await tx.meiDas.update({ where: { id: g.id }, data: { situacao: 'Em aberto', pagoEm: null } });
      await hist(tx, escritorioId, ator, meiId, 'DAS desmarcado', `${nomeMei(m)} · ${competencia}`);
      return { situacao: 'Em aberto' };
    }
    const { salarioMinimo } = await tabelaSm(escritorioId, tx);
    if (g) await tx.meiDas.update({ where: { id: g.id }, data: { situacao: 'Pago', pagoEm: hojeData() } });
    else await tx.meiDas.create({ data: { meiId, competencia, valor: das(m.atividade, Number(competencia.slice(0, 4)), salarioMinimo), situacao: 'Pago', pagoEm: hojeData() } });
    await hist(tx, escritorioId, ator, meiId, 'DAS pago', `${nomeMei(m)} · ${competencia}`);
    return { situacao: 'Pago' };
  });
}

// ─── DASN ───────────────────────────────────────────────────────────────────
export async function dasn(escritorioId: string, ator: Ator, meiId: string, ano: number, b: { alternar?: boolean; receitaInformada?: number | null }) {
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, meiId);
    const atual = await tx.meiDasn.findUnique({ where: { meiId_ano: { meiId, ano } } });
    if (b.alternar) {
      const entregar = atual?.situacao !== 'Entregue';
      await tx.meiDasn.upsert({
        where: { meiId_ano: { meiId, ano } }, create: { meiId, ano, situacao: entregar ? 'Entregue' : 'Pendente', entregueEm: entregar ? hojeData() : null },
        update: { situacao: entregar ? 'Entregue' : 'Pendente', entregueEm: entregar ? hojeData() : null },
      });
      await hist(tx, escritorioId, ator, meiId, entregar ? 'DASN entregue' : 'DASN desmarcada', `${nomeMei(m)} · ${ano}`);
    } else {
      const v = b.receitaInformada == null ? null : r2(b.receitaInformada);
      await tx.meiDasn.upsert({ where: { meiId_ano: { meiId, ano } }, create: { meiId, ano, receitaInformada: v }, update: { receitaInformada: v } });
      await hist(tx, escritorioId, ator, meiId, 'Receita da DASN informada', `${nomeMei(m)} · ${ano} · ${v ?? '(calculada)'}`);
    }
    return { ok: true };
  });
}

// ─── Parcelamentos ──────────────────────────────────────────────────────────
interface CompAcordo { competencia: string; valor: number; situacaoAnterior?: string; pagoEmAnterior?: string; valorAnterior?: number | null; existiaGuia?: boolean }
async function marcarGuia(tx: Tx, meiId: string, c: string, situacao: string, parcelamentoId: string | null, valor?: number) {
  const g = await tx.meiDas.findUnique({ where: { meiId_competencia: { meiId, competencia: c } } });
  const pagoEm = situacao === 'Pago' ? (g?.pagoEm ?? hojeData()) : null;
  if (g) await tx.meiDas.update({ where: { id: g.id }, data: { situacao, parcelamentoId, pagoEm, ...(valor != null ? { valor } : {}) } });
  else await tx.meiDas.create({ data: { meiId, competencia: c, valor: valor ?? 0, situacao, parcelamentoId, pagoEm } });
}
async function aplicarGuias(tx: Tx, meiId: string, p: { id: string; situacao: string; competencias: CompAcordo[] }) {
  for (const c of p.competencias) await marcarGuia(tx, meiId, c.competencia, p.situacao === 'Quitado' ? 'Pago' : 'Parcelado', p.id, c.valor);
}
// Devolve a guia como estava antes do acordo. Sem foto (acordo antigo): volta "Em aberto" com o valor (o painel apagava).
async function devolverGuia(tx: Tx, meiId: string, c: CompAcordo, parcId: string) {
  const g = await tx.meiDas.findUnique({ where: { meiId_competencia: { meiId, competencia: c.competencia } } });
  if (!g || (g.parcelamentoId && g.parcelamentoId !== parcId)) return;
  if (c.existiaGuia === false) { await tx.meiDas.delete({ where: { id: g.id } }); return; }
  await tx.meiDas.update({
    where: { id: g.id },
    data: {
      situacao: c.situacaoAnterior || 'Em aberto', pagoEm: c.pagoEmAnterior ? dataISO(c.pagoEmAnterior) : null, parcelamentoId: null,
      ...(c.valorAnterior != null ? { valor: c.valorAnterior } : {}),
    },
  });
}
export interface AcordoInput {
  meiId: string; competencias: { competencia: string; valor: number }[]; total: number; parcelas: number; valorPrimeira: number | null;
  parcelasPagas: number; adesao?: string | null; protocolo?: string | null; observacao?: string | null; situacao: string;
}
export async function salvarAcordo(escritorioId: string, ator: Ator, id: string | null, f: AcordoInput) {
  if (!f.competencias.length) throw Errors.validacao('Marque ao menos uma competência.');
  const nParc = Math.min(60, Math.max(1, Math.round(n(f.parcelas))));
  const situacao = ['Ativo', 'Quitado', 'Cancelado'].includes(f.situacao) ? f.situacao : 'Ativo';
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, f.meiId);
    const antigo = id ? await tx.meiParcelamento.findFirst({ where: { id, meiId: m.id } }) : null;
    if (id && !antigo) throw Errors.naoEncontrado('Parcelamento');
    const antes = new Map(((antigo?.competencias as unknown as CompAcordo[]) ?? []).map((c) => [c.competencia, c]));
    const comps: CompAcordo[] = [];
    for (const c of f.competencias) {
      const ja = antes.get(c.competencia);
      if (ja) { comps.push({ ...ja, valor: r2(n(c.valor)) }); continue; }
      const g = await tx.meiDas.findUnique({ where: { meiId_competencia: { meiId: m.id, competencia: c.competencia } } });
      if (g?.parcelamentoId && g.parcelamentoId !== id) throw Errors.validacao(`A competência ${c.competencia} já está em outro acordo.`);
      comps.push({
        competencia: c.competencia, valor: r2(n(c.valor)), existiaGuia: !!g, situacaoAnterior: g?.situacao ?? '',
        pagoEmAnterior: g?.pagoEm ? g.pagoEm.toISOString().slice(0, 10) : '', valorAnterior: g ? n(g.valor) : null,
      });
    }
    const principal = r2(comps.reduce((s, c) => s + c.valor, 0));
    const total = Math.max(0, r2(n(f.total)));
    const pe = f.valorPrimeira && nParc > 1 ? Math.min(r2(f.valorPrimeira), total) : 0;
    const demais = nParc <= 1 ? total : pe ? r2((total - pe) / (nParc - 1)) : r2(total / nParc);
    const pagas = situacao === 'Quitado' ? nParc : Math.min(nParc, Math.max(0, Math.round(n(f.parcelasPagas))));
    const data = {
      meiId: m.id, competencias: comps as unknown as Prisma.InputJsonValue, principal, juros: r2(total - principal), total, parcelas: nParc,
      valorParcela: demais, valorPrimeira: pe, parcelasPagas: pagas, adesao: dataISO(f.adesao) ?? hojeData(),
      protocolo: f.protocolo?.trim() || null, observacao: f.observacao?.trim() || null, situacao,
    };
    const p = antigo ? await tx.meiParcelamento.update({ where: { id: antigo.id }, data }) : await tx.meiParcelamento.create({ data });
    // competencias que sairam do acordo voltam como estavam
    for (const [c, old] of antes) if (!comps.some((x) => x.competencia === c)) await devolverGuia(tx, m.id, old, p.id);
    if (situacao === 'Cancelado') for (const c of comps) await devolverGuia(tx, m.id, c, p.id);
    else await aplicarGuias(tx, m.id, { id: p.id, situacao, competencias: comps });
    await hist(tx, escritorioId, ator, m.id, antigo ? 'Parcelamento do MEI alterado' : 'Parcelamento do MEI criado',
      `${nomeMei(m)} · ${comps.length} competência(s) · ${nParc}x · juros R$ ${r2(total - principal).toFixed(2)}`);
    return p;
  });
}
export async function acaoAcordo(escritorioId: string, ator: Ator, id: string, acao: 'pagas' | 'quitar' | 'cancelar' | 'reativar' | 'excluir', pagasN?: number) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.meiParcelamento.findFirst({ where: { id, mei: { escritorioId } }, include: { mei: { include: { empresa: { select: { razaoSocial: true } } } } } });
    if (!p) throw Errors.naoEncontrado('Parcelamento');
    const comps = p.competencias as unknown as CompAcordo[];
    const nome = nomeMei(p.mei);
    if (acao === 'excluir' || acao === 'cancelar') {
      for (const c of comps) await devolverGuia(tx, p.meiId, c, p.id);
      if (acao === 'excluir') await tx.meiParcelamento.delete({ where: { id } });
      else await tx.meiParcelamento.update({ where: { id }, data: { situacao: 'Cancelado' } });
      await hist(tx, escritorioId, ator, p.meiId, acao === 'excluir' ? 'Parcelamento do MEI excluído' : 'Parcelamento do MEI rescindido', `${nome} · ${n(p.total)} · ${comps.length} competência(s) devolvida(s)`);
      return { ok: true };
    }
    let pagas = p.parcelasPagas; let situacao = p.situacao;
    if (acao === 'pagas') pagas = Math.min(p.parcelas, Math.max(0, Math.round(n(pagasN))));
    if (acao === 'quitar') pagas = p.parcelas;
    if (acao === 'reativar') {
      for (const c of comps) {
        const g = await tx.meiDas.findUnique({ where: { meiId_competencia: { meiId: p.meiId, competencia: c.competencia } } });
        if (g?.parcelamentoId && g.parcelamentoId !== p.id) throw Errors.validacao(`A competência ${c.competencia} entrou em outro acordo — não dá para reativar este.`);
      }
    }
    if (situacao !== 'Cancelado' || acao === 'reativar') situacao = pagas >= p.parcelas ? 'Quitado' : 'Ativo';
    await tx.meiParcelamento.update({ where: { id }, data: { parcelasPagas: pagas, situacao } });
    await aplicarGuias(tx, p.meiId, { id: p.id, situacao, competencias: comps });
    const rot = { pagas: 'Parcela do MEI registrada', quitar: 'Parcelamento do MEI quitado', reativar: 'Parcelamento do MEI reativado' }[acao];
    await hist(tx, escritorioId, ator, p.meiId, rot, `${nome} · ${pagas}/${p.parcelas}`);
    return { ok: true, situacao, pagas };
  });
}
// Competencia "Parcelado" sem acordo (orfa): volta para "Em aberto"
export async function tirarDoParcelamento(escritorioId: string, ator: Ator, meiId: string, competencias: string[]) {
  return prisma.$transaction(async (tx) => {
    const m = await carregarMei(tx, escritorioId, meiId);
    const r = await tx.meiDas.updateMany({ where: { meiId, competencia: { in: competencias }, situacao: 'Parcelado', parcelamentoId: null }, data: { situacao: 'Em aberto' } });
    await hist(tx, escritorioId, ator, meiId, 'Competências tiradas do parcelamento', `${nomeMei(m)} · ${r.count}`);
    return { devolvidas: r.count };
  });
}

// ─── Configuracao ───────────────────────────────────────────────────────────
export async function salvarSalarioMinimo(escritorioId: string, ator: Ator, ano: number, valor: number) {
  if (!(valor > 0)) throw Errors.validacao('Informe um valor maior que zero.');
  const c = await tabelaSm(escritorioId);
  const sm = { ...c.salarioMinimo, [String(ano)]: r2(valor) };
  await prisma.meiConfig.upsert({ where: { escritorioId }, create: { escritorioId, salarioMinimo: sm }, update: { salarioMinimo: sm } });
  await prisma.$transaction((tx) => hist(tx, escritorioId, ator, null, 'Salário mínimo do MEI alterado', `${ano} · R$ ${r2(valor).toFixed(2)}`));
  return { ok: true };
}
export async function historico(escritorioId: string, meiId?: string) {
  return prisma.meiHistorico.findMany({ where: { escritorioId, ...(meiId ? { meiId } : {}) }, orderBy: { createdAt: 'desc' }, take: 300 });
}
export { SITUACOES_MEI, vencimento };
