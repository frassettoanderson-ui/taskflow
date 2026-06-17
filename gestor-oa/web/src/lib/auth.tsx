import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { SessaoAtual } from '@gestoroa/shared';
import { api, setAccessToken } from './api';

interface AuthState {
  sessao: SessaoAtual | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  registrar: (input: RegistrarInput) => Promise<void>;
  logout: () => Promise<void>;
  atualizar: () => Promise<void>;
}

export interface RegistrarInput {
  escritorio: { nome: string; cnpj?: string };
  admin: { nome: string; email: string; senha: string };
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<SessaoAtual | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Ao carregar, tenta restaurar a sessao via refresh cookie.
  useEffect(() => {
    (async () => {
      const ok = await api.refresh();
      if (ok) {
        try {
          const s = await api.get<SessaoAtual>('/auth/me');
          setSessao(s);
        } catch {
          setSessao(null);
        }
      }
      setCarregando(false);
    })();
  }, []);

  async function login(email: string, senha: string) {
    const s = await api.post<SessaoAtual>('/auth/login', { email, senha });
    setAccessToken(s.accessToken);
    setSessao(s);
  }

  async function registrar(input: RegistrarInput) {
    const s = await api.post<SessaoAtual>('/auth/registrar', input);
    setAccessToken(s.accessToken);
    setSessao(s);
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setSessao(null);
  }

  async function atualizar() {
    const s = await api.get<SessaoAtual>('/auth/me');
    setSessao((prev) => (prev ? { ...s, accessToken: prev.accessToken } : s));
  }

  return (
    <AuthContext.Provider
      value={{ sessao, carregando, login, registrar, logout, atualizar }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

export function temPermissao(sessao: SessaoAtual | null, flag: string): boolean {
  return !!sessao?.usuario.permissoes?.[flag as never];
}
