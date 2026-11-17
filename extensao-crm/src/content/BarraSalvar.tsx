// Barra fixa no rodapé das configurações: mostra se há alteração não salva e salva/descarta.
import { createContext, useContext, useEffect } from 'react';

/** Configurações avisa antes de fechar/trocar de aba se alguma aba tiver alteração pendente. */
export const SujoCtx = createContext<(aba: string, sujo: boolean) => void>(() => {});

export function BarraSalvar({ aba, sujo, salvar, descartar }: { aba: string; sujo: boolean; salvar: () => void; descartar: () => void }) {
  const avisarSujo = useContext(SujoCtx);
  useEffect(() => {
    avisarSujo(aba, sujo);
    return () => avisarSujo(aba, false);
  }, [aba, sujo, avisarSujo]);

  return (
    <div className={`barra-salvar${sujo ? ' barra-salvar--sujo' : ''}`}>
      <span className="barra-salvar__txt">{sujo ? 'Há alterações que ainda não foram salvas' : 'Tudo salvo'}</span>
      <button type="button" className="btn btn--fantasma" disabled={!sujo} onClick={descartar}>
        Descartar
      </button>
      <button type="button" className="btn btn--primario" disabled={!sujo} onClick={salvar}>
        Salvar alterações
      </button>
    </div>
  );
}
