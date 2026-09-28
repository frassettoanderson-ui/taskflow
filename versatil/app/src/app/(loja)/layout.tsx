import Link from "next/link";
import { CarrinhoProvider } from "@/components/carrinho";
import { BotaoCarrinho } from "@/components/BotaoCarrinho";
import { RastreioGrupo } from "@/components/RastreioGrupo";
import { IconeEscudo, IconeLoja, IconePix, IconeWhats } from "@/components/Icones";
import { getConfig } from "@/lib/config";
import { soDigitos } from "@/lib/format";

export default async function LojaLayout({ children }: LayoutProps<"/">) {
  const cfg = await getConfig();
  const zap = soDigitos(cfg.loja_whatsapp);
  return (
    <CarrinhoProvider>
      <RastreioGrupo />
      <div className="bg-ouro py-1.5 text-center text-[11px] font-bold text-noite sm:text-xs">
        Produtos com até 70% abaixo do preço de mercado · Retire na loja
      </div>
      <header className="sticky top-0 z-30 border-b filete bg-noite/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" aria-label="Versátil — início" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Versátil — Melhor preço da região" className="h-9 w-auto" />
          </Link>
          <form action="/" className="hidden flex-1 md:block">
            <input name="q" placeholder="Buscar produtos, marcas, códigos…" className="campo !rounded-full !py-2.5" />
          </form>
          <div className="ml-auto">
            <BotaoCarrinho />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-16 border-t filete bg-carvao/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-center text-sm text-cinza sm:grid-cols-3">
          <div>
            <IconeLoja className="mx-auto mb-2 h-6 w-6 text-ouro" />
            <p className="font-semibold text-marfim">Retirada na loja</p>
            <p className="mt-1">{cfg.loja_endereco}</p>
            <p>{cfg.loja_horario}</p>
          </div>
          <div>
            <IconePix className="mx-auto mb-2 h-6 w-6 text-ouro" />
            <p className="font-semibold text-marfim">Pix ou cartão</p>
            <p className="mt-1">Pagamento seguro pelo Asaas. Pagou, o produto fica reservado para você.</p>
          </div>
          <div>
            <IconeEscudo className="mx-auto mb-2 h-6 w-6 text-ouro" />
            <p className="font-semibold text-marfim">Compra garantida</p>
            <p className="mt-1">Produtos conferidos pela equipe. Compras online têm 7 dias para arrependimento (CDC art. 49).</p>
            {zap && (
              <a className="mt-3 inline-flex items-center gap-2 text-marfim underline decoration-ouro/50 underline-offset-4" href={`https://wa.me/55${zap}`}>
                <IconeWhats className="h-4 w-4 text-jade" /> Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
        <p className="pb-6 text-center text-[11px] text-cinza/70">© {new Date().getFullYear()} Versátil — Melhor preço da região</p>
      </footer>
    </CarrinhoProvider>
  );
}
