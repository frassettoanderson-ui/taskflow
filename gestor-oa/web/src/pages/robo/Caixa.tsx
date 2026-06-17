import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { useToast } from '../../components/ui';

export default function Caixa() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeAdmin = temPermissao(sessao, 'admin_escritorio');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ total: number; baixados: number; revisao: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (podeAdmin) api.get<{ apiKey: string | null }>('/robo/api-key').then((r) => setApiKey(r.apiKey)).catch(() => undefined);
  }, [podeAdmin]);

  async function enviar(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('arquivos', f));
    setEnviando(true);
    setResultado(null);
    try {
      const r = await api.upload<{ total: number; baixados: number; revisao: number }>('/robo/caixa', fd);
      setResultado(r);
      toast('ok', `${r.baixados} baixados, ${r.revisao} em revisao.`);
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setEnviando(false); }
  }

  async function regenerar() {
    const r = await api.post<{ apiKey: string }>('/robo/api-key/regenerar');
    setApiKey(r.apiKey);
    toast('ok', 'API key gerada.');
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Caixa do Robo</h1>
      <p className="text-sm text-slate-500">Arraste os PDFs das guias. O robo identifica empresa, obrigacao e competencia, da baixa na entrega e distribui ao cliente.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); enviar(e.dataTransfer.files); }}
        className={`grid place-items-center rounded-lg border-2 border-dashed p-12 text-center transition ${drag ? 'border-marca-500 bg-marca-50' : 'border-slate-300 bg-white'}`}
      >
        <div className="text-4xl">📥</div>
        <p className="mt-2 text-slate-600">Arraste PDFs aqui ou</p>
        <label className="btn-primary mt-2 cursor-pointer">
          Selecionar arquivos
          <input type="file" multiple accept="application/pdf" className="hidden" onChange={(e) => enviar(e.target.files)} />
        </label>
        {enviando && <p className="mt-3 text-sm text-slate-400">Processando...</p>}
      </div>

      {resultado && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-700">{resultado.total}</div><div className="text-xs text-slate-500">Processados</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-status-ok">{resultado.baixados}</div><div className="text-xs text-slate-500">Baixados</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-bold text-status-warn">{resultado.revisao}</div><div className="text-xs text-slate-500">Em revisao</div></div>
        </div>
      )}

      {podeAdmin && (
        <div className="card space-y-2 p-5">
          <h2 className="font-semibold text-slate-700">Integracao (API)</h2>
          <p className="text-sm text-slate-500">Sistemas externos podem enviar guias para <code>POST /api/v1/robo/ingest</code> com o header <code>x-api-key</code>.</p>
          <div className="flex items-center gap-2">
            <input className="input font-mono text-xs" readOnly value={apiKey ?? 'Nenhuma key gerada'} />
            <button className="btn-ghost border border-slate-300" onClick={regenerar}>{apiKey ? 'Regenerar' : 'Gerar'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
