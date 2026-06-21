import { Fragment, useEffect, useState } from 'react';
import { Megaphone, Search, Plus, Bell, Save } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Modal, Spinner, useToast } from '../../components/ui';

interface Comunicado { id: string; titulo: string; conteudo: string; ativo: boolean; createdAt: string; publicarEm?: string | null }

const dt = (s?: string | null) => s ? new Date(s).toLocaleString('pt-BR') : '—';
const dia = (s?: string | null) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

export default function ComunicadosAdmin() {
  const { sessao } = useAuth();
  const toast = useToast();
  const pode = temPermissao(sessao, 'portal_comunicados');
  const [itens, setItens] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [acoesId, setAcoesId] = useState<string | null>(null);

  // filtros
  const [busca, setBusca] = useState('');
  const [verAtivos, setVerAtivos] = useState(true);
  const [verInativos, setVerInativos] = useState(true);

  function carregar() { setLoading(true); api.get<Comunicado[]>('/gestao-portal/comunicados').then(setItens).finally(() => setLoading(false)); }
  useEffect(carregar, []);

  if (loading) return <Spinner />;

  const termo = busca.trim().toLowerCase();
  const lista = itens.filter((c) => {
    if (termo && !c.titulo.toLowerCase().includes(termo)) return false;
    if (c.ativo ? !verAtivos : !verInativos) return false;
    return true;
  });

  return (
    <div className="-m-6 min-h-full bg-fundo p-4 text-[13px]">
      {/* breadcrumb */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <Megaphone size={16} className="text-slate-400" />
          <span className="text-slate-400">Sistema</span><span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-400">Aplicativo e Area VIP</span><span className="text-slate-300">&rsaquo;</span>
          <span className="font-medium text-slate-700">Relacao de Comunicados do Aplicativo</span>
          <span className="text-slate-400">[ALT+C]</span>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-slate-400">
          <Search size={13} /><span className="text-[12px]">Central de ajuda</span>
        </div>
      </div>

      {/* toolbar: filtro + flags + acoes */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-400" />
          <input className="w-full rounded border border-marca-300 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-marca-500" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por ID, Empresa, Desc Comunicados" />
        </div>
        <label className="flex items-center gap-1 text-[13px] text-slate-600"><input type="checkbox" checked={verAtivos} onChange={(e) => setVerAtivos(e.target.checked)} /> Ativos</label>
        <label className="flex items-center gap-1 text-[13px] text-slate-600"><input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} /> Inativos</label>
        <button className="flex items-center gap-2 rounded bg-status-ok px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"><Search size={16} /> Filtrar</button>
        {pode && <button onClick={() => setNovo(true)} className="flex items-center gap-2 rounded bg-marca-500 px-5 py-2 text-sm font-medium text-white hover:bg-marca-600"><Plus size={16} /> Novo Comunicado</button>}
      </div>

      {/* tabela 4 colunas (pares empilhados) */}
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-300 text-left align-top text-[12px] font-bold text-slate-600">
              <th className="px-4 py-2">Assunto<br />Criador</th>
              <th className="px-4 py-2">Empresa<br />Anexo</th>
              <th className="px-4 py-2">Data Cadastro<br />Dt.Atualizacao</th>
              <th className="px-4 py-2">Status<br />Dt.Publicacao</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <Fragment key={c.id}>
                <tr className="cursor-pointer border-b border-slate-200 align-top odd:bg-white even:bg-fundo hover:bg-caixa" onClick={() => setAcoesId((id) => id === c.id ? null : c.id)}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-status-danger">{c.titulo}</div>
                    <div className="text-slate-700">{sessao?.usuario?.nome ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-status-danger">Todas as empresas</div>
                    <div className="text-slate-400">Sem anexo</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-status-danger">{dt(c.createdAt)}</div>
                    <div className="text-status-danger">{dt(c.createdAt)}</div>
                  </td>
                  <td className="px-4 py-2">
                    {c.ativo
                      ? <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[12px] font-medium text-emerald-700"><Bell size={12} /> Ativo</span>
                      : <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-0.5 text-[12px] font-medium text-slate-600">Inativo</span>}
                    <div className="mt-0.5 text-slate-600">{dia(c.publicarEm ?? c.createdAt)}</div>
                  </td>
                </tr>
                {/* form inline de edicao ao clicar na linha */}
                {acoesId === c.id && (
                  <tr className="bg-caixa">
                    <td colSpan={4} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <ComunicadoForm c={c} pode={pode} onSalvo={() => { setAcoesId(null); carregar(); }} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {lista.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Nenhum comunicado.</td></tr>}
          </tbody>
        </table>
      </div>

      {novo && <ComunicadoModal onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />}
    </div>
  );
}

const LBL_R = 'mb-1 block text-[13px] font-bold text-status-danger';
const INP_F = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';

// Formulario inline (abre ao clicar na linha): Assunto / Status / Descricao + Salvar + Registro de Leitura
function ComunicadoForm({ c, pode, onSalvo }: { c: Comunicado; pode: boolean; onSalvo: () => void }) {
  const toast = useToast();
  const [titulo, setTitulo] = useState(c.titulo);
  const [conteudo, setConteudo] = useState(c.conteudo);
  const [ativo, setAtivo] = useState(c.ativo);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try { await api.put(`/gestao-portal/comunicados/${c.id}`, { titulo, conteudo, ativo }); toast('ok', 'Salvo.'); onSalvo(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
        <div><label className={LBL_R}>Assunto</label><input className={INP_F} value={titulo} disabled={!pode} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label className={LBL_R}>Status</label>
          <select className={INP_F} value={ativo ? 'Ativo' : 'Inativo'} disabled={!pode} onChange={(e) => setAtivo(e.target.value === 'Ativo')}>
            <option>Ativo</option><option>Inativo</option>
          </select>
        </div>
      </div>
      <div><label className={LBL_R}>Descricao</label><textarea className={INP_F} rows={4} value={conteudo} disabled={!pode} onChange={(e) => setConteudo(e.target.value)} /></div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {pode && <button onClick={salvar} disabled={salvando} className="flex items-center justify-center gap-2 rounded bg-roxo-500 py-2 text-sm font-medium text-white hover:bg-roxo-600 disabled:opacity-60"><Save size={15} /> {salvando ? 'Salvando...' : 'Salvar'}</button>}
        <button onClick={() => toast('ok', 'Em construcao: Registro de Leitura.')} className="flex items-center justify-center gap-2 rounded bg-marca-400 py-2 text-sm font-medium text-white hover:bg-marca-500"><Search size={15} /> Registro de Leitura</button>
      </div>
    </div>
  );
}

function ComunicadoModal({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  async function salvar() {
    try {
      await api.post('/gestao-portal/comunicados', { titulo, conteudo });
      toast('ok', 'Salvo.'); onSalvo();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  return (
    <Modal aberto titulo="Novo comunicado" onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Titulo</label><input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div><label className="label">Conteudo</label><textarea className="input" rows={5} value={conteudo} onChange={(e) => setConteudo(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></div>
      </div>
    </Modal>
  );
}
