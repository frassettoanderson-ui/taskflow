"use client";
import { useActionState } from "react";
import { buscarRetirada } from "../../acoes";
import { soDigitos } from "@/lib/format";

export default function Retirada() {
  const [estado, acao, buscando] = useActionState(buscarRetirada, undefined);
  return (
    <div className="mx-auto max-w-sm pt-6 text-center">
      <h1 className="text-2xl font-extrabold">Retirada no balcão</h1>
      <p className="mt-2 text-sm text-cinza">Digite o código de 6 dígitos que o cliente mostra (ou o nº do pedido).</p>
      <form action={acao} className="mt-6">
        <input
          name="codigo"
          inputMode="numeric"
          autoFocus
          maxLength={8}
          onChange={(e) => (e.target.value = soDigitos(e.target.value))}
          placeholder="000000"
          className="campo text-center font-mono text-4xl tracking-[0.35em]"
        />
        {estado?.erro && <p className="mt-3 text-sm text-rubi">{estado.erro}</p>}
        <button disabled={buscando} className="botao-ouro mt-4 w-full rounded-xl py-4 text-base">{buscando ? "Buscando…" : "Conferir"}</button>
      </form>
      <p className="mt-6 text-xs text-cinza">A leitura do QR pela câmera entra junto com o PDV (fase 4).</p>
    </div>
  );
}
