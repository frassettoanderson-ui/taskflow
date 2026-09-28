"use client";
import { useTransition } from "react";
import { cancelarPedidoPainel, mudarStatusPedido } from "../../acoes";

export function AcoesRapidas({ pedidoId, status, grande = false, retirada = false }: { pedidoId: string; status: string; grande?: boolean; retirada?: boolean }) {
  const [pendente, iniciar] = useTransition();
  const mudar = (para: "SEPARANDO" | "PRONTO" | "RETIRADO") => iniciar(async () => { await mudarStatusPedido(pedidoId, para); });
  const cls = `botao-ouro flex-1 rounded-xl ${grande ? "py-4 text-base" : "py-2.5 text-sm"}`;
  const sec = `flex-1 rounded-xl border border-ouro-escuro text-ouro-claro font-semibold ${grande ? "py-4" : "py-2.5 text-sm"}`;

  let botoes: React.ReactNode = null;
  if (retirada && ["PAGO", "SEPARANDO", "PRONTO"].includes(status))
    botoes = (
      <button disabled={pendente} onClick={() => mudar("RETIRADO")} className={cls}>
        Entregar ao cliente (confirmar retirada)
      </button>
    );
  else if (status === "PAGO")
    botoes = (
      <>
        <button disabled={pendente} onClick={() => mudar("SEPARANDO")} className={sec}>Separando</button>
        <button disabled={pendente} onClick={() => mudar("PRONTO")} className={cls}>Pronto p/ retirada</button>
      </>
    );
  else if (status === "SEPARANDO") botoes = <button disabled={pendente} onClick={() => mudar("PRONTO")} className={cls}>Marcar como pronto</button>;
  else if (status === "PRONTO")
    botoes = (
      <button disabled={pendente} onClick={() => confirm("Confirmar que o cliente retirou o pedido?") && mudar("RETIRADO")} className={cls}>
        Confirmar retirada
      </button>
    );
  else if (status === "AGUARDANDO_PAGAMENTO")
    botoes = (
      <button
        disabled={pendente}
        onClick={() => confirm("Cancelar o pedido e liberar os itens para venda?") && iniciar(async () => { await cancelarPedidoPainel(pedidoId); })}
        className="flex-1 rounded-xl border filete py-2.5 text-sm text-cinza"
      >
        Cancelar e liberar itens
      </button>
    );
  if (!botoes) return null;
  return <div className={`mt-3 flex gap-2 ${pendente ? "opacity-60" : ""}`}>{botoes}</div>;
}
