import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useToast } from '../../components/ui';
import type { Tag, TipoIdentificador } from '../../lib/tipos';
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
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    honorario: '',
    apelidoEcontinuo: '',
    emailPrincipal: '',
    telefone: '',
    endereco: '',
    anotacoes: '',
  });
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [idents, setIdents] = useState<IdentLinha[]>([
    { tipo: 'CNPJ', valor: '', apelido: '' },
  ]);

  useEffect(() => {
    api.get<Tag[]>('/tags').then(setTags).catch(() => undefined);
  }, []);

  function set(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
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
      <h1 className="text-2xl font-semibold text-slate-800">Nova empresa</h1>
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
              <label className="label">Endereco</label>
              <input className="input" value={form.endereco} onChange={(e) => set('endereco', e.target.value)} />
            </div>
            <div>
              <label className="label">Honorario (R$)</label>
              <input className="input" type="number" step="0.01" min="0" placeholder="0,00" value={form.honorario} onChange={(e) => set('honorario', e.target.value)} />
            </div>
            <div>
              <label className="label">Apelido e-Continuo <span className="font-normal text-slate-400">(em branco = ID)</span></label>
              <input className="input" value={form.apelidoEcontinuo} onChange={(e) => set('apelidoEcontinuo', e.target.value)} />
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
          <p className="text-sm text-slate-500">CNPJ, CPF, IE, CEI ou CAEPF. Sao a chave de identificacao das guias pelo robo.</p>
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
                placeholder="Valor"
                value={linha.valor}
                onChange={(e) => setIdents((arr) => arr.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
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
