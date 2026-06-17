import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth, temPermissao } from '../lib/auth';

interface ConfigEscritorio {
  id: string;
  nome: string;
  cnpj: string | null;
  logoUrl: string | null;
  config: {
    mailFromName?: string;
    sabadoEhUtil?: boolean;
    smtp?: {
      host?: string;
      port?: number;
      secure?: boolean;
      user?: string;
      pass?: string;
      fromEmail?: string;
    };
  };
}

export default function Configuracoes() {
  const { sessao } = useAuth();
  const podeEditar = temPermissao(sessao, 'admin_escritorio');
  const [dados, setDados] = useState<ConfigEscritorio | null>(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get<ConfigEscritorio>('/escritorio')
      .then(setDados)
      .catch((e) => setErro(e instanceof ApiError ? e.message : 'Erro.'));
  }, []);

  if (!dados) return <div className="text-slate-400">Carregando...</div>;

  function set<K extends keyof ConfigEscritorio>(k: K, v: ConfigEscritorio[K]) {
    setDados((d) => (d ? { ...d, [k]: v } : d));
  }
  function setConfig(patch: Partial<ConfigEscritorio['config']>) {
    setDados((d) => (d ? { ...d, config: { ...d.config, ...patch } } : d));
  }
  function setSmtp(patch: Partial<NonNullable<ConfigEscritorio['config']['smtp']>>) {
    setDados((d) =>
      d ? { ...d, config: { ...d.config, smtp: { ...d.config.smtp, ...patch } } } : d,
    );
  }

  async function salvar() {
    if (!dados) return;
    setSalvando(true);
    setMsg('');
    setErro('');
    try {
      await api.put('/escritorio', {
        nome: dados.nome,
        cnpj: dados.cnpj,
        config: dados.config,
      });
      setMsg('Configuracoes salvas.');
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const r = await api.upload<{ logoUrl: string }>('/escritorio/logo', fd);
      set('logoUrl', r.logoUrl);
      setMsg('Logo atualizado.');
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro no upload.');
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">
        Configuracoes do escritorio
      </h1>

      {msg && (
        <div className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {msg}
        </div>
      )}
      {erro && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </div>
      )}

      <section className="card space-y-4 p-6">
        <h2 className="font-semibold text-slate-700">Dados cadastrais</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nome</label>
            <input
              className="input"
              value={dados.nome}
              disabled={!podeEditar}
              onChange={(e) => set('nome', e.target.value)}
            />
          </div>
          <div>
            <label className="label">CNPJ</label>
            <input
              className="input"
              value={dados.cnpj ?? ''}
              disabled={!podeEditar}
              onChange={(e) => set('cnpj', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Logo</label>
          <div className="flex items-center gap-4">
            {dados.logoUrl && (
              <img
                src={dados.logoUrl}
                alt="Logo"
                className="h-12 w-12 rounded border border-slate-200 object-contain"
              />
            )}
            {podeEditar && (
              <input type="file" accept="image/*" onChange={enviarLogo} />
            )}
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-semibold text-slate-700">E-mail</h2>
        <div>
          <label className="label">Nome do remetente ("From")</label>
          <input
            className="input"
            value={dados.config.mailFromName ?? ''}
            disabled={!podeEditar}
            onChange={(e) => setConfig({ mailFromName: e.target.value })}
          />
        </div>
        <details className="rounded border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">
            SMTP proprio (opcional)
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Host SMTP"
              value={dados.config.smtp?.host ?? ''}
              disabled={!podeEditar}
              onChange={(e) => setSmtp({ host: e.target.value })}
            />
            <input
              className="input"
              placeholder="Porta"
              type="number"
              value={dados.config.smtp?.port ?? ''}
              disabled={!podeEditar}
              onChange={(e) => setSmtp({ port: Number(e.target.value) })}
            />
            <input
              className="input"
              placeholder="Usuario"
              value={dados.config.smtp?.user ?? ''}
              disabled={!podeEditar}
              onChange={(e) => setSmtp({ user: e.target.value })}
            />
            <input
              className="input"
              placeholder="Senha"
              type="password"
              value={dados.config.smtp?.pass ?? ''}
              disabled={!podeEditar}
              onChange={(e) => setSmtp({ pass: e.target.value })}
            />
            <input
              className="input sm:col-span-2"
              placeholder="E-mail remetente (fromEmail)"
              value={dados.config.smtp?.fromEmail ?? ''}
              disabled={!podeEditar}
              onChange={(e) => setSmtp({ fromEmail: e.target.value })}
            />
          </div>
        </details>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-semibold text-slate-700">Regras gerais</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={!!dados.config.sabadoEhUtil}
            disabled={!podeEditar}
            onChange={(e) => setConfig({ sabadoEhUtil: e.target.checked })}
          />
          Considerar sabado como dia util no calculo de prazos
        </label>
      </section>

      {podeEditar && (
        <button className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
      )}
    </div>
  );
}
