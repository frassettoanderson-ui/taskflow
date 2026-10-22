// Importa o Societario do painel antigo da Atuan (base unica /var/lib/atuan-dados/base.json)
// para o Obrigo — SO a frente ATUAN Digital (decisao do usuario em 22/10/2026).
// Idempotente pelo legadoId. Uso (na VPS, em server/):
//   node scripts/importar-atuan-societario.mjs --dry      (so mostra o que faria)
//   node scripts/importar-atuan-societario.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const DRY = process.argv.includes('--dry');
const ESCRITORIO = process.env.ATUAN_ESCRITORIO_ID || 'cmuh6l6a8000011mstpvmjte3';
const BASE = process.env.ATUAN_BASE || '/var/lib/atuan-dados/base.json';
const FORMS = process.env.ATUAN_FORM_ARQUIVO || '/var/lib/atuan-formularios/formularios.json';
const STORAGE = path.resolve(process.env.STORAGE_ROOT || './storage');
const prisma = new PrismaClient();

const dig = (v) => String(v ?? '').replace(/\D/g, '');
const data = (v) => (v ? new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v) : null);
const frente = (c) => (c?.grupo === 'digital' ? 'digital' : c?.grupo === 'esporadico' ? 'esporadico' : 'nauta');

const p = JSON.parse(fs.readFileSync(BASE, 'utf8')).pacote.dados;
const clientes = new Map(p.clientes.map((c) => [c.id, c]));
const frenteProc = (pr) => (pr.grupo === 'digital' || pr.grupo === 'nauta' ? pr.grupo : frente(clientes.get(pr.clienteId)));
const procs = p.processos.filter((pr) => frenteProc(pr) === 'digital');
const forms = (p.socFormularios ?? []).filter((f) => !f.processoId || procs.some((x) => x.id === f.processoId));
const servForms = fs.existsSync(FORMS) ? JSON.parse(fs.readFileSync(FORMS, 'utf8')) : [];
console.log(`Painel: ${procs.length} processo(s) Atuan, ${forms.length} formulário(s).`);

// ─── Empresas ───────────────────────────────────────────────────────────────
const empresaDe = new Map(); // clienteId do painel -> Empresa.id
let criadas = 0, ligadas = 0;
async function empresaPara(clienteId) {
  if (!clienteId) return null;
  if (empresaDe.has(clienteId)) return empresaDe.get(clienteId);
  const c = clientes.get(clienteId);
  if (!c) return null;
  const cnpj = dig(c.documento);
  let id = null;
  const jaImportada = await prisma.empresa.findFirst({ where: { escritorioId: ESCRITORIO, legadoAtuanId: c.id, deletedAt: null }, select: { id: true } });
  if (jaImportada) id = jaImportada.id;
  if (!id && cnpj.length === 14) {
    const i = await prisma.empresaIdentificador.findFirst({ where: { escritorioId: ESCRITORIO, tipo: 'CNPJ', valor: cnpj, empresa: { deletedAt: null } }, select: { empresaId: true } });
    if (i) id = i.empresaId;
  }
  if (id) {
    ligadas++;
    // empresa que ja esta no Obrigo continua visivel; so ganha a frente/MEI do painel
    if (!DRY) await prisma.empresa.update({ where: { id }, data: { frente: frente(c), carteiraMei: !!c.carteiraMei, legadoAtuanId: c.id } });
  } else {
    criadas++;
    if (!DRY) {
      const ult = await prisma.empresa.aggregate({ where: { escritorioId: ESCRITORIO }, _max: { numero: true } });
      const e = await prisma.empresa.create({
        data: {
          escritorioId: ESCRITORIO, razaoSocial: c.nome || 'Empresa sem nome', nomeFantasia: c.fantasia || null, numero: (ult._max.numero ?? 0) + 1,
          emailPrincipal: c.email || null, telefone: c.telefone || null, cidade: c.cidade || null, uf: c.uf || null, endereco: c.endereco || null,
          atividade: c.cnaes || null, anotacoes: [c.observacao, 'Importado do painel da Atuan (Societário).'].filter(Boolean).join(' · '),
          ativo: c.situacao !== 'Encerrado', emAbertura: cnpj.length !== 14, frente: frente(c), carteiraMei: !!c.carteiraMei,
          naCarteira: c.carteira !== false, legadoAtuanId: c.id, contabilidade: 'atuan',
          identificadores: cnpj.length === 14 ? { create: [{ escritorioId: ESCRITORIO, tipo: 'CNPJ', valor: cnpj }] } : undefined,
        },
      });
      id = e.id;
    } else id = `(nova:${c.nome})`;
  }
  empresaDe.set(clienteId, id);
  return id;
}

// ─── Processos ──────────────────────────────────────────────────────────────
const ETAPAS = ['Formulário', 'Viabilidade', 'Documento Básico', 'Requerimento', 'Pagamento', 'Assinatura e arquivamento'];
const procDe = new Map(); let novosP = 0, existentesP = 0;
for (const pr of procs) {
  const existe = await prisma.socProcesso.findFirst({ where: { escritorioId: ESCRITORIO, legadoId: pr.id }, select: { id: true } });
  if (existe) { procDe.set(pr.id, existe.id); existentesP++; continue; }
  const empresaId = await empresaPara(pr.clienteId);
  novosP++;
  if (DRY) { console.log(`  processo ${pr.codigo} · ${clientes.get(pr.clienteId)?.nome ?? '?'} · ${pr.servico} · ${pr.situacao === 'Finalizado' ? 'Concluído' : pr.etapa}`); continue; }
  let codigo = pr.codigo || 'S/N';
  if (await prisma.socProcesso.findFirst({ where: { escritorioId: ESCRITORIO, codigo } })) codigo = `${codigo}-A`;
  const fin = pr.situacao === 'Finalizado';
  const novo = await prisma.socProcesso.create({
    data: {
      escritorioId: ESCRITORIO, empresaId: empresaId && !String(empresaId).startsWith('(') ? empresaId : null, codigo,
      grupo: ['digital', 'nauta', 'esporadico'].includes(pr.grupo) ? pr.grupo : null, servico: pr.servico || 'Abertura',
      natureza: pr.natureza || '', etapa: ETAPAS.includes(pr.etapa) ? pr.etapa : 'Formulário', situacao: pr.situacao || 'Em análise',
      responsavel: pr.responsavel || null, dependeDe: pr.dependeDe || 'Escritório', prazo: data(pr.prazo), proximaAcao: pr.proximaAcao || null,
      honorario: Number(pr.honorario) || 0, honorarioSit: pr.honorarioSit || 'Não informado', cpf: pr.cpf || null, senhaGov: pr.senhaGov || null,
      observacao: pr.observacao || null, protocoloRegin: pr.protocoloRegin || null, requerimento: pr.requerimento || null,
      pagamentoFeito: !!pr.pagamentoFeito, mudaEndereco: !!pr.mudaEndereco, mudaAtividade: !!pr.mudaAtividade, mudaMunicipio: !!pr.mudaMunicipio,
      baixaCadEconomico: pr.baixaCadEconomico ?? null, baixaCadEconomicoEm: data(pr.baixaCadEconomicoEm), foraDoQuadro: !!pr.foraDoQuadro,
      ocultoAte: data(pr.ocultoAte), checklistDe: Array.isArray(pr.checklist) ? `${pr.natureza ?? ''}|${pr.servico ?? ''}` : null,
      concluidoEm: fin ? data(pr.concluidoEm) ?? data(pr.criadoEm) : null, encaminhadoEm: fin ? new Date() : null, // ja encaminhado no painel
      legadoId: pr.id, createdAt: data(pr.criadoEm) ?? new Date(),
      checklist: Array.isArray(pr.checklist) ? { create: pr.checklist.map((i, ordem) => ({ ordem, etapa: i.etapa, tarefa: i.tarefa, feito: !!i.feito, na: !!i.na, nota: i.nota || null })) } : undefined,
    },
  });
  procDe.set(pr.id, novo.id);
  // historico: entradas da auditoria do painel que citam o codigo
  const aud = (p.auditoria ?? []).filter((a) => pr.codigo && String(a.detalhe ?? '').includes(pr.codigo));
  if (aud.length) await prisma.socHistorico.createMany({ data: aud.map((a) => ({ escritorioId: ESCRITORIO, processoId: novo.id, usuarioNome: a.quem || null, acao: a.acao, detalhe: a.detalhe || null, createdAt: data(a.quando) ?? new Date() })) });
  await prisma.socHistorico.create({ data: { escritorioId: ESCRITORIO, processoId: novo.id, usuarioNome: 'Importação', acao: 'Importado do painel da Atuan', detalhe: pr.codigo } });
}

// ─── Formularios ────────────────────────────────────────────────────────────
let novosF = 0;
for (const f of forms) {
  const existe = await prisma.socFormulario.findFirst({ where: { escritorioId: ESCRITORIO, legadoId: f.id } });
  if (existe) continue;
  novosF++;
  if (DRY) { console.log(`  formulário ${f.empresa} · ${f.servico} · ${f.processoId ? 'aprovado' : 'aguardando'}`); continue; }
  const sv = f.servidorId ? servForms.find((r) => r.id === f.servidorId) : null;
  const novo = await prisma.socFormulario.create({
    data: {
      escritorioId: ESCRITORIO, servidorId: f.servidorId || null, protocolo: f.protocolo || null, recebidoEm: data(f.recebidoEm) ?? new Date(),
      enviadoEm: f.enviadoEm || null, servico: f.servico || 'Abertura', empresaNome: f.empresa || '—', contato: f.contato || null, telefone: f.telefone || null,
      dados: f.dados ?? {}, processoId: f.processoId ? procDe.get(f.processoId) ?? null : null,
      empresaId: f.clienteId ? await empresaPara(f.clienteId) : null, empresaNova: !!f.clienteNovo,
      aprovadoEm: data(f.aprovadoEm), aprovadoPor: f.aprovadoPor || null, legadoId: f.id,
    },
  });
  const doc = sv?.dados?.documento;
  if (doc?.dados) {
    const dir = path.join(STORAGE, 'escritorios', ESCRITORIO, 'societario', 'formularios');
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(doc.nome || '') || (doc.tipo === 'application/pdf' ? '.pdf' : '.jpg');
    const arq = path.join(dir, `${novo.id}${ext}`);
    const buf = Buffer.from(doc.dados, 'base64');
    fs.writeFileSync(arq, buf);
    await prisma.socFormulario.update({ where: { id: novo.id }, data: { documentoArquivo: arq, documentoNome: doc.nome, documentoTipo: doc.tipo, documentoTamanho: buf.length } });
  }
  if (novo.processoId) await prisma.socProcesso.update({ where: { id: novo.processoId }, data: { origemFormularioId: novo.id } });
}

console.log(`${DRY ? '[SIMULAÇÃO] ' : ''}Processos novos: ${novosP} (já importados: ${existentesP}) · formulários novos: ${novosF} · empresas ligadas pelo CNPJ: ${ligadas} · empresas criadas: ${criadas}`);
await prisma.$disconnect();
