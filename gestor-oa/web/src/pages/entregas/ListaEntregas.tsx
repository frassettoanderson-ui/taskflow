import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, getAccessToken } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Modal, Spinner, useToast } from '../../components/ui';
import type {
  Entrega, StatusEntrega, Departamento, UsuarioBasico, Obrigacao, Tag,
} from '../../lib/tipos';
import { STATUS_INFO, dataBR } from '../../lib/tipos';

interface Pagina { items: Entrega[]; total: number; totalPages: number; page: number }
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function ListaEntregas() {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeBaixar = temPermissao(sessao, 'entregas_baixar');
  const podeEditarPrazo = temPermissao(sessao, 'entregas_editar_prazos');
  const podeMassa = temPermissao(sessao, 'entregas_acoes_massa');
  const podeDispensar = temPermissao(sessao, 'entregas_dispensar');

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [departamentoId, setDepartamentoId] = useState('');
  const [status, setStatus] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [tagId, setTagId] = useState('');
  const [page, setPage] = useState(1);

  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [loading, setLoading] = useState(true);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioBasico[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [baixando, setBaixando] = useState<Entrega | null>(null);
  const [modalMassa, setModalMassa] = useState(false);
  const [editPrazo, setEditPrazo] = useState<Entrega | null>(null);

  useEffect(() => {
    api.get<Departamento[]>('/departamentos').then(setDepartamentos).catch(() => undefined);
    api.get<UsuarioBasico[]>('/usuarios').then(setUsuarios).catch(() => undefined);
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
  }, []);

  function carregar() {
    setLoading(true);
    const qs = new URLSearchParams({ ano: String(ano), mes: String(mes), page: String(page), limit: '50' });
    if (departamentoId) qs.set('departamentoId', departamentoId);
    if (status) qs.set('status', status);
    if (responsavelId) qs.set('responsavelId', responsavelId);
    if (tagId) qs.set('tagId', tagId);
    api.get<Pagina>(`/entregas?${qs}`).then(setPagina).catch((e) => toast('erro', e instanceof ApiError ? e.message : 'Erro')).finally(() => setLoading(false));
  }
  useEffect(carregar, [ano, mes, departamentoId, status, responsavelId, tagId, page]);
  useEffect(() => setPage(1), [ano, mes, departamentoId, status, responsavelId, tagId]);

  const items = pagina?.items ?? [];
  const nomeUsuario = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome.split(' ')[0]])), [usuarios]);
  const todosSel = items.length > 0 && items.every((e) => sel.has(e.id));

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTodos() {
    setSel((s) => { const n = new Set(s); todosSel ? items.forEach((e) => n.delete(e.id)) : items.forEach((e) => n.add(e.id)); return n; });
  }

  async function gerarCompetencia() {
    if (!confirm(`Gerar entregas da competencia ${String(mes).padStart(2, '0')}/${ano}?`)) return;
    try {
      const r = await api.post<{ criadas: number }>('/entregas/gerar', { ano, mes });
      toast('ok', `${r.criadas} entrega(s) geradas.`);
      carregar();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function recalcular() {
    try { const r = await api.post<{ atualizadas: number }>('/entregas/recalcular'); toast('ok', `${r.atualizadas} status atualizados.`); carregar(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function desfazer(e: Entrega) {
    if (!confirm('Desfazer a baixa desta entrega?')) return;
    try { await api.post(`/entregas/${e.id}/desfazer`); toast('ok', 'Baixa desfeita.'); carregar(); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro'); }
  }
  async function dispensar(e: Entrega) {
    const motivo = prompt('Motivo da dispensa:');
    if (motivo === null) return;
    try { await api.post(`/entregas/${e.id}/dispensar`, { motivo }); toast('ok', 'Dispensada.'); carregar(); }
    catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro'); }
  }
  async function exportar() {
    const qs = new URLSearchParams({ ano: String(ano), mes: String(mes) });
    if (status) qs.set('status', status);
    const res = await fetch(`/api/v1/entregas/export?${qs}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'entregas.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const baixada = (e: Entrega) => ['ENTREGUE', 'ENTREGUE_JUSTIFICADA'].includes(e.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Lista de Entregas</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/entregas/calendario" className="btn-ghost border border-slate-300">Calendario</Link>
          <button className="btn-ghost border border-slate-300" onClick={exportar}>Exportar</button>
          {podeEditarPrazo && <button className="btn-ghost border border-slate-300" onClick={recalcular}>Recalcular status</button>}
          {podeEditarPrazo && <button className="btn-primary" onClick={gerarCompetencia}>Gerar competencia</button>}
        </div>
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Mes</label>
          <select className="input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Ano</label>
          <input type="number" className="input w-24" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Departamento</label>
          <select className="input" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
            <option value="">Todos</option>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Responsavel</label>
          <select className="input" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tag</label>
          <select className="input" value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">Todas</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
      </div>

      {sel.size > 0 && podeMassa && (
        <div className="flex items-center gap-3 rounded-md bg-marca-50 px-4 py-2 text-sm">
          <span className="font-medium text-marca-700">{sel.size} selecionada(s)</span>
          <button className="btn-ghost" onClick={() => setModalMassa(true)}>Acoes em massa</button>
          <button className="btn-ghost" onClick={() => setSel(new Set())}>Limpar</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {podeMassa && <th className="px-3 py-2"><input type="checkbox" checked={todosSel} onChange={toggleTodos} /></th>}
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Obrigacao</th>
                <th className="px-3 py-2">Comp.</th>
                <th className="px-3 py-2">Prazo tec.</th>
                <th className="px-3 py-2">Prazo legal</th>
                <th className="px-3 py-2">Resp.</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {podeMassa && <td className="px-3 py-2"><input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} /></td>}
                  <td className="px-3 py-2 font-medium text-slate-700">{e.empresa.razaoSocial}</td>
                  <td className="px-3 py-2">
                    {e.obrigacao.departamento && <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: e.obrigacao.departamento.cor }} />}
                    {e.obrigacao.nome}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{e.competencia}</td>
                  <td className="px-3 py-2 text-slate-500">{dataBR(e.prazoTecnico)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {podeEditarPrazo ? (
                      <button className="hover:underline" onClick={() => setEditPrazo(e)}>{dataBR(e.prazoLegal)}</button>
                    ) : dataBR(e.prazoLegal)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {e.responsavelPrazoId ? nomeUsuario.get(e.responsavelPrazoId) ?? '—' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge cor={STATUS_INFO[e.status].cor}>{STATUS_INFO[e.status].label}</Badge>
                    {e.origemBaixa === 'ROBO' && <span className="ml-1 text-[10px] text-marca-600">robo</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 text-xs">
                      {!baixada(e) && e.status !== 'DISPENSADA' && podeBaixar && (
                        <button className="font-medium text-status-ok hover:underline" onClick={() => setBaixando(e)}>OK</button>
                      )}
                      {baixada(e) && podeBaixar && (
                        <button className="text-amber-600 hover:underline" onClick={() => desfazer(e)}>desfazer</button>
                      )}
                      {!baixada(e) && podeDispensar && (
                        <button className="text-slate-400 hover:underline" onClick={() => dispensar(e)}>dispensar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400">
                  Nenhuma entrega nesta competencia. Use "Gerar competencia".
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pagina && pagina.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span className="text-slate-500">Pagina {pagina.page} de {pagina.totalPages} ({pagina.total})</span>
          <button className="btn-ghost" disabled={page >= pagina.totalPages} onClick={() => setPage((p) => p + 1)}>Proxima</button>
        </div>
      )}

      {baixando && <ModalBaixa entrega={baixando} onFechar={() => setBaixando(null)} onBaixado={() => { setBaixando(null); carregar(); }} />}
      {editPrazo && <ModalPrazo entrega={editPrazo} onFechar={() => setEditPrazo(null)} onSalvo={() => { setEditPrazo(null); carregar(); }} />}
      {modalMassa && <ModalMassa entregaIds={[...sel]} usuarios={usuarios} onFechar={() => setModalMassa(false)} onFeito={() => { setModalMassa(false); setSel(new Set()); carregar(); }} />}
    </div>
  );
}

function ModalBaixa({ entrega, onFechar, onBaixado }: { entrega: Entrega; onFechar: () => void; onBaixado: () => void }) {
  const toast = useToast();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [atualizarResp, setAtualizarResp] = useState(true);
  const [justificativa, setJustificativa] = useState('');
  const [enviarCliente, setEnviarCliente] = useState(false);
  const [arquivos, setArquivos] = useState<FileList | null>(null);
  const [salvando, setSalvando] = useState(false);

  const aposLegal = new Date(data + 'T12:00:00') > new Date(entrega.prazoLegal);

  async function confirmar() {
    if (entrega.obrigacao.exigeAnexoNaBaixa && (!arquivos || arquivos.length === 0))
      return toast('erro', 'Esta obrigacao exige anexo na baixa.');
    if (aposLegal && !justificativa.trim()) return toast('erro', 'Justificativa obrigatoria (apos prazo legal).');
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('dataEntrega', data);
      fd.append('atualizarResponsavel', String(atualizarResp));
      fd.append('justificativa', justificativa);
      fd.append('enviarCliente', String(enviarCliente));
      if (arquivos) Array.from(arquivos).forEach((f) => fd.append('anexos', f));
      await api.upload(`/entregas/${entrega.id}/baixar`, fd);
      toast('ok', enviarCliente ? 'Baixado! (envio ao cliente: Modulo 8)' : 'Entrega baixada.');
      onBaixado();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Dar baixa (OK)" onFechar={onFechar}>
      <div className="space-y-3">
        <div className="rounded bg-slate-50 px-3 py-2 text-sm">
          <strong>{entrega.empresa.razaoSocial}</strong><br />
          {entrega.obrigacao.nome} — comp. {entrega.competencia}
        </div>
        <div>
          <label className="label">Data da entrega</label>
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        {aposLegal && (
          <div>
            <label className="label text-red-600">Justificativa (apos prazo legal) *</label>
            <textarea className="input" rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Anexos {entrega.obrigacao.exigeAnexoNaBaixa && <span className="text-red-600">*</span>}</label>
          <input type="file" multiple onChange={(e) => setArquivos(e.target.files)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={atualizarResp} onChange={(e) => setAtualizarResp(e.target.checked)} />
          Definir-me como responsavel pela entrega
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={enviarCliente} onChange={(e) => setEnviarCliente(e.target.checked)} />
          Enviar ao cliente agora (Modulo 8)
        </label>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar} disabled={salvando}>{salvando ? 'Salvando...' : 'Confirmar baixa'}</button>
        </div>
      </div>
    </Modal>
  );
}

function ModalPrazo({ entrega, onFechar, onSalvo }: { entrega: Entrega; onFechar: () => void; onSalvo: () => void }) {
  const toast = useToast();
  const [legal, setLegal] = useState(entrega.prazoLegal.slice(0, 10));
  const [tecnico, setTecnico] = useState(entrega.prazoTecnico.slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    setSalvando(true);
    try { await api.put(`/entregas/${entrega.id}/prazo`, { prazoLegal: legal, prazoTecnico: tecnico }); toast('ok', 'Prazo atualizado.'); onSalvo(); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }
  return (
    <Modal aberto titulo="Editar prazos" onFechar={onFechar}>
      <div className="space-y-3">
        <div><label className="label">Prazo tecnico</label><input type="date" className="input" value={tecnico} onChange={(e) => setTecnico(e.target.value)} /></div>
        <div><label className="label">Prazo legal</label><input type="date" className="input" value={legal} onChange={(e) => setLegal(e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

function ModalMassa({ entregaIds, usuarios, onFechar, onFeito }: { entregaIds: string[]; usuarios: UsuarioBasico[]; onFechar: () => void; onFeito: () => void }) {
  const toast = useToast();
  const [acao, setAcao] = useState<'postergar' | 'transferir' | 'baixar' | 'dispensar'>('postergar');
  const [dias, setDias] = useState(0);
  const [novaData, setNovaData] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function executar() {
    setSalvando(true);
    try {
      await api.post('/entregas/acoes-massa', {
        entregaIds, acao,
        dias: acao === 'postergar' && !novaData ? dias : undefined,
        novaData: acao === 'postergar' && novaData ? novaData : undefined,
        responsavelId: acao === 'transferir' ? responsavelId : undefined,
        motivo: acao === 'dispensar' ? motivo : undefined,
      });
      toast('ok', 'Acao aplicada.');
      onFeito();
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={`Acoes em massa (${entregaIds.length})`} onFechar={onFechar}>
      <div className="space-y-3">
        <select className="input" value={acao} onChange={(e) => setAcao(e.target.value as never)}>
          <option value="postergar">Postergar/atualizar prazo</option>
          <option value="transferir">Transferir responsavel</option>
          <option value="baixar">Dar baixa</option>
          <option value="dispensar">Dispensar</option>
        </select>
        {acao === 'postergar' && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">+ N dias</label><input type="number" className="input" value={dias} onChange={(e) => setDias(Number(e.target.value))} /></div>
            <div><label className="label">ou nova data legal</label><input type="date" className="input" value={novaData} onChange={(e) => setNovaData(e.target.value)} /></div>
          </div>
        )}
        {acao === 'transferir' && (
          <select className="input" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Selecione o responsavel</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
        {acao === 'dispensar' && <input className="input" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={executar} disabled={salvando}>Aplicar</button>
        </div>
      </div>
    </Modal>
  );
}
