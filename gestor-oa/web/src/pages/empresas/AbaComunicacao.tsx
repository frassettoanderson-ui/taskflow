import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Badge, Spinner, useToast } from '../../components/ui';
import type { ComunicacaoLogItem } from '../../lib/tipos';
import { STATUS_COM_INFO } from '../../lib/tipos';

export default function AbaComunicacao({ empresaId }: { empresaId: string }) {
  const toast = useToast();
  const [itens, setItens] = useState<ComunicacaoLogItem[] | null>(null);
  const [numero, setNumero] = useState('');
  const [mensagem, setMensagem] = useState('');

  function carregar() { api.get<ComunicacaoLogItem[]>(`/comunicacao/historico/${empresaId}`).then(setItens); }
  useEffect(carregar, [empresaId]);

  async function enviarWhats() {
    if (!numero || !mensagem) return;
    try {
      const r = await api.post<{ tipo: string; link?: string }>('/comunicacao/whatsapp', { empresaId, numero, mensagem });
      if (r.link) window.open(r.link, '_blank');
      toast('ok', 'WhatsApp registrado.');
      setMensagem(''); carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function reenviar(id: string) {
    try { await api.post(`/comunicacao/${id}/reenviar`); toast('ok', 'Reenviado.'); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-2 p-4">
        <h2 className="font-semibold text-slate-700">Enviar por WhatsApp</h2>
        <div className="flex flex-wrap gap-2">
          <input className="input w-44" placeholder="Numero (DDD+numero)" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <input className="input flex-1" placeholder="Mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          <button className="btn-primary" onClick={enviarWhats}>Abrir WhatsApp</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-600">Historico de comunicacao</div>
        {!itens ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Canal</th><th className="px-3 py-2">Destinatario</th><th className="px-3 py-2">Assunto</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Quando</th><th></th></tr></thead>
            <tbody>
              {itens.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{l.canal === 'EMAIL' ? '✉️' : '📱'}</td>
                  <td className="px-3 py-2 text-slate-600">{l.destinatario}</td>
                  <td className="px-3 py-2 text-slate-500">{l.assunto ?? '—'}</td>
                  <td className="px-3 py-2"><Badge cor={STATUS_COM_INFO[l.status]?.cor}>{STATUS_COM_INFO[l.status]?.label ?? l.status}</Badge></td>
                  <td className="px-3 py-2 text-xs text-slate-400">{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2 text-right">{l.status === 'FALHOU' && l.canal === 'EMAIL' && <button className="text-xs text-marca-600 hover:underline" onClick={() => reenviar(l.id)}>reenviar</button>}</td>
                </tr>
              ))}
              {itens.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Nenhuma comunicacao.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
