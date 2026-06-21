import { useEffect, useState } from 'react';
import { Save, ChevronDown, ChevronRight, Eye, EyeOff, Trash2, User } from 'lucide-react';
import { api, ApiError, getAccessToken } from '../lib/api';
import { Spinner, useToast, InfoHint } from '../components/ui';

const INP = 'block w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-700 outline-none focus:border-marca-400 focus:ring-1 focus:ring-marca-100';
const LBL = 'mb-0.5 block text-[12px] font-medium text-slate-600';

const INFO_CCO = `Utilize ; para enviar para varios enderecos.

ATENCAO!!! Ao utilizar essa opcao copia oculta, os destinatarios receberao uma copia EXATA da(s) mensagem(ns) enviadas aos clientes, inclusive com os mesmos links de guias que fazem o controle do protocolo digital (data/hora/IP). Portanto os destinatarios devem ser instruidos a NAO clicarem nos links dos e-mails copiados, para nao gerarem protocolos digitais falsos-positivos.`;
const INFO_NOTIF_SOLIC = 'Receba um e-mail diario com o resumo das solicitacoes pendentes/atualizadas.';
const INFO_NOTIF_MKT = 'Receba notificacoes, comunicados e conteudos de marketing do sistema por e-mail.';

interface PerfilData {
  nome: string; email: string; tipo: string | null; telefone: string | null; observacoes: string | null;
  smtpHost: string | null; smtpPorta: number | null; smtpUsuario: string | null; ccoEmails: string | null;
  temSmtpSenha: boolean; temAssinatura: boolean; temFoto: boolean;
  notifSolicitacoesEmail: boolean; notifMarketingEmail: boolean;
}

export default function Perfil() {
  const toast = useToast();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [verNova, setVerNova] = useState(false);
  const [verConfirma, setVerConfirma] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPorta, setSmtpPorta] = useState('');
  const [smtpUsuario, setSmtpUsuario] = useState('');
  const [smtpSenha, setSmtpSenha] = useState('');
  const [ccoEmails, setCcoEmails] = useState('');
  const [notifSolic, setNotifSolic] = useState(true);
  const [notifMkt, setNotifMkt] = useState(true);
  const [temFoto, setTemFoto] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(false);

  const [sec, setSec] = useState<Record<string, boolean>>({ seg: true });

  useEffect(() => {
    api.get<PerfilData>('/auth/perfil').then((p) => {
      setNome(p.nome); setEmail(p.email); setTipo(p.tipo ?? '');
      setTelefone(p.telefone ?? ''); setObservacoes(p.observacoes ?? '');
      setSmtpHost(p.smtpHost ?? ''); setSmtpPorta(p.smtpPorta != null ? String(p.smtpPorta) : '');
      setSmtpUsuario(p.smtpUsuario ?? ''); setCcoEmails(p.ccoEmails ?? '');
      setNotifSolic(p.notifSolicitacoesEmail); setNotifMkt(p.notifMarketingEmail);
      setTemFoto(p.temFoto); setTemAssinatura(p.temAssinatura);
    }).catch(() => undefined).finally(() => setCarregando(false));
  }, []);

  function toggle(k: string) { setSec((s) => ({ ...s, [k]: !s[k] })); }

  // validacao senha (estilo Acessorias)
  const senhaForte = novaSenha.length >= 8 && /[a-z]/.test(novaSenha) && /[A-Z]/.test(novaSenha) && /[\d!@#$%^&*]/.test(novaSenha);
  const statusNova = !novaSenha ? { txt: 'a digitar', ok: false } : senhaForte ? { txt: 'forte', ok: true } : { txt: 'fraca', ok: false };
  const statusConf = !confirma ? { txt: 'a digitar', ok: false } : confirma !== novaSenha ? { txt: 'senhas diferentes', ok: false } : { txt: 'ok', ok: true };

  async function upload(url: string, file: File, onOk: () => void) {
    const fd = new FormData(); fd.append('arquivo', file);
    try { await api.upload(url, fd); onOk(); toast('ok', 'Imagem enviada.'); }
    catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro no upload.'); }
  }
  async function verImagem(url: string) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getAccessToken()}` }, credentials: 'include' });
      if (!res.ok) throw new Error();
      window.open(URL.createObjectURL(await res.blob()), '_blank');
    } catch { toast('erro', 'Sem imagem.'); }
  }

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome.');
    if (novaSenha) {
      if (!senhaForte) return toast('erro', 'A nova senha nao atende as regras.');
      if (novaSenha !== confirma) return toast('erro', 'As senhas nao conferem.');
      if (!senhaAtual) return toast('erro', 'Informe a senha atual para troca-la.');
    }
    setSalvando(true);
    try {
      await api.put('/auth/perfil', {
        nome, telefone: telefone || null, observacoes: observacoes || null,
        smtpHost: smtpHost || null, smtpPorta: smtpPorta === '' ? null : Number(smtpPorta),
        smtpUsuario: smtpUsuario || null, smtpSenha: smtpSenha || null, ccoEmails: ccoEmails || null,
        notifSolicitacoesEmail: notifSolic, notifMarketingEmail: notifMkt,
        ...(novaSenha ? { senhaAtual, novaSenha } : {}),
      });
      toast('ok', 'Dados atualizados.');
      setSenhaAtual(''); setNovaSenha(''); setConfirma(''); setSmtpSenha('');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="-m-6 min-h-full bg-neutral-100 p-5 text-[13px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500">
          <User size={16} className="text-slate-400" /><span>Sistema</span>
          <span className="text-slate-300">›</span><span className="text-slate-700">Dados do meu perfil no Sistema</span>
        </div>
        <input className="w-48 rounded border border-slate-300 bg-white px-2 py-1 text-[12px]" placeholder="Central de ajuda" disabled />
      </div>

      <div className="space-y-1">
        {/* Dados de seguranca */}
        <Secao titulo="Dados de seguranca" aberto={!!sec.seg} onToggle={() => toggle('seg')}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            <div>
              <label className={`${LBL} flex items-center justify-between`}>Nova senha <Status s={statusNova} /></label>
              <div className="relative">
                <input className={INP} type={verNova ? 'text' : 'password'} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
                <button type="button" onClick={() => setVerNova((v) => !v)} className="absolute right-2 top-2 text-slate-400">{verNova ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </div>
            <div>
              <label className={`${LBL} flex items-center justify-between`}>Redigite a nova senha <Status s={statusConf} /></label>
              <div className="relative">
                <input className={INP} type={verConfirma ? 'text' : 'password'} value={confirma} onChange={(e) => setConfirma(e.target.value)} />
                <button type="button" onClick={() => setVerConfirma((v) => !v)} className="absolute right-2 top-2 text-slate-400">{verConfirma ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </div>
            <div className="text-[12px] text-slate-500">
              <p className="font-medium text-slate-600">Regras para a definicao da senha</p>
              <ul className="ml-1 mt-1 space-y-0.5">
                <li>• Deve ter no minimo 8 caracteres</li>
                <li>• Misture letra(s)/simbolo(s) e numero(s)</li>
                <li>• Use letras maiusculas e minusculas</li>
              </ul>
            </div>
            <div className="text-[12px] text-slate-500">
              <p className="font-medium text-slate-600">Dicas para uma senha forte</p>
              <ul className="ml-1 mt-1 space-y-0.5">
                <li>• Evite padroes previsiveis (Ex: 12345)</li>
                <li>• Evite palavras comuns (Ex: senha)</li>
                <li>• 12 caracteres ou mais tendem a ser mais fortes</li>
              </ul>
            </div>
          </div>
        </Secao>

        {/* Dados de perfil */}
        <Secao titulo="Dados de perfil" aberto={!!sec.perfil} onToggle={() => toggle('perfil')}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className={LBL}>Foto de perfil</label>
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload('/auth/perfil/foto', f, () => setTemFoto(true)); }} className="block w-full text-[12px] file:mr-2 file:rounded file:border-0 file:bg-marca-500 file:px-3 file:py-1 file:text-white" />
              <p className="mt-1 text-[11px] text-slate-400">* Recomendamos salvar os arquivos com no maximo 320px de Largura e 320px de Altura</p>
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div><label className={LBL}>Nome</label><input className={INP} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div><label className={LBL}>Tipo / cargo</label><input className={`${INP} bg-slate-50`} value={tipo} disabled /></div>
                <div><label className={LBL}>E-mail (usuario de acesso)</label><input className={`${INP} bg-slate-50`} value={email} disabled /></div>
                <div><label className={LBL}>Fone(s)</label><input className={INP} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Fone" /></div>
                <div className="sm:col-span-2"><label className={LBL}>Dados complementares</label><input className={INP} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Comentarios" /></div>
              </div>
            </div>
            <div>
              <label className={LBL}>Foto de perfil atual</label>
              {temFoto ? (
                <button onClick={() => verImagem('/api/v1/auth/perfil/foto')} className="block"><img src={`/api/v1/auth/perfil/foto?t=${Date.now()}`} alt="Foto" className="h-28 w-28 rounded border border-slate-200 object-cover" /></button>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded border border-slate-200 bg-white"><User size={48} className="text-slate-700" /></div>
              )}
              {!temFoto && <p className="mt-1 text-[12px] text-slate-500">Sem foto de perfil configurada!</p>}
            </div>
          </div>
        </Secao>

        {/* Dados do e-mail */}
        <Secao titulo="Dados do e-mail" aberto={!!sec.email} onToggle={() => toggle('email')}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-4">
            <div><label className={LBL}>Servidor de SMTP (Host)</label><input className={INP} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.exemplo.com" /></div>
            <div><label className={LBL}>Porta de SMTP</label><input className={INP} value={smtpPorta} onChange={(e) => setSmtpPorta(e.target.value)} placeholder="587" /></div>
            <div><label className={LBL}>Usuario do SMTP</label><input className={INP} value={smtpUsuario} onChange={(e) => setSmtpUsuario(e.target.value)} placeholder="usuario@exemplo.com" /></div>
            <div><label className={LBL}>Senha do SMTP</label><input className={INP} type="password" value={smtpSenha} onChange={(e) => setSmtpSenha(e.target.value)} placeholder="Senha do SMTP (Em Branco = Mantem)" /></div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className={LBL}>Assinatura dos E-mail's <span className="font-normal text-status-danger">Recomendado: 420px largura por 125px de altura</span></label>
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload('/auth/perfil/assinatura', f, () => setTemAssinatura(true)); }} className="block w-full text-[12px] file:mr-2 file:rounded file:border-0 file:bg-marca-500 file:px-3 file:py-1 file:text-white" />
              <label className={`${LBL} mt-3`}>Endereco para receber copia oculta (Cco) dos envios por SMTP / Gmail <InfoHint texto={INFO_CCO} /></label>
              <input className={INP} value={ccoEmails} onChange={(e) => setCcoEmails(e.target.value)} placeholder="Cco de todos e-mails enviados" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-[12px] font-medium text-slate-600">Assinatura Atual {temAssinatura && <button onClick={() => setTemAssinatura(false)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>}</div>
              {temAssinatura ? (
                <button onClick={() => verImagem('/api/v1/auth/perfil/assinatura')}><img src={`/api/v1/auth/perfil/assinatura?t=${Date.now()}`} alt="Assinatura" className="max-h-32 rounded border border-slate-200 bg-white object-contain p-1" /></button>
              ) : <span className="text-[12px] text-slate-400">Sem assinatura.</span>}
            </div>
          </div>
        </Secao>

        {/* Notificacoes por e-mail */}
        <Secao titulo="Notificacoes por e-mail" aberto={!!sec.notif} onToggle={() => toggle('notif')}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
            <div>
              <label className={LBL}>Notificacoes de solicitacoes por e-mail (e-mail diario) <InfoHint texto={INFO_NOTIF_SOLIC} /></label>
              <select className={INP} value={notifSolic ? 'L' : 'D'} onChange={(e) => setNotifSolic(e.target.value === 'L')}><option value="L">Ligado</option><option value="D">Desligado</option></select>
            </div>
            <div>
              <label className={LBL}>Notificacoes / Comunicados / Conteudos de Marketing por e-mail <InfoHint texto={INFO_NOTIF_MKT} /></label>
              <select className={INP} value={notifMkt ? 'L' : 'D'} onChange={(e) => setNotifMkt(e.target.value === 'L')}><option value="L">Ligado</option><option value="D">Desligado</option></select>
            </div>
          </div>
        </Secao>
      </div>

      {/* Senha atual + OK */}
      <div className="mt-4 grid grid-cols-1 items-end gap-4 md:grid-cols-2">
        <div>
          <label className={LBL}>Senha atual <span className="text-marca-600">do Acessorias</span></label>
          <input className={INP} type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} placeholder="Senha atual de acesso ao Sistema" />
        </div>
        <button onClick={salvar} disabled={salvando} className="flex items-center justify-center gap-2 rounded-md bg-status-ok py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60">
          <Save size={16} /> {salvando ? 'Salvando...' : 'OK - Atualizar dados'}
        </button>
      </div>
    </div>
  );
}

function Secao({ titulo, aberto, onToggle, children }: { titulo: string; aberto: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200 py-3">
      <button onClick={onToggle} className="flex items-center gap-1 text-left text-[13px] font-semibold text-slate-700">
        {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {titulo} <span className="font-normal text-marca-500">(clique para {aberto ? 'ocultar' : 'exibir'})</span>
      </button>
      {aberto && <div className="mt-3">{children}</div>}
    </div>
  );
}

function Status({ s }: { s: { txt: string; ok: boolean } }) {
  return <span className={`text-[11px] font-medium ${s.ok ? 'text-status-ok' : 'text-status-danger'}`}>{s.txt}</span>;
}
