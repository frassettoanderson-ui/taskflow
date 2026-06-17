import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Spinner, useToast } from '../../components/ui';
import type { ProcessoDetalhe } from '../../lib/tipos';
import { STATUS_PROCESSO_INFO, dataBR } from '../../lib/tipos';

const COR_PASSO: Record<string, string> = { PENDENTE: '#94a3b8', CONCLUIDO: '#5cb85c', DISPENSADO: '#cbd5e1' };

export default function ProcessoFicha() {
  const { id = '' } = useParams();
  const { sessao } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeOperar = temPermissao(sessao, 'processos_operar');

  const [p, setP] = useState<ProcessoDetalhe | null>(null);
  const [comentario, setComentario] = useState('');
  const [ocultarDispensados, setOcultar] = useState(false);

  function carregar() { api.get<ProcessoDetalhe>(`/processos/${id}`).then(setP); }
  useEffect(carregar, [id]);

  if (!p) return <Spinner />;

  async function acao(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); toast('ok', msg); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  const passos = ocultarDispensados ? p.passos.filter((x) => x.status !== 'DISPENSADO') : p.passos;

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <button onClick={() => navigate('/processos')} className="text-sm text-marca-600 hover:underline">← Voltar</button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">{p.nome}</h1>
            <p className="text-slate-500">{p.empresa.razaoSocial} · inicio {dataBR(p.dataInicio)}</p>
          </div>
          <Badge cor={STATUS_PROCESSO_INFO[p.status].cor}>{STATUS_PROCESSO_INFO[p.status].label}</Badge>
        </div>
      </div>

      {podeOperar && (
        <div className="flex flex-wrap gap-2">
          {p.status === 'EM_ANDAMENTO' && <button className="btn-ghost border border-slate-300" onClick={() => { const d = prompt('Suspender por quantos dias?'); if (d) acao(() => api.post(`/processos/${id}/suspender`, { dias: Number(d) }), 'Suspenso.'); }}>Suspender</button>}
          {p.status === 'SUSPENSO' && <button className="btn-ghost border border-slate-300" onClick={() => acao(() => api.post(`/processos/${id}/status`, { status: 'EM_ANDAMENTO' }), 'Retomado.')}>Retomar</button>}
          {p.status !== 'CANCELADO' && p.status !== 'CONCLUIDO' && <button className="btn-ghost text-red-600" onClick={() => { if (confirm('Cancelar processo?')) acao(() => api.post(`/processos/${id}/status`, { status: 'CANCELADO' }), 'Cancelado.'); }}>Cancelar</button>}
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={ocultarDispensados} onChange={(e) => setOcultar(e.target.checked)} /> Ocultar dispensados</label>
        </div>
      )}

      {/* Timeline de passos */}
      <div className="card divide-y divide-slate-100">
        {passos.map((passo) => (
          <div key={passo.id} className="flex items-start gap-3 p-4">
            <span className="mt-1 inline-block h-3 w-3 flex-shrink-0 rounded-full" style={{ background: COR_PASSO[passo.status] }} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${passo.status === 'DISPENSADO' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{passo.ordem}. {passo.titulo}</span>
                {passo.bloqueante && <Badge className="bg-amber-100 text-amber-700">bloqueante</Badge>}
                {passo.acaoAutomatica !== 'NENHUMA' && <Badge className="bg-blue-50 text-blue-700">{passo.acaoAutomatica}</Badge>}
              </div>
              {passo.descricao && <p className="text-sm text-slate-500">{passo.descricao}</p>}
              <div className="text-xs text-slate-400">
                {passo.prazo && `Prazo: ${dataBR(passo.prazo)}`}
                {passo.concluidoEm && ` · concluido ${dataBR(passo.concluidoEm)}`}
              </div>
            </div>
            {podeOperar && passo.status === 'PENDENTE' && (
              <div className="flex gap-2 text-xs">
                <button className="font-medium text-status-ok hover:underline" onClick={() => acao(() => api.post(`/processos/passos/${passo.id}/concluir`), 'Passo concluido.')}>concluir</button>
                <button className="text-slate-400 hover:underline" onClick={() => acao(() => api.post(`/processos/passos/${passo.id}/dispensar`), 'Dispensado.')}>dispensar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {podeOperar && (
        <button className="btn-ghost border border-slate-300" onClick={() => { const t = prompt('Titulo do novo passo:'); if (t) acao(() => api.post(`/processos/${id}/passos`, { titulo: t }), 'Passo adicionado.'); }}>+ Adicionar passo avulso</button>
      )}

      {/* Comentarios */}
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold text-slate-700">Comentarios</h2>
        {podeOperar && (
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Comentar..." value={comentario} onChange={(e) => setComentario(e.target.value)} />
            <button className="btn-primary" onClick={() => { if (comentario.trim()) { acao(() => api.post(`/processos/${id}/comentarios`, { texto: comentario }), 'Comentado.'); setComentario(''); } }}>Enviar</button>
          </div>
        )}
        <div className="space-y-2">
          {p.comentarios.map((c) => (
            <div key={c.id} className="rounded bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-700">{c.texto}</span>
              <span className="ml-2 text-xs text-slate-400">{new Date(c.createdAt).toLocaleString('pt-BR')}</span>
            </div>
          ))}
          {p.comentarios.length === 0 && <p className="text-sm text-slate-400">Sem comentarios.</p>}
        </div>
      </div>
    </div>
  );
}
