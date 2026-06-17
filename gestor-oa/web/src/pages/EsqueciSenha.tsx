import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import AuthShell from '../components/AuthShell';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api.post('/auth/esqueci-senha', { email });
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao enviar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthShell
      titulo="Recuperar senha"
      subtitulo="Enviaremos um link de redefinicao por e-mail"
      rodape={
        <Link to="/login" className="font-medium text-white underline">
          Voltar ao login
        </Link>
      }
    >
      {enviado ? (
        <div className="rounded bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
          Se o e-mail existir, enviaremos instrucoes para redefinir a senha.
          Verifique sua caixa de entrada.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">E-mail</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {erro && (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={carregando}>
            {carregando ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
