import Link from "next/link";
import type { Prisma, StatusProduto } from "@prisma/client";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { brl, diasDesde, CONDICOES } from "@/lib/format";
import { FotoProduto } from "@/components/FotoProduto";
import { codigoInterno } from "@/components/CardProduto";

const ABAS: { status: StatusProduto; rotulo: string }[] = [
  { status: "ATIVO", rotulo: "Na vitrine" },
  { status: "ESGOTADO", rotulo: "Vendidos" },
  { status: "RASCUNHO", rotulo: "Rascunhos" },
  { status: "ARQUIVADO", rotulo: "Arquivados" },
];

export default async function Produtos({ searchParams }: PageProps<"/painel/produtos">) {
  const sp = await searchParams;
  const status = (ABAS.find((a) => a.status === sp.status)?.status ?? "ATIVO") as StatusProduto;
  const ordem = sp.ordem === "parados" ? "parados" : "recentes";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cfg = await getConfig();
  const amarelo = Number(cfg.parado_amarelo_dias);
  const vermelho = Number(cfg.parado_vermelho_dias);

  const where: Prisma.ProdutoWhereInput = {
    status,
    ...(q ? { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, ...(Number(q) ? [{ codigo: Number(q) }] : [])] } : {}),
  };
  const [produtos, contagem] = await Promise.all([
    db.produto.findMany({ where, include: { fotos: { take: 1, orderBy: { ordem: "asc" } } }, orderBy: { criadoEm: "desc" }, take: 300 }),
    db.produto.groupBy({ by: ["status"], _count: true }),
  ]);
  const lista = produtos.map((p) => ({ ...p, dias: diasDesde(p.ultimaVendaEm ?? p.publicadoEm ?? p.criadoEm) }));
  if (ordem === "parados") lista.sort((a, b) => b.dias - a.dias);
  const cor = (d: number) => (d >= vermelho ? "bg-rubi" : d >= amarelo ? "bg-ouro" : "bg-jade");
  const n = (s: string) => contagem.find((c) => c.status === s)?._count ?? 0;
  const url = (o: Record<string, string>) => "/painel/produtos?" + new URLSearchParams({ status, ordem, ...(q ? { q } : {}), ...o }).toString();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Produtos</h1>
        <Link href="/painel/produtos/novo" className="botao-ouro hidden rounded-xl px-5 py-2.5 text-sm md:inline-block">+ Cadastrar</Link>
      </div>
      {sp.salvo && (
        <p className="mt-3 rounded-lg bg-jade/10 px-3 py-2 text-center text-sm text-jade">
          Produto salvo.{sp.grupos ? ` Na fila para ${sp.grupos} grupo(s) de WhatsApp.` : ""}
        </p>
      )}

      <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {ABAS.map((a) => (
          <Link key={a.status} href={url({ status: a.status })} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${status === a.status ? "border-ouro bg-ouro/10 text-ouro-claro" : "filete text-cinza"}`}>
            {a.rotulo} <span className="font-mono opacity-70">{n(a.status)}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-3 flex gap-2">
        <form action="/painel/produtos" className="flex-1">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="ordem" value={ordem} />
          <input name="q" defaultValue={q} placeholder="Buscar por nome, código ou SKU" className="campo !py-2.5" />
        </form>
        <Link href={url({ ordem: ordem === "parados" ? "recentes" : "parados" })} className="shrink-0 rounded-xl border filete px-3 py-2.5 text-xs font-semibold text-cinza">
          {ordem === "parados" ? "⏱ Mais parados" : "🆕 Recentes"}
        </Link>
      </div>

      {status === "ATIVO" && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-cinza">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-jade" />até {amarelo - 1} dias sem vender</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-ouro" />{amarelo}–{vermelho - 1} dias</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rubi" />{vermelho}+ dias: revisar preço</span>
        </p>
      )}

      {lista.length === 0 ? (
        <p className="mt-10 text-center text-sm text-cinza">Nenhum produto aqui.</p>
      ) : (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {lista.map((p) => (
            <li key={p.id}>
              <Link href={`/painel/produtos/${p.id}`} className="flex gap-3 rounded-2xl border filete bg-carvao/60 p-2.5 transition hover:border-ouro-escuro">
                <FotoProduto arquivo={p.fotos[0]?.arquivo} alt={p.titulo} miniatura className="h-[72px] w-[72px] shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] tracking-wider text-ouro">{codigoInterno(p.codigo)} · {CONDICOES[p.condicao].rotulo}</p>
                  <p className="line-clamp-1 text-sm font-semibold">{p.titulo}</p>
                  <p className="mt-0.5 text-sm">
                    <b className="text-ouro-claro">{brl(p.precoCents)}</b>
                    {p.custoCents ? <span className="ml-2 text-[11px] text-cinza">margem {brl(p.precoCents - p.custoCents)}</span> : null}
                  </p>
                  <p className="text-[11px] text-cinza">
                    {p.estoqueDisponivel} disp.{p.estoqueReservado > 0 && <b className="text-ouro"> · {p.estoqueReservado} reservado</b>}
                    {p.vendidos > 0 && ` · ${p.vendidos} vendido(s)`} · {p.visualizacoes} visitas
                  </p>
                </div>
                {status === "ATIVO" && (
                  <div className="flex shrink-0 flex-col items-center justify-center px-1">
                    <span className={`h-2.5 w-2.5 rounded-full ${cor(p.dias)}`} />
                    <span className="mt-1 font-mono text-xs">{p.dias}d</span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
