import { useEffect, useState } from 'react';
import { FileText, Settings, HelpCircle, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui';

interface ConsultaResultado {
  arquivo: string;
  identificado: boolean;
  obrigacaoNome: string | null;
  empresa: string | null;
  competencia: string | null;
}

const TOUR = [
  {
    titulo: 'Consulta documento',
    texto: `Nesta tela voce envia um ou mais arquivos para verificar se os documentos ja possuem identificacao disponivel na base de conhecimento do e-Continuo.

Os arquivos reconhecidos serao agrupados automaticamente por tipo de documento. Caso algum arquivo ainda nao tenha identificacao disponivel, ele sera exibido separadamente para analise.

Quando necessario, voce tambem podera ajustar o vinculo/configuracao correspondente ao documento identificado.

Use o botao Escolher arquivos para selecionar um ou mais anexos.

Apos a selecao, o botao "OK - Consultar" sera habilitado para iniciar a consulta.`,
  },
  {
    titulo: 'Consultar',
    texto: `Inicia a leitura dos arquivos selecionados e exibe abaixo o documento homologado correspondente a cada tipo reconhecido (ou a situacao de nao identificado para homologacao).

Durante a consulta a tela pode ficar temporariamente bloqueada ate concluir.`,
  },
];

export default function ConsultaDocumento() {
  const { sessao } = useAuth();
  const toast = useToast();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [consultando, setConsultando] = useState(false);
  const [resultados, setResultados] = useState<ConsultaResultado[] | null>(null);
  const [office, setOffice] = useState('');
  const [tour, setTour] = useState(0); // 0 = fechado, 1 = passo 1, 2 = passo 2

  useEffect(() => {
    api.get<{ nome: string }>('/escritorio').then((e) => setOffice(e.nome)).catch(() => undefined);
  }, []);

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files ?? []).slice(0, 30);
    setArquivos(fs);
    setResultados(null);
  }

  async function consultar() {
    if (arquivos.length === 0) return;
    setConsultando(true);
    setResultados(null);
    try {
      const fd = new FormData();
      arquivos.forEach((f) => fd.append('arquivos', f));
      const r = await api.upload<ConsultaResultado[]>('/robo/consultar', fd);
      setResultados(r);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro na consulta.'); }
    finally { setConsultando(false); }
  }

  // agrupa reconhecidos por tipo; nao identificados separados
  const reconhecidos = (resultados ?? []).filter((r) => r.identificado);
  const naoIdentificados = (resultados ?? []).filter((r) => !r.identificado);
  const grupos = reconhecidos.reduce<Record<string, ConsultaResultado[]>>((acc, r) => {
    const k = r.obrigacaoNome ?? '—';
    (acc[k] ??= []).push(r); return acc;
  }, {});

  return (
    <div className="-m-6 min-h-full bg-neutral-100 p-5 text-[13px]">
      {/* Cabecalho */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <FileText size={16} className="text-slate-400" />
          <span>Sistema</span><span className="text-slate-300">›</span>
          <span>e-Continuo</span><span className="text-slate-300">›</span>
          <span className="text-slate-700">Consulta de documentos na base de conhecimento do e-Continuo [CTRL+K]</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      <div className="relative">
        <button onClick={() => setTour(1)} title="Ajuda" className="absolute -top-1 right-0 text-marca-500 hover:text-marca-700"><HelpCircle size={18} /></button>

        <div className="mt-4 flex items-stretch gap-4">
          {/* Area de upload */}
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-2 py-2">
            <Upload size={16} className="text-slate-400" />
            <span className="flex-1 truncate text-slate-500">
              {arquivos.length ? `${arquivos.length} arquivo(s) selecionado(s)` : 'Selecione ate 30 arquivos (ate 2 MB cada)'}
            </span>
            <span className="rounded bg-marca-500 px-3 py-1 text-[12px] font-medium text-white">Escolher Arquivos</span>
            <input type="file" multiple className="hidden" onChange={escolher} />
          </label>

          {/* OK - Consultar */}
          <button onClick={consultar} disabled={arquivos.length === 0 || consultando}
            className="flex w-1/3 items-center justify-center gap-2 rounded bg-marca-400 px-6 text-sm font-medium text-white hover:bg-marca-500 disabled:opacity-60">
            <Settings size={16} /> {consultando ? 'Consultando...' : 'OK - Consultar'}
          </button>
        </div>

        {/* Lista de arquivos selecionados */}
        {arquivos.length > 0 && !resultados && (
          <div className="mt-2 flex flex-wrap gap-1">
            {arquivos.map((f, i) => <span key={i} className="rounded bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">{f.name}</span>)}
          </div>
        )}

        {/* Resultados */}
        {resultados && (
          <div className="mt-5 space-y-4">
            {Object.keys(grupos).length === 0 && naoIdentificados.length === 0 && (
              <p className="text-slate-400">Nenhum resultado.</p>
            )}
            {Object.entries(grupos).map(([tipo, itens]) => (
              <div key={tipo} className="overflow-hidden rounded border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-50 px-4 py-2 text-[13px] font-semibold text-emerald-700">
                  <CheckCircle2 size={15} /> {tipo} <span className="font-normal text-slate-400">— documento homologado ({itens.length})</span>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-slate-100">
                    {itens.map((r, i) => (
                      <tr key={i} className="text-slate-600">
                        <td className="px-4 py-1.5">{r.arquivo}</td>
                        <td className="px-4 py-1.5">{r.empresa ?? <span className="text-slate-400">empresa nao identificada</span>}</td>
                        <td className="px-4 py-1.5">{r.competencia ?? <span className="text-slate-400">competencia ?</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {naoIdentificados.length > 0 && (
              <div className="overflow-hidden rounded border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-amber-50 px-4 py-2 text-[13px] font-semibold text-amber-700">
                  <AlertTriangle size={15} /> Nao identificados <span className="font-normal text-slate-400">— para homologacao ({naoIdentificados.length})</span>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-slate-100">
                    {naoIdentificados.map((r, i) => <tr key={i}><td className="px-4 py-1.5 text-slate-600">{r.arquivo}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rodape */}
      <div className="mt-6 flex items-center justify-between border-t border-marca-200 pt-2 text-[12px] text-marca-600">
        <span>Usuario: {sessao?.usuario?.nome ?? '—'}</span>
        <span>Office: {office || '—'}</span>
      </div>

      {/* Tour de ajuda (2 passos) */}
      {tour > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setTour(0)}>
          <div className={`absolute w-80 rounded-lg bg-slate-800 p-4 text-[12px] leading-relaxed text-slate-200 shadow-2xl ${tour === 1 ? 'left-6 top-32' : 'right-6 top-32'}`} onClick={(e) => e.stopPropagation()}>
            <h4 className="mb-2 text-[14px] font-semibold text-white">{TOUR[tour - 1].titulo}</h4>
            <p className="whitespace-pre-line">{TOUR[tour - 1].texto}</p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1">
                {TOUR.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === tour - 1 ? 'bg-white' : 'bg-slate-500'}`} />)}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setTour(0)} className="text-slate-300 hover:text-white">Fechar</button>
                <button onClick={() => setTour((t) => Math.max(1, t - 1))} disabled={tour === 1} className="text-slate-300 hover:text-white disabled:opacity-40">Anterior</button>
                {tour < TOUR.length
                  ? <button onClick={() => setTour((t) => t + 1)} className="rounded border border-slate-500 px-2 py-0.5 text-white hover:bg-slate-700">Proximo</button>
                  : <button onClick={() => setTour(0)} className="rounded border border-slate-500 px-2 py-0.5 text-white hover:bg-slate-700">OK, entendido</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
