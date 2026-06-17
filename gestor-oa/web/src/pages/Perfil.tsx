import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Spinner, useToast } from '../components/ui';

interface Perfil { nome: string; email: string; tipo: string | null; telefone: string | null; observacoes: string | null }

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

  useEffect(() => {
    api.get<Perfil>('/auth/perfil').then((p) => {
      setNome(p.nome); setEmail(p.email); setTipo(p.tipo ?? '');
      setTelefone(p.telefone ?? ''); setObservacoes(p.observacoes ?? '');
    }).finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    if (nome.trim().length < 2) return toast('erro', 'Informe o nome.');
    if (novaSenha && novaSenha.length < 8) return toast('erro', 'Nova senha minima de 8 caracteres.');
    if (novaSenha && !senhaAtual) return toast('erro', 'Informe a senha atual para troca-la.');
    setSalvando(true);
    try {
      await api.put('/auth/perfil', {
        nome, telefone: telefone || null, observacoes: observacoes || null,
        ...(novaSenha ? { senhaAtual, novaSenha } : {}),
      });
      toast('ok', 'Perfil atualizado.');
      setSenhaAtual(''); setNovaSenha('');
    } catch (e) { toast('erro', e instanceof ApiError ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  if (carregando) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Dados do meu perfil</h1>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><label className="label">Tipo / cargo</label><input className="input" value={tipo} disabled /></div>
        <div><label className="label">E-mail (usuario de acesso)</label><input className="input" value={email} disabled /></div>
        <div><label className="label">Fone(s)</label><input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Fone" /></div>
        <div className="sm:col-span-2"><label className="label">Dados complementares</label><input className="input" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Comentarios" /></div>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Trocar senha (opcional)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label">Senha atual</label><input type="password" className="input" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} /></div>
          <div><label className="label">Nova senha (min 8)</label><input type="password" className="input" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Em branco = manter" /></div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={salvar} disabled={salvando}><Save size={16} /> {salvando ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </div>
  );
}
