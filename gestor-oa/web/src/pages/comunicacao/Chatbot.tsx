import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { ChatbotFluxo } from '../../lib/tipos';

interface Opcao { texto: string; resposta: string }

export default function Chatbot() {
  const { sessao } = useAuth();
  const toast = useToast();
  const pode = temPermissao(sessao, 'portal_configurar');
  const [bots, setBots] = useState<ChatbotFluxo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<ChatbotFluxo | null>(null);

  function carregar() { setLoading(true); api.get<ChatbotFluxo[]>('/comunicacao/chatbots').then(setBots).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  async function novo() {
    const b = await api.post<ChatbotFluxo>('/comunicacao/chatbots', { nome: 'Novo fluxo', arvore: { pergunta: 'Como posso ajudar?', opcoes: [] } });
    carregar(); setSel(b);
  }

  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Chatbot (fluxos)</h1>
        {pode && <button className="btn-primary" onClick={novo}>+ Novo fluxo</button>}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card divide-y divide-slate-100 p-2">
          {bots.map((b) => (
            <button key={b.id} onClick={() => setSel(b)} className={`block w-full px-3 py-2 text-left text-sm ${sel?.id === b.id ? 'bg-marca-50 text-marca-700' : 'text-slate-600 hover:bg-slate-50'}`}>{b.nome}</button>
          ))}
          {bots.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">Nenhum fluxo.</p>}
        </div>
        <div className="lg:col-span-2">
          {sel ? <Editor key={sel.id} bot={sel} podeEditar={pode} onSalvo={carregar} onExcluido={() => { setSel(null); carregar(); }} /> : <div className="card p-10 text-center text-slate-400">Selecione ou crie um fluxo.</div>}
        </div>
      </div>
    </div>
  );
}

function Editor({ bot, podeEditar, onSalvo, onExcluido }: { bot: ChatbotFluxo; podeEditar: boolean; onSalvo: () => void; onExcluido: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(bot.nome);
  const [pergunta, setPergunta] = useState(bot.arvore?.pergunta ?? '');
  const [opcoes, setOpcoes] = useState<Opcao[]>((bot.arvore?.opcoes as Opcao[]) ?? []);
  const [simSel, setSimSel] = useState<number | null>(null);

  async function salvar() {
    try { await api.put(`/comunicacao/chatbots/${bot.id}`, { nome, arvore: { pergunta, opcoes } }); toast('ok', 'Salvo.'); onSalvo(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function excluir() { if (!confirm('Excluir fluxo?')) return; await api.del(`/comunicacao/chatbots/${bot.id}`); onExcluido(); }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold text-slate-700">Editor</h2>
        <div><label className="label">Nome do fluxo</label><input className="input" value={nome} disabled={!podeEditar} onChange={(e) => setNome(e.target.value)} /></div>
        <div><label className="label">Pergunta inicial</label><input className="input" value={pergunta} disabled={!podeEditar} onChange={(e) => setPergunta(e.target.value)} /></div>
        <div className="space-y-2">
          <label className="label">Opcoes (texto → resposta)</label>
          {opcoes.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" placeholder="Opcao" value={o.texto} disabled={!podeEditar} onChange={(e) => setOpcoes((a) => a.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))} />
              <input className="input" placeholder="Resposta" value={o.resposta} disabled={!podeEditar} onChange={(e) => setOpcoes((a) => a.map((x, j) => j === i ? { ...x, resposta: e.target.value } : x))} />
              {podeEditar && <button className="btn-ghost" onClick={() => setOpcoes((a) => a.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          {podeEditar && <button className="btn-ghost border border-slate-300 text-xs" onClick={() => setOpcoes((a) => [...a, { texto: '', resposta: '' }])}>+ Opcao</button>}
        </div>
        {podeEditar && <div className="flex gap-2"><button className="btn-primary" onClick={salvar}>Salvar</button><button className="btn-ghost text-red-600" onClick={excluir}>Excluir</button></div>}
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="font-semibold text-slate-700">Simulador</h2>
        <div className="rounded bg-slate-50 p-3 text-sm">
          <div className="mb-2 rounded bg-white px-3 py-2 text-slate-700">{pergunta || '...'}</div>
          {simSel === null ? (
            <div className="space-y-1">
              {opcoes.map((o, i) => <button key={i} onClick={() => setSimSel(i)} className="block w-full rounded bg-marca-500 px-3 py-1.5 text-left text-white hover:bg-marca-600">{o.texto || '(opcao)'}</button>)}
              {opcoes.length === 0 && <p className="text-slate-400">Adicione opcoes para testar.</p>}
            </div>
          ) : (
            <div>
              <div className="mb-2 ml-auto w-fit rounded bg-marca-100 px-3 py-1.5 text-marca-800">{opcoes[simSel]?.texto}</div>
              <div className="rounded bg-white px-3 py-2 text-slate-700">{opcoes[simSel]?.resposta || '(sem resposta)'}</div>
              <button className="mt-2 text-xs text-marca-600 hover:underline" onClick={() => setSimSel(null)}>Reiniciar</button>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400">O chatbot conecta de verdade quando o provedor oficial do WhatsApp estiver configurado.</p>
      </div>
    </div>
  );
}
