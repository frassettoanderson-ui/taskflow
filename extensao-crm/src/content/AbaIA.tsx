// Configuração da IA: provedor, chave própria, modelo e como o negócio fala.
import { useState } from 'react';
import { gravar, MODELO_PADRAO_IA, type ProvedorIA } from '../shared/dados';
import { useColecao } from '../ui/hooks';
import { useCRM } from './contexto';
import { pedirIA } from './iaCliente';

const PROVEDORES: { id: ProvedorIA; nome: string; ajuda: string }[] = [
  { id: 'groq', nome: 'Groq', ajuda: 'Grátis com limite diário. Chave em console.groq.com (começa com gsk_).' },
  { id: 'gemini', nome: 'Gemini', ajuda: 'Chave em aistudio.google.com (formatos AIza... ou AQ...).' },
  { id: 'openai', nome: 'OpenAI', ajuda: 'Chave em platform.openai.com (começa com sk-). Pago por uso.' },
];

export function AbaIA() {
  const { avisar } = useCRM();
  const ia = useColecao('ia');
  const [testando, setTestando] = useState(false);
  if (!ia) return null;
  const salvar = (p: Partial<typeof ia>) => gravar('ia', { ...ia, ...p });
  const atual = PROVEDORES.find((p) => p.id === ia.provedor)!;

  const testar = async () => {
    setTestando(true);
    try {
      const t = await pedirIA('corrigir', 'ola, tudo bem com vcs? gostaria de mais informaçao');
      avisar(`Funcionando: "${t.slice(0, 60)}"`);
    } catch (e) {
      avisar(`Falhou: ${(e as Error).message}`, true);
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="campos">
      <div className="campo campo--largo">
        <span>Provedor</span>
        <div className="abas" style={{ justifyContent: 'flex-start', paddingTop: 0 }}>
          {PROVEDORES.map((p) => (
            <button key={p.id} className="aba" aria-pressed={ia.provedor === p.id} onClick={() => salvar({ provedor: p.id })}>
              {p.nome}
            </button>
          ))}
        </div>
        <small className="ajuda" style={{ textAlign: 'left' }}>{atual.ajuda}</small>
      </div>
      <label className="campo">
        <span>Chave da API ({atual.nome})</span>
        <input className="entrada" type="password" autoComplete="off" key={`k${ia.provedor}`} defaultValue={ia.chaves[ia.provedor] ?? ''} onBlur={(e) => salvar({ chaves: { ...ia.chaves, [ia.provedor]: e.target.value.trim() } })} />
      </label>
      <label className="campo">
        <span>Modelo</span>
        <input className="entrada" key={`m${ia.provedor}`} placeholder={MODELO_PADRAO_IA[ia.provedor]} defaultValue={ia.modelo[ia.provedor] ?? ''} onBlur={(e) => salvar({ modelo: { ...ia.modelo, [ia.provedor]: e.target.value.trim() } })} />
      </label>
      <label className="campo campo--largo">
        <span>Sobre o seu negócio (o que vende, horários, como atende). A IA usa isso nas sugestões.</span>
        <textarea className="entrada" rows={4} defaultValue={ia.sobreNegocio} onBlur={(e) => salvar({ sobreNegocio: e.target.value })} placeholder="Ex.: Barbearia em Imbituba, corte R$ 40, atendemos de segunda a sábado das 9h às 20h, agendamento pelo link..." />
      </label>
      <label className="campo campo--largo">
        <span>Tom de voz</span>
        <input className="entrada" defaultValue={ia.tom} onBlur={(e) => salvar({ tom: e.target.value })} />
      </label>
      <div className="linha-botoes campo--largo">
        <button className="btn btn--primario" onClick={testar} disabled={testando}>
          {testando ? 'Testando...' : 'Testar a chave'}
        </button>
      </div>
      <div className="ajuda campo--largo">
        A IA só escreve rascunhos. O texto vai para o campo de mensagem e você revisa antes de enviar. A chave fica salva só neste navegador.
      </div>
    </div>
  );
}
