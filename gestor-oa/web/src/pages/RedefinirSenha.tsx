import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import AuthShell from '../components/AuthShell';

export default function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [novaSenha, setNovaSenha] = useState('');
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api.post('/auth/redefinir-senha', { token, novaSenha });
      setOk(true);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao redefinir.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthShell
      titulo="Definir nova senha"
      rodape={
        <Link to="/login" className="font-medium text-white underline">
          Ir para o login
        </Link>
      }
    >
      {!token ? (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          Link invalido. Solicite um novo em "Esqueci minha senha".
        </div>
      ) : ok ? (
        <div className="rounded bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
          Senha redefinida com sucesso! Voce ja pode entrar com a nova senha.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Nova senha (min. 8 caracteres)</label>
            <input
              className="input"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {erro && (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={carregando}>
            {carregando ? 'Salvando...' : 'Redefinir senha'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
