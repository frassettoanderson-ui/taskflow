import Link from "next/link";
import { Marca } from "@/components/Marca";

export function Cabecalho({ nome, sair, voltar }: { nome?: string; sair?: () => Promise<void>; voltar?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-noite px-4 text-white">
      {voltar ? (
        <Link href={voltar} className="flex items-center gap-1 text-sm font-semibold text-ouro-claro">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          Voltar
        </Link>
      ) : (
        <Marca className="text-[18px]" />
      )}
      {nome && (
        <div className="flex items-center gap-3 text-xs text-white/70">
          <span className="max-w-[9rem] truncate">{nome}</span>
          {sair && (
            <form action={sair}>
              <button className="underline underline-offset-2">Sair</button>
            </form>
          )}
        </div>
      )}
    </header>
  );
}
