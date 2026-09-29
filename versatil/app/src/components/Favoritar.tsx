"use client";
import { useEffect, useState } from "react";

const CHAVE = "versatil_favoritos";

/** Coração de favoritos (guardado no navegador), como o do ML. */
export function Favoritar({ id, comTexto = false }: { id: string; comTexto?: boolean }) {
  const [fav, setFav] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFav((JSON.parse(localStorage.getItem(CHAVE) || "[]") as string[]).includes(id));
    } catch {}
  }, [id]);
  const alternar = () => {
    try {
      const lista: string[] = JSON.parse(localStorage.getItem(CHAVE) || "[]");
      const nova = lista.includes(id) ? lista.filter((x) => x !== id) : [id, ...lista].slice(0, 100);
      localStorage.setItem(CHAVE, JSON.stringify(nova));
      setFav(nova.includes(id));
    } catch {}
  };
  return (
    <button onClick={alternar} aria-pressed={fav} aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"} className="inline-flex items-center gap-2 text-ouro-escuro">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
      </svg>
      {comTexto && <span className="text-[14px]">{fav ? "Nos seus favoritos" : "Adicionar aos favoritos"}</span>}
    </button>
  );
}
