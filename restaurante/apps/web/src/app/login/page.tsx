'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('dono@exemplo.com');
  const [password, setPassword] = useState('123456');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        setErro(msg ?? 'Não foi possível entrar.');
        return;
      }

      // O backend já colocou o cookie de login na resposta.
      router.push('/painel');
      router.refresh();
    } catch {
      setErro('O servidor não respondeu. Ele já terminou de subir?');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="center-screen">
      <form className="card card--login" onSubmit={entrar}>
        <h1 className="title">Entrar</h1>
        <p className="subtitle">Painel do restaurante</p>

        {erro && <div className="error">{erro}</div>}

        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <button type="submit" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="hint">
          Usuários de exemplo (senha <code>123456</code>):
          <br />
          <code>dono@exemplo.com</code> — Dono
          <br />
          <code>gerente@exemplo.com</code> — Gerente
          <br />
          <code>operador@exemplo.com</code> — Operador
        </div>
      </form>
    </main>
  );
}
