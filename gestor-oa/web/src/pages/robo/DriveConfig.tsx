import { useEffect, useState } from 'react';
import { HardDrive, ExternalLink, RefreshCw, CheckCircle2, Link2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Spinner, useToast } from '../../components/ui';

interface StatusDrive {
  conectado: boolean;
  email: string | null;
  entradaId: string | null;
}

export default function DriveConfig() {
  const toast = useToast();
  const [status, setStatus] = useState<StatusDrive | null>(null);
  const [code, setCode] = useState('');
  const [conectando, setConectando] = useState(false);
  const [processando, setProcessando] = useState(false);

  function carregar() {
    api.get<StatusDrive>('/drive/status').then(setStatus).catch(() => setStatus({ conectado: false, email: null, entradaId: null }));
  }
  useEffect(carregar, []);

  async function abrirAutorizacao() {
    try {
      const { url } = await api.get<{ url: string }>('/drive/auth-url');
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro ao gerar link');
    }
  }

  async function conectar() {
    if (!code.trim()) return toast('erro', 'Cole o codigo (ou a URL) que o Google mostrou.');
    setConectando(true);
    try {
      await api.post('/drive/conectar', { code });
      setCode('');
      toast('ok', 'Google Drive conectado!');
      carregar();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro ao conectar');
    } finally {
      setConectando(false);
    }
  }

  async function processarAgora() {
    setProcessando(true);
    try {
      const r = await api.post<{ vistos: number; baixados: number; revisao: number }>('/drive/processar-agora', {});
      toast('ok', `Verificado: ${r.baixados} baixado(s), ${r.revisao} em revisao (de ${r.vistos} arquivo(s)).`);
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro ao processar');
    } finally {
      setProcessando(false);
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar o Google Drive?')) return;
    try {
      await api.post('/drive/desconectar', {});
      toast('ok', 'Desconectado.');
      carregar();
    } catch (e) {
      toast('erro', e instanceof ApiError ? e.message : 'Erro');
    }
  }

  if (!status) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <HardDrive className="text-marca-600" size={24} />
        <h1 className="text-2xl font-semibold text-slate-800">e-Continuo via Google Drive</h1>
      </div>
      <p className="text-sm text-slate-500">
        Conecte uma conta do Google Drive. A partir dai, todo PDF colocado na pasta <b>Entrada</b> e' lancado
        automaticamente no sistema e arquivado em <code>Departamento / Apelido do cliente / Obrigacao / Obrigacao - MM-AAAA.pdf</code>.
        Nao precisa instalar nada em PC nenhum.
      </p>

      {!status.conectado ? (
        <div className="card space-y-4 p-5">
          <div>
            <p className="font-medium text-slate-700">1. Autorize o acesso</p>
            <p className="mb-2 text-[13px] text-slate-500">Abra a tela do Google, escolha a conta do escritorio e permita o acesso ao Drive.</p>
            <button onClick={abrirAutorizacao} className="btn-primary inline-flex items-center gap-2">
              <ExternalLink size={16} /> Abrir autorizacao do Google
            </button>
          </div>
          <div>
            <p className="font-medium text-slate-700">2. Cole o codigo</p>
            <p className="mb-2 text-[13px] text-slate-500">
              Apos autorizar, o navegador vai para uma pagina que pode mostrar "nao foi possivel acessar" - isso e' normal.
              Copie o <b>codigo</b> que aparece (ou a <b>URL inteira</b> da barra de enderecos) e cole abaixo.
            </p>
            <div className="flex gap-2">
              <input className="input flex-1 font-mono text-xs" placeholder="cole o codigo ou a URL aqui" value={code} onChange={(e) => setCode(e.target.value)} />
              <button onClick={conectar} disabled={conectando} className="btn-primary inline-flex items-center gap-2">
                <Link2 size={16} /> {conectando ? 'Conectando...' : 'Conectar'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card space-y-4 p-5">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={20} />
            <span className="font-medium">Conectado{status.email ? ` — ${status.email}` : ''}</span>
          </div>
          <div className="rounded bg-slate-50 p-3 text-[13px] text-slate-600">
            Coloque os PDFs na pasta <b>GestorOA › Entrada</b> do seu Drive. A cada poucos minutos o sistema processa os novos.
            Documentos nao identificados ficam na Entrada para voce resolver na <b>Revisao</b>.
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={processarAgora} disabled={processando} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw size={16} className={processando ? 'animate-spin' : ''} /> {processando ? 'Processando...' : 'Processar agora'}
            </button>
            <button onClick={desconectar} className="btn-ghost border border-slate-300">Desconectar</button>
          </div>
        </div>
      )}
    </div>
  );
}
