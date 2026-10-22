// Importa Alvaras do painel antigo da Atuan (/var/lib/atuan-dados/base.json) para o Obrigo —
// SO a frente ATUAN Digital. Licencas, legalizacoes (Kanban), parametros da calculadora e checklists,
// e os CNAEs dos clientes (para a calculadora). Idempotente pelo legadoId. Uso (em server/):
//   node scripts/importar-atuan-alvaras.mjs --dry
//   node scripts/importar-atuan-alvaras.mjs
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const DRY = process.argv.includes('--dry');
const ESCRITORIO = process.env.ATUAN_ESCRITORIO_ID || 'cmuh6l6a8000011mstpvmjte3';
const BASE = process.env.ATUAN_BASE || '/var/lib/atuan-dados/base.json';
const prisma = new PrismaClient();

const dig = (v) => String(v ?? '').replace(/\D/g, '');
const data = (v) => (v ? new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v) : null);
const valida = (d) => (d && !Number.isNaN(d.getTime()) ? d : null);
const frente = (c) => (c?.grupo === 'digital' ? 'digital' : c?.grupo === 'esporadico' ? 'esporadico' : 'nauta');

const p = JSON.parse(fs.readFileSync(BASE, 'utf8')).pacote.dados;
const clientes = new Map(p.clientes.map((c) => [c.id, c]));
const daAtuan = (r) => frente(clientes.get(r.clienteId)) === 'digital';
const licencas = (p.licencas ?? []).filter(daAtuan);
const legal = (p.legalizacoes ?? []).filter(daAtuan);
console.log(`Painel: ${licencas.length} licença(s) e ${legal.length} legalização(ões) da Atuan.`);

const empresaDe = new Map(); let criadas = 0, ligadas = 0, cnaes = 0;
async function empresaPara(clienteId) {
  if (!clienteId) return null;
  if (empresaDe.has(clienteId)) return empresaDe.get(clienteId);
  const c = clientes.get(clienteId);
  if (!c) return null;
  const cnpj = dig(c.documento);
  let id = (await prisma.empresa.findFirst({ where: { escritorioId: ESCRITORIO, legadoAtuanId: c.id, deletedAt: null }, select: { id: true } }))?.id ?? null;
  if (!id && cnpj.length === 14) id = (await prisma.empresaIdentificador.findFirst({ where: { escritorioId: ESCRITORIO, tipo: 'CNPJ', valor: cnpj, empresa: { deletedAt: null } }, select: { empresaId: true } }))?.empresaId ?? null;
  if (id) {
    ligadas++;
    const atual = await prisma.empresa.findUnique({ where: { id }, select: { cnaes: true } });
    if (!DRY) await prisma.empresa.update({ where: { id }, data: { frente: frente(c), legadoAtuanId: c.id, ...(!atual?.cnaes && c.cnaes ? { cnaes: c.cnaes } : {}) } });
    if (!atual?.cnaes && c.cnaes) cnaes++;
  } else {
    criadas++;
    if (DRY) { id = `(nova:${c.nome})`; console.log(`  empresa nova: ${c.nome}`); }
    else {
      const ult = await prisma.empresa.aggregate({ where: { escritorioId: ESCRITORIO }, _max: { numero: true } });
      id = (await prisma.empresa.create({
        data: {
          escritorioId: ESCRITORIO, razaoSocial: c.nome || 'Empresa sem nome', nomeFantasia: c.fantasia || null, numero: (ult._max.numero ?? 0) + 1,
          emailPrincipal: c.email || null, telefone: c.telefone || null, cidade: c.cidade || null, uf: c.uf || null, endereco: c.endereco || null,
          cnaes: c.cnaes || null, anotacoes: [c.observacao, 'Importado do painel da Atuan (Alvarás).'].filter(Boolean).join(' · '),
          ativo: c.situacao !== 'Encerrado', emAbertura: cnpj.length !== 14, frente: frente(c), naCarteira: c.carteira !== false, legadoAtuanId: c.id, contabilidade: 'atuan',
          identificadores: cnpj.length === 14 ? { create: [{ escritorioId: ESCRITORIO, tipo: 'CNPJ', valor: cnpj }] } : undefined,
        },
      })).id;
    }
  }
  empresaDe.set(clienteId, id);
  return id;
}
const real = (id) => (id && !String(id).startsWith('(') ? id : null);

// ─── Licencas ───────────────────────────────────────────────────────────────
const licDe = new Map(); let novasL = 0;
for (const l of licencas) {
  const ja = await prisma.licenca.findFirst({ where: { escritorioId: ESCRITORIO, legadoId: l.id }, select: { id: true } });
  if (ja) { licDe.set(l.id, ja.id); continue; }
  const empresaId = await empresaPara(l.clienteId);
  novasL++;
  if (DRY) { console.log(`  licença ${clientes.get(l.clienteId)?.nome} · ${l.tipo} · validade ${l.validade || '—'} · ${l.situacao}`); continue; }
  const n = await prisma.licenca.create({
    data: {
      escritorioId: ESCRITORIO, empresaId: real(empresaId), clienteNome: clientes.get(l.clienteId)?.nome ?? null, tipo: l.tipo || 'Alvará de Funcionamento',
      orgao: l.orgao || null, protocolo: l.protocolo || null, situacao: l.situacao || 'Em preparação', emissao: valida(data(l.emissao)), validade: valida(data(l.validade)),
      responsavel: l.responsavel || null, taxa: Number(l.taxa) || null, observacao: l.observacao || null, inativo: !!l.inativo,
      inativoEm: valida(data(l.inativoEm)), inativoMotivo: l.inativoMotivo || null, legadoId: l.id, createdAt: valida(data(l.criadoEm)) ?? new Date(),
    },
  });
  licDe.set(l.id, n.id);
}

// ─── Legalizacoes ───────────────────────────────────────────────────────────
const legDe = new Map(); let novasG = 0;
for (const g of legal) {
  const ja = await prisma.legalizacao.findFirst({ where: { escritorioId: ESCRITORIO, legadoId: g.id }, select: { id: true } });
  if (ja) { legDe.set(g.id, ja.id); continue; }
  const empresaId = await empresaPara(g.clienteId);
  const proc = g.processoId ? await prisma.socProcesso.findFirst({ where: { escritorioId: ESCRITORIO, legadoId: g.processoId }, select: { id: true } }) : null;
  novasG++;
  if (DRY) { console.log(`  cartão ${clientes.get(g.clienteId)?.nome ?? g.cliente} · ${g.tipo ?? '(a iniciar)'} · ${g.etapa}${g.ocultoNoIniciar ? ' (pai oculto)' : ''}`); continue; }
  const n = await prisma.legalizacao.create({
    data: {
      escritorioId: ESCRITORIO, empresaId: real(empresaId), clienteNome: clientes.get(g.clienteId)?.nome ?? g.cliente ?? null, processoId: proc?.id ?? null,
      licencaId: g.licencaId ? licDe.get(g.licencaId) ?? null : null, tipo: g.tipo || 'Alvará de Funcionamento', orgao: g.orgao || null, protocolo: g.protocolo || null,
      tipoProcesso: g.tipoProcesso || 'Manual', prazo: valida(data(g.prazo)), vencimento: valida(data(g.vencimento)), etapa: g.etapa || 'A iniciar',
      observacao: g.observacao || null, alvarasPrevistos: g.alvarasPrevistos ?? [], alvarasGerados: g.alvarasGerados ?? [], ocultoNoIniciar: !!g.ocultoNoIniciar,
      taxaPaga: !!g.taxaPaga, taxaPagaEm: valida(data(g.taxaPagaEm)), concluidoEm: valida(data(g.concluidoEm)), renovadoEm: valida(data(g.renovadoEm)),
      licencaCriada: !!g.licencaCriada, validadeAnterior: g.validadeAnterior || null, situacaoAnterior: g.situacaoAnterior || null, obsAnterior: g.obsAnterior || null,
      inativo: !!g.inativo, inativoEm: valida(data(g.inativoEm)), inativoMotivo: g.inativoMotivo || null, responsavel: g.responsavel || null, legadoId: g.id,
      createdAt: valida(data(g.criadoEm)) ?? new Date(),
    },
  });
  legDe.set(g.id, n.id);
}
if (!DRY) for (const g of legal) if (g.paiId && legDe.get(g.paiId)) await prisma.legalizacao.update({ where: { id: legDe.get(g.id) }, data: { paiId: legDe.get(g.paiId) } });

// ─── Parametros e checklists ────────────────────────────────────────────────
const cfg = await prisma.alvConfig.findUnique({ where: { escritorioId: ESCRITORIO } });
if (!cfg && !DRY) {
  const par = p.alvParametros ?? {};
  const s = (v) => (v === undefined || v === null ? '' : String(v));
  const checklists = Object.fromEntries(Object.entries(p.alvChecklists ?? {}).map(([k, v]) => [k, (v ?? []).map((i) => ({ id: i.id || Math.random().toString(36).slice(2), texto: i.texto, feito: !!i.feito }))]));
  await prisma.alvConfig.create({
    data: {
      escritorioId: ESCRITORIO,
      parametros: {
        exercicio: par.exercicio || new Date().getFullYear(),
        ufmPorAno: Object.fromEntries(Object.entries(par.ufmPorAno ?? {}).map(([a, v]) => [a, s(v)])),
        atividades: (par.atividades ?? []).map((a) => ({ cnae: s(a.cnae), ufm: s(a.ufm), desc: s(a.desc) })),
        faixas: (par.faixas ?? []).map((f) => ({ ate: s(f.ate), abertura: s(f.abertura), renovacao: s(f.renovacao) })),
        taxas: Object.fromEntries(Object.entries(par.taxas ?? {}).map(([k, v]) => [k, s(v)])),
      },
      checklists,
    },
  });
}
console.log(`${DRY ? '[SIMULAÇÃO] ' : ''}Licenças novas: ${novasL} · cartões novos: ${novasG} · empresas ligadas: ${ligadas} · criadas: ${criadas} · CNAEs gravados: ${cnaes} · parâmetros/checklists: ${cfg ? 'já existiam' : 'copiados'}`);
await prisma.$disconnect();
