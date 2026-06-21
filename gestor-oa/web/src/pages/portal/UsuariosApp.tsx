import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Printer, Bell } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Spinner, useToast } from '../../components/ui';

interface EmpAcesso { id: string; razaoSocial: string; ativo: boolean; temAcesso: boolean; contatoId: string }
interface UsuarioApp { nome: string; email: string; createdAt: string; ultimoAcesso: string | null; empresas: EmpAcesso[]; temAcesso: boolean }

const dia = (s?: string | null) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

export default function UsuariosApp() {
  const toast = useToast();
  const navigate = useNavigate();
  const [lista, setLista] = useState<UsuarioApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [status, setStatus] = useState<'ativos' | 'todos' | 'inativos'>('ativos');
  const [sort, setSort] = useState<{ campo: 'nome' | 'cadastro' | 'acesso'; dir: 'asc' | 'desc' }>({ campo: 'nome', dir: 'asc' });

  function carregar() { setLoading(true); api.get<UsuarioApp[]>('/gestao-portal/usuarios-app').then(setLista).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  async function ativar(e: EmpAcesso) {
    try { const r = await api.post<{ email: string; senha: string }>(`/gestao-portal/usuarios-app/${e.contatoId}/ativar`, {}); toast('ok', `Acesso ativado. Login: ${r.email} / senha: ${r.senha}`); carregar(); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro'); }
  }
  function ordenar(campo: 'nome' | 'cadastro' | 'acesso') {
    setSort((s) => (s.campo === campo ? { campo, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }));
  }

  if (loading) return <Spinner />;

  const termo = filtro.trim().toLowerCase();
  const filtrada = lista
    .filter((u) => {
      if (status === 'ativos' && !u.temAcesso) return false;
      if (status === 'inativos' && u.temAcesso) return false;
      if (termo && !u.nome.toLowerCase().includes(termo) && !u.email.toLowerCase().includes(termo) && !u.empresas.some((e) => e.razaoSocial.toLowerCase().includes(termo))) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.campo === 'cadastro') return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      if (sort.campo === 'acesso') return ((a.ultimoAcesso ? new Date(a.ultimoAcesso).getTime() : 0) - (b.ultimoAcesso ? new Date(b.ultimoAcesso).getTime() : 0)) * dir;
      return a.nome.localeCompare(b.nome, 'pt-BR') * dir;
    });

  function exportarCsv() {
    const linhas = ['Nome;E-mail;Empresa;Dt.cadastro;Ult.acesso;Status'];
    for (const u of filtrada) for (const e of u.empresas) linhas.push([u.nome, u.email, e.razaoSocial, dia(u.createdAt), dia(u.ultimoAcesso), e.temAcesso ? 'Ativo' : 'Sem acesso'].join(';'));
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'usuarios-app.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* breadcrumb */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <Users size={16} className="text-slate-400" />
          <span className="text-slate-400">Sistema</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-400">Aplicativo e Area VIP</span><span className="text-slate-300">&rsaquo;</span>
          <span className="font-medium text-slate-700">Gestao de usuarios do Aplicativo</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[280px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-400" />
          <input className="w-full rounded border border-marca-300 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-marca-500" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar Razao Social, Nome Fantasia, E-mail ou Nome de Usuario" />
        </div>
        <select className="rounded border border-slate-300 bg-white px-3 py-2 text-[13px] text-marca-600" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="ativos">Somente ativos</option>
          <option value="todos">Todos</option>
          <option value="inativos">Somente inativos</option>
        </select>
        <button className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={16} /> Filtrar</button>
        <button onClick={exportarCsv} title="Exportar para Excel (CSV)" className="grid h-9 w-10 place-items-center rounded bg-roxo-500 text-white hover:bg-roxo-600"><Printer size={17} /></button>
      </div>

      {/* tabela */}
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-300 text-left align-bottom text-[12px] font-bold text-marca-600">
              <ThSort campo="nome" label="Nome [E-mail]" sort={sort} onSort={ordenar} />
              <th className="px-3 py-2">Empresa</th>
              <ThSort campo="cadastro" label="Dt.cadastro" sort={sort} onSort={ordenar} />
              <ThSort campo="acesso" label="Ult.acesso" sort={sort} onSort={ordenar} />
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrada.map((u) => (
              <tr key={u.email} className="border-b border-slate-200 align-top odd:bg-white even:bg-fundo">
                <td className="px-3 py-2">
                  <span className="text-slate-700">{u.nome} </span>
                  <span className="font-medium text-status-danger">[{u.email}]</span>
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    {u.empresas.map((e) => (
                      <div key={e.contatoId}><button onClick={() => navigate(`/empresas/${e.id}`)} className="text-left font-medium text-marca-600 hover:underline">{e.razaoSocial}</button></div>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600">{dia(u.createdAt)}</td>
                <td className="px-3 py-2 text-slate-600">{dia(u.ultimoAcesso)}</td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    {u.empresas.map((e) => (
                      <div key={e.contatoId} className="flex items-center gap-2">
                        {e.temAcesso
                          ? <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[12px] font-medium text-emerald-700"><Bell size={12} /> Ativo</span>
                          : <><span className="rounded bg-slate-200 px-2 py-0.5 text-[12px] text-slate-600">Sem acesso</span><button onClick={() => ativar(e)} className="text-[12px] text-marca-600 hover:underline">ativar acesso</button></>}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {filtrada.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Nenhum usuario.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThSort({ campo, label, sort, onSort }: {
  campo: 'nome' | 'cadastro' | 'acesso'; label: string;
  sort: { campo: string; dir: 'asc' | 'desc' }; onSort: (c: 'nome' | 'cadastro' | 'acesso') => void;
}) {
  const ativo = sort.campo === campo;
  return (
    <th className="px-3 py-2">
      <button onClick={() => onSort(campo)} className="flex items-center gap-1 font-bold text-marca-600 hover:underline">
        {label}<span className="text-[10px] text-slate-400">{ativo ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </button>
    </th>
  );
}
