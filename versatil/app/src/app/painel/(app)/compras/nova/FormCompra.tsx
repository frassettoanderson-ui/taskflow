"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FormaPagamento } from "@prisma/client";
import { registrarCompraAcao } from "../../../loja-acoes";
import { brl, mascaraMoeda, parseReais } from "@/lib/format";

type Prod = { id: string; codigo: number; titulo: string; custoCents: number | null; estoqueDisponivel: number };
type Linha = { produtoId: string; titulo: string; qtd: string; custo: string };

const hoje = () => {
  const d = new Date(Date.now() - 3 * 3600_000);
  return d.toISOString().slice(0, 10);
};

export function FormCompra({ produtos, fornecedores }: { produtos: Prod[]; fornecedores: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [fornecedorId, setFornecedorId] = useState("");
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [nf, setNf] = useState("");
  const [obs, setObs] = useState("");
  const [pago, setPago] = useState(true);
  const [forma, setForma] = useState<FormaPagamento>("PIX");
  const [vencimento, setVencimento] = useState(hoje());
  const [erro, setErro] = useState("");
  const [enviando, iniciar] = useTransition();

  const sugestoes = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return [];
    return produtos.filter((p) => p.titulo.toLowerCase().includes(t) || String(p.codigo) === t.replace(/\D/g, "")).slice(0, 8);
  }, [busca, produtos]);

  const total = linhas.reduce((s, l) => s + (Number(l.qtd) || 0) * (parseReais(l.custo) ?? 0), 0);

  function add(p: Prod) {
    if (!linhas.some((l) => l.produtoId === p.id)) setLinhas([...linhas, { produtoId: p.id, titulo: p.titulo, qtd: "1", custo: p.custoCents ? mascaraMoeda(String(p.custoCents)) : "" }]);
    setBusca("");
  }

  function salvar() {
    setErro("");
    iniciar(async () => {
      const r = await registrarCompraAcao({
        fornecedorId: fornecedorId || undefined,
        itens: linhas.map((l) => ({ produtoId: l.produtoId, quantidade: Number(l.qtd) || 0, custoUnitCents: parseReais(l.custo) ?? 0 })),
        notaFiscal: nf,
        observacao: obs,
        pago,
        vencimento: pago ? undefined : vencimento,
        forma,
      });
      if (!r.ok) return setErro(r.erro);
      router.push(`/painel/compras?ok=${r.numero}`);
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 rounded-2xl border filete bg-white p-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-cinza">
          Fornecedor
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className="campo mt-1">
            <option value="">Sem fornecedor / avulso</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-cinza">
          Nota fiscal (opcional)
          <input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="Número da NF" className="campo mt-1" />
        </label>
        {!fornecedores.length && (
          <p className="text-xs text-cinza sm:col-span-2">
            Cadastre fornecedores em <Link href="/painel/compras" className="text-ouro-escuro underline">Compras</Link> para acompanhar de quem você compra.
          </p>
        )}
      </div>

      <div className="rounded-2xl border filete bg-white p-4">
        <p className="mb-2 font-bold">Produtos do lote</p>
        <div className="relative">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto pelo nome ou código…" className="campo" />
          {sugestoes.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border filete bg-white shadow-lg">
              {sugestoes.map((p) => (
                <li key={p.id}>
                  <button onClick={() => add(p)} className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-grafite">
                    <span className="line-clamp-1">{p.titulo}</span>
                    <span className="shrink-0 text-xs text-cinza">estoque {p.estoqueDisponivel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-1 text-[11px] text-cinza">Produto novo? Cadastre primeiro em Produtos → Cadastrar (com estoque 0) e depois lance a entrada aqui.</p>

        {linhas.length > 0 && (
          <div className="mt-3 space-y-2">
            {linhas.map((l, i) => (
              <div key={l.produtoId} className="grid grid-cols-[1fr_70px_110px_28px] items-center gap-2 rounded-xl bg-grafite px-3 py-2 text-sm">
                <span className="line-clamp-2 font-semibold">{l.titulo}</span>
                <input value={l.qtd} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, qtd: e.target.value.replace(/\D/g, "") } : x)))} inputMode="numeric" aria-label="Quantidade" className="rounded-lg border filete bg-white px-2 py-1.5 text-center" />
                <input value={l.custo} onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, custo: mascaraMoeda(e.target.value) } : x)))} inputMode="numeric" placeholder="custo un." aria-label="Custo unitário" className="rounded-lg border filete bg-white px-2 py-1.5 text-right" />
                <button onClick={() => setLinhas(linhas.filter((_, j) => j !== i))} className="text-rubi" aria-label="Remover">✕</button>
              </div>
            ))}
            <p className="text-right text-lg font-extrabold">Total {brl(total)}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border filete bg-white p-4">
        <p className="mb-2 font-bold">Pagamento ao fornecedor</p>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} onClick={() => setPago(v)} className={`rounded-xl py-2.5 text-sm font-bold ${pago === v ? "bg-noite text-ouro-claro" : "bg-grafite text-cinza"}`}>{v ? "Já paguei" : "Vou pagar depois"}</button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-cinza">
            Forma
            <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)} className="campo mt-1">
              <option value="PIX">Pix</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
              <option value="OUTRO">Boleto / outro</option>
            </select>
          </label>
          {!pago && (
            <label className="text-xs font-semibold text-cinza">
              Vencimento
              <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="campo mt-1" />
            </label>
          )}
        </div>
        <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className="campo mt-3" />
      </div>

      {erro && <p className="rounded-lg bg-rubi/10 px-3 py-2 text-center text-sm text-rubi">{erro}</p>}
      <button onClick={salvar} disabled={enviando || !linhas.length} className="botao-ouro w-full py-4 text-base disabled:opacity-40">
        {enviando ? "Registrando…" : `Registrar entrada de ${linhas.reduce((s, l) => s + (Number(l.qtd) || 0), 0)} unidade(s)`}
      </button>
    </div>
  );
}
