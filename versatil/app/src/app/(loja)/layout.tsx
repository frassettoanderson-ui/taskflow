import Link from "next/link";
import { CarrinhoProvider } from "@/components/carrinho";
import { BotaoCarrinho } from "@/components/BotaoCarrinho";
import { RastreioGrupo } from "@/components/RastreioGrupo";
import { getConfig } from "@/lib/config";
import { soDigitos } from "@/lib/format";

export default async function LojaLayout({ children }: LayoutProps<"/">) {
  const cfg = await getConfig();
  const zap = soDigitos(cfg.loja_whatsapp);
  return (
    <CarrinhoProvider>
      <RastreioGrupo />
      <header className="sticky top-0 z-30 border-b filete bg-noite/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="Versátil — início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Versátil — Melhor preço da região" className="h-9 w-auto" />
          </Link>
          <BotaoCarrinho />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-16 border-t filete">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-center text-sm text-cinza sm:grid-cols-3">
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ouro">Retirada</p>
            <p className="text-marfim">{cfg.loja_endereco}</p>
            <p>{cfg.loja_horario}</p>
          </div>
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ouro">Como funciona</p>
            <p>Pagou, a peça é sua. Reservamos na hora e você retira na loja com o seu código.</p>
          </div>
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ouro">Atendimento</p>
            {zap ? (
              <a className="text-marfim underline decoration-ouro/50 underline-offset-4" href={`https://wa.me/55${zap}`}>
                Falar no WhatsApp
              </a>
            ) : (
              <p>WhatsApp em breve</p>
            )}
            <p className="mt-2 text-xs">Compras online: 7 dias para arrependimento (CDC art. 49).</p>
          </div>
        </div>
      </footer>
    </CarrinhoProvider>
  );
}
