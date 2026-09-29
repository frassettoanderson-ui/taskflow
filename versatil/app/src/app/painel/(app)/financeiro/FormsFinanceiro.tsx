"use client";
import { useActionState, useState, useTransition } from "react";
import { baixarLancamentoAcao, salvarLancamentoAcao } from "../../loja-acoes";
import { mascaraMoeda } from "@/lib/format";

const hoje = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const SUGESTOES = {
  DESPESA: ["Aluguel", "Energia", "Água", "Internet e telefone", "Salários", "Pró-labore", "Impostos", "Taxas de cartão e Pix", "Frete e transporte", "Marketing", "Manutenção", "Material de embalagem", "Outras despesas"],
  RECEITA: ["Vendas loja física", "Vendas online", "Outras receitas"],
};

export function NovoLancamento({ categorias }: { categorias: string[] }) {
  const [estado, acao, pend] = useActionState(salvarLancamentoAcao, undefined);
  const [tipo, setTipo] = useState<"DESPESA" | "RECEITA">("DESPESA");
  const [valor, setValor] = useState("");
  const opcoes = [...new Set([...SUGESTOES[tipo], ...categorias])];
  return (
    <form action={(fd) => { acao(fd); setValor(""); }} className="space-y-3 rounded-2xl border filete bg-white p-4">
      <p className="text-center font-bold">Novo lançamento</p>
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-2 gap-2">
        {(["DESPESA", "RECEITA"] as const).map((t) => (
          <button type="button" key={t} onClick={() => setTipo(t)} className={`rounded-xl py-2 text-sm font-bold ${tipo === t ? (t === "DESPESA" ? "bg-rubi text-white" : "bg-jade text-white") : "bg-grafite text-cinza"}`}>
            {t === "DESPESA" ? "Conta a pagar" : "Conta a receber"}
          </button>
        ))}
      </div>
      <input name="descricao" required placeholder="Descrição (ex.: aluguel da loja)" className="campo" />
      <input name="categoria" list="categorias-fin" placeholder="Categoria" className="campo" />
      <datalist id="categorias-fin">{opcoes.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="grid grid-cols-2 gap-2">
        <input name="valor" value={valor} onChange={(e) => setValor(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="Valor" className="campo text-right font-bold" />
        <input name="vencimento" type="date" defaultValue={hoje()} className="campo" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="forma" className="campo" defaultValue="">
          <option value="">Forma…</option>
          <option value="PIX">Pix</option>
          <option value="DINHEIRO">Dinheiro</option>
          <option value="DEBITO">Débito</option>
          <option value="CREDITO">Crédito</option>
          <option value="OUTRO">Boleto / outro</option>
        </select>
        <select name="conta" className="campo" defaultValue="Banco">
          <option>Banco</option>
          <option>Caixa da loja</option>
          <option>Asaas</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pago" className="h-4 w-4 accent-[#8a6516]" /> Já foi {tipo === "DESPESA" ? "paga" : "recebida"}
      </label>
      <label className="flex items-center gap-2 text-xs text-cinza">
        Repetir por
        <input name="repetir" type="number" min={1} max={24} defaultValue={1} className="w-14 rounded-lg border filete px-2 py-1 text-center text-marfim" />
        mês(es) (contas fixas)
      </label>
      {estado?.erro && <p className="text-center text-sm text-rubi">{estado.erro}</p>}
      {estado?.ok && <p className="text-center text-sm text-jade">{estado.ok}</p>}
      <button disabled={pend} className="botao-ouro w-full py-3">{pend ? "Salvando…" : "Salvar"}</button>
    </form>
  );
}

export function AcoesLancamento({ id, status }: { id: string; status: string }) {
  const [pend, iniciar] = useTransition();
  const rodar = (a: "pagar" | "reabrir" | "cancelar") => iniciar(async () => { await baixarLancamentoAcao(id, a); });
  if (status === "PAGO")
    return (
      <button disabled={pend} onClick={() => confirm("Voltar para em aberto?") && rodar("reabrir")} className="rounded-full bg-jade/10 px-2.5 py-1 text-[11px] font-bold text-jade">
        pago ✓
      </button>
    );
  if (status === "CANCELADO") return <span className="text-[11px] text-cinza">cancelado</span>;
  return (
    <span className="inline-flex gap-1">
      <button disabled={pend} onClick={() => rodar("pagar")} className="rounded-full bg-noite px-2.5 py-1 text-[11px] font-bold text-ouro-claro">{pend ? "…" : "Baixar"}</button>
      <button disabled={pend} onClick={() => confirm("Cancelar este lançamento?") && rodar("cancelar")} className="rounded-full px-1.5 text-[11px] text-cinza" aria-label="Cancelar">✕</button>
    </span>
  );
}
