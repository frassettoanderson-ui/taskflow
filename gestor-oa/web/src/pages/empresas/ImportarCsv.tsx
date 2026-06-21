import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Download, X, Upload } from 'lucide-react';
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
  const [nomeArquivo, setNomeArquivo] = useState('');

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
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

  const btnVerde = 'flex items-center justify-center gap-2 rounded-md bg-status-ok px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50';
  const btnLaranja = 'flex items-center justify-center gap-2 rounded-md bg-status-warn px-4 py-2 text-sm font-medium text-white hover:bg-amber-500';

  return (
    <div className="-m-6 min-h-full bg-neutral-100 p-5 text-[13px]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <Heart size={16} className="text-slate-400" /><span>Empresas</span>
          <span className="text-slate-300">›</span><span className="text-slate-700">Importacao de cadastros de empresas</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      {/* Bloco 1: CSV com indicacao de colunas */}
      <h2 className="text-[16px] font-semibold text-slate-700">Importacao de cadastros de empresas com <span className="text-marca-600">CSV</span> e indicacao de colunas <span className="text-marca-600">[de » para]</span> para dados dos campos: <button onClick={baixarTemplate} className="ml-1 text-[12px] font-normal text-marca-500 hover:underline">(baixar modelo)</button></h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6 text-slate-600">
        <li>Atraves de seu controle de gestao atual, exporte os CNPJ's de seus clientes para um arquivo em CSV, separados por ';' (ponto-e-virgula). Se os dados estiverem em excel, utilize a opcao 'Salvar como' e selecione a opcao "CSV";</li>
        <li>O importador ira listar todas as colunas detectadas e voce indicara quais os campos correspondentes;</li>
        <li>CNPJ's, CPF's e CAEPF's ja existentes serao <span className="text-status-warn">atualizados</span> com os novos dados;</li>
        <li>Para contatos e inscricoes estaduais, favor inserir uma linha para cada registro, repetindo os demais dados do cadastro principal;</li>
        <li>Se houver uma coluna relacionada a marcacao de departamentos, os valores "S" marcarao o departamento automaticamente. Valores "N" desmarcarao o departamento. Valores em branco nao marcarao o departamento, sendo necessario faze-lo manualmente apos a importacao, se desejar.</li>
      </ol>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
        <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-2 py-2">
          <Upload size={16} className="text-slate-400" />
          <span className="flex-1 truncate text-slate-500">{nomeArquivo || 'Arquivo CSV com os dados a serem importados [ate 10MB]'}</span>
          <span className="rounded bg-marca-500 px-3 py-1 text-[12px] font-medium text-white">Selecionar arquivo</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={aoSelecionar} />
        </label>
        <button className={btnVerde} onClick={importar} disabled={importando || grade.length === 0}><Download size={16} /> {importando ? 'Importando...' : 'OK - Iniciar importacao agora'}</button>
        <button className={btnLaranja} onClick={() => navigate('/empresas')}><X size={16} /> Cancelar</button>
      </div>

      {/* Mapeamento + previa (aparece apos selecionar) */}
      {grade.length > 0 && (
        <div className="mt-3 space-y-3">
          <div className="rounded border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-[13px] font-semibold text-slate-700">Indique as colunas [de » para]</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS.map((campo) => (
                <div key={campo.key}>
                  <label className="mb-0.5 block text-[12px] font-medium text-slate-600">{campo.label}</label>
                  <select className="block w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" value={mapa[campo.key] ?? -1} onChange={(e) => setMapa((m) => ({ ...m, [campo.key]: Number(e.target.value) }))}>
                    <option value={-1}>— ignorar —</option>
                    {(grade[0] ?? []).map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-[13px] font-semibold text-slate-700">Previa ({linhasDados.length} linhas)</h3>
            <table className="w-full text-[11px]">
              <thead className="text-left text-slate-500"><tr>{(grade[0] ?? []).map((h, i) => <th key={i} className="px-2 py-1">{h}</th>)}</tr></thead>
              <tbody>{linhasDados.slice(0, 8).map((row, i) => <tr key={i} className="border-t border-slate-100">{row.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>)}</tbody>
            </table>
            {linhasDados.length > 8 && <p className="mt-2 text-[11px] text-slate-400">...e mais {linhasDados.length - 8} linhas.</p>}
          </div>
        </div>
      )}

      {resultado && (
        <div className="mt-3 rounded border border-slate-200 bg-white p-4">
          <p className="text-emerald-700">{resultado.criadas} empresa(s) importada(s).</p>
          {resultado.erros.length > 0 && (
            <ul className="mt-1 space-y-1 text-[12px] text-red-600">{resultado.erros.map((e) => <li key={e.linha}>Linha {e.linha}: {e.erro}</li>)}</ul>
          )}
        </div>
      )}

      {/* Bloco 2: deteccao automatica de CNPJs */}
      <h2 className="mt-6 text-[16px] font-semibold text-slate-700">Importacao de cadastros de empresas com <span className="text-marca-600">deteccao automatica</span> de CNPJs:</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6 text-slate-600">
        <li>Atraves de seu controle de gestao atual, exporte os CNPJ's de seus clientes para um arquivo em TXT, CSV, PDF ou XLS;</li>
        <li>O importador de cadastros ira identificar <span className="text-marca-600">automaticamente</span> todos os numeros de CNPJ's constantes no arquivo e ira relaciona-los para voce completar os dados deles;</li>
        <li>CNPJ's ja existentes serao <span className="text-status-warn">ignorados</span>;</li>
        <li>Apos iniciar a importacao, se por algum motivo precisar dar uma pausa no processo, sem problemas, e possivel retoma-la posteriormente no ponto em que parou tranquilamente, vamos la?</li>
      </ol>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
        <label className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-2 opacity-70">
          <Upload size={16} className="text-slate-400" />
          <span className="flex-1 truncate text-slate-500">Arquivo com os CNPJs a serem importados [ate 10MB]</span>
          <span className="rounded bg-marca-500 px-3 py-1 text-[12px] font-medium text-white">Selecionar arquivo</span>
        </label>
        <button className={btnVerde} onClick={() => toast('ok', 'Em construcao: deteccao automatica de CNPJs.')}><Download size={16} /> OK - Iniciar importacao agora</button>
        <button className={btnLaranja} onClick={() => navigate('/empresas')}><X size={16} /> Cancelar</button>
      </div>

      {/* Bloco 3: historico */}
      <h2 className="mt-6 text-[15px] font-semibold text-slate-700">Importacoes com deteccao automatica de CNPJs ja realizadas e/ou em andamento:</h2>
      <div className="mt-1 overflow-hidden rounded border border-slate-200 bg-white">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200 text-left text-[12px] font-semibold text-slate-600">
            <th className="px-4 py-2">Usuario que importou</th>
            <th className="px-4 py-2">Data/Hora Inicio | Fim</th>
            <th className="px-4 py-2 text-right">Importados / <span className="text-status-warn">Ignorados</span> / Total</th>
          </tr></thead>
          <tbody><tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400">Nenhuma importacao realizada.</td></tr></tbody>
        </table>
      </div>
    </div>
  );
}
