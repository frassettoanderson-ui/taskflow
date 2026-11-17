// Chave liga/desliga (mais clara que caixinha de marcar para quem não é técnico).
export function Interruptor({ ligado, aoMudar, rotulo, descricao }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string; descricao?: string }) {
  return (
    <button type="button" className="interruptor" role="switch" aria-checked={ligado} onClick={() => aoMudar(!ligado)}>
      <span className="interruptor__trilho">
        <span className="interruptor__bola" />
      </span>
      <span className="interruptor__txt">
        <strong>{rotulo}</strong>
        {descricao && <small>{descricao}</small>}
      </span>
      <span className="interruptor__estado">{ligado ? 'Ligado' : 'Desligado'}</span>
    </button>
  );
}
