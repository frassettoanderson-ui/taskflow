// Barra fixa logo acima do campo de mensagem com as respostas marcadas como "botão".
// Um clique envia a resposta na conversa aberta. Só aparece com uma conversa aberta.
import { useEffect, useState } from 'react';
import type { RespostaRapida } from '../shared/dados';
import { useColecao } from '../ui/hooks';
import { ICONE_TIPO } from './Respostas';
import { useCRM } from './contexto';
import { destinoDe, enviarResposta } from './envio';

const FOOTER = 'footer';

export function BotoesRapidos() {
  const { ativo, contatos, avisar } = useCRM();
  const respostas = useColecao('respostas') ?? [];
  const [enviando, setEnviando] = useState<string | null>(null);
  const [larguraFooter, setLarguraFooter] = useState<{ left: number; width: number } | null>(null);

  const botoes = respostas.filter((r) => r.botao).sort((a, b) => a.ordem - b.ordem);

  // acompanha a posição do rodapé do WhatsApp para a barra ficar alinhada com o campo
  useEffect(() => {
    const medir = () => {
      const f = document.querySelector(FOOTER) as HTMLElement | null;
      if (f) {
        const r = f.getBoundingClientRect();
        setLarguraFooter({ left: r.left, width: r.width });
      } else {
        setLarguraFooter(null);
      }
    };
    medir();
    const t = setInterval(medir, 1000);
    window.addEventListener('resize', medir);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', medir);
    };
  }, [ativo?.id]);

  if (!ativo || !botoes.length || !larguraFooter) return null;

  const enviar = async (r: RespostaRapida) => {
    setEnviando(r.id);
    try {
      await enviarResposta(destinoDe(ativo, contatos[ativo.id]), r);
    } catch (e) {
      avisar(`Falhou: ${(e as Error).message}`, true);
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="botoes-rapidos" style={{ left: larguraFooter.left, width: larguraFooter.width }}>
      {botoes.map((r) => {
        const Icone = ICONE_TIPO[r.tipo];
        return (
          <button key={r.id} className="botao-rapido" disabled={enviando === r.id} onClick={() => enviar(r)} title={`Enviar: ${r.titulo}`}>
            <Icone tam={14} />
            {r.titulo}
          </button>
        );
      })}
    </div>
  );
}
