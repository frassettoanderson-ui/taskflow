"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCarrinho } from "@/components/carrinho";
import { brl, cpfValido, mascaraCpf, mascaraTelefone, soDigitos } from "@/lib/format";

type Props = { endereco: string; horario: string; reservaPix: number; demo: boolean };

export function FormCheckout({ endereco, horario, reservaPix, demo }: Props) {
  const { itens, pronto, totalCents, limpar, remover } = useCarrinho();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [metodo, setMetodo] = useState<"PIX" | "CARTAO">("PIX");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!pronto) return null;
  if (!itens.length) {
    return (
      <div className="px-4 py-24 text-center">
        <p className="text-cinza">Carrinho vazio.</p>
        <Link href="/" className="mt-4 inline-block text-ouro-escuro underline">Voltar à loja</Link>
      </div>
    );
  }

  async function finalizar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (nome.trim().split(/\s+/).length < 2) return setErro("Informe nome e sobrenome.");
    if (soDigitos(telefone).length < 10) return setErro("Informe seu WhatsApp com DDD.");
    if (!cpfValido(cpf)) return setErro("CPF inválido.");
    setEnviando(true);
    try {
      const r = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, cpf, email, metodo, itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })) }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.produtoId) remover(j.produtoId);
        setErro(j.erro || "Não foi possível finalizar.");
        setEnviando(false);
        return;
      }
      limpar();
      router.push(`/pedido/${j.token}`);
    } catch {
      setErro("Falha de conexão. Tente de novo.");
      setEnviando(false);
    }
  }

  const opcao = (m: "PIX" | "CARTAO", titulo: string, sub: string) => (
    <button
      type="button"
      onClick={() => setMetodo(m)}
      className={`flex-1 rounded-xl border p-4 text-center transition ${metodo === m ? "border-ouro bg-ouro/10" : "filete"}`}
    >
      <p className={`font-bold ${metodo === m ? "text-ouro-escuro" : ""}`}>{titulo}</p>
      <p className="mt-0.5 text-[11px] text-cinza">{sub}</p>
    </button>
  );

  return (
    <form onSubmit={finalizar} className="mx-auto max-w-xl px-4 pb-10 pt-8">
      <h1 className="text-center text-2xl font-extrabold">Finalizar compra</h1>
      {demo && (
        <p className="mx-auto mt-3 max-w-sm rounded-lg border border-ouro-escuro/50 bg-ouro/5 px-3 py-2 text-center text-xs text-ouro-escuro">
          Modo demonstração: nenhum pagamento real será cobrado.
        </p>
      )}

      <section className="mt-6 rounded-2xl border filete bg-white p-4">
        {itens.map((i) => (
          <div key={i.produtoId} className="flex justify-between gap-3 py-1.5 text-sm">
            <span className="line-clamp-1 text-marfim/90">
              {i.quantidade > 1 && <b className="font-mono text-ouro-escuro">{i.quantidade}× </b>}
              {i.titulo}
            </span>
            <span className="shrink-0 font-semibold">{brl(i.precoCents * i.quantidade)}</span>
          </div>
        ))}
        <div className="mt-2 flex items-baseline justify-between border-t filete pt-3">
          <span className="text-sm text-cinza">Total</span>
          <span className="texto-ouro text-2xl font-extrabold">{brl(totalCents)}</span>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ouro-escuro">Seus dados</p>
        <input className="campo" placeholder="Nome completo" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className="campo" placeholder="WhatsApp com DDD" inputMode="tel" autoComplete="tel" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} />
        <input className="campo" placeholder="CPF" inputMode="numeric" value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} />
        <input className="campo" placeholder="E-mail (opcional)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </section>

      <section className="mt-6">
        <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ouro-escuro">Pagamento</p>
        <div className="flex gap-3">
          {opcao("PIX", "Pix", "Aprovação na hora")}
          {opcao("CARTAO", "Cartão de crédito", "Página segura do Asaas")}
        </div>
        <p className="mt-2 text-center text-xs text-cinza">
          {metodo === "PIX"
            ? `Os itens ficam reservados para você por ${reservaPix} minutos enquanto paga.`
            : "Você será levado à página de pagamento segura. Os itens ficam reservados enquanto isso."}
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-ouro-escuro/50 p-4 text-center text-sm">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ouro-escuro">Retirada na loja</p>
        <p className="mt-1.5 text-marfim">{endereco}</p>
        <p className="text-xs text-cinza">{horario} · sem prazo para retirar</p>
      </section>

      {erro && <p className="mt-4 rounded-lg bg-rubi/10 px-3 py-2 text-center text-sm text-rubi">{erro}</p>}

      <button disabled={enviando} className="botao-principal mt-6 w-full rounded-xl py-4 text-base">
        {enviando ? "Reservando seus itens…" : metodo === "PIX" ? `Gerar Pix de ${brl(totalCents)}` : `Pagar ${brl(totalCents)} no cartão`}
      </button>
    </form>
  );
}
