"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPOS, I, type Item } from "./menu-itens";

export function NavPainel({ aSeparar, vertical = false, admin }: { aSeparar: number; vertical?: boolean; admin: boolean }) {
  const path = usePathname();
  const todos = GRUPOS.flatMap((g) => g.itens.map((i) => i.href));
  // item ativo = o de prefixo mais longo que casa com a rota atual
  const melhor = todos.filter((h) => (h === "/painel" ? path === h : path === h || path.startsWith(h + "/"))).sort((a, b) => b.length - a.length)[0];
  const ativo = (h: string) => h === melhor;
  const Icone = ({ d, className }: { d: string; className: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  );

  if (vertical)
    return (
      <nav className="mt-6 flex flex-col gap-4 overflow-y-auto">
        {GRUPOS.map((g) => {
          const itens = g.itens.filter((i) => admin || !i.admin);
          if (!itens.length) return null;
          return (
            <div key={g.titulo || "topo"}>
              {g.titulo && <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-cinza/70">{g.titulo}</p>}
              {itens.map((i) => (
                <Link key={i.href} href={i.href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${ativo(i.href) ? "bg-ouro/15 text-ouro-escuro" : "text-marfim/70 hover:bg-grafite hover:text-marfim"}`}>
                  <Icone d={i.icone} className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{i.rotulo}</span>
                  {i.href === "/painel/pedidos" && aSeparar > 0 && <span className="rounded-full bg-ouro px-2 font-mono text-[11px] text-noite">{aSeparar}</span>}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
    );

  // barra inferior do celular
  const barra: (Item & { destaque?: boolean })[] = admin
    ? [
        { href: "/painel", rotulo: "Início", icone: I.inicio },
        { href: "/painel/pedidos", rotulo: "Pedidos", icone: I.pedidos },
        { href: "/painel/pdv", rotulo: "PDV", icone: I.pdv, destaque: true },
        { href: "/painel/produtos/novo", rotulo: "Cadastrar", icone: I.cadastrar },
        { href: "/painel/menu", rotulo: "Mais", icone: I.mais },
      ]
    : [
        { href: "/painel/pedidos", rotulo: "Pedidos", icone: I.pedidos },
        { href: "/painel/pdv", rotulo: "PDV", icone: I.pdv, destaque: true },
        { href: "/painel/caixa", rotulo: "Caixa", icone: I.caixa },
        { href: "/painel/retirada", rotulo: "Retirada", icone: I.retirada },
      ];
  return (
    <nav className={`grid ${admin ? "grid-cols-5" : "grid-cols-4"}`}>
      {barra.map((i) => {
        const on = i.href === "/painel/menu" ? path === "/painel/menu" : ativo(i.href);
        return (
          <Link key={i.href} href={i.href} className="relative flex flex-col items-center gap-0.5 py-1.5">
            {i.destaque ? (
              <span className="botao-ouro -mt-5 flex h-12 w-12 items-center justify-center rounded-full">
                <Icone d={i.icone} className="h-6 w-6" />
              </span>
            ) : (
              <Icone d={i.icone} className={`h-5 w-5 ${on ? "text-ouro-escuro" : "text-cinza"}`} />
            )}
            <span className={`text-[10px] font-semibold ${on ? "text-ouro-escuro" : "text-cinza"}`}>{i.rotulo}</span>
            {i.href === "/painel/pedidos" && aSeparar > 0 && <span className="absolute right-[22%] top-0 rounded-full bg-ouro px-1.5 font-mono text-[10px] text-noite">{aSeparar}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
