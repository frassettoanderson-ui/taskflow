import { useEffect, useState } from 'react';
import { Smartphone, KeyRound } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Spinner, useToast } from '../../components/ui';

interface ContatoApp { id: string; nome: string; email: string; empresa: string; ativo: boolean; temAcesso: boolean }

export default function UsuariosApp() {
  const toast = useToast();
  const [lista, setLista] = useState<ContatoApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  function carregar() { setLoading(true); api.get<ContatoApp[]>('/gestao-portal/usuarios-app').then(setLista).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  async function ativar(c: ContatoApp) {
    try { const r = await api.post<{ email: string; senha: string }>(`/gestao-portal/usuarios-app/${c.id}/ativar`, {}); toast('ok', `Acesso ativado. Login: ${r.email} / senha: ${r.senha}`); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function ativarMassa() {
    const semAcesso = lista.filter((c) => !c.temAcesso && c.ativo).length;
    if (semAcesso === 0) return toast('ok', 'Todos os contatos ja tem acesso.');
    if (!confirm(`Gerar senha provisoria "123" para ${semAcesso} contato(s) sem acesso?`)) return;
    try { const r = await api.post<{ ativados: number }>('/gestao-portal/usuarios-app/ativar-massa', {}); toast('ok', `${r.ativados} contato(s) ativado(s) com a senha 123.`); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (loading) return <Spinner />;
  const termo = filtro.trim().toLowerCase();
  const filtrada = termo ? lista.filter((c) => c.nome.toLowerCase().includes(termo) || c.email.toLowerCase().includes(termo) || c.empresa.toLowerCase().includes(termo)) : lista;
  const comAcesso = lista.filter((c) => c.temAcesso).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-800"><Smartphone size={22} /> Usuarios do APP</h1>
          <p className="text-sm text-slate-500">Contatos das empresas com acesso a Area VIP. {comAcesso} de {lista.length} com acesso liberado.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={ativarMassa}><KeyRound size={16} /> Ativar todos (senha 123)</button>
      </div>

      <input className="input max-w-md" placeholder="Filtrar por nome, e-mail ou empresa" value={filtro} onChange={(e) => setFiltro(e.target.value)} />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Contato</th><th className="px-3 py-2">E-mail</th><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Acesso</th><th></th></tr>
          </thead>
          <tbody>
            {filtrada.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-700">{c.nome}</td>
                <td className="px-3 py-2 text-slate-500">{c.email}</td>
                <td className="px-3 py-2 text-slate-500">{c.empresa}</td>
                <td className="px-3 py-2">{c.temAcesso ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Ativo</span> : <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Sem acesso</span>}</td>
                <td className="px-3 py-2 text-right">
                  {!c.temAcesso && <button className="text-xs text-marca-600 hover:underline" onClick={() => ativar(c)}>ativar acesso</button>}
                </td>
              </tr>
            ))}
            {filtrada.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Nenhum contato com e-mail cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
