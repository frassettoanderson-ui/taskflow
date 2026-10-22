// Botões de IA para qualquer campo de texto: corrigir, melhorar e criar a partir de um pedido.
import { useState } from 'react';
import { useCRM } from './contexto';
import { pedirIA } from './iaCliente';

export function BotoesIA({ texto, aoResultado }: { texto: string; aoResultado: (t: string) => void }) {
  const { avisar } = useCRM();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pedido, setPedido] = useState<string | null>(null);

  const rodar = async (acao: 'corrigir' | 'melhorar' | 'criar') => {
    if (acao !== 'criar' && !texto.trim()) return avisar('Escreva algum texto primeiro', true);
    if (acao === 'criar' && !pedido?.trim()) return avisar('Descreva o que a mensagem deve dizer', true);
    setOcupado(acao);
    try {
      aoResultado(await pedirIA(acao, texto, acao === 'criar' ? pedido! : undefined));
      setPedido(null);
    } catch (e) {
      avisar(`IA: ${(e as Error).message}`, true);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="botoes-ia">
      <div className="linha-botoes" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn btn--pequeno" disabled={!!ocupado} onClick={() => rodar('corrigir')}>
          {ocupado === 'corrigir' ? 'Corrigindo...' : 'Corrigir ortografia'}
        </button>
        <button type="button" className="btn btn--pequeno" disabled={!!ocupado} onClick={() => rodar('melhorar')}>
          {ocupado === 'melhorar' ? 'Melhorando...' : 'Melhorar texto'}
        </button>
        <button type="button" className="btn btn--pequeno" disabled={!!ocupado} onClick={() => setPedido((p) => (p === null ? '' : null))} aria-pressed={pedido !== null}>
          Criar com IA
        </button>
      </div>
      {pedido !== null && (
        <div className="campos" style={{ marginTop: 6 }}>
          <textarea className="entrada campo--largo" rows={2} autoFocus placeholder="Ex.: convite para o cliente voltar, avisando que temos horário livre sábado" value={pedido} onChange={(e) => setPedido(e.target.value)} />
          <div className="linha-botoes campo--largo" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn--pequeno btn--primario" disabled={!!ocupado} onClick={() => rodar('criar')}>
              {ocupado === 'criar' ? 'Gerando...' : 'Gerar texto'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
