import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import AuthShell from '../components/AuthShell';

export default function Registrar() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nomeEscritorio: '',
    cnpj: '',
    nome: '',
    email: '',
    senha: '',
  });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  function set(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await registrar({
        escritorio: { nome: form.nomeEscritorio, cnpj: form.cnpj || undefined },
        admin: { nome: form.nome, email: form.email, senha: form.senha },
      });
      navigate('/');
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao cadastrar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthShell
      titulo="Cadastrar escritorio"
      subtitulo="Crie sua conta e o primeiro usuario administrador"
      rodape={
        <>
          Ja tem conta?{' '}
          <Link to="/login" className="font-medium text-white underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Nome do escritorio</label>
          <input
            className="input"
            value={form.nomeEscritorio}
            onChange={(e) => set('nomeEscritorio', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">CNPJ (opcional)</label>
          <input
            className="input"
            value={form.cnpj}
            onChange={(e) => set('cnpj', e.target.value)}
          />
        </div>
        <hr className="border-slate-100" />
        <div>
          <label className="label">Seu nome</label>
          <input
            className="input"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Senha (min. 8 caracteres)</label>
          <input
            className="input"
            type="password"
            value={form.senha}
            onChange={(e) => set('senha', e.target.value)}
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
          {carregando ? 'Cadastrando...' : 'Criar conta'}
        </button>
      </form>
    </AuthShell>
  );
}
