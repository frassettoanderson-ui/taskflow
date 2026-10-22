// Ao digitar "/" no campo de mensagem do WhatsApp, mostra as respostas rápidas que batem com o atalho.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RespostaRapida } from '../shared/dados';
import { useColecao } from '../ui/hooks';
import { useCRM } from './contexto';
import { destinoDe, enviarResposta, inserirResposta } from './envio';
import { ICONE_TIPO } from './Respostas';
import { wa } from './wa';

const CAMPO = 'footer div[contenteditable="true"]';

export function SugestoesBarra() {
  const { ativo, contatos, avisar } = useCRM();
  const respostas = useColecao('respostas') ?? [];
  const [termo, setTermo] = useState<string | null>(null);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  const [sel, setSel] = useState(0);
  const lista = useMemo(() => {
    if (termo === null) return [];
    const t = termo.toLowerCase();
    return respostas.filter((r) => r.atalho.startsWith(t) || r.titulo.toLowerCase().includes(t)).slice(0, 8);
  }, [termo, respostas]);
  const estado = useRef({ lista, sel });
  estado.current = { lista, sel };

  useEffect(() => {
    const aoDigitar = (e: Event) => {
      const alvo = e.target as HTMLElement;
      const campo = alvo.closest?.(CAMPO) as HTMLElement | null;
      if (!campo) return;
      const m = (campo.textContent ?? '').match(/^\/(\S*)$/);
      if (!m) return setTermo(null);
      const r = campo.getBoundingClientRect();
      setPos({ left: r.left, bottom: window.innerHeight - r.top + 8 });
      setTermo(m[1]);
      setSel(0);
    };
    document.addEventListener('input', aoDigitar, true);
    return () => document.removeEventListener('input', aoDigitar, true);
  }, []);

  const escolher = async (r: RespostaRapida) => {
    setTermo(null);
    if (!ativo) return;
    const destino = destinoDe(ativo, contatos[ativo.id]);
    try {
      if (r.tipo === 'texto') await inserirResposta(destino, r);
      else {
        await wa('escreverNoCampo', ativo.id, '');
        await enviarResposta(destino, r);
      }
    } catch (e) {
      avisar(`Falhou: ${(e as Error).message}`, true);
    }
  };

  useEffect(() => {
    if (termo === null) return;
    const tecla = (e: KeyboardEvent) => {
      const { lista, sel } = estado.current;
      if (e.key === 'Escape') {
        setTermo(null);
        return;
      }
      if (!lista.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSel((s) => (s + (e.key === 'ArrowDown' ? 1 : lista.length - 1)) % lista.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        escolher(lista[sel]);
      }
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [termo === null]);

  if (termo === null || !lista.length) return null;

  return (
    <div className="sugestoes" style={{ left: pos.left, bottom: pos.bottom }} role="listbox">
      {lista.map((r, i) => {
        const Icone = ICONE_TIPO[r.tipo];
        return (
          <button key={r.id} className="sugestao" role="option" aria-selected={i === sel} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(r)}>
            <span className="resposta__tipo" style={{ width: 26, height: 26 }}>
              <Icone tam={14} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="resposta__titulo">
                {r.titulo}
                <span className="resposta__atalho">/{r.atalho}</span>
              </span>
              <span className="resposta__previa" style={{ display: 'block' }}>
                {r.texto || r.nomeArquivo}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
