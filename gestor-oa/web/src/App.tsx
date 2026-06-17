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
import Usuarios from './pages/Usuarios';
import Auditoria from './pages/Auditoria';
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
import Armazenamento from './pages/documentos/Armazenamento';
import ProtocolosFisicos from './pages/documentos/ProtocolosFisicos';
import Caixa from './pages/robo/Caixa';
import Revisao from './pages/robo/Revisao';
import PainelRobo from './pages/robo/PainelRobo';
import Assinaturas from './pages/robo/Assinaturas';
import Processos from './pages/processos/Processos';
import ProcessoFicha from './pages/processos/ProcessoFicha';
import Matrizes from './pages/processos/Matrizes';
import PortalApp from './portal/PortalApp';
import ComunicadosAdmin from './pages/portal/ComunicadosAdmin';
import SolicitacoesInbox from './pages/portal/SolicitacoesInbox';
import Templates from './pages/comunicacao/Templates';
import Chatbot from './pages/comunicacao/Chatbot';

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
      {/* Portal do cliente (Area VIP) - app separado */}
      <Route path="/portal/*" element={<PortalApp />} />

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
        <Route path="documentos/armazenamento" element={<Armazenamento />} />
        <Route path="documentos/protocolos-fisicos" element={<ProtocolosFisicos />} />
        <Route path="robo" element={<Caixa />} />
        <Route path="robo/revisao" element={<Revisao />} />
        <Route path="robo/painel" element={<PainelRobo />} />
        <Route path="robo/assinaturas" element={<Assinaturas />} />
        <Route path="processos" element={<Processos />} />
        <Route path="processos/matrizes" element={<Matrizes />} />
        <Route path="processos/:id" element={<ProcessoFicha />} />
        <Route path="area-vip/comunicados" element={<ComunicadosAdmin />} />
        <Route path="area-vip/solicitacoes" element={<SolicitacoesInbox />} />
        <Route path="comunicacao/templates" element={<Templates />} />
        <Route path="comunicacao/chatbot" element={<Chatbot />} />
        <Route path="cadastros" element={<Cadastros />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
