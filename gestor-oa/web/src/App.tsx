import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import Registrar from './pages/Registrar';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Configuracoes from './pages/Configuracoes';

function Protegida({ children }: { children: React.ReactNode }) {
  const { sessao, carregando } = useAuth();
  if (carregando) {
    return (
      <div className="grid h-full place-items-center text-slate-400">
        Carregando...
      </div>
    );
  }
  if (!sessao) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { sessao } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={sessao ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/registrar" element={<Registrar />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />

      <Route
        path="/"
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
