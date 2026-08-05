'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * A porta de entrada.
 *
 * É a primeira coisa que qualquer pessoa vê do sistema, então ela carrega a
 * identidade inteira: papel de um lado, brasa do outro. A coluna da esquerda é
 * a "capa do cardápio"; a da direita, o formulário — que fica sozinho no
 * celular, onde não há espaço para cerimônia.
 */
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
    <main className="login-tela">
      {/* ---- a capa: só no computador, onde há espaço para respirar ---- */}
      <aside className="login-capa">
        <div className="login-marca">
          <div className="login-logo" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
              <path
                d="M12 7.4c1.9 1.3 2.9 2.7 2.9 4.2a2.9 2.9 0 0 1-5.8 0c0-1.5 1-2.9 2.9-4.2Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span>Sistema para Restaurantes</span>
        </div>

        <div className="login-frase">
          <h2>
            Seus clientes.
            <br />
            Seus dados.
            <br />
            <em>Sem comissão.</em>
          </h2>
          <p>
            Cardápio digital, pedidos, salão e caixa — no seu canal próprio, do jeito que o
            restaurante é seu.
          </p>
        </div>

        <ul className="login-lista">
          <li>Pedido do delivery, do salão e do balcão numa tela só</li>
            <li>O caixa continua vendendo mesmo sem internet</li>
          <li>A base de clientes é sua, não de um marketplace</li>
        </ul>
      </aside>

      {/* ---- o formulário ---- */}
      <div className="login-lado">
        <form className="login-caixa" onSubmit={entrar}>
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
      </div>
    </main>
  );
}
