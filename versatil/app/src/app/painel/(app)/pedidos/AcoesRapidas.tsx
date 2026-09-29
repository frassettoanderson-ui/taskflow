"use client";
import { useTransition } from "react";
import { cancelarPedidoPainel, mudarStatusPedido } from "../../acoes";

export function AcoesRapidas({ pedidoId, status, grande = false, compacto = false }: { pedidoId: string; status: string; grande?: boolean; compacto?: boolean }) {
  const [pendente, iniciar] = useTransition();
  const mudar = (para: "SEPARANDO" | "PRONTO" | "RETIRADO") => iniciar(async () => { await mudarStatusPedido(pedidoId, para); });
  const tam = grande ? "py-4 text-base" : compacto ? "px-2 py-1.5 text-xs" : "py-2.5 text-sm";
  const cls = `botao-ouro flex-1 rounded-xl ${tam}`;
  const sec = `flex-1 rounded-xl border border-ouro-escuro text-ouro-escuro font-semibold ${tam}`;

  let botoes: React.ReactNode = null;
  if (status === "PAGO")
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
        className={`flex-1 rounded-xl border filete text-cinza ${tam}`}
      >
        Cancelar e liberar itens
      </button>
    );
  if (!botoes) return null;
  return <div className={`${compacto ? "" : "mt-3"} flex gap-2 ${pendente ? "opacity-60" : ""}`}>{botoes}</div>;
}
