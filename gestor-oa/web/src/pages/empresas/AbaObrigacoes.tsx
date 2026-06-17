import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth, temPermissao } from '../../lib/auth';
import { Badge, Spinner, useToast } from '../../components/ui';
import type {
  VinculoObrigacao,
  Regime,
  Grupo,
  Obrigacao,
} from '../../lib/tipos';

const CORES_ORIGEM: Record<string, string> = {
  REGIME: '#7c3aed',
  GRUPO: '#1d4ed8',
  MANUAL: '#475569',
};

export default function AbaObrigacoes({
  empresaId,
  regimeAtualId,
  onRegimeMudou,
}: {
  empresaId: string;
  regimeAtualId: string | null;
  onRegimeMudou: () => void;
}) {
  const { sessao } = useAuth();
  const toast = useToast();
  const podeGerenciar = temPermissao(sessao, 'obrigacoes_gerenciar');

  const [vinculos, setVinculos] = useState<VinculoObrigacao[] | null>(null);
  const [regimes, setRegimes] = useState<Regime[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [catalogo, setCatalogo] = useState<Obrigacao[]>([]);
  const [regimeSel, setRegimeSel] = useState(regimeAtualId ?? '');
  const [grupoSel, setGrupoSel] = useState('');
  const [obrigSel, setObrigSel] = useState('');
  const [ocultarInativas, setOcultarInativas] = useState(true);

  function carregar() {
    api.get<VinculoObrigacao[]>(`/empresa-obrigacoes/empresa/${empresaId}`).then(setVinculos);
  }
  useEffect(() => {
    carregar();
    api.get<Regime[]>('/regimes').then(setRegimes).catch(() => undefined);
    api.get<Grupo[]>('/grupos').then(setGrupos).catch(() => undefined);
    api.get<Obrigacao[]>('/obrigacoes').then(setCatalogo).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function aplicarRegime() {
    try {
      const r = await api.put<VinculoObrigacao[]>(`/empresa-obrigacoes/empresa/${empresaId}/regime`, {
        regimeId: regimeSel || null,
      });
      setVinculos(r);
      onRegimeMudou();
      toast('ok', 'Regime aplicado (obrigacoes de regime substituidas).');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function aplicarGrupo() {
    if (!grupoSel) return;
    try {
      const r = await api.post<VinculoObrigacao[]>(`/empresa-obrigacoes/empresa/${empresaId}/grupo`, { grupoId: grupoSel });
      setVinculos(r); setGrupoSel('');
      toast('ok', 'Grupo aplicado.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function removerGrupo(grupoId: string) {
    try {
      const r = await api.del<VinculoObrigacao[]>(`/empresa-obrigacoes/empresa/${empresaId}/grupo/${grupoId}`);
      setVinculos(r);
      toast('ok', 'Grupo removido.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function adicionarManual() {
    if (!obrigSel) return;
    try {
      const r = await api.post<VinculoObrigacao[]>(`/empresa-obrigacoes/empresa/${empresaId}/manual`, { obrigacaoId: obrigSel });
      setVinculos(r); setObrigSel('');
      toast('ok', 'Obrigacao adicionada.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }
  async function removerManual(eoId: string) {
    try {
      await api.del(`/empresa-obrigacoes/vinculo/${eoId}/manual`);
      carregar();
      toast('ok', 'Origem manual removida.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro'); }
  }

  if (!vinculos) return <Spinner />;

  // grupos atualmente aplicados (derivado das origens)
  const gruposAplicados = new Set<string>();
  vinculos.forEach((v) => v.origens.forEach((o) => o.origem === 'GRUPO' && o.refId && gruposAplicados.add(o.refId)));

  // agrupar por departamento
  const porDep = new Map<string, { nome: string; cor: string; itens: VinculoObrigacao[] }>();
  for (const v of vinculos) {
    if (ocultarInativas && !v.ativo) continue;
    const dep = v.obrigacao.departamento;
    const key = dep?.id ?? 'sem';
    if (!porDep.has(key)) porDep.set(key, { nome: dep?.nome ?? 'Sem departamento', cor: dep?.cor ?? '#94a3b8', itens: [] });
    porDep.get(key)!.itens.push(v);
  }

  return (
    <div className="space-y-4">
      {podeGerenciar && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="card space-y-2 p-4">
            <div className="text-sm font-medium text-slate-600">Regime tributario</div>
            <p className="text-xs text-slate-400">Substitui as obrigacoes de origem regime.</p>
            <div className="flex gap-2">
              <select className="input" value={regimeSel} onChange={(e) => setRegimeSel(e.target.value)}>
                <option value="">— sem regime —</option>
                {regimes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
              <button className="btn-primary" onClick={aplicarRegime}>Aplicar</button>
            </div>
          </div>

          <div className="card space-y-2 p-4">
            <div className="text-sm font-medium text-slate-600">Adicionar grupo</div>
            <p className="text-xs text-slate-400">Apenas adiciona (nao remove nada).</p>
            <div className="flex gap-2">
              <select className="input" value={grupoSel} onChange={(e) => setGrupoSel(e.target.value)}>
                <option value="">Selecione</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
              <button className="btn-primary" onClick={aplicarGrupo}>Adicionar</button>
            </div>
          </div>

          <div className="card space-y-2 p-4">
            <div className="text-sm font-medium text-slate-600">Obrigacao avulsa (manual)</div>
            <p className="text-xs text-slate-400">Adiciona uma obrigacao do catalogo.</p>
            <div className="flex gap-2">
              <select className="input" value={obrigSel} onChange={(e) => setObrigSel(e.target.value)}>
                <option value="">Selecione</option>
                {catalogo.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <button className="btn-primary" onClick={adicionarManual}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {gruposAplicados.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Grupos aplicados:</span>
          {[...gruposAplicados].map((gid) => {
            const g = grupos.find((x) => x.id === gid);
            return (
              <span key={gid} className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                {g?.nome ?? 'grupo'}
                {podeGerenciar && <button className="text-blue-400 hover:text-blue-700" onClick={() => removerGrupo(gid)}>✕</button>}
              </span>
            );
          })}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={ocultarInativas} onChange={(e) => setOcultarInativas(e.target.checked)} />
        Ocultar inativas
      </label>

      {[...porDep.values()].map((g) => (
        <div key={g.nome} className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold" style={{ color: g.cor }}>
            {g.nome} ({g.itens.length})
          </div>
          <table className="w-full text-sm">
            <tbody>
              {g.itens.map((v) => (
                <tr key={v.id} className="border-b border-slate-50">
                  <td className="px-4 py-2">
                    <span className={v.ativo ? 'text-slate-700' : 'text-slate-400 line-through'}>{v.obrigacao.nome}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {v.origens.map((o, i) => (
                        <Badge key={i} cor={CORES_ORIGEM[o.origem]}>{o.origem}</Badge>
                      ))}
                      {!v.ativo && <Badge className="bg-slate-200 text-slate-500">inativa</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {podeGerenciar && v.origens.some((o) => o.origem === 'MANUAL') && (
                      <button className="text-xs text-red-500 hover:underline" onClick={() => removerManual(v.id)}>remover manual</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {[...porDep.values()].length === 0 && (
        <p className="text-slate-400">Nenhuma obrigacao vinculada. Aplique um regime ou grupo acima.</p>
      )}
    </div>
  );
}
