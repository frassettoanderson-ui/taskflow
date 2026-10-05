import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { brl, mascaraCpf, mascaraTelefone, STATUS_PEDIDO } from "@/lib/format";
import { AcoesRapidas } from "../AcoesRapidas";
import { FormEstorno } from "./FormEstorno";
import { FORMAS } from "@/lib/lojafisica";
import { MARCA } from "@/lib/marca";

const METODO = { PIX: "Pix", CARTAO: "Cartão", DINHEIRO: "Dinheiro", DEBITO: "Débito", MISTO: "Pagamento misto" } as const;

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function DetalhePedido({ params }: PageProps<"/painel/pedidos/[id]">) {
  const { id } = await params;
  const eu = await exigirUsuario();
  const p = await db.pedido.findUnique({
    where: { id },
    include: { cliente: true, itens: { include: { produto: { select: { id: true, codigo: true } } } }, eventos: { orderBy: { criadoEm: "desc" } }, pagamentos: true },
  });
  if (!p) notFound();
  const podeEstornar = ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO"].includes(p.status) && p.estornoCents < p.totalCents;
  const zap = p.cliente.telefone;
  const pdv = p.canal === "PDV";
  const semContato = zap === "00000000000";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/painel/pedidos" className="text-xs text-cinza">← Pedidos</Link>


      <div className="mt-3 rounded-2xl border filete bg-white p-5 text-center">
        <p className="font-mono text-xs text-ouro-escuro">{pdv ? "Venda no balcão" : "Pedido"} #{p.numero} · {METODO[p.metodo]}{p.origemGrupo && ` · grupo ${p.origemGrupo}`}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cinza">{STATUS_PEDIDO[p.status]}</p>
        <p className="texto-ouro mt-2 text-4xl font-extrabold">{brl(p.totalCents)}</p>
        {p.estornoCents > 0 && <p className="text-sm text-rubi">Estornado: {brl(p.estornoCents)}</p>}
        {p.alerta && <p className="mt-3 rounded-lg bg-rubi/10 px-3 py-2 text-sm text-rubi">{p.alerta}</p>}
        <AcoesRapidas pedidoId={p.id} status={p.status} grande />
      </div>

      <section className="mt-4 rounded-2xl border filete p-4 text-center">
        <p className="font-semibold">{p.cliente.nome}</p>
        {!semContato && <p className="text-sm text-cinza">{mascaraTelefone(zap)}{p.cliente.cpf && ` · CPF ${mascaraCpf(p.cliente.cpf)}`}</p>}
        {!semContato && <a href={`https://wa.me/55${zap}?text=${encodeURIComponent(`Olá ${p.cliente.nome.split(" ")[0]}! Aqui é da ${MARCA.nome}, sobre o seu pedido #${p.numero}.`)}`} target="_blank" className="mt-2 inline-block text-sm text-ouro-escuro underline underline-offset-4">
          Chamar no WhatsApp
        </a>}
      </section>

      <section className="mt-4 rounded-2xl border filete p-4">
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-cinza">{pdv ? "Itens vendidos" : "Itens para separar"}</p>
        {p.itens.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 border-b filete py-2 text-sm last:border-0">
            <span>
              <b className="font-mono text-ouro-escuro">{i.quantidade}×</b> {i.titulo}{" "}
              <Link href={`/painel/produtos/${i.produto.id}`} className="font-mono text-[10px] text-cinza">#{String(i.produto.codigo).padStart(4, "0")}</Link>
            </span>
            <span className="shrink-0">{brl(i.precoUnitCents * i.quantidade)}</span>
          </div>
        ))}
        {pdv && p.pagamentos.length > 0 && (
          <div className="mt-3 border-t filete pt-3 text-sm">
            {p.descontoCents > 0 && <div className="flex justify-between text-cinza"><span>Desconto</span><span>− {brl(p.descontoCents)}</span></div>}
            {p.pagamentos.map((g) => (
              <div key={g.id} className="flex justify-between">
                <span>{FORMAS[g.forma]}{g.trocoCents > 0 && <span className="text-xs text-cinza"> · recebido {brl(g.recebidoCents ?? 0)}, troco {brl(g.trocoCents)}</span>}</span>
                <span className="font-semibold">{brl(g.valorCents)}</span>
              </div>
            ))}
            <Link href={`/painel/cupom/${p.id}`} target="_blank" className="mt-2 inline-block text-xs text-ouro-escuro underline underline-offset-2">Reimprimir cupom</Link>
          </div>
        )}
      </section>

      {podeEstornar && eu.papel === "ADMIN" && <FormEstorno pedidoId={p.id} restanteCents={p.totalCents - p.estornoCents} retirado={p.status === "RETIRADO"} pdv={pdv} formas={[...new Set(p.pagamentos.map((g) => g.forma))]} />}

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
