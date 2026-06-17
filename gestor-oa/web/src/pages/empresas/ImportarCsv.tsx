import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../components/ui';

const CAMPOS = [
  { key: 'razaoSocial', label: 'Razao social *' },
  { key: 'nomeFantasia', label: 'Nome fantasia' },
  { key: 'emailPrincipal', label: 'E-mail' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'endereco', label: 'Endereco' },
  { key: 'chaveTipo', label: 'Tipo da chave (CNPJ/CPF/CAEPF)' },
  { key: 'chaveValor', label: 'Valor da chave' },
] as const;

type CampoKey = (typeof CAMPOS)[number]['key'];

// Parser CSV simples (suporta , ou ; e aspas basicas).
function parseCsv(texto: string): string[][] {
  const linhas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  const sep = (linhas[0]?.match(/;/g)?.length ?? 0) > (linhas[0]?.match(/,/g)?.length ?? 0) ? ';' : ',';
  return linhas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
}

export default function ImportarCsv() {
  const navigate = useNavigate();
  const toast = useToast();
  const [grade, setGrade] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Record<CampoKey, number>>({} as never);
  const [resultado, setResultado] = useState<{ criadas: number; erros: { linha: number; erro: string }[] } | null>(null);
  const [importando, setImportando] = useState(false);

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const g = parseCsv(String(reader.result));
      setGrade(g);
      // auto-mapeia por nome de cabecalho
      const header = (g[0] ?? []).map((h) => h.toLowerCase());
      const novo = {} as Record<CampoKey, number>;
      for (const campo of CAMPOS) {
        const idx = header.findIndex((h) => h.includes(campo.key.toLowerCase()) || (campo.key === 'razaoSocial' && (h.includes('razao') || h.includes('nome'))) || (campo.key === 'chaveValor' && (h.includes('cnpj') || h.includes('cpf'))));
        novo[campo.key] = idx;
      }
      setMapa(novo);
      setResultado(null);
    };
    reader.readAsText(file, 'utf-8');
  }

  function baixarTemplate() {
    const conteudo = 'razaoSocial;nomeFantasia;emailPrincipal;telefone;endereco;chaveTipo;chaveValor\nEmpresa Exemplo LTDA;Exemplo;contato@exemplo.com.br;1199990000;Rua A 100;CNPJ;12345678000199';
    const blob = new Blob([conteudo], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo_empresas.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const linhasDados = grade.slice(1);

  async function importar() {
    if (mapa.razaoSocial === undefined || mapa.razaoSocial < 0) {
      return toast('erro', 'Mapeie ao menos a coluna de Razao social.');
    }
    const linhas = linhasDados
      .map((row) => ({
        razaoSocial: row[mapa.razaoSocial] ?? '',
        nomeFantasia: mapa.nomeFantasia >= 0 ? row[mapa.nomeFantasia] : undefined,
        emailPrincipal: mapa.emailPrincipal >= 0 ? row[mapa.emailPrincipal] : undefined,
        telefone: mapa.telefone >= 0 ? row[mapa.telefone] : undefined,
        endereco: mapa.endereco >= 0 ? row[mapa.endereco] : undefined,
        chaveTipo: mapa.chaveTipo >= 0 ? (row[mapa.chaveTipo]?.toUpperCase() as never) : undefined,
        chaveValor: mapa.chaveValor >= 0 ? row[mapa.chaveValor] : undefined,
      }))
      .filter((l) => l.razaoSocial.trim());

    if (!linhas.length) return toast('erro', 'Nenhuma linha valida.');
    setImportando(true);
    try {
      const r = await api.post<{ criadas: number; erros: { linha: number; erro: string }[] }>('/empresas/importar', { linhas });
      setResultado(r);
      toast('ok', `${r.criadas} empresa(s) importada(s).`);
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Importar empresas (CSV)</h1>
        <button className="btn-ghost border border-slate-300" onClick={baixarTemplate}>Baixar modelo CSV</button>
      </div>

      <div className="card space-y-3 p-6">
        <label className="label">Arquivo CSV</label>
        <input type="file" accept=".csv,text/csv" onChange={aoSelecionar} />
        <p className="text-xs text-slate-400">Aceita separador , ou ; — a primeira linha deve ser o cabecalho.</p>
      </div>

      {grade.length > 0 && (
        <>
          <div className="card space-y-3 p-6">
            <h2 className="font-semibold text-slate-700">Mapeamento de colunas</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPOS.map((campo) => (
                <div key={campo.key}>
                  <label className="label">{campo.label}</label>
                  <select
                    className="input"
                    value={mapa[campo.key] ?? -1}
                    onChange={(e) => setMapa((m) => ({ ...m, [campo.key]: Number(e.target.value) }))}
                  >
                    <option value={-1}>— ignorar —</option>
                    {(grade[0] ?? []).map((h, i) => (
                      <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-x-auto p-4">
            <h2 className="mb-2 font-semibold text-slate-700">Previa ({linhasDados.length} linhas)</h2>
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>{(grade[0] ?? []).map((h, i) => <th key={i} className="px-2 py-1">{h}</th>)}</tr>
              </thead>
              <tbody>
                {linhasDados.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">{row.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {linhasDados.length > 8 && <p className="mt-2 text-xs text-slate-400">...e mais {linhasDados.length - 8} linhas.</p>}
          </div>

          <div className="flex gap-2">
            <button className="btn-primary" onClick={importar} disabled={importando}>
              {importando ? 'Importando...' : `Importar ${linhasDados.length} empresas`}
            </button>
            <button className="btn-ghost" onClick={() => navigate('/empresas')}>Voltar</button>
          </div>
        </>
      )}

      {resultado && (
        <div className="card space-y-2 p-6">
          <h2 className="font-semibold text-slate-700">Resultado</h2>
          <p className="text-emerald-700">{resultado.criadas} empresa(s) criada(s).</p>
          {resultado.erros.length > 0 && (
            <div>
              <p className="font-medium text-red-600">{resultado.erros.length} erro(s):</p>
              <ul className="mt-1 space-y-1 text-sm text-red-600">
                {resultado.erros.map((e) => (<li key={e.linha}>Linha {e.linha}: {e.erro}</li>))}
              </ul>
            </div>
          )}
          <button className="btn-primary mt-2" onClick={() => navigate('/empresas')}>Ver empresas</button>
        </div>
      )}
    </div>
  );
}
