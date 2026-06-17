import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import Registrar from './pages/Registrar';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Configuracoes from './pages/Configuracoes';
import Cadastros from './pages/Cadastros';
import EmpresasList from './pages/empresas/EmpresasList';
import EmpresaForm from './pages/empresas/EmpresaForm';
import EmpresaFicha from './pages/empresas/EmpresaFicha';
import ImportarCsv from './pages/empresas/ImportarCsv';
import Catalogo from './pages/obrigacoes/Catalogo';
import Regimes from './pages/obrigacoes/Regimes';
import Grupos from './pages/obrigacoes/Grupos';
import Feriados from './pages/obrigacoes/Feriados';
import AlocacaoMassa from './pages/obrigacoes/AlocacaoMassa';
import ListaEntregas from './pages/entregas/ListaEntregas';
import Calendario from './pages/entregas/Calendario';

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
        <Route path="empresas" element={<EmpresasList />} />
        <Route path="empresas/nova" element={<EmpresaForm />} />
        <Route path="empresas/importar" element={<ImportarCsv />} />
        <Route path="empresas/:id" element={<EmpresaFicha />} />
        <Route path="obrigacoes" element={<Catalogo />} />
        <Route path="obrigacoes/regimes" element={<Regimes />} />
        <Route path="obrigacoes/grupos" element={<Grupos />} />
        <Route path="obrigacoes/feriados" element={<Feriados />} />
        <Route path="obrigacoes/alocacao" element={<AlocacaoMassa />} />
        <Route path="entregas" element={<ListaEntregas />} />
        <Route path="entregas/calendario" element={<Calendario />} />
        <Route path="cadastros" element={<Cadastros />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
