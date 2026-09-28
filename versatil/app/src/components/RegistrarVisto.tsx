"use client";
import { useEffect } from "react";

export const CHAVE_VISTOS = "versatil_vistos";

/** Guarda no navegador os últimos produtos vistos (alimenta "Visto recentemente" / "Também te interessa"). */
export function RegistrarVisto({ id }: { id: string }) {
  useEffect(() => {
    try {
      const atual: string[] = JSON.parse(localStorage.getItem(CHAVE_VISTOS) || "[]");
      localStorage.setItem(CHAVE_VISTOS, JSON.stringify([id, ...atual.filter((x) => x !== id)].slice(0, 20)));
    } catch {}
  }, [id]);
  return null;
}
