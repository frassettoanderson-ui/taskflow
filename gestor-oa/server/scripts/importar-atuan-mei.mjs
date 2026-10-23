// Importa o modulo MEI do painel antigo da Atuan (/var/lib/atuan-dados/base.json) para o Obrigo:
// MEIs, honorarios pagos, comissoes, guias de DAS, DASN, lancamentos e parcelamentos.
// Idempotente pelo legadoId do MEI (se o MEI ja foi importado, pula ele e tudo que e dele). Uso (em server/):
//   node scripts/importar-atuan-mei.mjs --dry
//   node scripts/importar-atuan-mei.mjs
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const DRY = process.argv.includes('--dry');
const ESCRITORIO = process.env.ATUAN_ESCRITORIO_ID || 'cmuh6l6a8000011mstpvmjte3';
const BASE = process.env.ATUAN_BASE || '/var/lib/atuan-dados/base.json';
const prisma = new PrismaClient();

const dig = (v) => String(v ?? '').replace(/\D/g, '');
const data = (v) => { if (!v) return null; const d = new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v); return Number.isNaN(d.getTime()) ? null : d; };
const n = (v) => Number(v) || 0;
const frente = (c) => (c?.grupo === 'digital' ? 'digital' : c?.grupo === 'esporadico' ? 'esporadico' : 'nauta');
const ATIV = ['comercio', 'servicos', 'ambos', 'transporte'];
function atividadeDe(m) {
  if (ATIV.includes(m.atividade)) return m.atividade;
  const s = String(m.tipoReceita ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return { comercio: 'comercio', servicos: 'servicos', 'comercio e servicos': 'ambos', industria: 'comercio', 'transporte de cargas': 'transporte', transporte: 'transporte' }[s] ?? 'servicos';
}
const CONTAS = ['rec_vendas', 'rec_servicos', 'rec_outras', 'rec_fin', 'ded_impostos', 'ded_devol', 'cmv', 'desp_pessoal', 'desp_admin', 'desp_comercial', 'desp_fin', 'outras_desp'];
const POR_CATEGORIA = { 'venda de mercadoria': 'rec_vendas', 'prestação de serviço': 'rec_servicos', 'prestacao de servico': 'rec_servicos', 'compra de mercadoria': 'cmv', aluguel: 'desp_admin', transporte: 'desp_admin' };
const contaDe = (l) => (CONTAS.includes(l.conta) ? l.conta : POR_CATEGORIA[String(l.categoria ?? '').toLowerCase()] ?? (l.tipo === 'Despesa' ? 'outras_desp' : 'rec_outras'));
const sinal = (c) => (c.startsWith('rec_') ? 1 : -1);
function dataLanc(l) {
  if (/^\d{4}-\d{2}-\d{2}/.test(l.data ?? '')) return l.data.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(l.competencia ?? '')) { const [a, m] = l.competencia.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); }
  return null;
}

const p = JSON.parse(fs.readFileSync(BASE, 'utf8')).pacote.dados;
const clientes = new Map(p.clientes.map((c) => [c.id, c]));
const meis = p.meis ?? [];
console.log(`Painel: ${meis.length} MEI(s), ${(p.meiLancamentos ?? []).length} lançamentos, ${(p.meiDas ?? []).length} guias, ${(p.meiDasn ?? []).length} DASN, ${(p.meiParcelamentos ?? []).length} parcelamentos, ${(p.meiFaturamento ?? []).length} faturamentos mensais (legado).`);

let empLigadas = 0, empCriadas = 0, tot = { meis: 0, lanc: 0, das: 0, dasn: 0, parc: 0, fat: 0, pulados: 0 };
for (const m of meis) {
  if (await prisma.mei.findFirst({ where: { escritorioId: ESCRITORIO, legadoId: m.id }, select: { id: true } })) { tot.pulados++; continue; }
  const c = clientes.get(m.clienteId);
  const cnpj = dig(m.cnpj || c?.documento);
  // empresa no Obrigo
  let empresaId = c ? (await prisma.empresa.findFirst({ where: { escritorioId: ESCRITORIO, legadoAtuanId: c.id, deletedAt: null }, select: { id: true } }))?.id : null;
  if (!empresaId && cnpj.length === 14) empresaId = (await prisma.empresaIdentificador.findFirst({ where: { escritorioId: ESCRITORIO, tipo: 'CNPJ', valor: cnpj, empresa: { deletedAt: null } }, select: { empresaId: true } }))?.empresaId;
  const nome = c?.nome || m.apelido || 'MEI';
  if (empresaId) empLigadas++; else empCriadas++;
  const lanc = (p.meiLancamentos ?? []).filter((l) => l.meiId === m.id);
  const guias = (p.meiDas ?? []).filter((g) => g.meiId === m.id);
  const dasn = (p.meiDasn ?? []).filter((x) => x.meiId === m.id);
  const parc = (p.meiParcelamentos ?? []).filter((x) => x.meiId === m.id);
  const fat = (p.meiFaturamento ?? []).filter((x) => x.meiId === m.id && (n(x.comercio) || n(x.servicos)));
  console.log(`  ${nome} · ${atividadeDe(m)} · ${m.situacao || 'Ativo'} · empresa ${empresaId ? 'existente' : 'nova'} · ${lanc.length} lanç · ${guias.length} guias · ${dasn.length} DASN · ${parc.length} acordos${fat.length ? ` · ${fat.length} faturamentos mensais` : ''}`);
  if (DRY) { tot.meis++; tot.lanc += lanc.length; tot.das += guias.length; tot.dasn += dasn.length; tot.parc += parc.length; tot.fat += fat.length; continue; }

  await prisma.$transaction(async (tx) => {
    if (!empresaId) {
      const ult = await tx.empresa.aggregate({ where: { escritorioId: ESCRITORIO }, _max: { numero: true } });
      empresaId = (await tx.empresa.create({
        data: {
          escritorioId: ESCRITORIO, razaoSocial: nome, nomeFantasia: c?.fantasia || m.apelido || null, numero: (ult._max.numero ?? 0) + 1,
          emailPrincipal: c?.email || null, telefone: c?.telefone || null, cidade: c?.cidade || null, uf: c?.uf || null, endereco: c?.endereco || null,
          cnaes: c?.cnaes || null, anotacoes: 'Importado do painel da Atuan (MEI).', ativo: (m.situacao || 'Ativo') === 'Ativo',
          frente: frente(c), contabilidade: frente(c) === 'nauta' ? 'nauta' : 'atuan', carteiraMei: true, naCarteira: c ? c.carteira !== false : true, legadoAtuanId: c?.id ?? null,
          identificadores: cnpj.length === 14 ? { create: [{ escritorioId: ESCRITORIO, tipo: 'CNPJ', valor: cnpj }] } : undefined,
        },
      })).id;
    } else {
      await tx.empresa.update({ where: { id: empresaId }, data: { carteiraMei: true, ...(c ? { legadoAtuanId: c.id } : {}) } });
    }
    const honPago = {};
    for (const [comp, v] of Object.entries(m.honPago ?? {})) if (v) honPago[comp] = { pagoEm: typeof v === 'object' && v.pagoEm ? v.pagoEm : '' };
    const novo = await tx.mei.create({
      data: {
        escritorioId: ESCRITORIO, empresaId, apelido: m.apelido || null, codigo: m.codigo || null, cnpj: m.cnpj || null, ocupacao: m.ocupacao || null,
        atividade: atividadeDe(m), situacao: ['Ativo', 'Baixado', 'Desenquadrado', 'Inativo'].includes(m.situacao) ? m.situacao : 'Ativo',
        abertura: data(m.abertura), temEmpregado: !!m.temEmpregado, honorario: n(m.honorario), honorarioHist: { '0000-00': n(m.honorario) },
        comissaoPct: m.comissaoPct === '' || m.comissaoPct == null ? 10 : n(m.comissaoPct), comissaoPctHist: m.comissaoPctHist ?? {}, honPago,
        observacao: m.observacao || null, inativoEm: data(m.inativoEm), inativoMotivo: m.inativoMotivo || null, simeiBaixa: m.simeiBaixa || null,
        simeiBaixaEm: data(m.simeiBaixaEm), legadoId: m.id, createdAt: data(m.criadoEm) ?? new Date(),
      },
    });
    for (const l of lanc) {
      const d = dataLanc(l); const conta = contaDe(l);
      if (!d || !(n(l.valor) > 0)) continue;
      await tx.meiLancamento.create({ data: { meiId: novo.id, data: data(d), competencia: d.slice(0, 7), conta, descricao: l.descricao || null, valor: n(l.valor), automatico: !!l.automatico } });
      tot.lanc++;
    }
    // Faturamento mensal legado (Nauta) vira lancamento de receita, para entrar no faturamento unico
    for (const f of fat) {
      const d = dataLanc({ competencia: f.competencia });
      if (n(f.comercio)) { await tx.meiLancamento.create({ data: { meiId: novo.id, data: data(d), competencia: f.competencia, conta: 'rec_vendas', descricao: 'Faturamento mensal (importado)', valor: n(f.comercio) } }); tot.fat++; }
      if (n(f.servicos)) { await tx.meiLancamento.create({ data: { meiId: novo.id, data: data(d), competencia: f.competencia, conta: 'rec_servicos', descricao: 'Faturamento mensal (importado)', valor: n(f.servicos) } }); tot.fat++; }
    }
    // acordos primeiro (as guias apontam para eles)
    const parcDe = new Map();
    for (const a of parc) {
      const comps = (a.competencias ?? []).map((x) => ({ competencia: x.competencia, valor: n(x.valor), situacaoAnterior: x.situacaoAnterior ?? 'Em aberto', pagoEmAnterior: x.pagoEmAnterior ?? '', valorAnterior: x.valorAnterior ?? n(x.valor), existiaGuia: x.existiaGuia ?? true }));
      const novoA = await tx.meiParcelamento.create({
        data: {
          meiId: novo.id, competencias: comps, principal: n(a.principal), juros: n(a.juros), total: n(a.total), parcelas: Math.max(1, Math.round(n(a.parcelas)) || 1),
          valorParcela: n(a.valorParcela), valorPrimeira: n(a.valorPrimeira), parcelasPagas: Math.round(n(a.parcelasPagas)), adesao: data(a.adesao),
          protocolo: a.protocolo || null, observacao: a.observacao || null, situacao: ['Ativo', 'Quitado', 'Cancelado'].includes(a.situacao) ? a.situacao : 'Ativo',
          createdAt: data(a.criadoEm) ?? new Date(),
        },
      });
      parcDe.set(a.id, novoA.id); tot.parc++;
    }
    const vistas = new Set();
    for (const g of guias) {
      if (!/^\d{4}-\d{2}$/.test(g.competencia ?? '') || vistas.has(g.competencia)) continue;
      vistas.add(g.competencia);
      await tx.meiDas.create({
        data: { meiId: novo.id, competencia: g.competencia, valor: n(g.valor), situacao: g.situacao || 'Em aberto', pagoEm: data(g.pagoEm), parcelamentoId: g.parcelamentoId ? parcDe.get(g.parcelamentoId) ?? null : null },
      });
      tot.das++;
    }
    const anos = new Set();
    for (const x of dasn) {
      const ano = Number(x.ano);
      if (!ano || anos.has(ano)) continue;
      anos.add(ano);
      await tx.meiDasn.create({ data: { meiId: novo.id, ano, situacao: x.situacao || 'Pendente', entregueEm: data(x.entregueEm), receitaInformada: x.receitaInformada === '' || x.receitaInformada == null || n(x.receitaInformada) === 0 ? null : n(x.receitaInformada) } });
      tot.dasn++;
    }
    await tx.meiHistorico.create({ data: { escritorioId: ESCRITORIO, meiId: novo.id, usuarioNome: 'Importação', acao: 'Importado do painel da Atuan', detalhe: nome } });
    tot.meis++;
  });
}
console.log(`${DRY ? '[SIMULAÇÃO] ' : ''}MEIs: ${tot.meis} (já importados: ${tot.pulados}) · lançamentos: ${tot.lanc} · faturamentos mensais→lançamentos: ${tot.fat} · guias: ${tot.das} · DASN: ${tot.dasn} · acordos: ${tot.parc} · empresas ligadas: ${empLigadas} · criadas: ${empCriadas}`);
await prisma.$disconnect();
