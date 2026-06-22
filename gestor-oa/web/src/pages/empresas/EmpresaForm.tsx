import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../components/ui';
import type { Tag, TipoIdentificador, GrupoEmpresa } from '../../lib/tipos';
import { LABEL_TIPO_IDENT } from '../../lib/tipos';

interface IdentLinha {
  tipo: TipoIdentificador;
  valor: string;
  apelido: string;
}

export default function EmpresaForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [grupos, setGrupos] = useState<GrupoEmpresa[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [proximoId, setProximoId] = useState<number | null>(null);

  const [form, setForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    grupoEmpresaId: '',
    honorario: '',
    apelidoEcontinuo: '',
    emailPrincipal: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numeroEndereco: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    grupoEnvio: '',
    anotacoes: '',
  });
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [idents, setIdents] = useState<IdentLinha[]>([
    { tipo: 'CNPJ', valor: '', apelido: '' },
  ]);

  useEffect(() => {
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
    api.get<GrupoEmpresa[]>('/grupos-empresa').then(setGrupos).catch(() => undefined);
    api.get<{ numero: number }>('/empresas/proximo-numero').then((r) => setProximoId(r.numero)).catch(() => undefined);
  }, []);

  async function criarGrupo() {
    const nome = prompt('Nome do novo grupo de empresas:');
    if (!nome?.trim()) return;
    try {
      const g = await api.post<GrupoEmpresa>('/grupos-empresa', { nome: nome.trim() });
      setGrupos((arr) => [...arr, g]);
      set('grupoEmpresaId', g.id);
    } catch (err) { toast('erro', err instanceof ApiError ? err.message : 'Erro'); }
  }

  function set(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // Consulta o CNPJ (BrasilAPI via backend) e preenche os campos vazios
  async function buscarCnpj(cnpj: string) {
    const dig = (cnpj || '').replace(/\D/g, '');
    if (dig.length !== 14 || buscandoCnpj) return;
    setBuscandoCnpj(true);
    try {
      const d = await api.get<{ razaoSocial: string; nomeFantasia: string; cep: string; logradouro: string; numeroEndereco: string; complemento: string; bairro: string; cidade: string; uf: string; telefone: string; email: string }>(`/empresas/consulta-cnpj/${dig}`);
      setForm((f) => ({
        ...f,
        razaoSocial: f.razaoSocial || d.razaoSocial,
        nomeFantasia: f.nomeFantasia || d.nomeFantasia,
        cep: f.cep || d.cep,
        logradouro: f.logradouro || d.logradouro,
        numeroEndereco: f.numeroEndereco || d.numeroEndereco,
        complemento: f.complemento || d.complemento,
        bairro: f.bairro || d.bairro,
        cidade: f.cidade || d.cidade,
        uf: f.uf || d.uf,
        telefone: f.telefone || d.telefone,
        emailPrincipal: f.emailPrincipal || d.email,
      }));
      toast('ok', 'Dados do CNPJ preenchidos.');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Nao foi possivel consultar o CNPJ.'); }
    finally { setBuscandoCnpj(false); }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const identificadores = idents
        .filter((i) => i.valor.trim())
        .map((i) => ({ tipo: i.tipo, valor: i.valor, apelido: i.apelido || undefined }));
      const empresa = await api.post<{ id: string }>('/empresas', {
        ...form,
        honorario: form.honorario === '' ? undefined : Number(form.honorario),
        apelidoEcontinuo: form.apelidoEcontinuo || undefined,
        grupoEmpresaId: form.grupoEmpresaId || undefined,
        grupoEnvio: form.grupoEnvio || undefined,
        uf: form.uf || undefined,
        emailPrincipal: form.emailPrincipal || undefined,
        tagIds,
        identificadores,
      });
      toast('ok', 'Empresa criada.');
      navigate(`/empresas/${empresa.id}`);
    } catch (err) {
      toast('erro', err instanceof ApiError ? err.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Nova empresa</h1>
        {proximoId != null && <span className="rounded bg-marca-50 px-3 py-1 text-sm font-medium text-marca-600">ID: {proximoId}</span>}
      </div>
      <form onSubmit={salvar} className="space-y-6">
        <section className="card space-y-4 p-6">
          <h2 className="font-semibold text-slate-700">Dados</h2>
          <div>
            <label className="label">Razao social *</label>
            <input className="input" value={form.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome fantasia</label>
              <input className="input" value={form.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} />
            </div>
            <div>
              <label className="label">E-mail principal</label>
              <input className="input" type="email" value={form.emailPrincipal} onChange={(e) => set('emailPrincipal', e.target.value)} />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
            </div>
            <div>
              <label className="label">Honorario (R$)</label>
              <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={form.honorario} onChange={(e) => set('honorario', e.target.value)} />
            </div>
            <div>
              <label className="label">Apelido e-Continuo <span className="font-normal text-slate-400">(em branco = ID)</span></label>
              <input className="input" value={form.apelidoEcontinuo} onChange={(e) => set('apelidoEcontinuo', e.target.value)} />
            </div>
            <div>
              <label className="label">Grupo de empresas</label>
              <div className="flex gap-2">
                <select className="input flex-1" value={form.grupoEmpresaId} onChange={(e) => set('grupoEmpresaId', e.target.value)}>
                  <option value="">— Sem grupo —</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
                <button type="button" className="btn-ghost border border-slate-300" onClick={criarGrupo}>+ Novo</button>
              </div>
            </div>
            <div>
              <label className="label">Grupo de envio de e-mails</label>
              <input className="input" value={form.grupoEnvio} onChange={(e) => set('grupoEnvio', e.target.value)} placeholder="Ex.: Lote matutino" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-600">Endereco</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><label className="label">CEP</label><input className="input" value={form.cep} onChange={(e) => set('cep', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="label">Logradouro</label><input className="input" value={form.logradouro} onChange={(e) => set('logradouro', e.target.value)} /></div>
              <div><label className="label">Numero</label><input className="input" value={form.numeroEndereco} onChange={(e) => set('numeroEndereco', e.target.value)} /></div>
              <div><label className="label">Complemento</label><input className="input" value={form.complemento} onChange={(e) => set('complemento', e.target.value)} /></div>
              <div><label className="label">Bairro</label><input className="input" value={form.bairro} onChange={(e) => set('bairro', e.target.value)} /></div>
              <div><label className="label">Cidade</label><input className="input" value={form.cidade} onChange={(e) => set('cidade', e.target.value)} /></div>
              <div><label className="label">UF</label><input className="input" maxLength={2} value={form.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} /></div>
            </div>
          </div>
          <div>
            <label className="label">Anotacoes</label>
            <textarea className="input" rows={2} value={form.anotacoes} onChange={(e) => set('anotacoes', e.target.value)} />
          </div>
          {tags.length > 0 && (
            <div>
              <label className="label">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <label key={t.id} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={tagIds.includes(t.id)}
                      onChange={(e) =>
                        setTagIds((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id)))
                      }
                    />
                    {t.nome}
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="font-semibold text-slate-700">Identificadores</h2>
          <p className="text-sm text-slate-500">CNPJ, CPF, IE, CEI ou CAEPF. Sao a chave de identificacao das guias pelo robo.{buscandoCnpj && <span className="ml-2 font-medium text-marca-600">buscando dados do CNPJ...</span>}</p>
          {idents.map((linha, i) => (
            <div key={i} className="flex gap-2">
              <select
                className="input w-44"
                value={linha.tipo}
                onChange={(e) =>
                  setIdents((arr) => arr.map((x, j) => (j === i ? { ...x, tipo: e.target.value as TipoIdentificador } : x)))
                }
              >
                {Object.entries(LABEL_TIPO_IDENT).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                className="input flex-1"
                placeholder={linha.tipo === 'CNPJ' ? 'CNPJ (preenche os dados ao sair do campo)' : 'Valor'}
                value={linha.valor}
                onChange={(e) => setIdents((arr) => arr.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                onBlur={() => { if (linha.tipo === 'CNPJ') buscarCnpj(linha.valor); }}
              />
              <input
                className="input w-40"
                placeholder="Apelido"
                value={linha.apelido}
                onChange={(e) => setIdents((arr) => arr.map((x, j) => (j === i ? { ...x, apelido: e.target.value } : x)))}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIdents((arr) => arr.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost border border-slate-300"
            onClick={() => setIdents((arr) => [...arr, { tipo: 'CNPJ', valor: '', apelido: '' }])}
          >
            + Adicionar identificador
          </button>
        </section>

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Criar empresa'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/empresas')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
