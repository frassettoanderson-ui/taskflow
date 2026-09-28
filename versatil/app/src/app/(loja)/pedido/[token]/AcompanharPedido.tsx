"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ResumoPedido } from "@/lib/resumo";
import { brl, soDigitos } from "@/lib/format";
import { IconeCheck } from "@/components/Icones";

type Props = { token: string; inicial: ResumoPedido; endereco: string; horario: string; whatsapp: string };

function useRelogio(fim: string | null) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!fim) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [fim]);
  if (!fim) return null;
  return Math.max(0, Math.floor((new Date(fim).getTime() - agora) / 1000));
}

export function AcompanharPedido({ token, inicial, endereco, horario, whatsapp }: Props) {
  const [p, setP] = useState(inicial);
  const [copiado, setCopiado] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const restante = useRelogio(p.expiraEm);

  // acompanha o status até o pagamento cair (webhook) ou a reserva vencer
  useEffect(() => {
    if (p.status !== "AGUARDANDO_PAGAMENTO") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/pedidos/${token}`, { cache: "no-store" }).catch(() => null);
      if (r?.ok) setP(await r.json());
    }, 4000);
    return () => clearInterval(t);
  }, [p.status, token]);

  const copiar = async () => {
    if (!p.pixPayload) return;
    await navigator.clipboard.writeText(p.pixPayload).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };
  const simular = async () => {
    setSimulando(true);
    await fetch("/api/demo/pagar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const r = await fetch(`/api/pedidos/${token}`, { cache: "no-store" });
    setP(await r.json());
    setSimulando(false);
  };
  const cancelar = async () => {
    if (!confirm("Cancelar o pedido e liberar os itens?")) return;
    await fetch(`/api/pedidos/${token}/cancelar`, { method: "POST" });
    const r = await fetch(`/api/pedidos/${token}`, { cache: "no-store" });
    setP(await r.json());
  };

  const mmss = restante !== null ? `${String(Math.floor(restante / 60)).padStart(2, "0")}:${String(restante % 60).padStart(2, "0")}` : "";
  const zap = soDigitos(whatsapp);
  const pago = ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO"].includes(p.status);

  return (
    <div className="mx-auto max-w-md px-4 pb-12 pt-8 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ouro">Pedido #{p.numero}</p>

      {p.status === "AGUARDANDO_PAGAMENTO" && (
        <section className="entrada">
          <h1 className="mt-2 text-2xl font-extrabold">
            {p.metodo === "PIX" ? "Pague com Pix" : "Pague com cartão"}, {p.primeiroNome}
          </h1>
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-ouro-escuro/60 bg-ouro/5 px-4 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ouro" />
            <span className="text-sm">
              Itens reservados por <b className="font-mono text-ouro-claro">{mmss}</b>
            </span>
          </div>

          {p.metodo === "PIX" && p.pixQr && (
            <div className="mt-6 rounded-2xl border filete bg-carvao/70 p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.pixQr} alt="QR Code Pix" className="mx-auto w-56 rounded-xl bg-white p-2" />
              <p className="texto-ouro mt-4 text-3xl font-extrabold">{brl(p.totalCents)}</p>
              <button onClick={copiar} className="botao-ouro mt-4 w-full rounded-xl py-4">
                {copiado ? "Código copiado ✓" : "Copiar código Pix"}
              </button>
              <p className="mt-3 text-xs text-cinza">Abra o app do seu banco, escolha Pix copia e cola e cole o código. A confirmação aparece aqui sozinha.</p>
            </div>
          )}

          {p.metodo === "CARTAO" && (
            <div className="mt-6 rounded-2xl border filete bg-carvao/70 p-5">
              <p className="texto-ouro text-3xl font-extrabold">{brl(p.totalCents)}</p>
              {p.invoiceUrl ? (
                <a href={p.invoiceUrl} className="botao-ouro mt-4 block rounded-xl py-4">
                  Ir para o pagamento seguro
                </a>
              ) : (
                <p className="mt-3 text-sm text-cinza">No modo demonstração, use o botão abaixo para simular a aprovação.</p>
              )}
              <p className="mt-3 text-xs text-cinza">Depois de pagar, volte para esta página — ela atualiza sozinha.</p>
            </div>
          )}

          {p.demo && (
            <button onClick={simular} disabled={simulando} className="mt-4 w-full rounded-xl border border-dashed border-ouro-escuro py-3 text-sm text-ouro-claro">
              {simulando ? "Simulando…" : "Simular pagamento aprovado (demonstração)"}
            </button>
          )}
          <button onClick={cancelar} className="mt-5 text-xs text-cinza underline underline-offset-2">
            Desistir e liberar os itens
          </button>
        </section>
      )}

      {pago && (
        <section className="entrada">
          <IconeCheck className="entrada mx-auto mt-4 h-14 w-14 text-jade" />
          <h1 className="mt-2 text-3xl font-extrabold">
            {p.status === "RETIRADO" ? "Retirado. Obrigado!" : <>Compra confirmada, <span className="texto-ouro">{p.primeiroNome}</span>!</>}
          </h1>
          <p className="mt-2 text-sm text-cinza">
            {p.status === "PRONTO" ? "Seu pedido já está separado esperando por você." : p.status === "RETIRADO" ? "Esperamos você na próxima oportunidade." : "Pagamento aprovado. Seus produtos já estão reservados no seu nome."}
          </p>
          {p.status !== "RETIRADO" && p.codigoRetirada && (
            <div className="mt-6 rounded-2xl border border-ouro-escuro/70 bg-carvao/80 p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ouro">Código de retirada</p>
              <p className="mt-2 font-mono text-5xl font-semibold tracking-[0.2em] text-marfim">{p.codigoRetirada}</p>
              {p.retiradaQr && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.retiradaQr} alt="QR de retirada" className="mx-auto mt-4 w-40 rounded-lg" />
              )}
              <p className="mt-3 text-xs text-cinza">Tire um print desta tela e mostre no balcão.</p>
            </div>
          )}
          {p.status !== "RETIRADO" && (
            <div className="mt-4 rounded-2xl border border-dashed filete p-4 text-sm">
              <p className="text-marfim">{endereco}</p>
              <p className="text-xs text-cinza">{horario} · pode retirar quando quiser</p>
            </div>
          )}
          <Etapas status={p.status} />
        </section>
      )}

      {(p.status === "EXPIRADO" || p.status === "CANCELADO") && (
        <section className="entrada py-8">
          <h1 className="mt-2 text-2xl font-extrabold">{p.status === "EXPIRADO" ? "A reserva expirou" : "Pedido cancelado"}</h1>
          <p className="mt-2 text-sm text-cinza">Os itens voltaram a ficar disponíveis na loja. Se ainda estiverem disponíveis, é só comprar de novo.</p>
          <Link href="/" className="botao-ouro mt-6 inline-block rounded-xl px-6 py-3">Voltar à loja</Link>
        </section>
      )}

      {p.status === "ESTORNADO" && (
        <section className="entrada py-8">
          <h1 className="mt-2 text-2xl font-extrabold">Pagamento estornado</h1>
          <p className="mt-2 text-sm text-cinza">
            {p.alerta?.startsWith("Venda dupla")
              ? "Infelizmente outra pessoa concluiu a compra deste item segundos antes. Seu pagamento foi devolvido automaticamente."
              : `Estornamos ${brl(p.estornoCents)} para você.`}
          </p>
          <Link href="/" className="botao-ouro mt-6 inline-block rounded-xl px-6 py-3">Ver outros produtos</Link>
        </section>
      )}

      <ul className="mt-8 space-y-2 text-left">
        {p.itens.map((i) => (
          <li key={i.slug} className="flex justify-between gap-3 border-b filete pb-2 text-sm">
            <span className="text-marfim/85">
              {i.quantidade > 1 && <b className="font-mono text-ouro">{i.quantidade}× </b>}
              {i.titulo}
            </span>
            <span className="shrink-0">{brl(i.precoUnitCents * i.quantidade)}</span>
          </li>
        ))}
      </ul>

      {zap && (
        <a href={`https://wa.me/55${zap}?text=${encodeURIComponent(`Olá! Sobre o pedido #${p.numero}`)}`} className="mt-6 inline-block text-sm text-ouro-claro underline underline-offset-4">
          Dúvidas? Fale com a loja no WhatsApp
        </a>
      )}
    </div>
  );
}

function Etapas({ status }: { status: string }) {
  const passos = [
    ["PAGO", "Pago"],
    ["SEPARANDO", "Separando"],
    ["PRONTO", "Pronto"],
    ["RETIRADO", "Retirado"],
  ];
  const idx = passos.findIndex(([s]) => s === status);
  return (
    <div className="mt-6 flex items-center justify-center gap-1">
      {passos.map(([s, rot], i) => (
        <div key={s} className="flex items-center gap-1">
          <div className="flex flex-col items-center">
            <span className={`h-2.5 w-2.5 rounded-full ${i <= idx ? "bg-ouro" : "bg-fio"}`} />
            <span className={`mt-1 text-[10px] uppercase tracking-wider ${i <= idx ? "text-ouro-claro" : "text-cinza"}`}>{rot}</span>
          </div>
          {i < passos.length - 1 && <span className={`mb-4 h-px w-8 ${i < idx ? "bg-ouro" : "bg-fio"}`} />}
        </div>
      ))}
    </div>
  );
}
