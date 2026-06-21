import { useEffect, useState } from 'react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type { DocumentoGED, Protocolo, Contato } from '../../lib/tipos';
import { formatarBytes, dataBR } from '../../lib/tipos';

async function baixarArquivo(url: string, nome: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  if (!res.ok) return;
  const blob = await res.blob();
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = u; a.download = nome; a.click(); URL.revokeObjectURL(u);
}

export default function AbaDocumentos({ empresaId }: { empresaId: string }) {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeUpload = temPermissao(sessao, 'documentos_upload');
  const podeExcluir = temPermissao(sessao, 'documentos_excluir');

  const [raiz, setRaiz] = useState<'DocsEmpresa' | 'DocsEntregas'>('DocsEmpresa');
  const [docs, setDocs] = useState<DocumentoGED[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [pasta, setPasta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verProtocolos, setVerProtocolos] = useState(false);
  const [protocoloDoc, setProtocoloDoc] = useState<DocumentoGED | null>(null);

  function carregar() {
    setLoading(true);
    const qs = new URLSearchParams({ raiz });
    if (busca.trim()) qs.set('busca', busca.trim());
    api.get<DocumentoGED[]>(`/ged/empresa/${empresaId}?${qs}`).then(setDocs).finally(() => setLoading(false));
  }
  useEffect(() => { const t = setTimeout(carregar, 200); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [raiz, busca, empresaId]);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files?.length) return;
    const fd = new FormData();
    fd.append('pasta', pasta);
    Array.from(files).forEach((f) => fd.append('arquivos', f));
    setEnviando(true);
    try { await api.upload(`/ged/empresa/${empresaId}/upload`, fd); toast('ok', 'Documentos enviados.'); carregar(); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro'); }
    finally { setEnviando(false); }
  }
  async function excluir(d: DocumentoGED) {
    if (!confirm(`Excluir ${d.nomeArquivo}?`)) return;
    try { await api.del(`/ged/${d.id}`); toast('ok', 'Removido.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  // agrupa por pasta
  const porPasta = new Map<string, DocumentoGED[]>();
  for (const d of docs) {
    const k = d.pasta || '(raiz)';
    if (!porPasta.has(k)) porPasta.set(k, []);
    porPasta.get(k)!.push(d);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1 text-sm">
          {(['DocsEmpresa', 'DocsEntregas'] as const).map((r) => (
            <button key={r} onClick={() => setRaiz(r)} className={`rounded px-3 py-1 ${raiz === r ? 'bg-marca-500 text-white' : 'text-slate-600'}`}>
              {r === 'DocsEmpresa' ? 'Docs do Escritorio' : 'Docs de Entregas'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input w-48" placeholder="Buscar arquivo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button className="btn-ghost border border-slate-300" onClick={() => setVerProtocolos(true)}>Protocolos</button>
          <button className="btn-ghost border border-slate-300" onClick={() => baixarArquivo(`/api/v1/ged/empresa/${empresaId}/zip?raiz=${raiz}`, 'documentos.zip')}>Baixar tudo (zip)</button>
        </div>
      </div>

      {podeUpload && raiz === 'DocsEmpresa' && (
        <div className="card flex flex-wrap items-end gap-2 p-3">
          <div><label className="label">Subpasta (opcional)</label><input className="input w-48" placeholder="ex.: Contratos" value={pasta} onChange={(e) => setPasta(e.target.value)} /></div>
          <div><label className="label">Arquivos</label><input type="file" multiple onChange={enviar} disabled={enviando} /></div>
          {enviando && <span className="text-sm text-slate-400">enviando...</span>}
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="space-y-3">
          {[...porPasta.entries()].map(([pastaNome, itens]) => (
            <div key={pastaNome} className="card overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-600">📁 {pastaNome}</div>
              <div className="divide-y divide-slate-100">
                {itens.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <div>
                      <button className="text-marca-600 hover:underline" onClick={() => baixarArquivo(`/api/v1/ged/${d.id}/download`, d.nomeArquivo)}>{d.nomeArquivo}</button>
                      <span className="ml-2 text-xs text-slate-400">{formatarBytes(d.tamanho)} · {dataBR(d.createdAt)}</span>
                      {d.origem !== 'MANUAL' && <Badge className="ml-2 bg-blue-50 text-blue-700">{d.origem}</Badge>}
                    </div>
                    <div className="flex gap-3 text-xs">
                      <button className="text-slate-500 hover:underline" onClick={() => setProtocoloDoc(d)}>protocolar</button>
                      {podeExcluir && <button className="text-red-500 hover:underline" onClick={() => excluir(d)}>excluir</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {docs.length === 0 && <p className="text-slate-400">Nenhum documento.</p>}
        </div>
      )}

      {verProtocolos && <ModalProtocolos empresaId={empresaId} onFechar={() => setVerProtocolos(false)} />}
      {protocoloDoc && <ModalCriarProtocolo empresaId={empresaId} doc={protocoloDoc} onFechar={() => setProtocoloDoc(null)} />}
    </div>
  );
}

function ModalProtocolos({ empresaId, onFechar }: { empresaId: string; onFechar: () => void }) {
  const [protocolos, setProtocolos] = useState<Protocolo[] | null>(null);
  useEffect(() => { api.get<Protocolo[]>(`/protocolos/empresa/${empresaId}`).then(setProtocolos); }, [empresaId]);
  return (
    <Modal aberto titulo="Protocolos digitais" onFechar={onFechar} largura="max-w-2xl">
      {!protocolos ? <Spinner /> : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {protocolos.map((p) => (
            <div key={p.id} className="card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{p.documento?.nomeArquivo ?? 'Documento'}</span>
                <Badge className="bg-neutral-100 text-slate-600">{p.canal}</Badge>
              </div>
              <div className="text-xs text-slate-500">Para {p.destinatario} · enviado {new Date(p.enviadoEm).toLocaleString('pt-BR')}</div>
              <div className="mt-1 text-xs">
                {p.visualizacoes.length === 0 ? (
                  <span className="text-amber-600">Ainda nao visualizado</span>
                ) : (
                  <details>
                    <summary className="cursor-pointer text-emerald-700">{p.visualizacoes.length} visualizacao(oes)</summary>
                    <ul className="mt-1 space-y-0.5 text-slate-500">
                      {p.visualizacoes.map((v) => (
                        <li key={v.id}>{new Date(v.visualizadoEm).toLocaleString('pt-BR')} — {v.ip ?? 'ip?'}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
          {protocolos.length === 0 && <p className="text-slate-400">Nenhum protocolo gerado.</p>}
        </div>
      )}
    </Modal>
  );
}

function ModalCriarProtocolo({ empresaId, doc, onFechar }: { empresaId: string; doc: DocumentoGED; onFechar: () => void }) {
  const toast = useToast();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [destinatario, setDestinatario] = useState('');
  const [canal, setCanal] = useState<'EMAIL' | 'AREA_VIP' | 'WHATSAPP'>('EMAIL');
  const [link, setLink] = useState('');

  useEffect(() => { api.get<Contato[]>(`/empresas/${empresaId}/contatos`).then(setContatos).catch(() => undefined); }, [empresaId]);

  async function criar() {
    if (!destinatario) return toast('erro', 'Informe o destinatario.');
    try {
      const r = await api.post<{ link: string }>('/protocolos', { empresaId, documentoId: doc.id, destinatario, canal });
      setLink(r.link);
      toast('ok', 'Protocolo gerado.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <Modal aberto titulo={`Protocolar: ${doc.nomeArquivo}`} onFechar={onFechar}>
      <div className="space-y-3">
        <div>
          <label className="label">Destinatario</label>
          <input className="input" list="contatos" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="nome ou e-mail" />
          <datalist id="contatos">{contatos.map((c) => <option key={c.id} value={c.email ?? c.nome}>{c.nome}</option>)}</datalist>
        </div>
        <div>
          <label className="label">Canal</label>
          <select className="input" value={canal} onChange={(e) => setCanal(e.target.value as never)}>
            <option value="EMAIL">E-mail</option>
            <option value="AREA_VIP">Area VIP</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </div>
        {link && (
          <div className="rounded bg-emerald-50 p-2 text-xs text-emerald-700">
            Link de protocolo: <a href={link} target="_blank" rel="noreferrer" className="underline">{link}</a>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Fechar</button>
          <button className="btn-primary" onClick={criar}>Gerar protocolo</button>
        </div>
      </div>
    </Modal>
  );
}
