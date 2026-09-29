import Link from "next/link";
import { CarrinhoProvider } from "@/components/carrinho";
import { BotaoCarrinho } from "@/components/BotaoCarrinho";
import { RastreioGrupo } from "@/components/RastreioGrupo";
import { IconeEscudo, IconeLoja, IconePix, IconeWhats } from "@/components/Icones";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { soDigitos } from "@/lib/format";
import { clienteAtual } from "@/lib/conta";

export default async function LojaLayout({ children }: LayoutProps<"/">) {
  const [cfg, categorias, cliente] = await Promise.all([
    getConfig(),
    db.categoria.findMany({ where: { produtos: { some: { status: "ATIVO" } } }, orderBy: { ordem: "asc" } }),
    clienteAtual(),
  ]);
  const zap = soDigitos(cfg.loja_whatsapp);

  return (
    <CarrinhoProvider>
      <RastreioGrupo />
      {/* cabeçalho no padrão ML: faixa de cor, logo, busca larga, carrinho; 2ª linha com local + categorias */}
      <header className="bg-noite text-white">
        <div className="mx-auto max-w-[1200px] px-3 pt-2.5 md:px-4">
          <div className="flex items-center gap-3 md:gap-8">
            <Link href="/" aria-label="Versátil — início" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Versátil — Melhor preço da região" className="h-9 w-auto md:h-11" />
            </Link>
            <form action="/busca" className="relative hidden flex-1 md:block md:max-w-[600px]">
              <input name="q" placeholder="Buscar produtos, marcas e muito mais…" className="h-10 w-full rounded-[2px] bg-white pl-4 pr-12 text-[16px] shadow-[0_1px_2px_rgba(0,0,0,0.2)] outline-none placeholder:text-[#999]" />
              <button aria-label="Buscar" className="absolute right-0 top-0 flex h-10 w-11 items-center justify-center border-l border-[#e6e6e6] text-cinza">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
              </button>
            </form>
            {/* login ao lado da busca (desktop) */}
            <div className="hidden shrink-0 leading-tight md:block">
              {cliente ? (
                <Link href="/conta" className="group block">
                  <span className="block text-[13px] font-semibold text-white group-hover:text-ouro">Olá, {cliente.nome.split(" ")[0]}</span>
                  <span className="block text-[12px] text-white/60">Minha conta e pedidos</span>
                </Link>
              ) : (
                <>
                  <Link href="/entrar" className="inline-block rounded-[6px] border border-ouro px-4 py-1.5 text-[13px] font-semibold text-ouro hover:bg-ouro hover:text-noite">
                    Entrar
                  </Link>
                  <Link href="/cadastro" className="mt-1 block text-[11px] text-white/65 hover:text-white">
                    Ainda não tem cadastro? <b className="font-semibold text-ouro">Clique aqui!</b>
                  </Link>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              {zap && (
                <a href={`https://wa.me/55${zap}`} className="hidden text-[13px] text-white/80 hover:text-white xl:block">
                  Atendimento
                </a>
              )}
              <Link href={cliente ? "/conta" : "/entrar"} aria-label={cliente ? "Minha conta" : "Entrar"} className="flex h-10 w-10 items-center justify-center text-white md:hidden">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" /></svg>
              </Link>
              <BotaoCarrinho />
            </div>
          </div>

          {/* busca no celular */}
          <form action="/busca" className="relative mt-2.5 md:hidden">
            <input name="q" placeholder="Buscar na Versátil" className="h-10 w-full rounded-full bg-white pl-4 pr-11 text-[16px] shadow-[0_1px_2px_rgba(0,0,0,0.2)] outline-none placeholder:text-[#999]" />
            <button aria-label="Buscar" className="absolute right-1 top-0 flex h-10 w-10 items-center justify-center text-cinza">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            </button>
          </form>

          <nav className="sem-barra -mx-3 mt-2 flex items-center gap-5 overflow-x-auto px-3 pb-2.5 text-[13px] text-white/85 md:mx-0 md:px-0">
            {/* embaixo da logo: só a cidade (depois entra o endereço da loja) */}
            <span className="flex shrink-0 items-center gap-1.5 text-white/85 md:w-[150px]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-ouro" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {cfg.loja_cidade}
            </span>
            <Link href="/busca" className="shrink-0 hover:text-ouro">Todos os produtos</Link>
            <Link href="/busca?ordem=desconto" className="shrink-0 hover:text-ouro">Ofertas</Link>
            <Link href="/busca?max=50" className="shrink-0 hover:text-ouro">Até R$ 50</Link>
            {categorias.map((c) => (
              <Link key={c.id} href={`/busca?cat=${c.slug}`} className="shrink-0 hover:text-ouro">
                {c.nome}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-12 bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 text-center sm:grid-cols-3">
          {[
            [IconeLoja, "Retire na loja", `${cfg.loja_endereco} · ${cfg.loja_horario}. Pagou, o produto fica separado no seu nome.`],
            [IconePix, "Pague no Pix ou cartão", "Pagamento seguro processado pelo Asaas. Aprovação do Pix na hora."],
            [IconeEscudo, "Compra garantida", "Produtos conferidos pela equipe. Compras online têm 7 dias para arrependimento (CDC art. 49)."],
          ].map(([I, t, d]) => {
            const Icone = I as typeof IconeLoja;
            return (
              <div key={t as string} className="flex flex-col items-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-fio">
                  <Icone className="h-6 w-6 text-ouro-escuro" />
                </span>
                <p className="mt-3 text-[16px] font-semibold">{t as string}</p>
                <p className="mt-1 max-w-xs text-[13px] text-cinza">{d as string}</p>
              </div>
            );
          })}
        </div>
        <div className="border-t border-fio">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-2 px-4 py-4 text-[12px] text-cinza sm:flex-row">
            <p>© {new Date().getFullYear()} Versátil — Melhor preço da região</p>
            {zap && (
              <a href={`https://wa.me/55${zap}`} className="inline-flex items-center gap-1.5 hover:text-marfim">
                <IconeWhats className="h-4 w-4 text-jade" /> Fale com a gente no WhatsApp
              </a>
            )}
          </div>
        </div>
      </footer>
    </CarrinhoProvider>
  );
}
