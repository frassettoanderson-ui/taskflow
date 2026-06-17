import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import AuthShell from '../components/AuthShell';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@demo.com.br');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao entrar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthShell
      titulo="Entrar"
      subtitulo="Acesse o painel do seu escritorio"
      rodape={
        <>
          Ainda nao tem conta?{' '}
          <Link to="/registrar" className="font-medium text-white underline">
            Cadastre seu escritorio
          </Link>
        </>
      }
    >
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
        <div>
          <label className="label">Senha</label>
          <input
            className="input"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </div>
        {erro && (
          <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={carregando}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
        <div className="text-center">
          <Link to="/esqueci-senha" className="text-sm text-petroleo-600 hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
