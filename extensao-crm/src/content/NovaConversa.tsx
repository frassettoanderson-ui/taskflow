// Abrir conversa com um número que não está na agenda, e gerar link wa.me para divulgar.
import { useState } from 'react';
import { normalizarNumero } from '../shared/dados';
import { mascaraTelefone } from '../ui/formato';
import { useEsc } from '../ui/hooks';
import { IconFechar } from '../ui/icones';
import { useCRM } from './contexto';
import { wa } from './wa';

export function NovaConversa({ fechar }: { fechar: () => void }) {
  const { avisar, salvarContato } = useCRM();
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [texto, setTexto] = useState('');
  const [abrindo, setAbrindo] = useState(false);
  useEsc(fechar);

  const numero = normalizarNumero(telefone);
  const link = numero ? `https://wa.me/${numero}${texto.trim() ? `?text=${encodeURIComponent(texto.trim())}` : ''}` : '';

  const abrir = async () => {
    if (!numero) return avisar('Número incompleto', true);
    setAbrindo(true);
    try {
      const id = await wa('existeNumero', numero);
      if (!id) return avisar('Este número não tem WhatsApp', true);
      await wa('abrirChat', id);
      if (nome.trim()) await salvarContato({ id, nome: nome.trim(), numero }, (c) => void (c.nome = nome.trim()));
      if (texto.trim()) await wa('escreverNoCampo', id, texto.trim());
      fechar();
    } catch (e) {
      avisar(`Não foi possível abrir: ${(e as Error).message}`, true);
    } finally {
      setAbrindo(false);
    }
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(link);
    avisar('Link copiado');
  };

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="modal">
        <div className="modal__topo">
          <h2>Nova conversa</h2>
          <p>Fale com um número que não está salvo, sem precisar adicionar na agenda.</p>
          <button className="icone-btn modal__fechar" onClick={fechar} title="Fechar (Esc)">
            <IconFechar />
          </button>
        </div>
        <div className="modal__corpo">
          <div className="campos">
            <label className="campo">
              <span>Telefone com DDD</span>
              <input className="entrada" inputMode="tel" placeholder="(48) 99999-8888" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} autoFocus onKeyDown={(e) => e.key === 'Enter' && abrir()} />
            </label>
            <label className="campo">
              <span>Nome (opcional, vai para a ficha)</span>
              <input className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="campo campo--largo">
              <span>Mensagem inicial (fica no campo para você revisar e enviar)</span>
              <textarea className="entrada" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </label>
            {link && (
              <div className="campo campo--largo">
                <span>Link para compartilhar</span>
                <div className="item-linha" style={{ marginTop: 0 }}>
                  <code className="link-wa">{link}</code>
                  <button className="btn btn--pequeno" onClick={copiar}>
                    Copiar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal__rodape">
          <button className="btn" onClick={fechar}>
            Cancelar
          </button>
          <button className="btn btn--primario" onClick={abrir} disabled={!numero || abrindo}>
            Abrir conversa
          </button>
        </div>
      </div>
    </div>
  );
}
