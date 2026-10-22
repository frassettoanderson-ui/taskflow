// Assistente de IA da conversa aberta: sugere a próxima resposta lendo as últimas mensagens e a ficha.
// Nunca envia sozinho: o texto vai para o campo de mensagem e a pessoa revisa e aperta enviar.
import { useEffect, useState } from 'react';
import { totalNegocios } from '../shared/dados';
import { moeda, telefone } from '../ui/formato';
import { useEsc } from '../ui/hooks';
import { IconFechar } from '../ui/icones';
import { BotoesIA } from './BotoesIA';
import { useCRM } from './contexto';
import { pedirIA } from './iaCliente';
import { wa } from './wa';

const CAMPO = 'footer div[contenteditable="true"]';

export function Assistente({ fechar }: { fechar: () => void }) {
  const { ativo, contatos, avisar } = useCRM();
  const [texto, setTexto] = useState('');
  const [sugerindo, setSugerindo] = useState(false);
  useEsc(fechar);

  // começa com o que já estava digitado no WhatsApp
  useEffect(() => {
    setTexto((document.querySelector(CAMPO)?.textContent ?? '').trim());
  }, []);

  const contato = ativo ? contatos[ativo.id] : undefined;

  const sugerir = async () => {
    if (!ativo) return avisar('Abra uma conversa primeiro', true);
    setSugerindo(true);
    try {
      const msgs = await wa('ultimasMensagens', ativo.id, 20);
      if (!msgs.length) throw new Error('A conversa não tem mensagens de texto para a IA ler');
      const conversa = msgs.map((m) => `${m.deMim ? 'Atendente' : 'Cliente'}: ${m.texto}`).join('\n');
      const ficha = contato
        ? [
            contato.nome && `Nome: ${contato.nome}`,
            contato.empresa && `Empresa: ${contato.empresa}`,
            contato.cidade && `Cidade: ${contato.cidade}`,
            contato.produtos && `Interesse: ${contato.produtos}`,
            contato.negocios.length && `Negócios: ${moeda.format(totalNegocios(contato))}`,
            contato.observacoes && `Observações: ${contato.observacoes}`,
          ]
            .filter(Boolean)
            .join('\n')
        : `Nome: ${ativo.nome || telefone(ativo.numero)}`;
      setTexto(await pedirIA('responder', texto, `Dados do cliente:\n${ficha}\n\nConversa (mais antiga primeiro):\n${conversa}`));
    } catch (e) {
      avisar(`IA: ${(e as Error).message}`, true);
    } finally {
      setSugerindo(false);
    }
  };

  const usar = async () => {
    if (!ativo || !texto.trim()) return;
    try {
      await wa('escreverNoCampo', ativo.id, texto.trim());
      fechar();
    } catch (e) {
      avisar(`Não foi possível colocar no campo: ${(e as Error).message}`, true);
    }
  };

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="modal">
        <div className="modal__topo">
          <h2>Assistente de IA</h2>
          <p>{ativo ? `Conversa com ${contato?.nome || ativo.nome || telefone(ativo.numero)}` : 'Abra uma conversa para usar o assistente'}</p>
          <button className="icone-btn modal__fechar" onClick={fechar} title="Fechar (Esc)">
            <IconFechar />
          </button>
        </div>
        <div className="modal__corpo">
          <div className="linha-botoes" style={{ marginBottom: 12 }}>
            <button className="btn btn--primario" onClick={sugerir} disabled={!ativo || sugerindo}>
              {sugerindo ? 'Lendo a conversa...' : 'Sugerir resposta'}
            </button>
          </div>
          <textarea className="entrada" rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Peça uma sugestão ou escreva aqui para corrigir e melhorar." />
          <BotoesIA texto={texto} aoResultado={setTexto} />
          <div className="ajuda">Confira preços, prazos e qualquer [marcador] antes de enviar.</div>
        </div>
        <div className="modal__rodape">
          <button className="btn" onClick={fechar}>
            Cancelar
          </button>
          <button className="btn btn--primario" onClick={usar} disabled={!ativo || !texto.trim()}>
            Colocar no campo de mensagem
          </button>
        </div>
      </div>
    </div>
  );
}
