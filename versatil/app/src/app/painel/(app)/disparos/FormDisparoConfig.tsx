"use client";
import { useActionState } from "react";
import { salvarConfig } from "../../acoes";

const CAMPOS: [string, string][] = [
  ["disparo_intervalo_min", "Intervalo mínimo entre mensagens (seg)"],
  ["disparo_intervalo_max", "Intervalo máximo entre mensagens (seg)"],
  ["disparo_intervalo_grupo_min", "Mínimo entre mensagens no mesmo grupo (min)"],
  ["disparo_limite_hora", "Máximo de mensagens por hora"],
  ["disparo_hora_inicio", "Começa a enviar às (h)"],
  ["disparo_hora_fim", "Para de enviar às (h)"],
];

export function FormDisparoConfig({ cfg }: { cfg: Record<string, string> }) {
  const [estado, acao, salvando] = useActionState(salvarConfig, undefined);
  return (
    <form action={acao} className="mx-auto max-w-2xl rounded-2xl border filete bg-white p-5">
      <div className="grid grid-cols-2 gap-3">
        {CAMPOS.map(([k, r]) => (
          <label key={k} className="block">
            <span className="mb-1 block min-h-[2.4em] text-center text-[11px] font-semibold text-cinza">{r}</span>
            <input name={k} defaultValue={cfg[k]} inputMode="numeric" className="campo text-center" />
          </label>
        ))}
      </div>
      <label className="mt-4 flex items-center justify-center gap-2 text-sm">
        <input type="hidden" name="disparo_auto_publicar" value="0" />
        <input type="checkbox" name="disparo_auto_publicar" value="1" defaultChecked={cfg.disparo_auto_publicar === "1"} className="h-4 w-4 accent-[#d4af55]" />
        Marcar “disparar nos grupos” por padrão ao cadastrar produto
      </label>
      {estado?.erro && <p className="mt-3 text-center text-sm text-rubi">{estado.erro}</p>}
      {estado?.ok && <p className="mt-3 text-center text-sm text-jade">{estado.ok}</p>}
      <button disabled={salvando} className="botao-ouro mt-4 w-full rounded-xl py-3">{salvando ? "Salvando…" : "Salvar ritmo"}</button>
      <p className="mt-2 text-center text-[11px] text-cinza">Com 10 grupos e ~30 produtos/dia são ~300 mensagens. O padrão (45–120s, 6 min por grupo, 40/h) espalha isso ao longo do dia.</p>
    </form>
  );
}
