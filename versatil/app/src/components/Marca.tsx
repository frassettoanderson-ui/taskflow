import { MARCA } from "@/lib/marca";

/** Marca em texto (enquanto não há logo): selo dourado "L3" + "SALVADOS". tom = cor do fundo onde ela fica. */
export function Marca({ tom = "escuro", className = "" }: { tom?: "escuro" | "claro"; className?: string }) {
  const [sigla, ...resto] = MARCA.nome.split(" ");
  return (
    <span className={`inline-flex select-none items-center gap-[0.35em] leading-none ${className}`} aria-label={MARCA.nome}>
      <span className="rounded-[0.22em] bg-gradient-to-b from-ouro-claro to-ouro px-[0.28em] py-[0.16em] font-black tracking-tight text-noite">{sigla}</span>
      <span className={`font-extrabold uppercase tracking-[0.08em] ${tom === "escuro" ? "text-white" : "text-noite"}`}>{resto.join(" ")}</span>
    </span>
  );
}
