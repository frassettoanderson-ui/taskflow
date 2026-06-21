import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Badge, Spinner, useToast } from '../../components/ui';

interface Sol { id: string; titulo: string; status: string; contatoNome: string; empresa?: { razaoSocial: string }; createdAt: string }
interface Detalhe { titulo: string; status: string; empresa?: { razaoSocial: string }; avaliacaoNota: number | null; mensagens: { id: string; autorNome: string; autorTipo: string; texto: string; createdAt: string }[] }

export default function SolicitacoesInbox() {
  const toast = useToast();
  const [itens, setItens] = useState<Sol[]>([]);
  const [status, setStatus] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);

  function carregar() { api.get<Sol[]>(`/gestao-portal/solicitacoes${status ? `?status=${status}` : ''}`).then(setItens); }
  useEffect(carregar, [status]);

  if (aberta) return <Thread id={aberta} onVoltar={() => { setAberta(null); carregar(); }} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Solicitacoes dos clientes</h1>
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas</option>
          <option value="ABERTA">Abertas</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="FINALIZADA">Finalizadas</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Titulo</th><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2">Status</th></tr>
          </thead>
          <tbody>
            {itens.map((s) => (
              <tr key={s.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setAberta(s.id)}>
                <td className="px-3 py-2 font-medium text-slate-700">{s.titulo}</td>
                <td className="px-3 py-2 text-slate-500">{s.empresa?.razaoSocial}</td>
                <td className="px-3 py-2 text-slate-500">{s.contatoNome}</td>
                <td className="px-3 py-2"><Badge className="bg-fundo text-slate-600">{s.status}</Badge></td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-400">Nenhuma solicitacao.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Thread({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const toast = useToast();
  const [s, setS] = useState<Detalhe | null>(null);
  const [texto, setTexto] = useState('');
  function carregar() { api.get<Detalhe>(`/gestao-portal/solicitacoes/${id}`).then(setS); }
  useEffect(carregar, [id]);
  if (!s) return <Spinner />;
  async function enviar() { if (!texto.trim()) return; try { await api.post(`/gestao-portal/solicitacoes/${id}/mensagem`, { texto }); setTexto(''); carregar(); } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); } }
  async function mudar(st: string) { await api.post(`/gestao-portal/solicitacoes/${id}/status`, { status: st }); carregar(); }
  return (
    <div className="max-w-3xl space-y-4">
      <button onClick={onVoltar} className="text-sm text-marca-600 hover:underline">← Voltar</button>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{s.titulo} <span className="text-sm text-slate-400">· {s.empresa?.razaoSocial}</span></h1>
        <select className="input w-44" value={s.status} onChange={(e) => mudar(e.target.value)}>
          <option value="ABERTA">Aberta</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="FINALIZADA">Finalizada</option>
        </select>
      </div>
      {s.avaliacaoNota && <div className="text-sm text-amber-600">Avaliacao do cliente: {'★'.repeat(s.avaliacaoNota)}</div>}
      <div className="card space-y-2 p-4">
        {s.mensagens.map((m) => (
          <div key={m.id} className={`rounded p-2 text-sm ${m.autorTipo === 'USUARIO' ? 'bg-marca-50' : 'bg-fundo'}`}>
            <div className="text-xs text-slate-400">{m.autorNome} · {new Date(m.createdAt).toLocaleString('pt-BR')}</div>
            <div className="text-slate-700">{m.texto}</div>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <input className="input flex-1" placeholder="Responder ao cliente..." value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button className="btn-primary" onClick={enviar}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
