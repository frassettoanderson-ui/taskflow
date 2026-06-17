import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Spinner, useToast } from '../../components/ui';
import type { Feriado } from '../../lib/tipos';

export default function Feriados() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ data: '', nome: '', abrangencia: 'NACIONAL' });

  function carregar() {
    setLoading(true);
    api.get<Feriado[]>(`/feriados?ano=${ano}`).then(setFeriados).finally(() => setLoading(false));
  }
  useEffect(carregar, [ano]);

  async function adicionar() {
    if (!novo.data || !novo.nome) return;
    try {
      await api.post('/feriados', novo);
      setNovo({ data: '', nome: '', abrangencia: 'NACIONAL' });
      toast('ok', 'Feriado adicionado.');
      carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function remover(id: string) {
    try { await api.del(`/feriados/${id}`); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Feriados</h1>
        <select className="input w-32" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {[ano - 1, ano, ano + 1, new Date().getFullYear(), new Date().getFullYear() + 1].filter((v, i, a) => a.indexOf(v) === i).sort().map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <p className="text-sm text-slate-500">Usados no calculo de dias uteis dos prazos. Nacionais ja vem seedados; adicione municipais/estaduais.</p>

      {podeGerenciar && (
        <div className="card flex flex-wrap items-end gap-2 p-4">
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={novo.data} onChange={(e) => setNovo((n) => ({ ...n, data: e.target.value }))} />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="label">Nome</label>
            <input className="input" value={novo.nome} onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label">Abrangencia</label>
            <select className="input" value={novo.abrangencia} onChange={(e) => setNovo((n) => ({ ...n, abrangencia: e.target.value }))}>
              <option value="NACIONAL">Nacional</option>
              <option value="ESTADUAL">Estadual</option>
              <option value="MUNICIPAL">Municipal</option>
            </select>
          </div>
          <button className="btn-primary" onClick={adicionar}>Adicionar</button>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Feriado</th><th className="px-3 py-2">Abrangencia</th><th></th></tr>
            </thead>
            <tbody>
              {feriados.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{new Date(f.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                  <td className="px-3 py-2 text-slate-700">{f.nome}</td>
                  <td className="px-3 py-2 text-slate-500">{f.abrangencia}{f.uf ? ` - ${f.uf}` : ''}</td>
                  <td className="px-3 py-2 text-right">
                    {podeGerenciar && <button className="text-red-500 hover:underline" onClick={() => remover(f.id)}>remover</button>}
                  </td>
                </tr>
              ))}
              {feriados.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Nenhum feriado em {ano}.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
