// Alvaras e regularizacao — regras transcritas do painel da Atuan (painel/js/paginas-alvaras.js).
// Especificacao: Downloads/atuan/_painel-servidor-20261022/SPEC-ALVARAS.md. Bugs do painel corrigidos aqui:
// renovacao pelo Kanban renova a licenca existente (nao cria outra), cartoes "pai" ocultos nao contam,
// trava da taxa vale tambem para ir direto a Concluido, Puxar concluidos usa a regra do Societario,
// excluir licenca solta os cartoes que apontavam para ela.
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { AppError, Errors } from '../../lib/errors.js';

export const LICENCAS = ['Alvará de Funcionamento', 'Bombeiros (AVCB)', 'Vigilância Sanitária', 'Polícia Civil', 'Ambiental', 'Outro'];
export const LIC_SITUACOES = ['Em preparação', 'Protocolado / em análise', 'Em exigência', 'Deferido / emitido', 'A renovar', 'Vencido', 'Indeferido'];
export const ETAPAS_LEGAL = ['A iniciar', 'Consulta / protocolo', 'Aguardando análise do órgão', 'Alvará emitido', 'Concluído'];
export const MOTIVOS_INATIVACAO = ['Baixa / encerramento da empresa', 'Empresa inativa (sem movimento)', 'Cliente saiu do escritório', 'Outro'];
const [A_INICIAR, CONSULTA, , EMITIDO, CONCLUIDO] = ETAPAS_LEGAL;

export interface Ator { id?: string; nome?: string }
type Tx = Prisma.TransactionClient;

const hojeData = () => new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) + 'T00:00:00Z');
const dataISO = (v?: string | null) => (v ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null);
const fmtBR = (d?: Date | null) => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '—');
const maisUmAno = (d: Date) => { const n = new Date(d); n.setUTCFullYear(n.getUTCFullYear() + 1); return n; };

async function hist(tx: Tx, escritorioId: string, ator: Ator, acao: string, detalhe: string, ids: { licencaId?: string | null; legalizacaoId?: string | null } = {}) {
  await tx.alvHistorico.create({ data: { escritorioId, usuarioId: ator.id ?? null, usuarioNome: ator.nome ?? null, acao, detalhe, licencaId: ids.licencaId ?? null, legalizacaoId: ids.legalizacaoId ?? null } });
}
async function nomeEmpresa(tx: Tx, empresaId?: string | null, fallback?: string | null) {
  if (!empresaId) return fallback || 'Cliente';
  const e = await tx.empresa.findUnique({ where: { id: empresaId }, select: { razaoSocial: true } });
  return e?.razaoSocial ?? fallback ?? 'Cliente';
}
const EMPRESA_SEL = { id: true, razaoSocial: true, ativo: true, cnaes: true, identificadores: { where: { tipo: 'CNPJ' as const }, select: { valor: true } } } satisfies Prisma.EmpresaSelect;
const resumoEmpresa = (e: Prisma.EmpresaGetPayload<{ select: typeof EMPRESA_SEL }> | null) =>
  e ? { id: e.id, razaoSocial: e.razaoSocial, ativo: e.ativo, cnaes: e.cnaes, cnpj: e.identificadores[0]?.valor ?? '' } : null;

// ─── Licencas ───────────────────────────────────────────────────────────────
export async function listarLicencas(escritorioId: string) {
  const [ls, conclusoes] = await Promise.all([
    prisma.licenca.findMany({ where: { escritorioId }, include: { empresa: { select: EMPRESA_SEL } }, orderBy: { createdAt: 'asc' } }),
    prisma.legalizacao.findMany({ where: { escritorioId, licencaId: { not: null } }, select: { licencaId: true, renovadoEm: true, concluidoEm: true } }),
  ]);
  const ultima = new Map<string, Date>();
  for (const c of conclusoes) {
    const d = c.renovadoEm ?? c.concluidoEm;
    if (d && (!ultima.get(c.licencaId!) || d > ultima.get(c.licencaId!)!)) ultima.set(c.licencaId!, d);
  }
  return ls.map(({ empresa, ...l }) => ({ ...l, taxa: l.taxa == null ? null : Number(l.taxa), empresa: resumoEmpresa(empresa), ultimaConclusao: ultima.get(l.id) ?? null }));
}

export interface LicencaInput {
  empresaId: string; tipo?: string; orgao?: string | null; protocolo?: string | null; situacao?: string; emissao?: string | null;
  validade?: string | null; responsavel?: string | null; taxa?: number | null; observacao?: string | null;
}
export async function salvarLicenca(escritorioId: string, ator: Ator, id: string | null, f: LicencaInput) {
  if (!f.empresaId) throw Errors.validacao('Preencha: Cliente.');
  const emp = await prisma.empresa.findFirst({ where: { id: f.empresaId, escritorioId }, select: { razaoSocial: true } });
  if (!emp) throw Errors.validacao('Cliente não encontrado.');
  const data = {
    empresaId: f.empresaId, clienteNome: emp.razaoSocial, tipo: LICENCAS.includes(f.tipo ?? '') ? f.tipo! : 'Alvará de Funcionamento',
    orgao: f.orgao || null, protocolo: f.protocolo?.trim() || null, situacao: LIC_SITUACOES.includes(f.situacao ?? '') ? f.situacao! : 'Em preparação',
    emissao: dataISO(f.emissao), validade: dataISO(f.validade), responsavel: f.responsavel || null, taxa: f.taxa ?? null, observacao: f.observacao || null,
  };
  return prisma.$transaction(async (tx) => {
    if (id) {
      const atual = await tx.licenca.findFirst({ where: { id, escritorioId } });
      if (!atual) throw Errors.naoEncontrado('Licença');
      const l = await tx.licenca.update({ where: { id }, data });
      await hist(tx, escritorioId, ator, 'Alvará / licença — alterado', `${emp.razaoSocial} — ${l.tipo}`, { licencaId: id });
      return l;
    }
    const l = await tx.licenca.create({ data: { escritorioId, ...data } });
    await hist(tx, escritorioId, ator, 'Alvará / licença — criado', `${emp.razaoSocial} — ${l.tipo}`, { licencaId: l.id });
    return l;
  });
}

export async function observacaoLicenca(escritorioId: string, id: string, observacao: string) {
  const r = await prisma.licenca.updateMany({ where: { id, escritorioId }, data: { observacao: observacao.trim() || null } });
  if (!r.count) throw Errors.naoEncontrado('Licença');
  return { ok: true };
}

export async function excluirLicenca(escritorioId: string, ator: Ator, id: string) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.licenca.findFirst({ where: { id, escritorioId } });
    if (!l) throw Errors.naoEncontrado('Licença');
    await tx.legalizacao.updateMany({ where: { escritorioId, licencaId: id }, data: { licencaId: null } });
    await tx.licenca.delete({ where: { id } });
    await hist(tx, escritorioId, ator, 'Alvará / licença — excluído', `${await nomeEmpresa(tx, l.empresaId, l.clienteNome)} — ${l.tipo}`);
    return { excluido: true };
  });
}

export async function renovarUmAno(escritorioId: string, ator: Ator, id: string) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.licenca.findFirst({ where: { id, escritorioId } });
    if (!l) throw Errors.naoEncontrado('Licença');
    if (!l.validade) throw Errors.validacao('Cadastre a validade antes de renovar.');
    const nova = maisUmAno(l.validade);
    await tx.licenca.update({ where: { id }, data: { validade: nova, situacao: 'Deferido / emitido' } });
    await hist(tx, escritorioId, ator, 'Alvará renovado', `${await nomeEmpresa(tx, l.empresaId, l.clienteNome)} — ${l.tipo} → ${fmtBR(nova)}`, { licencaId: id });
    return { validade: nova };
  });
}

// Renovacao pelo Kanban: entra direto em "Consulta / protocolo" ligada a licenca (o painel deixava em
// "A iniciar" e, ao marcar alvaras, criava uma licenca nova em vez de renovar esta)
export async function mandarParaKanban(escritorioId: string, ator: Ator, id: string) {
  return prisma.$transaction(async (tx) => {
    const l = await tx.licenca.findFirst({ where: { id, escritorioId } });
    if (!l) throw Errors.naoEncontrado('Licença');
    const aberto = await tx.legalizacao.findFirst({ where: { escritorioId, licencaId: id, etapa: { not: CONCLUIDO } } });
    if (aberto) throw Errors.validacao('Este alvará já tem um processo aberto no Kanban.');
    const nome = await nomeEmpresa(tx, l.empresaId, l.clienteNome);
    const c = await tx.legalizacao.create({
      data: {
        escritorioId, empresaId: l.empresaId, clienteNome: nome, licencaId: id, tipo: l.tipo, orgao: l.orgao, protocolo: l.protocolo,
        tipoProcesso: 'Renovação', prazo: l.validade, etapa: CONSULTA,
        observacao: `Renovação — ${l.tipo}${l.validade ? ` · vence ${fmtBR(l.validade)}` : ''}`,
      },
    });
    await hist(tx, escritorioId, ator, 'Renovação enviada ao Kanban', `${nome} — ${l.tipo}`, { licencaId: id, legalizacaoId: c.id });
    return c;
  });
}

export async function corrigirTipo(escritorioId: string, ator: Ator, de: string, para: string) {
  if (!LICENCAS.includes(para)) throw Errors.validacao('Tipo de destino inválido.');
  return prisma.$transaction(async (tx) => {
    const r = await tx.licenca.updateMany({ where: { escritorioId, tipo: de }, data: { tipo: para } });
    await hist(tx, escritorioId, ator, 'Tipo de licença corrigido em lote', `${r.count} registro(s): ${de || '—'} → ${para}`);
    return { alterados: r.count };
  });
}

// Inativacao por empresa: todas as licencas e legalizacoes dela
export async function inativarEmpresa(escritorioId: string, ator: Ator, empresaId: string, motivo: string | null) {
  const nome = await nomeEmpresa(prisma, empresaId);
  return prisma.$transaction(async (tx) => {
    const data = motivo
      ? { inativo: true, inativoEm: hojeData(), inativoMotivo: MOTIVOS_INATIVACAO.includes(motivo) ? motivo : 'Outro' }
      : { inativo: false, inativoEm: null, inativoMotivo: null };
    const a = await tx.licenca.updateMany({ where: { escritorioId, empresaId }, data });
    const b = await tx.legalizacao.updateMany({ where: { escritorioId, empresaId }, data });
    await hist(tx, escritorioId, ator, motivo ? 'Alvarás inativados' : 'Alvarás reativados', motivo ? `${nome} — ${motivo}` : nome);
    return { licencas: a.count, legalizacoes: b.count };
  });
}

// Importacao de planilha (linhas ja lidas no navegador). Chave: empresa + tipo + protocolo.
export interface LinhaImport { cliente: string; tipo?: string; protocolo?: string; orgao?: string; validade?: string; situacao?: string; responsavel?: string; observacao?: string }
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function tipoDeTexto(t?: string) {
  const s = norm(t);
  const exato = LICENCAS.find((l) => norm(l) === s);
  if (exato) return exato;
  if (/avcb|bombeir/.test(s)) return 'Bombeiros (AVCB)';
  if (/sanit|visa/.test(s)) return 'Vigilância Sanitária';
  if (/policia/.test(s)) return 'Polícia Civil';
  if (/ambient/.test(s)) return 'Ambiental';
  return 'Alvará de Funcionamento';
}
export async function importar(escritorioId: string, ator: Ator, linhas: LinhaImport[]) {
  const empresas = await prisma.empresa.findMany({ where: { escritorioId, deletedAt: null }, select: { id: true, razaoSocial: true, nomeFantasia: true } });
  const porNome = new Map<string, { id: string; razaoSocial: string }>();
  for (const e of empresas) { porNome.set(norm(e.razaoSocial), e); if (e.nomeFantasia) porNome.set(norm(e.nomeFantasia), e); }
  let novos = 0, atualizados = 0, ignoradas = 0; const semCadastro = new Set<string>();
  await prisma.$transaction(async (tx) => {
    for (const r of linhas) {
      if (!String(r.cliente ?? '').trim()) { ignoradas++; continue; }
      const e = porNome.get(norm(r.cliente));
      if (!e) { semCadastro.add(String(r.cliente).trim()); ignoradas++; continue; }
      const tipo = tipoDeTexto(r.tipo);
      const proto = String(r.protocolo ?? '').trim();
      const existentes = await tx.licenca.findMany({ where: { escritorioId, empresaId: e.id, tipo } });
      const atual = existentes.find((l) => norm(l.protocolo) === norm(proto));
      const validade = dataBRouISO(r.validade);
      const data: Prisma.LicencaUncheckedUpdateInput = {};
      if (r.orgao?.trim()) data.orgao = r.orgao.trim();
      if (validade) data.validade = validade;
      if (r.situacao?.trim()) data.situacao = situacaoDeTexto(r.situacao);
      if (r.responsavel?.trim()) data.responsavel = r.responsavel.trim();
      if (r.observacao?.trim()) data.observacao = r.observacao.trim();
      if (atual) { await tx.licenca.update({ where: { id: atual.id }, data }); atualizados++; }
      else {
        await tx.licenca.create({ data: { escritorioId, empresaId: e.id, clienteNome: e.razaoSocial, tipo, protocolo: proto || null, situacao: 'Em preparação', ...(data as object) } });
        novos++;
      }
    }
    await hist(tx, escritorioId, ator, 'Alvarás importados por planilha', `${novos} novos, ${atualizados} atualizados`);
  });
  return { novos, atualizados, ignoradas, semCadastro: [...semCadastro] };
}
function situacaoDeTexto(s: string) {
  return LIC_SITUACOES.find((x) => norm(x) === norm(s)) ?? LIC_SITUACOES.find((x) => norm(x).startsWith(norm(s).slice(0, 6))) ?? 'Em preparação';
}
// Aceita dd/mm/aaaa ou aaaa-mm-dd. Data invalida = nao mexe (o painel apagava a validade)
function dataBRouISO(v?: string) {
  const s = String(v ?? '').trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}

// ─── Legalizacoes (Kanban) ──────────────────────────────────────────────────
export async function listarLegalizacoes(escritorioId: string) {
  const ls = await prisma.legalizacao.findMany({ where: { escritorioId }, include: { empresa: { select: EMPRESA_SEL } }, orderBy: { createdAt: 'asc' } });
  return ls.map(({ empresa, ...l }) => ({ ...l, empresa: resumoEmpresa(empresa) }));
}

export async function novaLegalizacao(escritorioId: string, ator: Ator, empresaId: string) {
  const nome = await nomeEmpresa(prisma, empresaId);
  return prisma.$transaction(async (tx) => {
    const c = await tx.legalizacao.create({
      data: { escritorioId, empresaId, clienteNome: nome, tipoProcesso: 'Abertura', etapa: A_INICIAR, alvarasPrevistos: [], alvarasGerados: [] },
    });
    await hist(tx, escritorioId, ator, 'Legalização criada', nome, { legalizacaoId: c.id });
    return c;
  });
}

export interface FichaCartao { alvaras?: string[]; tipo?: string; observacao?: string | null; protocolo?: string | null; orgao?: string | null }
export async function salvarCartao(escritorioId: string, ator: Ator, id: string, f: FichaCartao) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.legalizacao.findFirst({ where: { id, escritorioId } });
    if (!c) throw Errors.naoEncontrado('Cartão');
    const nome = await nomeEmpresa(tx, c.empresaId, c.clienteNome);
    if (c.etapa === A_INICIAR) {
      const marcados = (f.alvaras ?? []).filter((a) => LICENCAS.includes(a));
      if (!marcados.length) throw Errors.validacao('Marque ao menos um alvará que esta empresa vai precisar.');
      const gerados = new Set((c.alvarasGerados as string[] | null) ?? []);
      let n = 0;
      for (const tipo of marcados) {
        if (gerados.has(tipo)) continue;
        // Se a empresa ja tem licenca ativa deste tipo, o cartao renova essa (nao duplica)
        const lic = c.empresaId ? await tx.licenca.findFirst({ where: { escritorioId, empresaId: c.empresaId, tipo, inativo: false }, orderBy: { createdAt: 'desc' } }) : null;
        await tx.legalizacao.create({
          data: {
            escritorioId, empresaId: c.empresaId, clienteNome: nome, tipo, orgao: lic?.orgao ?? null, protocolo: c.protocolo, tipoProcesso: c.tipoProcesso || 'Abertura',
            etapa: CONSULTA, paiId: c.id, processoId: c.processoId, licencaId: lic?.id ?? null, observacao: c.observacao,
          },
        });
        gerados.add(tipo); n++;
      }
      await tx.legalizacao.update({ where: { id }, data: { alvarasPrevistos: marcados, alvarasGerados: [...gerados], observacao: f.observacao?.trim() || null, ocultoNoIniciar: true } });
      await hist(tx, escritorioId, ator, 'Alvarás definidos e enviados à legalização', nome, { legalizacaoId: id });
      return { gerados: n };
    }
    const data: Prisma.LegalizacaoUpdateInput = { observacao: f.observacao?.trim() || null };
    if (c.etapa === CONSULTA && f.tipo && LICENCAS.includes(f.tipo)) data.tipo = f.tipo;
    if (f.protocolo !== undefined) data.protocolo = f.protocolo?.trim() || null;
    if (f.orgao !== undefined) data.orgao = f.orgao || null;
    await tx.legalizacao.update({ where: { id }, data });
    await hist(tx, escritorioId, ator, 'Cartão de legalização atualizado', nome, { legalizacaoId: id });
    return { gerados: 0 };
  });
}

export async function marcarTaxa(escritorioId: string, ator: Ator, id: string, paga: boolean) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.legalizacao.findFirst({ where: { id, escritorioId } });
    if (!c) throw Errors.naoEncontrado('Cartão');
    await tx.legalizacao.update({ where: { id }, data: { taxaPaga: paga, taxaPagaEm: paga ? hojeData() : null } });
    await hist(tx, escritorioId, ator, paga ? 'Taxa paga' : 'Taxa desmarcada', await nomeEmpresa(tx, c.empresaId, c.clienteNome), { legalizacaoId: id });
    return { ok: true };
  });
}

export async function definirVencimento(escritorioId: string, ator: Ator, id: string, vencimento: string | null) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.legalizacao.findFirst({ where: { id, escritorioId } });
    if (!c) throw Errors.naoEncontrado('Cartão');
    await tx.legalizacao.update({ where: { id }, data: { vencimento: dataISO(vencimento) } });
    await hist(tx, escritorioId, ator, 'Validade da nova licença informada', `${await nomeEmpresa(tx, c.empresaId, c.clienteNome)} → ${vencimento ? fmtBR(dataISO(vencimento)) : '(apagada)'}`, { legalizacaoId: id });
    return { ok: true };
  });
}

export async function moverCartao(escritorioId: string, ator: Ator, id: string, destino: string) {
  if (!ETAPAS_LEGAL.includes(destino)) throw Errors.validacao('Etapa inválida.');
  return prisma.$transaction(async (tx) => {
    const c = await tx.legalizacao.findFirst({ where: { id, escritorioId } });
    if (!c) throw Errors.naoEncontrado('Cartão');
    if (c.etapa === destino) return { aviso: '' };
    if (c.etapa === A_INICIAR) throw Errors.validacao('Clique na empresa e marque os alvarás — cada um vira um cartão em “Consulta / protocolo”.');
    const iDest = ETAPAS_LEGAL.indexOf(destino);
    if (iDest >= ETAPAS_LEGAL.indexOf(EMITIDO) && !c.taxaPaga && ETAPAS_LEGAL.indexOf(c.etapa) < ETAPAS_LEGAL.indexOf(EMITIDO)) {
      throw Errors.validacao(`Marque “Taxa paga” antes de mover para “${destino}”.`);
    }
    if (destino === CONCLUIDO && !c.vencimento) throw new AppError(422, 'FALTA_VENCIMENTO', 'Informe a data de vencimento (validade da nova licença) antes de mover para Concluído.');
    const nome = await nomeEmpresa(tx, c.empresaId, c.clienteNome);
    let aviso = '';
    if (destino === CONCLUIDO) aviso = await concluir(tx, escritorioId, c, nome);
    else if (c.etapa === CONCLUIDO) aviso = await desfazerConclusao(tx, c);
    await tx.legalizacao.update({ where: { id }, data: { etapa: destino } });
    await hist(tx, escritorioId, ator, 'Legalização mudou de etapa', `${nome}: ${c.etapa} → ${destino}`, { legalizacaoId: id });
    return { aviso };
  });
}

// Ao entrar em Concluido: cria a licenca (ou renova a vinculada) com a validade digitada no cartao
async function concluir(tx: Tx, escritorioId: string, c: Prisma.LegalizacaoGetPayload<object>, nome: string) {
  if (c.renovadoEm) return '';
  const hoje = hojeData();
  const lic = c.licencaId ? await tx.licenca.findFirst({ where: { id: c.licencaId, escritorioId } }) : null;
  let validade: Date;
  if (!lic) {
    validade = c.vencimento ?? maisUmAno(hoje);
    const nova = await tx.licenca.create({
      data: {
        escritorioId, empresaId: c.empresaId, clienteNome: nome, tipo: c.tipo || 'Alvará de Funcionamento', orgao: c.orgao, protocolo: c.protocolo,
        situacao: 'Deferido / emitido', validade, emissao: hoje, observacao: c.observacao,
      },
    });
    await tx.legalizacao.update({ where: { id: c.id }, data: { licencaId: nova.id, licencaCriada: true, concluidoEm: c.concluidoEm ?? new Date(), renovadoEm: hoje } });
  } else {
    validade = c.vencimento ?? maisUmAno(lic.validade ?? hoje);
    const obs = c.observacao && !(lic.observacao ?? '').includes(c.observacao) ? [lic.observacao, c.observacao].filter(Boolean).join('\n') : lic.observacao;
    await tx.licenca.update({ where: { id: lic.id }, data: { validade, situacao: 'Deferido / emitido', ...(c.protocolo ? { protocolo: c.protocolo } : {}), observacao: obs } });
    await tx.legalizacao.update({
      where: { id: c.id },
      data: {
        licencaCriada: false, concluidoEm: c.concluidoEm ?? new Date(), renovadoEm: hoje,
        validadeAnterior: lic.validade ? lic.validade.toISOString().slice(0, 10) : '', situacaoAnterior: lic.situacao, obsAnterior: lic.observacao ?? '',
      },
    });
  }
  return `Licença registrada — próximo vencimento em ${fmtBR(validade)}.`;
}
async function desfazerConclusao(tx: Tx, c: Prisma.LegalizacaoGetPayload<object>) {
  if (!c.renovadoEm) { await tx.legalizacao.update({ where: { id: c.id }, data: { concluidoEm: null } }); return ''; }
  if (c.licencaCriada && c.licencaId) {
    await tx.licenca.deleteMany({ where: { id: c.licencaId } });
    await tx.legalizacao.update({ where: { id: c.id }, data: { licencaId: null } });
  } else if (c.licencaId) {
    await tx.licenca.updateMany({
      where: { id: c.licencaId },
      data: { validade: c.validadeAnterior ? dataISO(c.validadeAnterior) : null, situacao: c.situacaoAnterior || 'Em preparação', observacao: c.obsAnterior || null },
    });
  }
  await tx.legalizacao.update({ where: { id: c.id }, data: { renovadoEm: null, licencaCriada: false, concluidoEm: null } });
  return 'Conclusão desfeita — a licença voltou como estava.';
}

export async function tirarDoQuadro(escritorioId: string, ator: Ator, id: string) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.legalizacao.findFirst({ where: { id, escritorioId } });
    if (!c) throw Errors.naoEncontrado('Cartão');
    await tx.legalizacao.updateMany({ where: { escritorioId, paiId: id }, data: { paiId: null } });
    await tx.legalizacao.delete({ where: { id } });
    await hist(tx, escritorioId, ator, 'Legalização retirada do Kanban', await nomeEmpresa(tx, c.empresaId, c.clienteNome));
    return { ok: true };
  });
}

// Processos do Societario concluidos que precisam de alvara e ainda nao tem cartao (regra unica com o Societario)
export async function pendentesDoSocietario(escritorioId: string) {
  const ps = await prisma.socProcesso.findMany({
    where: { escritorioId, situacao: 'Finalizado', OR: [{ servico: 'Abertura' }, { servico: 'Alteração', OR: [{ mudaEndereco: true }, { mudaAtividade: true }] }] },
    select: { id: true, codigo: true, empresaId: true, servico: true, protocoloRegin: true, mudaEndereco: true, mudaAtividade: true },
  });
  const comCartao = new Set((await prisma.legalizacao.findMany({ where: { escritorioId, processoId: { in: ps.map((p) => p.id) } }, select: { processoId: true } })).map((x) => x.processoId));
  return ps.filter((p) => !comCartao.has(p.id));
}
export async function puxarConcluidos(escritorioId: string, ator: Ator) {
  const ps = await pendentesDoSocietario(escritorioId);
  if (!ps.length) return { criados: 0 };
  await prisma.$transaction(async (tx) => {
    for (const p of ps) {
      const nome = await nomeEmpresa(tx, p.empresaId);
      const muda = p.servico === 'Alteração' ? ` — alteração de ${[p.mudaEndereco ? 'endereço' : '', p.mudaAtividade ? 'atividade' : ''].filter(Boolean).join(' e ')}` : '';
      await tx.legalizacao.create({
        data: {
          escritorioId, empresaId: p.empresaId, clienteNome: nome, processoId: p.id, tipo: 'Alvará de Funcionamento', protocolo: p.protocoloRegin,
          tipoProcesso: p.servico === 'Alteração' ? 'Alteração' : 'Abertura', etapa: A_INICIAR, observacao: `Originado do Societário (${p.codigo})${muda}`,
        },
      });
    }
    await hist(tx, escritorioId, ator, 'Concluídos puxados para a legalização', `${ps.length} processo(s)`);
  });
  return { criados: ps.length };
}

// ─── Configuracao (calculadora + checklists) ────────────────────────────────
export async function obterConfig(escritorioId: string) {
  const c = await prisma.alvConfig.findUnique({ where: { escritorioId } });
  return { parametros: (c?.parametros ?? {}) as Record<string, unknown>, checklists: (c?.checklists ?? {}) as Record<string, unknown> };
}
export async function salvarConfig(escritorioId: string, ator: Ator, b: { parametros?: unknown; checklists?: unknown; acao?: string; detalhe?: string }) {
  const data: Prisma.AlvConfigUpdateInput = {};
  if (b.parametros !== undefined) data.parametros = b.parametros as Prisma.InputJsonValue;
  if (b.checklists !== undefined) data.checklists = b.checklists as Prisma.InputJsonValue;
  await prisma.alvConfig.upsert({ where: { escritorioId }, create: { escritorioId, parametros: (b.parametros ?? {}) as Prisma.InputJsonValue, checklists: (b.checklists ?? {}) as Prisma.InputJsonValue }, update: data });
  if (b.acao) await prisma.$transaction((tx) => hist(tx, escritorioId, ator, b.acao!, b.detalhe ?? ''));
  return obterConfig(escritorioId);
}

export async function historico(escritorioId: string) {
  return prisma.alvHistorico.findMany({ where: { escritorioId }, orderBy: { createdAt: 'desc' }, take: 300 });
}

// Empresas para os selects (todas as da carteira + as que ja tem licenca)
export async function empresasParaSelect(escritorioId: string) {
  const es = await prisma.empresa.findMany({ where: { escritorioId, deletedAt: null }, select: EMPRESA_SEL, orderBy: { razaoSocial: 'asc' } });
  return es.map(resumoEmpresa);
}
