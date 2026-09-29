import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { GRUPOS } from "../menu-itens";

export const metadata = { title: "Menu" };

/** Menu completo para o celular (o "Mais" da barra inferior). */
export default async function Menu() {
  const u = await exigirUsuario();
  const admin = u.papel === "ADMIN";
  return (
    <div className="mx-auto max-w-md space-y-5">
      {GRUPOS.map((g) => {
        const itens = g.itens.filter((i) => admin || !i.admin);
        if (!itens.length) return null;
        return (
          <section key={g.titulo || "topo"}>
            {g.titulo && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cinza">{g.titulo}</p>}
            <div className="grid grid-cols-2 gap-2">
              {itens.map((i) => (
                <Link key={i.href} href={i.href} className="flex items-center gap-2.5 rounded-2xl border filete bg-white p-3.5 text-sm font-semibold">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ouro-escuro" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={i.icone} /></svg>
                  {i.rotulo}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
