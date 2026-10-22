// Planilhas .xlsx geradas no próprio navegador (SheetJS), sem servidor.
import { utils, writeFileXLSX } from 'xlsx';
import { totalNegocios, type Contato } from '../shared/dados';
import { dataCurta, telefone } from '../ui/formato';

const SEXO: Record<string, string> = { F: 'Feminino', M: 'Masculino', O: 'Outro' };

function linhaContato(nome: string, numero: string, c?: Contato) {
  return {
    Nome: c?.nome || nome,
    Telefone: telefone(numero),
    'E-mail': c?.email ?? '',
    Empresa: c?.empresa ?? '',
    Cargo: c?.cargo ?? '',
    Cidade: c?.cidade ?? '',
    Estado: c?.estado ?? '',
    Sexo: SEXO[c?.sexo ?? ''] ?? '',
    Nascimento: dataCurta(c?.nascimento ?? ''),
    Origem: c?.origem ?? '',
    'Produtos de interesse': c?.produtos ?? '',
    'Valor dos negócios': totalNegocios(c),
    'Etiquetas do CRM': c?.tags.join(', ') ?? '',
    Observações: c?.observacoes ?? '',
  };
}

const nomeArquivo = (base: string) => `${base.replace(/[\\/:*?"<>|]+/g, ' ').trim()} ${new Date().toLocaleDateString('sv-SE')}.xlsx`;

function ajustarLarguras(ws: ReturnType<typeof utils.json_to_sheet>, linhas: Record<string, unknown>[]) {
  if (!linhas.length) return;
  ws['!cols'] = Object.keys(linhas[0]).map((k) => ({ wch: Math.min(40, Math.max(k.length, ...linhas.map((l) => String(l[k] ?? '').length)) + 2) }));
}

/** Uma aba por coluna do funil + aba "Resumo". */
export async function exportarFunil(nomeFunil: string, colunas: { nome: string; contatos: { id: string; nome: string; numero: string; contato?: Contato }[] }[]) {
  const wb = utils.book_new();
  const resumo = colunas.map((c) => ({ Etapa: c.nome, Contatos: c.contatos.length, 'Valor total': c.contatos.reduce((s, x) => s + totalNegocios(x.contato), 0) }));
  const wsR = utils.json_to_sheet(resumo);
  ajustarLarguras(wsR, resumo);
  utils.book_append_sheet(wb, wsR, 'Resumo');
  const usados = new Set<string>(['Resumo']);
  for (const col of colunas) {
    const linhas = col.contatos.map((x) => linhaContato(x.nome, x.numero, x.contato));
    const ws = utils.json_to_sheet(linhas.length ? linhas : [linhaContato('', '')].map((l) => Object.fromEntries(Object.keys(l).map((k) => [k, '']))));
    ajustarLarguras(ws, linhas);
    // nome de aba no Excel: até 31 caracteres, sem repetir
    let nome = col.nome.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Etapa';
    for (let i = 2; usados.has(nome); i++) nome = `${nome.slice(0, 28)} ${i}`;
    usados.add(nome);
    utils.book_append_sheet(wb, ws, nome);
  }
  writeFileXLSX(wb, nomeArquivo(nomeFunil));
}

/** Todas as fichas de contato numa aba só. */
export async function exportarContatos(contatos: Contato[]) {
  const linhas = contatos.map((c) => linhaContato(c.nome, c.numero, c));
  const ws = utils.json_to_sheet(linhas);
  ajustarLarguras(ws, linhas);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Contatos');
  writeFileXLSX(wb, nomeArquivo('Contatos CRM'));
}
