"use client";
import Link from "next/link";

const ICONES = {
  cards: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  lista: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};

/** Alterna cards × lista; a escolha fica salva num cookie (vale neste navegador). */
export function AlternarModo({ modo, href, cookie }: { modo: "cards" | "lista"; href: Record<"cards" | "lista", string>; cookie: string }) {
  return (
    <div className="flex shrink-0 gap-1 rounded-full border filete bg-white p-1">
      {(["cards", "lista"] as const).map((m) => (
        <Link
          key={m}
          href={href[m]}
          onClick={() => { document.cookie = `${cookie}=${m}; path=/painel; max-age=31536000`; }}
          aria-label={m === "cards" ? "Ver em cards" : "Ver em lista"}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${modo === m ? "bg-noite text-ouro-claro" : "text-cinza"}`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONES[m]} /></svg>
          {m === "cards" ? "Cards" : "Lista"}
        </Link>
      ))}
    </div>
  );
}
