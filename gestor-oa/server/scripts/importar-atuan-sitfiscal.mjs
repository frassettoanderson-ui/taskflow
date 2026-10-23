// Importa a Situação Fiscal (e-CAC) do painel antigo da Atuan para o Obrigô:
//  - relatórios lidos pelo FiscalView (pacote.plataformas.fiscalview_pro_v1 do base.json);
//  - opção pelo Simples/SIMEI do cartão CNPJ dos clientes (Consulta de optantes).
// Cada relatório vai para o(s) escritório(s) (perfis Atuan / Nauta / MEIs) que têm a empresa com
// aquele CNPJ; sem empresa em nenhum, vai pela carteira do cliente no painel (ATUAN Digital -> Atuan,
// MEI -> MEIs, NAUTA/Esporádicos -> Nauta) e, sem cliente no painel, fica na Atuan.
// Idempotente: um relatório por escritório+CNPJ, o mais recente vence (regra do FiscalView).
//   node scripts/importar-atuan-sitfiscal.mjs --dry
//   node scripts/importar-atuan-sitfiscal.mjs
import fs from 'node:fs';
import { PrismaClient, Prisma } from '@prisma/client';

const DRY = process.argv.includes('--dry');
const BASE = process.env.ATUAN_BASE || '/var/lib/atuan-dados/base.json';
const ATUAN = process.env.ATUAN_ESCRITORIO_ID || 'cmuh6l6a8000011mstpvmjte3';
const ESCRITORIOS = (process.env.SSO_ESCRITORIOS || '').split(',').map((p) => p.split(':')[1]).filter(Boolean);
const prisma = new PrismaClient();
const dig = (v) => String(v ?? '').replace(/\D/g, '');
const ms = (v) => { const m = String(v || '').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/); return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime() : 0; };

const pacote = JSON.parse(fs.readFileSync(BASE, 'utf8')).pacote;
const rels = JSON.parse(pacote.plataformas?.fiscalview_pro_v1 || '[]');
const clientes = pacote.dados.clientes || [];
const escritorios = [...new Set([ATUAN, ...ESCRITORIOS])];
const perfil = Object.fromEntries((process.env.SSO_ESCRITORIOS || '').split(',').map((p) => p.split(':').map((x) => x.trim())));
const clientePorCnpj = new Map(clientes.filter((c) => dig(c.documento).length === 14).map((c) => [dig(c.documento), c]));
function escritorioDaCarteira(cnpj) {
  const c = clientePorCnpj.get(cnpj);
  if (!c) return ATUAN;
  if (c.carteiraMei) return perfil.meis || ATUAN;
  if (c.grupo === 'digital') return ATUAN;
  return perfil.nauta || ATUAN;
}
console.log(`Painel: ${rels.length} relatório(s) do e-CAC, ${clientes.length} cliente(s). Escritórios: ${escritorios.length}`);

// CNPJ -> [{escritorioId, empresaId}]
const ids = await prisma.empresaIdentificador.findMany({ where: { tipo: 'CNPJ', escritorioId: { in: escritorios }, empresa: { deletedAt: null } }, select: { escritorioId: true, empresaId: true, valor: true } });
const porCnpj = new Map();
for (const i of ids) { const k = dig(i.valor); if (!porCnpj.has(k)) porCnpj.set(k, []); porCnpj.get(k).push(i); }

const conta = { novos: 0, atualizados: 0, ignorados: 0, semEmpresa: 0, porEscritorio: {} };
for (const r of rels) {
  const cnpj = dig(r.cnpj);
  if (cnpj.length !== 14) continue;
  let alvos = porCnpj.get(cnpj) || [];
  if (!alvos.length) { conta.semEmpresa++; alvos = [{ escritorioId: escritorioDaCarteira(cnpj), empresaId: null }]; }
  const vistos = new Set();
  for (const a of alvos) {
    if (vistos.has(a.escritorioId)) continue;
    vistos.add(a.escritorioId);
    conta.porEscritorio[a.escritorioId] = (conta.porEscritorio[a.escritorioId] || 0) + 1;
    const ts = r.reportTimestamp || ms(r.reportDateTime);
    const atual = await prisma.sitFiscalRelatorio.findUnique({ where: { escritorioId_cnpj: { escritorioId: a.escritorioId, cnpj } } });
    if (atual && ts < (atual.reportEm?.getTime() ?? 0)) { conta.ignorados++; continue; }
    if (DRY) { atual ? conta.atualizados++ : conta.novos++; continue; }
    const data = {
      companyName: r.companyName || 'Empresa', priority: r.priority || 'Regular', exigivel: new Prisma.Decimal(Number(r.exigibleAmount || 0).toFixed(2)),
      reportEm: ts ? new Date(ts) : null, fileName: r.fileName || null, dados: r, importadoEm: r.importedAt ? new Date(r.importedAt) : new Date(),
      importadoPor: 'Importação do painel', empresaId: a.empresaId,
    };
    if (atual) { await prisma.sitFiscalRelatorio.update({ where: { id: atual.id }, data }); conta.atualizados++; }
    else { await prisma.sitFiscalRelatorio.create({ data: { escritorioId: a.escritorioId, cnpj, ...data } }); conta.novos++; }
  }
}
console.log(`${DRY ? '[SIMULAÇÃO] ' : ''}Relatórios: ${conta.novos} novo(s), ${conta.atualizados} atualizado(s), ${conta.ignorados} ignorado(s) (havia mais recente); ${conta.semEmpresa} sem empresa cadastrada (foram pela carteira do painel).`);
console.log('Por escritório:', conta.porEscritorio);

// ─── Opção pelo Simples / SIMEI (cartão CNPJ) ───────────────────────────────
let optAtual = 0;
for (const c of clientes) {
  if (!c.simplesOptante && !c.simeiOptante) continue;
  const alvos = porCnpj.get(dig(c.documento)) || [];
  const legado = await prisma.empresa.findMany({ where: { legadoAtuanId: c.id, deletedAt: null }, select: { id: true } });
  const empIds = [...new Set([...alvos.map((a) => a.empresaId), ...legado.map((e) => e.id)])];
  for (const id of empIds) {
    optAtual++;
    if (DRY) continue;
    await prisma.empresa.update({ where: { id }, data: {
      simplesOptante: c.simplesOptante || null, simplesDesde: c.simplesDesde || null, simplesSaida: c.simplesSaida || null,
      simeiOptante: c.simeiOptante || null, simeiDesde: c.simeiDesde || null, simeiSaida: c.simeiSaida || null,
      receitaEm: c.receitaEm ? new Date(c.receitaEm) : null,
    } });
  }
}
console.log(`${DRY ? '[SIMULAÇÃO] ' : ''}Optantes (cartão CNPJ): ${optAtual} empresa(s) atualizada(s).`);
await prisma.$disconnect();
