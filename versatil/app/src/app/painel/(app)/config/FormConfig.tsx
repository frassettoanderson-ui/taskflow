"use client";
import { useActionState, useState } from "react";
import { salvarConfig } from "../../acoes";
import { mascaraTelefone } from "@/lib/format";

export function FormConfig({ cfg }: { cfg: Record<string, string> }) {
  const [estado, acao, salvando] = useActionState(salvarConfig, undefined);
  const [zap, setZap] = useState(mascaraTelefone(cfg.loja_whatsapp));
  const campo = (nome: string, rotulo: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="mb-1 block text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-cinza">{rotulo}</span>
      <input name={nome} defaultValue={cfg[nome]} className="campo text-center" {...props} />
    </label>
  );
  return (
    <form action={acao} className="mt-6 space-y-4">
      {campo("loja_cidade", "Cidade (aparece embaixo da logo)")}
      {campo("loja_endereco", "Endereço de retirada")}
      {campo("loja_grupo_whatsapp", "Link do grupo de ofertas no WhatsApp", { placeholder: "https://chat.whatsapp.com/…", inputMode: "url" })}
      {campo("loja_horario", "Horário de atendimento")}
      <label className="block">
        <span className="mb-1 block text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-cinza">WhatsApp da loja</span>
        <input name="loja_whatsapp" value={zap} onChange={(e) => setZap(mascaraTelefone(e.target.value))} inputMode="tel" className="campo text-center" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {campo("reserva_pix_min", "Reserva Pix (min)", { inputMode: "numeric" })}
        {campo("reserva_cartao_min", "Reserva cartão (min)", { inputMode: "numeric" })}
        {campo("parado_amarelo_dias", "Alerta amarelo (dias)", { inputMode: "numeric" })}
        {campo("parado_vermelho_dias", "Alerta vermelho (dias)", { inputMode: "numeric" })}
      </div>
      {estado?.erro && <p className="text-center text-sm text-rubi">{estado.erro}</p>}
      {estado?.ok && <p className="text-center text-sm text-jade">{estado.ok}</p>}
      <button disabled={salvando} className="botao-ouro w-full rounded-xl py-3.5">{salvando ? "Salvando…" : "Salvar"}</button>
    </form>
  );
}
