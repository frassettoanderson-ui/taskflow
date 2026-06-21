import { api } from './api';

interface LinhaEmp { regime: string; razaoSocial: string; cnpj: string; fone: string }
interface RegimeRel { id: string; nome: string; obrigacoes?: { obrigacao?: { nome?: string; departamento?: { nome?: string } | null } }[] }

const ESTILO = {
  startY: 48,
  styles: { fontSize: 8, cellPadding: 3, lineColor: [180, 180, 180] as [number, number, number], lineWidth: 0.5 },
  headStyles: { fillColor: [66, 139, 202] as [number, number, number], textColor: 255, fontStyle: 'bold' as const },
  theme: 'grid' as const,
};

// jspdf so e carregado quando um relatorio e realmente gerado (lazy, fora do bundle principal).
async function gerar(titulo: string, head: string[], body: string[][]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(titulo, doc.internal.pageSize.getWidth() / 2, 34, { align: 'center' });
  autoTable(doc, { ...ESTILO, head: [head], body });
  window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

export async function relatorioEmpresasPorRegime(regimeId?: string) {
  const linhas = await api.get<LinhaEmp[]>(`/regimes/relatorio/empresas${regimeId ? `?regimeId=${regimeId}` : ''}`);
  await gerar(
    'Relacao de Empresas e seus Regimes Tributarios',
    ['Regime', 'Razao Social', 'ID', 'CNPJ', 'Fone'],
    linhas.map((l, i) => [l.regime, l.razaoSocial, String(i + 1).padStart(3, '0'), l.cnpj, l.fone]),
  );
}

export async function relatorioObrigacoesPorRegime(regimeId?: string) {
  const regimes = await api.get<RegimeRel[]>('/regimes');
  const body: string[][] = [];
  for (const r of regimes) {
    if (regimeId && r.id !== regimeId) continue;
    for (const l of r.obrigacoes ?? []) body.push([r.nome, l.obrigacao?.departamento?.nome ?? '-', l.obrigacao?.nome ?? '']);
  }
  await gerar('Relacao de Obrigacoes dos Regimes Tributarios', ['Regime', 'Departamento', 'Obrigacao'], body);
}
