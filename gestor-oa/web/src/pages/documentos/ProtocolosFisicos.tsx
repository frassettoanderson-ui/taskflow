import { useEffect, useRef, useState } from 'react';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type { ProtocoloFisico, EmpresaLista } from '../../lib/tipos';
import { STATUS_FISICO_LABEL, dataBR } from '../../lib/tipos';

const CORES: Record<string, string> = {
  AGUARDANDO_RETIRADA: '#f0ad4e', ENTREGUE: '#5cb85c', DEVOLVIDO: '#5b9bd5', CANCELADO: '#94a3b8',
};

export default function ProtocolosFisicos() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'documentos_upload');
  const [itens, setItens] = useState<ProtocoloFisico[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [assinar, setAssinar] = useState<ProtocoloFisico | null>(null);

  function carregar() {
    setLoading(true);
    api.get<ProtocoloFisico[]>('/protocolos-fisicos').then(setItens).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function mudarStatus(p: ProtocoloFisico, status: ProtocoloFisico['status']) {
    try { await api.put(`/protocolos-fisicos/${p.id}`, { status }); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function recibo(p: ProtocoloFisico) {
    const res = await fetch(`/api/v1/protocolos-fisicos/${p.id}/recibo`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!res.ok) return toast('erro', 'Falha ao gerar recibo.');
    const html = await res.text();
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Protocolos Fisicos</h1>
        {podeGerenciar && <button className="btn-primary" onClick={() => setNovo(true)}>+ Novo protocolo</button>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Documentos</th><th className="px-3 py-2">Retirado por</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Status</th><th></th></tr>
          </thead>
          <tbody>
            {itens.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-700">{p.empresa?.razaoSocial}</td>
                <td className="px-3 py-2 text-slate-600">{p.descricao}</td>
                <td className="px-3 py-2 text-slate-500">{p.retiradoPor ?? '—'}</td>
                <td className="px-3 py-2 text-slate-500">{dataBR(p.data)}</td>
                <td className="px-3 py-2"><Badge cor={CORES[p.status]}>{STATUS_FISICO_LABEL[p.status]}</Badge></td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 text-xs">
                    <button className="text-marca-600 hover:underline" onClick={() => recibo(p)}>recibo</button>
                    {podeGerenciar && <button className="text-marca-600 hover:underline" onClick={() => setAssinar(p)}>assinar</button>}
                    {podeGerenciar && p.status === 'AGUARDANDO_RETIRADA' && <button className="text-emerald-600 hover:underline" onClick={() => mudarStatus(p, 'ENTREGUE')}>entregar</button>}
                    {podeGerenciar && <button className="text-slate-400 hover:underline" onClick={() => mudarStatus(p, 'DEVOLVIDO')}>devolver</button>}
                  </div>
                </td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Nenhum protocolo fisico.</td></tr>}
          </tbody>
        </table>
      </div>

      {novo && <ModalNovo onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />}
      {assinar && <ModalAssinar protocolo={assinar} onFechar={() => setAssinar(null)} onSalvo={() => { setAssinar(null); carregar(); }} />}
    </div>
  );
}

function ModalNovo({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [empresas, setEmpresas] = useState<EmpresaLista[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [retiradoPor, setRetiradoPor] = useState('');

  useEffect(() => { api.get<{ items: EmpresaLista[] }>('/empresas?limit=100').then((p) => setEmpresas(p.items)).catch(() => undefined); }, []);

  async function salvar() {
    if (!empresaId || !descricao) return toast('erro', 'Preencha empresa e documentos.');
    try { await api.post('/protocolos-fisicos', { empresaId, descricao, retiradoPor }); toast('ok', 'Protocolo criado.'); onSalvo(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <Modal aberto titulo="Novo protocolo fisico" onFechar={onFechar}>
      <div className="space-y-3">
        <div>
          <label className="label">Empresa</label>
          <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">Selecione</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}
          </select>
        </div>
        <div><label className="label">Documentos</label><textarea className="input" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        <div><label className="label">Retirado/recebido por</label><input className="input" value={retiradoPor} onChange={(e) => setRetiradoPor(e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

function ModalAssinar({ protocolo, onFechar, onSalvo }: { protocolo: ProtocoloFisico; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    const cli = 'touches' in e ? e.touches[0] : e;
    return { x: cli.clientX - r.left, y: cli.clientY - r.top };
  }
  function start(e: React.MouseEvent | React.TouchEvent) { desenhando.current = true; const ctx = canvasRef.current!.getContext('2d')!; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!desenhando.current) return;
    const ctx = canvasRef.current!.getContext('2d')!; const { x, y } = pos(e);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a'; ctx.lineTo(x, y); ctx.stroke();
  }
  function end() { desenhando.current = false; }
  function limpar() { const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); }

  async function salvar() {
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    try { await api.post(`/protocolos-fisicos/${protocolo.id}/assinatura`, { imagemBase64: dataUrl }); toast('ok', 'Assinatura salva.'); onSalvo(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <Modal aberto titulo="Assinatura" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Assine no quadro abaixo:</p>
        <canvas
          ref={canvasRef} width={400} height={150}
          className="w-full touch-none rounded border border-slate-300 bg-white"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
        <div className="flex justify-between">
          <button className="btn-ghost" onClick={limpar}>Limpar</button>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
            <button className="btn-primary" onClick={salvar}>Salvar assinatura</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
