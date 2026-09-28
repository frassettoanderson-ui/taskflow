import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { brl, mascaraCpf, mascaraTelefone, STATUS_PEDIDO } from "@/lib/format";
import { AcoesRapidas } from "../AcoesRapidas";
import { FormEstorno } from "./FormEstorno";

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function DetalhePedido({ params, searchParams }: PageProps<"/painel/pedidos/[id]">) {
  const { id } = await params;
  const retirada = (await searchParams).retirada === "1";
  const p = await db.pedido.findUnique({
    where: { id },
    include: { cliente: true, itens: { include: { produto: { select: { id: true, codigo: true } } } }, eventos: { orderBy: { criadoEm: "desc" } } },
  });
  if (!p) notFound();
  const pagoAberto = ["PAGO", "SEPARANDO", "PRONTO"].includes(p.status);
  const podeEstornar = ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO"].includes(p.status) && p.estornoCents < p.totalCents;
  const zap = p.cliente.telefone;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/painel/pedidos" className="text-xs text-cinza">← Pedidos</Link>

      {retirada && (
        <div className={`mt-3 rounded-2xl border p-4 text-center ${pagoAberto ? "border-jade/60 bg-jade/10" : "border-rubi/60 bg-rubi/10"}`}>
          <p className={`font-bold ${pagoAberto ? "text-jade" : "text-rubi"}`}>
            {pagoAberto ? "Código válido — pedido pago, pode entregar." : p.status === "RETIRADO" ? "Atenção: este pedido JÁ FOI RETIRADO." : `Atenção: pedido ${STATUS_PEDIDO[p.status].toLowerCase()}. Não entregue.`}
          </p>
        </div>
      )}

      <div className="mt-3 rounded-2xl border filete bg-carvao/60 p-5 text-center">
        <p className="font-mono text-xs text-ouro">Pedido #{p.numero} · {p.metodo === "PIX" ? "Pix" : "Cartão"}{p.origemGrupo && ` · grupo ${p.origemGrupo}`}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cinza">{STATUS_PEDIDO[p.status]}</p>
        <p className="texto-ouro mt-2 text-4xl font-extrabold">{brl(p.totalCents)}</p>
        {p.estornoCents > 0 && <p className="text-sm text-rubi">Estornado: {brl(p.estornoCents)}</p>}
        {p.codigoRetirada && pagoAberto && <p className="mt-2 font-mono text-lg tracking-[0.3em]">{p.codigoRetirada}</p>}
        {p.alerta && <p className="mt-3 rounded-lg bg-rubi/10 px-3 py-2 text-sm text-rubi">{p.alerta}</p>}
        <AcoesRapidas pedidoId={p.id} status={p.status} grande retirada={retirada} />
      </div>

      <section className="mt-4 rounded-2xl border filete p-4 text-center">
        <p className="font-semibold">{p.cliente.nome}</p>
        <p className="text-sm text-cinza">{mascaraTelefone(zap)}{p.cliente.cpf && ` · CPF ${mascaraCpf(p.cliente.cpf)}`}</p>
        <a href={`https://wa.me/55${zap}?text=${encodeURIComponent(`Olá ${p.cliente.nome.split(" ")[0]}! Aqui é da Versátil, sobre o seu pedido #${p.numero}.`)}`} target="_blank" className="mt-2 inline-block text-sm text-ouro-claro underline underline-offset-4">
          Chamar no WhatsApp
        </a>
      </section>

      <section className="mt-4 rounded-2xl border filete p-4">
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-cinza">Itens para separar</p>
        {p.itens.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 border-b filete py-2 text-sm last:border-0">
            <span>
              <b className="font-mono text-ouro">{i.quantidade}×</b> {i.titulo}{" "}
              <Link href={`/painel/produtos/${i.produto.id}`} className="font-mono text-[10px] text-cinza">#{String(i.produto.codigo).padStart(4, "0")}</Link>
            </span>
            <span className="shrink-0">{brl(i.precoUnitCents * i.quantidade)}</span>
          </div>
        ))}
      </section>

      {podeEstornar && <FormEstorno pedidoId={p.id} restanteCents={p.totalCents - p.estornoCents} retirado={p.status === "RETIRADO"} />}

      <section className="mt-4">
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-cinza">Histórico</p>
        <ol className="space-y-2">
          {p.eventos.map((e) => (
            <li key={e.id} className="rounded-xl border filete px-3 py-2 text-sm">
              <p>{e.descricao}</p>
              <p className="text-[11px] text-cinza">{fmt(e.criadoEm)} · {e.autor}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
