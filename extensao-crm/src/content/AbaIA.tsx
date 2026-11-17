// Configuração da IA: provedor, chave própria, modelo e como o negócio fala.
import { useEffect, useState } from 'react';
import { gravar, ler, MODELO_PADRAO_IA, type ConfigIA, type ProvedorIA } from '../shared/dados';
import { useColecao } from '../ui/hooks';
import { BarraSalvar } from './BarraSalvar';
import { useCRM } from './contexto';
import { pedirIA } from './iaCliente';

const PROVEDORES: { id: ProvedorIA; nome: string; ajuda: string }[] = [
  { id: 'groq', nome: 'Groq', ajuda: 'Grátis com limite diário. Chave em console.groq.com (começa com gsk_).' },
  { id: 'gemini', nome: 'Gemini', ajuda: 'Chave em aistudio.google.com (formatos AIza... ou AQ...).' },
  { id: 'openai', nome: 'OpenAI', ajuda: 'Chave em platform.openai.com (começa com sk-). Pago por uso.' },
];

export function AbaIA() {
  const { avisar } = useCRM();
  const salvo = useColecao('ia');
  const [ia, setIa] = useState<ConfigIA | undefined>(salvo);
  const [testando, setTestando] = useState(false);
  const sujo = !!salvo && !!ia && JSON.stringify(salvo) !== JSON.stringify(ia);
  useEffect(() => {
    if (salvo && (!ia || !sujo)) setIa(salvo);
  }, [salvo]);
  if (!ia || !salvo) return null;
  const salvar = (p: Partial<ConfigIA>) => setIa({ ...ia, ...p });
  const atual = PROVEDORES.find((p) => p.id === ia.provedor)!;
  const gravarTudo = async () => {
    await gravar('ia', { ...(await ler('ia')), ...ia, chaves: Object.fromEntries(Object.entries(ia.chaves).map(([k, v]) => [k, (v ?? '').trim()])), modelo: Object.fromEntries(Object.entries(ia.modelo).map(([k, v]) => [k, (v ?? '').trim()])) });
    avisar('Configuração da IA salva');
  };

  const testar = async () => {
    setTestando(true);
    try {
      // testa com o que está na tela: salva antes
      if (sujo) await gravarTudo();
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
        <input className="entrada" type="password" autoComplete="off" key={`k${ia.provedor}`} value={ia.chaves[ia.provedor] ?? ''} onChange={(e) => salvar({ chaves: { ...ia.chaves, [ia.provedor]: e.target.value } })} />
      </label>
      <label className="campo">
        <span>Modelo</span>
        <input className="entrada" key={`m${ia.provedor}`} placeholder={MODELO_PADRAO_IA[ia.provedor]} value={ia.modelo[ia.provedor] ?? ''} onChange={(e) => salvar({ modelo: { ...ia.modelo, [ia.provedor]: e.target.value } })} />
      </label>
      <label className="campo campo--largo">
        <span>Sobre o seu negócio (o que vende, horários, como atende). A IA usa isso nas sugestões.</span>
        <textarea className="entrada" rows={4} value={ia.sobreNegocio} onChange={(e) => salvar({ sobreNegocio: e.target.value })} placeholder="Ex.: Barbearia em Imbituba, corte R$ 40, atendemos de segunda a sábado das 9h às 20h, agendamento pelo link..." />
      </label>
      <label className="campo campo--largo">
        <span>Tom de voz</span>
        <input className="entrada" value={ia.tom} onChange={(e) => salvar({ tom: e.target.value })} />
      </label>
      <div className="linha-botoes campo--largo">
        <button className="btn btn--primario" onClick={testar} disabled={testando}>
          {testando ? 'Testando...' : 'Testar a chave'}
        </button>
      </div>
      <div className="campo--largo">
        <BarraSalvar aba="ia" sujo={sujo} salvar={gravarTudo} descartar={() => setIa(salvo)} />
      </div>
      <div className="ajuda campo--largo">
        Nos botões de IA ela só escreve rascunhos: o texto vai para o campo e você revisa antes de enviar. Para ela responder os clientes sozinha, use a aba Atendimento automático. A chave fica salva só neste navegador.
      </div>
    </div>
  );
}
