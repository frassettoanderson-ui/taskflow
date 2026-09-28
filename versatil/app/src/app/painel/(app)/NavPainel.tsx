"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/painel", rotulo: "Início", icone: "M3 11.5 12 4l9 7.5M5 10v10h14V10" },
  { href: "/painel/pedidos", rotulo: "Pedidos", icone: "M6 3h12l1 18H5L6 3Zm3 5h6M9 12h6" },
  { href: "/painel/produtos/novo", rotulo: "Cadastrar", icone: "M12 5v14M5 12h14", destaque: true },
  { href: "/painel/produtos", rotulo: "Produtos", icone: "M4 7l8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7" },
  { href: "/painel/retirada", rotulo: "Retirada", icone: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z" },
];

export function NavPainel({ aSeparar, vertical = false }: { aSeparar: number; vertical?: boolean }) {
  const path = usePathname();
  const ativo = (h: string) => (h === "/painel" ? path === h : path.startsWith(h) && !(h === "/painel/produtos" && path === "/painel/produtos/novo"));

  if (vertical)
    return (
      <nav className="mt-8 flex flex-col gap-1">
        {[...ITENS, { href: "/painel/disparos", rotulo: "Disparos WhatsApp", icone: "" }, { href: "/painel/config", rotulo: "Configurações", icone: "" }].map((i) => (
          <Link key={i.href} href={i.href} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition ${ativo(i.href) ? "bg-ouro/10 text-ouro-claro" : "text-cinza hover:text-marfim"}`}>
            {i.rotulo}
            {i.href === "/painel/pedidos" && aSeparar > 0 && <span className="rounded-full bg-ouro px-2 font-mono text-[11px] text-noite">{aSeparar}</span>}
          </Link>
        ))}
      </nav>
    );

  return (
    <nav className="grid grid-cols-5">
      {ITENS.map((i) => (
        <Link key={i.href} href={i.href} className="relative flex flex-col items-center gap-0.5 py-1.5">
          {i.destaque ? (
            <span className="botao-ouro -mt-5 flex h-12 w-12 items-center justify-center rounded-full">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d={i.icone} /></svg>
            </span>
          ) : (
            <svg viewBox="0 0 24 24" className={`h-5 w-5 ${ativo(i.href) ? "text-ouro" : "text-cinza"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={i.icone} /></svg>
          )}
          <span className={`text-[10px] font-semibold ${ativo(i.href) ? "text-ouro-claro" : "text-cinza"}`}>{i.rotulo}</span>
          {i.href === "/painel/pedidos" && aSeparar > 0 && (
            <span className="absolute right-[22%] top-0 rounded-full bg-ouro px-1.5 font-mono text-[10px] text-noite">{aSeparar}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
