import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// ---------- Spinner ----------
export function Spinner({ texto = 'Carregando...' }: { texto?: string }) {
  return <div className="py-10 text-center text-slate-400">{texto}</div>;
}

// ---------- Badge ----------
export function Badge({
  children,
  cor,
  className = '',
}: {
  children: ReactNode;
  cor?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={
        cor
          ? { backgroundColor: cor + '22', color: cor, border: `1px solid ${cor}55` }
          : undefined
      }
    >
      {children}
    </span>
  );
}

// ---------- Modal ----------
export function Modal({
  aberto,
  titulo,
  onFechar,
  children,
  largura = 'max-w-lg',
}: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  largura?: string;
}) {
  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
      onClick={onFechar}
    >
      <div
        className={`card w-full ${largura} p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">{titulo}</h2>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Toast ----------
interface Toast {
  id: number;
  tipo: 'ok' | 'erro';
  msg: string;
}
const ToastCtx = createContext<{
  toast: (tipo: 'ok' | 'erro', msg: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((tipo: 'ok' | 'erro', msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tipo, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md px-4 py-2 text-sm text-white shadow-lg ${
              t.tipo === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx.toast;
}

// ---------- Hook de carregamento de dados ----------
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    fn()
      .then((d) => vivo && setData(d))
      .catch((e) => vivo && setErro(e?.message ?? 'Erro'))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, erro, recarregar };
}
