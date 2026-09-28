"use client";
import { useEffect } from "react";

/** Guarda o ?g=<grupo> dos links disparados no WhatsApp para atribuir a venda ao grupo. */
export function RastreioGrupo() {
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("g");
    if (g && /^[\w-]{1,40}$/.test(g)) document.cookie = `vs_g=${g}; path=/; max-age=${7 * 86400}; samesite=lax`;
  }, []);
  return null;
}
