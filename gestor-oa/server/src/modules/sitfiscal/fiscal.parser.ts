// Leitura do "Relatório de Situação Fiscal" da Receita (e-CAC) — porte fiel do FiscalView
// do painel da Atuan (fiscalview.html): mesmas regex, mesma classificação de risco.
// O texto sai do pdf.js 3.11.174 (a mesma versão que o painel usava no navegador), com a
// mesma montagem de linhas (item.str + quebra em hasEOL), para a leitura bater 1:1.
import { randomUUID } from 'node:crypto';

export interface Debito { description: string; reference: string; dueDate: string; original: number; amount: number; penalty: number; interest: number; status: string; note: string }
export interface Parcelamento { system: string; suspended: boolean; name: string; number?: string; count: number; suspendedValue: number; atrasoValue: number; modality: string; note?: string }
export interface Pgfn { number: string; process: string; source: string; status: string; system: string; suspended: boolean }
export interface RelatorioFiscal {
  id: string; companyName: string; cnpj: string; reportDateTime: string; fileName: string;
  municipality: string; uf: string; address: string; district: string; zipCode: string; responsible: string;
  cadastralStatus: string; legalNature: string; openingDate: string; cnae: string; companySize: string;
  simples: string; simei: string; certificateType: string; certificateIssue: string; certificateValidity: string; certificateCode: string;
  exigibleDebts: Debito[]; suspendedDebts: Debito[]; installmentGroups: Parcelamento[]; pgfnItems: Pgfn[]; pgfnClear: boolean;
  unknownPending: string[]; importedAt: string;
  // calculados por finalize()
  exigibleAmount: number; suspendedAmount: number; overdueInstallments: number; installmentSuspended: number; installmentActive: number;
  pgfnActiveItems: Pgfn[]; pgfnSuspendedItems: Pgfn[]; pgfnCount: number; reportTimestamp: number;
  priority: 'Crítico' | 'Atenção' | 'Regular'; reasons: string[]; summary: string; quality: number; qualityLabel: string;
}

const clean = (v: unknown = '') => String(v ?? '').replace(/\s+/g, ' ').trim();
const digits = (v: unknown = '') => String(v ?? '').replace(/\D/g, '');
const brl = (v = 0) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function money(v: unknown = ''): number { const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function fmtCnpj(v = ''): string { const n = digits(v).slice(0, 14); return n.length === 14 ? n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : v; }
export function dateBR(v: unknown = ''): Date | null {
  const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  return m ? new Date(+m[3]!, +m[2]! - 1, +m[1]!, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : null;
}
function one(t: string, r: RegExp, f = ''): string { const m = String(t).match(r); return m ? clean(m[1]) : f; }
function sec(t: string, start: RegExp, ends: RegExp[] = []): string {
  const m = t.match(start); if (!m || m.index == null) return '';
  const s = m.index + m[0].length; let e = t.length;
  for (const r of ends) { const n = t.slice(s).match(r); if (n && n.index != null) e = Math.min(e, s + n.index); }
  return t.slice(s, e);
}
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// Recalcula totais, risco, resumo e qualidade da extração (mesmos critérios do FiscalView).
export function finalize(o: Partial<RelatorioFiscal>): RelatorioFiscal {
  const r = { ...o, exigibleDebts: arr<Debito>(o.exigibleDebts), suspendedDebts: arr<Debito>(o.suspendedDebts), installmentGroups: arr<Parcelamento>(o.installmentGroups), pgfnItems: arr<Pgfn>(o.pgfnItems), unknownPending: arr<string>(o.unknownPending) } as RelatorioFiscal;
  r.exigibleAmount = r.exigibleDebts.reduce((s, d) => s + Number(d.amount || 0), 0);
  r.suspendedAmount = r.suspendedDebts.reduce((s, d) => s + Number(d.amount || 0), 0);
  r.overdueInstallments = r.installmentGroups.filter((g) => !g.suspended).reduce((s, d) => s + Number(d.count || 0), 0);
  r.installmentSuspended = r.installmentGroups.reduce((s, d) => s + Number(d.suspendedValue || 0), 0);
  r.installmentActive = r.installmentGroups.length;
  r.pgfnActiveItems = r.pgfnItems.filter((i) => !i.suspended);
  r.pgfnSuspendedItems = r.pgfnItems.filter((i) => i.suspended);
  r.pgfnCount = r.pgfnItems.length; r.reportTimestamp = dateBR(r.reportDateTime)?.getTime() || 0;
  const crit: string[] = [];
  if (r.exigibleAmount) crit.push('débitos exigíveis'); if (r.overdueInstallments) crit.push('parcelas em atraso');
  if (r.pgfnActiveItems.length) crit.push('inscrições ativas na PGFN'); if (r.unknownPending.length) crit.push('outras pendências (omissão de declaração / processo fiscal)');
  const att: string[] = [];
  if (r.suspendedAmount) att.push('valores suspensos, em análise ou a vencer');
  if (r.installmentSuspended || r.installmentActive) att.push('parcelamento(s) ativo(s)/com exigibilidade suspensa');
  if (r.pgfnSuspendedItems.length) att.push('inscrições na PGFN com exigibilidade suspensa');
  if (/positiva com efeitos/i.test(r.certificateType || '')) att.push('certidão positiva com efeitos de negativa');
  if (crit.length) { r.priority = 'Crítico'; r.reasons = crit; } else if (att.length) { r.priority = 'Atenção'; r.reasons = att; } else { r.priority = 'Regular'; r.reasons = ['sem pendências relevantes identificadas']; }
  const parts: string[] = [];
  if (r.exigibleAmount) parts.push(`${r.exigibleDebts.length} débito(s) exigível(is), totalizando ${brl(r.exigibleAmount)}`);
  if (r.suspendedAmount) parts.push(`${r.suspendedDebts.length} item(ns) suspenso(s), a vencer ou em análise, totalizando ${brl(r.suspendedAmount)}`);
  if (r.overdueInstallments) parts.push(`${r.overdueInstallments} parcela(s) em atraso`);
  if (r.installmentSuspended) parts.push(`${brl(r.installmentSuspended)} em parcelamento com exigibilidade suspensa`);
  if (r.pgfnCount) parts.push(`${r.pgfnCount} inscrição(ões) na PGFN`);
  r.summary = parts.length ? `Foram identificados ${parts.join(', ')}.` : 'Nenhuma pendência fiscal relevante foi identificada.';
  const checks = [r.companyName && r.companyName !== 'Empresa não identificada', digits(r.cnpj).length === 14, !!r.reportDateTime, !!r.uf, !!r.cadastralStatus, !!r.cnae, r.certificateType && r.certificateType !== 'Não identificada', r.reportTimestamp > 0];
  r.quality = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  r.qualityLabel = r.quality >= 90 ? 'Alta' : r.quality >= 70 ? 'Média' : 'Baixa';
  return r;
}

function parseRegime(t: string, start: string, end: string): string {
  const s = sec(t, new RegExp(start, 'i'), [new RegExp(end, 'i'), /Sócios e Administradores/i, /Certidão Emitida/i, /Diagnóstico Fiscal/i]);
  const rows = s.split(/\n+/).map(clean).filter((v) => /^\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}\/\d{2}\/\d{4})?$/.test(v));
  return rows.length ? (rows.at(-1)!.split(/\s+/).length === 1 ? 'Optante atual' : 'Período encerrado') : 'Não informado';
}

function cleanDebtDescription(value: string): string {
  let description = clean(value)
    .replace(/^.*?Situação\s+/i, '')
    .replace(/^.*?Página:\s*\d+\s*\/\s*\d+\s*/i, '')
    .replace(/^.*?INFORMAÇÕES DE APOIO PARA EMISSÃO DE CERTIDÃO\s*/i, '');
  const codeMatches = [...description.matchAll(/\b\d{4}-\d{2}\b/g)];
  if (codeMatches.length) description = description.slice(codeMatches.at(-1)!.index);
  else { const simpleIndex = description.toUpperCase().lastIndexOf('SIMPLES NAC.'); if (simpleIndex >= 0) description = description.slice(simpleIndex); }
  description = description.replace(/^CNPJ:\s*[\d./-]+\s*/i, '').replace(/\s+/g, ' ').trim();
  return description || 'Débito fiscal';
}

function parseDebts(content: string, statuses: string[]): Debito[] {
  const text = String(content).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const statusPattern = statuses.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const rowPattern = new RegExp(
    '(.{2,260}?)\\s+' + '(\\d{2}\\/(?:\\d{2}\\/)?\\d{4})\\s+' + '(\\d{2}\\/\\d{2}\\/\\d{4})\\s+' +
    '((?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\s+){2,6})' + '(' + statusPattern + ')\\b', 'gi');
  const rows: Debito[] = [];
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(text)) !== null) {
    const values = [...match[4]!.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}/g)].map((i) => money(i[0]));
    if (values.length < 2) continue;
    const nextText = text.slice(rowPattern.lastIndex, rowPattern.lastIndex + 180);
    const noteMatch = nextText.match(/Notificação de lançamento:\s*(\d+)/i);
    rows.push({
      description: cleanDebtDescription(match[1]!), reference: match[2] || '', dueDate: match[3] || '',
      original: values[0] || 0, amount: values.at(-1) || 0,
      penalty: values.length >= 4 ? values[2] || 0 : 0, interest: values.length >= 5 ? values[3] || 0 : 0,
      status: clean(match[5]), note: noteMatch ? `Notificação de lançamento: ${noteMatch[1]}` : '',
    });
  }
  return rows;
}

function stripNoise(s: unknown): string {
  return clean(String(s || '').replace(/_{2,}/g, ' ').replace(/MINISTÉRIO DA FAZENDA[\s\S]*?EMISSÃO DE CERTIDÃO/gi, ' ')
    .replace(/Por meio do Portal[\s\S]*?\d{2}:\d{2}:\d{2}/gi, ' ').replace(/CNPJ(?:\s+do\s+certificado)?:\s*[\d.\/-]+/gi, ' ')
    .replace(/\s+Página:\s*\d+\s*\/\s*\d+/gi, ' ').replace(/\s+Página\b.*$/i, ' ').replace(/\s+[A-Z]$/, '').replace(/\s+/g, ' ').trim());
}
const SECTION_STOP = /(?:Pendência\s*[-–—]\s*)?(?:Débito|Parcelamento|Inscrição|Processo\s+Fiscal)(?:\s+com\s+Exigibilidade\s+Suspensa)?\s*\([^)]+\)|Débito com Exigibilidade Suspensa\s*\([^)]+\)|Diagnóstico Fiscal na (?:Procuradoria|Receita)|Final do Relatório/i;

// Todas as modalidades de parcelamento: (PARCSN/PARCMEI), (SIEFPAR), (SISPAR), com ou sem "Pendência -".
function parseInstallments(text: string): Parcelamento[] {
  const groups: Parcelamento[] = [];
  const headerRe = /(?:Pendência\s*[-–—]\s*)?Parcelamento(?:\s+com\s+Exigibilidade\s+Suspensa)?\s*\(([^)]+)\)/gi;
  let h: RegExpExecArray | null;
  while ((h = headerRe.exec(text)) !== null) {
    const system = clean(h[1] || '').toUpperCase(), suspended = /Exigibilidade\s+Suspensa/i.test(h[0]);
    const start = h.index + h[0].length, rest = text.slice(start), stop = rest.match(SECTION_STOP);
    const block = (stop && stop.index != null ? rest.slice(0, stop.index) : rest).replace(/\s+/g, ' ').trim();
    if (!block) continue;
    let matched = false;
    const reA = /([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .\/()-]{0,80}?)\s*[-–—]\s*EM PARCELAMENTO/gi;
    let m: RegExpExecArray | null;
    while ((m = reA.exec(block)) !== null) {
      matched = true;
      const atr = block.slice(m.index, reA.lastIndex + 80).match(/Parcelas?\s+em\s+atraso\s*:?\s*(\d+)/i);
      let name = clean(m[1]).replace(/^.*?CNPJ:\s*[\d.\/-]+\s*/i, '').replace(/^.*?Página:\s*\d+\s*\/\s*\d+\s*/i, '');
      const up = name.toUpperCase();
      if (up.includes('MEI')) name = 'MEI'; else if (up.includes('SIMPLES NACIONAL')) name = 'SIMPLES NACIONAL';
      groups.push({ system, suspended, name: name || `Parcelamento (${system})`, count: Number(atr?.[1] || 0), suspendedValue: 0, atrasoValue: 0, modality: '' });
    }
    if (!matched && /SIEFPAR/.test(system)) {
      const reB = /Parcelamento:\s*([\d.\-]+)([\s\S]*?)(?=Parcelamento:|$)/gi;
      let b: RegExpExecArray | null;
      while ((b = reB.exec(block)) !== null) {
        matched = true; const seg = b[2] || '';
        const sv = seg.match(/Valor\s+Suspenso:\s*([\d.,]+)/i), cn = seg.match(/Parcelas?\s+em\s+Atraso:\s*(\d+)/i), av = seg.match(/Valor\s+em\s+Atraso:\s*([\d.,]+)/i);
        const desc = seg.replace(/Valor\s+Suspenso:\s*[\d.,]+/i, '').replace(/Parcelas?\s+em\s+Atraso:\s*\d+/i, '').replace(/Valor\s+em\s+Atraso:\s*[\d.,]+/i, '');
        groups.push({ system, suspended, name: stripNoise(desc) || 'Parcelamento', number: clean(b[1]), count: Number(cn?.[1] || 0), suspendedValue: money(sv?.[1] || 0), atrasoValue: money(av?.[1] || 0), modality: '' });
      }
    }
    if (!matched && /SISPAR/.test(system)) {
      const reC = /(\d{6,})\s+([\s\S]*?)\s+Modalidade:\s*([\s\S]*?)(?=\s+\d{6,}\s|\s+Página|\s+MINISTÉRIO|_{3,}|$)/gi;
      let c: RegExpExecArray | null;
      while ((c = reC.exec(block)) !== null) { matched = true; groups.push({ system, suspended, name: stripNoise(c[2]) || `Parcelamento (${system})`, modality: stripNoise(c[3]), count: 0, suspendedValue: 0, atrasoValue: 0 }); }
    }
    if (!matched) {
      const atr = block.match(/Parcelas?\s+em\s+atraso\s*:?\s*(\d+)/i), sv = block.match(/Valor\s+Suspenso:\s*([\d.,]+)/i);
      groups.push({ system, suspended, name: `Parcelamento (${system})`, count: Number(atr?.[1] || 0), suspendedValue: money(sv?.[1] || 0), atrasoValue: 0, modality: '', note: 'Parcelamento identificado — conferir detalhes no relatório' });
    }
  }
  return groups;
}

// Inscrições na PGFN: "Pendência - Inscrição (SIDA)", "Inscrição com Exigibilidade Suspensa (SIDA)" e "(Sistema DÍVIDA)".
function parsePgfn(text: string): Pgfn[] {
  const items: Pgfn[] = [];
  const headerRe = /(?:Pendência\s*[-–—]\s*)?Inscrição(?:\s+com\s+Exigibilidade\s+Suspensa)?\s*\((SIDA|Sistema\s+D[IÍ]VIDA)\)/gi;
  let h: RegExpExecArray | null;
  while ((h = headerRe.exec(text)) !== null) {
    const sys = clean(h[1] || '').toUpperCase(), suspended = /Exigibilidade\s+Suspensa/i.test(h[0]);
    const start = h.index + h[0].length, rest = text.slice(start), stop = rest.match(SECTION_STOP);
    const block = (stop && stop.index != null ? rest.slice(0, stop.index) : rest).replace(/\s+/g, ' ').trim();
    if (!block) continue;
    if (/D[IÍ]VIDA/.test(sys)) {
      const re = /Inscrição:\s*([\d.\-]+)([\s\S]*?)(?=Inscrição:|$)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(block)) !== null) { const st = (m[2] || '').match(/Situação:\s*([A-ZÀ-Ú0-9 .\/-]+)/i); items.push({ number: clean(m[1]), source: 'Dívida Ativa (DAU)', process: '', status: stripNoise(st?.[1] || '') || 'Situação não identificada', system: 'DÍVIDA', suspended: true }); }
      continue;
    }
    const matches = [...block.matchAll(/\b\d{2}\.\d\.\d{2}\.\d{6}-\d{2}\b/g)];
    matches.forEach((numberMatch, index) => {
      const st = numberMatch.index!, end = index + 1 < matches.length ? matches[index + 1]!.index! : block.length;
      const segment = block.slice(st, end), number = numberMatch[0];
      const process = segment.match(/\b\d{5}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0] || '';
      const dateIndex = segment.search(/\b\d{2}\/\d{2}\/\d{4}\b/);
      const source = stripNoise((dateIndex > 0 ? segment.slice(number.length, dateIndex) : segment.slice(number.length))
        .replace(/Inscrição Receita Inscrito em Ajuizado em Processo Tipo de Devedor/i, '').replace(/DEVEDOR PRINCIPAL/gi, '').replace(/Situação:[\s\S]*/i, ''));
      const statusMatch = segment.match(/Situação:\s*([A-ZÀ-Ú0-9 .\/-]+)/i);
      items.push({ number, process, source: source || 'Receita não identificada', status: stripNoise(statusMatch?.[1] || '') || 'Situação não identificada', system: 'SIDA', suspended });
    });
  }
  return items;
}

// Omissões de declaração, processos fiscais e qualquer "Pendência - X" não reconhecida (rede de segurança).
function parseOthers(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:Pendência\s*[-–—]\s*)?(Omissão\s+de\s+[A-Za-zÀ-ÿ0-9/ -]+?)\s*\*?\s*_{3,}\s*(?:\(Per[ií]odo de Apura[çc][ãa]o\)\s*([0-9]{4}\s*[-–]\s*(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)(?:\s+(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ))*))?/gi)) {
    const lbl = clean(m[1]); const per = m[2] ? clean(m[2]) : ''; out.add(lbl + (per ? ' — Período: ' + per : ''));
  }
  for (const m of text.matchAll(/(?:Pendência\s*[-–—]\s*)?(Processo\s+Fiscal\s*\([^)]+\))/gi)) out.add(clean(m[1]));
  for (const m of text.matchAll(/Pendência\s*[-–—]\s*([A-Za-zÀ-ú][A-Za-zÀ-ú ]{2,45}?\([^)]+\))/gi)) { const s = clean(m[1]); if (!/Débito|Parcelamento|Inscrição|Processo Fiscal|Omissão/i.test(s)) out.add(s); }
  return [...out];
}

export function parseReport(texto: string, fileName: string): RelatorioFiscal {
  const t = String(texto).replace(/\u00a0/g, ' ');
  const header = t.split(/Dados Cadastrais da Matriz/i)[0] ?? '';
  const cad = sec(t, /Dados Cadastrais da Matriz/i, [/Sócios e Administradores/i, /Certidão Emitida/i, /Diagnóstico Fiscal/i]);
  const companyMatch = header.match(/CNPJ:\s*\d{2}\.?\d{3}\.?\d{3}\s*[-–—]\s*([^\n]+)/i);
  const companyName = clean(companyMatch?.[1] || '') || 'Empresa não identificada';
  const fullCnpj = fmtCnpj(one(cad, /CNPJ:\s*(\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2})/i, ''));
  const reportDateTime = one(header, /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/, '');
  const certMatch = t.match(/Certidão\s+(Positiva\s+com\s+Efeitos\s+de\s+Negativa|Negativa|Positiva):\s*([A-Z0-9.]+)?[\s\S]{0,180}?Emissão:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]{0,120}?Data de Validade:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const certLabel = clean(certMatch?.[1] || '');
  let certificateType = 'Não identificada';
  if (/Positiva\s+com\s+Efeitos/i.test(certLabel)) certificateType = 'Positiva com efeitos de negativa';
  else if (/^Negativa$/i.test(certLabel)) certificateType = 'Negativa';
  else if (/^Positiva$/i.test(certLabel)) certificateType = 'Positiva';
  const exig = sec(t, /Pendência\s*-\s*Débito\s*\(SIEF\)/i, [/Diagnóstico Fiscal na Procuradoria/i, /Pendência\s*-\s*Inscrição/i, /Final do Relatório/i]);
  const susp = sec(t, /Débito com Exigibilidade Suspensa\s*\(SIEF\)/i, [/Diagnóstico Fiscal na Procuradoria/i, /Pendência\s*-\s*Inscrição/i, /Final do Relatório/i]);
  return finalize({
    id: randomUUID(), companyName, cnpj: fullCnpj, reportDateTime, fileName,
    municipality: one(cad, /Município:\s*(.*?)(?=\s+UF:|$)/i, ''), uf: one(cad, /UF:\s*([A-Z]{2})/i, ''),
    address: one(cad, /Endereço:\s*(.*?)(?=\s+Bairro:|$)/i, ''), district: one(cad, /Bairro:\s*(.*?)(?=\s+CEP:|$)/i, ''),
    zipCode: one(cad, /CEP:\s*([\d-]+)/i, ''), responsible: one(cad, /Responsável:\s*(.*?)(?=\s+Situação:|$)/i, ''),
    cadastralStatus: one(cad, /Situação:\s*(.*?)(?=\s+Natureza Jurídica:|$)/i, ''), legalNature: one(cad, /Natureza Jurídica:\s*(.*?)(?=\s+Data de Abertura:|$)/i, ''),
    openingDate: one(cad, /Data de Abertura:\s*(\d{2}\/\d{2}\/\d{4})/i, ''), cnae: one(cad, /CNAE:\s*(.*?)(?=\s+Porte da Empresa:|$)/i, ''),
    companySize: one(cad, /Porte da Empresa:\s*(.*?)(?=\s+Opção pelo|$)/i, ''),
    simples: parseRegime(t, 'Opção pelo Simples Nacional', 'Opção pelo SIMEI'), simei: parseRegime(t, 'Opção pelo SIMEI', 'Sócios e Administradores'),
    certificateType, certificateIssue: certMatch?.[3] || '', certificateValidity: certMatch?.[4] || '', certificateCode: certMatch?.[2] || '',
    exigibleDebts: parseDebts(exig, ['DEVEDOR']), suspendedDebts: parseDebts(susp, ['A VENCER', 'A ANALISAR', 'SUSPENSO']),
    installmentGroups: parseInstallments(t), pgfnItems: parsePgfn(t),
    pgfnClear: /Não foram detectadas pendências\/exigibilidades suspensas[\s\S]*?Procuradoria-Geral/i.test(t),
    unknownPending: parseOthers(t), importedAt: new Date().toISOString(),
  });
}

// ─── Texto do PDF (pdf.js 3.11.174, build legado p/ Node) ────────────────────
type PdfJs = typeof import('pdfjs-dist');
let pdfjs: PdfJs | null = null;
async function carregarPdfJs(): Promise<PdfJs> {
  if (!pdfjs) {
    // build legado é CommonJS: no ESM do Node ele chega em .default
    const m = (await import('pdfjs-dist/legacy/build/pdf.js')) as unknown as { default?: PdfJs } & PdfJs;
    pdfjs = m.default ?? m;
  }
  return pdfjs;
}

function erroLegivel(error: unknown): string {
  const e = error as { name?: string; message?: string };
  const name = e?.name || '', message = String(e?.message || error || 'Falha desconhecida.');
  if (/PasswordException/i.test(name) || /password/i.test(message)) return 'O PDF está protegido por senha e não pode ser lido automaticamente.';
  if (/InvalidPDFException/i.test(name) || /Invalid PDF/i.test(message)) return 'O PDF está corrompido ou possui uma estrutura inválida.';
  return `Falha na leitura do PDF: ${message}`;
}

export async function textoDoPdf(buf: Buffer): Promise<string> {
  if (!buf?.length) throw new Error('O arquivo está vazio.');
  if (!buf.subarray(0, 4096).toString('latin1').includes('%PDF-')) throw new Error('O arquivo selecionado não possui uma assinatura PDF válida.');
  const lib = await carregarPdfJs();
  let pdf;
  try {
    pdf = await lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, stopAtErrors: false, verbosity: 0, disableFontFace: true }).promise;
  } catch (error) { throw new Error(erroLegivel(error)); }
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
    let pageText = '';
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) { if (!item.str) continue; pageText += item.str + (item.hasEOL ? '\n' : ' '); }
    pages.push(pageText.split(/\n+/).map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n'));
  }
  await pdf.destroy();
  const extracted = pages.join('\n');
  if (!extracted.trim()) throw new Error('O PDF foi aberto, mas não possui texto selecionável. Relatórios digitalizados como imagem precisam de OCR.');
  return extracted;
}

export async function lerRelatorio(buf: Buffer, fileName: string): Promise<RelatorioFiscal> {
  const r = parseReport(await textoDoPdf(buf), fileName);
  if (!digits(r.cnpj) || r.companyName === 'Empresa não identificada') throw new Error('CNPJ ou nome empresarial não identificado.');
  return r;
}
