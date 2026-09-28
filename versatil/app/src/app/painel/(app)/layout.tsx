import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { sair } from "../acoes";
import { NavPainel } from "./NavPainel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel", robots: { index: false } };

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  const u = await exigirUsuario();
  const aSeparar = await db.pedido.count({ where: { status: { in: ["PAGO", "SEPARANDO"] } } });
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r filete bg-carvao/60 p-5 md:flex">
        <Link href="/painel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Versátil" className="h-9 w-auto" />
        </Link>
        <NavPainel aSeparar={aSeparar} vertical />
        <div className="mt-auto text-xs text-cinza">
          <p className="truncate">{u.nome}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/" target="_blank" className="underline underline-offset-2">Ver loja</Link>
            <form action={sair}><button className="underline underline-offset-2">Sair</button></form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b filete bg-noite/90 px-4 backdrop-blur md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Versátil" className="h-7 w-auto" />
        <form action={sair}><button className="text-xs text-cinza underline">Sair</button></form>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t filete bg-noite/95 pt-1.5 backdrop-blur md:hidden">
        <NavPainel aSeparar={aSeparar} />
      </div>
    </div>
  );
}
