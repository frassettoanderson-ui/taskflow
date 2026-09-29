"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import type { FormaPagamento } from "@prisma/client";
import { venderAcao } from "../../loja-acoes";
import { brl, mascaraCpf, mascaraMoeda, mascaraTelefone, parseReais } from "@/lib/format";
import { pixCopiaECola } from "@/lib/pix";
import { urlFoto } from "@/lib/uploads-url";

type Produto = { id: string; codigo: number; titulo: string; marca: string | null; sku: string | null; ean: string | null; precoCents: number; estoque: number; foto: string | null };
type Linha = { produtoId: string; titulo: string; precoCents: number; max: number; qtd: number; foto: string | null };
type Pag = { forma: FormaPagamento; valorCents: number };

const NOMES: Partial<Record<FormaPagamento, string>> = { DINHEIRO: "Dinheiro", PIX: "Pix", DEBITO: "Débito", CREDITO: "Crédito", OUTRO: "Outro" };
const ICONES: Partial<Record<FormaPagamento, string>> = {
  DINHEIRO: "M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 10v4M18 10v4",
  PIX: "m12 3 9 9-9 9-9-9 9-9Zm-3.5 5.5 7 7m0-7-7 7",
  DEBITO: "M3 6h18v12H3zM3 10h18M7 15h3",
  CREDITO: "M3 6h18v12H3zM3 10h18M7 15h3M14 15h3",
  OUTRO: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5m0 3h.01",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Pdv({ produtos, operador, caixaNumero, pix }: { produtos: Produto[]; operador: string; caixaNumero: number; pix: { chave: string; nome: string; cidade: string } }) {
  const router = useRouter();
  const busca = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [descTipo, setDescTipo] = useState<"valor" | "pct">("valor");
  const [descValor, setDescValor] = useState("");
  const [cliente, setCliente] = useState({ nome: "", telefone: "", cpf: "" });
  const [verCliente, setVerCliente] = useState(false);
  const [etapa, setEtapa] = useState<"venda" | "pagamento" | "concluida">("venda");
  const [pags, setPags] = useState<Pag[]>([]);
  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [valor, setValor] = useState("");
  const [qrPix, setQrPix] = useState<{ img: string; codigo: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [abaMobile, setAbaMobile] = useState<"produtos" | "carrinho">("produtos");
  const [resultado, setResultado] = useState<{ pedidoId: string; numero: number; troco: number; total: number } | null>(null);
  const [enviando, iniciar] = useTransition();

  const bruto = linhas.reduce((s, l) => s + l.precoCents * l.qtd, 0);
  const descNum = descTipo === "pct" ? Math.round((bruto * Math.min(100, Number(descValor.replace(",", ".")) || 0)) / 100) : parseReais(descValor) ?? 0;
  const desconto = Math.min(bruto, Math.max(0, descNum));
  const total = bruto - desconto;
  const pago = pags.reduce((s, p) => s + p.valorCents, 0);
  const falta = Math.max(0, total - pago);
  const troco = Math.max(0, pago - total);

  const lista = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return produtos.slice(0, 60);
    return produtos.filter((p) => norm(`${p.titulo} ${p.marca ?? ""} ${p.sku ?? ""} ${p.ean ?? ""} ${p.codigo}`).includes(t)).slice(0, 60);
  }, [q, produtos]);

  // atalhos: F2 busca, F10 pagar, Esc volta
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); busca.current?.focus(); }
      if (e.key === "F10" && linhas.length && etapa === "venda") { e.preventDefault(); irPagamento(); }
      if (e.key === "Escape" && etapa === "pagamento") { setEtapa("venda"); setQrPix(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  function adicionar(p: Produto, n = 1) {
    setAviso("");
    setLinhas((ls) => {
      const ex = ls.find((l) => l.produtoId === p.id);
      if (ex) {
        if (ex.qtd + n > p.estoque) { setAviso(`Só há ${p.estoque} unidade(s) de "${p.titulo}".`); return ls; }
        return ls.map((l) => (l.produtoId === p.id ? { ...l, qtd: l.qtd + n } : l));
      }
      return [...ls, { produtoId: p.id, titulo: p.titulo, precoCents: p.precoCents, max: p.estoque, qtd: 1, foto: p.foto }];
    });
  }

  /** Enter na busca: leitor de código de barras (etiqueta V000123, código interno, EAN ou SKU) adiciona direto. */
  function enter() {
    const t = q.trim();
    if (!t) return;
    const num = /^v?0*(\d+)$/i.exec(t.replace(/^#/, ""));
    const exato =
      produtos.find((p) => p.ean && p.ean === t) ||
      produtos.find((p) => p.sku && norm(p.sku) === norm(t)) ||
      (num ? produtos.find((p) => p.codigo === Number(num[1])) : undefined);
    const alvo = exato ?? (lista.length === 1 ? lista[0] : undefined);
    if (alvo) { adicionar(alvo); setQ(""); } else setAviso(`Nenhum produto com "${t}".`);
  }

  const alterar = (id: string, d: number) => setLinhas((ls) => ls.flatMap((l) => (l.produtoId !== id ? [l] : l.qtd + d <= 0 ? [] : [{ ...l, qtd: Math.min(l.max, l.qtd + d) }])));

  function irPagamento() {
    if (!linhas.length) return;
    setPags([]);
    setForma("DINHEIRO");
    setValor(mascaraMoeda(String(total)));
    setEtapa("pagamento");
  }

  async function adicionarPag() {
    const v = parseReais(valor) ?? 0;
    if (v <= 0) return;
    if (forma !== "DINHEIRO" && v > falta) { setAviso("Só o dinheiro pode passar do valor (para dar troco)."); return; }
    if (forma === "PIX" && !qrPix) {
      const codigo = pix.chave ? pixCopiaECola({ chave: pix.chave, nome: pix.nome, cidade: pix.cidade, valorCents: v, txid: `PDV${Date.now().toString(36)}` }) : "";
      setQrPix({ img: codigo ? await QRCode.toDataURL(codigo, { margin: 1, width: 280 }) : "", codigo });
      return;
    }
    setQrPix(null);
    setAviso("");
    const novos = [...pags, { forma, valorCents: v }];
    setPags(novos);
    const resta = Math.max(0, total - novos.reduce((s, p) => s + p.valorCents, 0));
    setValor(resta ? mascaraMoeda(String(resta)) : "");
  }

  function finalizar() {
    iniciar(async () => {
      const r = await venderAcao({
        itens: linhas.map((l) => ({ produtoId: l.produtoId, quantidade: l.qtd })),
        descontoCents: desconto,
        pagamentos: pags,
        cliente: cliente.telefone || cliente.cpf || cliente.nome ? cliente : undefined,
      });
      if (!r.ok) {
        setAviso(r.erro);
        if (r.produtoId) { setLinhas((ls) => ls.filter((l) => l.produtoId !== r.produtoId)); setEtapa("venda"); }
        return;
      }
      setResultado(r);
      setEtapa("concluida");
    });
  }

  function novaVenda() {
    setLinhas([]); setDescValor(""); setCliente({ nome: "", telefone: "", cpf: "" }); setVerCliente(false);
    setPags([]); setResultado(null); setEtapa("venda"); setAviso(""); setQ(""); setAbaMobile("produtos");
    router.refresh();
    setTimeout(() => busca.current?.focus(), 50);
  }

  // ---------- venda concluída ----------
  if (etapa === "concluida" && resultado)
    return (
      <div className="mx-auto max-w-md pt-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-jade/15 text-3xl text-jade">✓</span>
        <h1 className="mt-4 text-2xl font-extrabold">Venda #{resultado.numero} concluída</h1>
        <p className="mt-1 text-cinza">Total {brl(resultado.total)}</p>
        {resultado.troco > 0 && (
          <div className="mt-5 rounded-2xl border-2 border-jade bg-jade/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-jade">Troco</p>
            <p className="text-5xl font-extrabold text-jade">{brl(resultado.troco)}</p>
          </div>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <a href={`/painel/cupom/${resultado.pedidoId}`} target="_blank" className="rounded-xl border border-ouro-escuro py-3.5 font-semibold text-ouro-escuro">Imprimir cupom</a>
          <button onClick={novaVenda} autoFocus className="botao-ouro py-3.5">Nova venda</button>
        </div>
      </div>
    );

  const carrinho = (
    <div className="flex h-full flex-col rounded-2xl border filete bg-white">
      <div className="flex items-center justify-between border-b filete px-4 py-3">
        <p className="font-bold">Venda atual</p>
        <p className="text-xs text-cinza">Caixa #{caixaNumero} · {operador.split(" ")[0]}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2" style={{ maxHeight: "46vh" }}>
        {!linhas.length ? (
          <p className="px-3 py-10 text-center text-sm text-cinza">Passe o leitor no código ou toque num produto.</p>
        ) : (
          linhas.map((l) => (
            <div key={l.produtoId} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-grafite">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold">{l.titulo}</p>
                <p className="text-xs text-cinza">{brl(l.precoCents)} un.</p>
              </div>
              <div className="flex items-center rounded-full border filete">
                <button onClick={() => alterar(l.produtoId, -1)} className="h-8 w-8 text-lg" aria-label="Menos">−</button>
                <span className="w-7 text-center font-mono text-sm">{l.qtd}</span>
                <button onClick={() => alterar(l.produtoId, 1)} disabled={l.qtd >= l.max} className="h-8 w-8 text-lg disabled:opacity-30" aria-label="Mais">+</button>
              </div>
              <p className="w-20 text-right text-sm font-bold">{brl(l.precoCents * l.qtd)}</p>
            </div>
          ))
        )}
      </div>
      <div className="space-y-2 border-t filete px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-cinza">Subtotal</span>
          <span>{brl(bruto)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-cinza">Desconto</span>
          <div className="flex items-center gap-1">
            <div className="flex overflow-hidden rounded-lg border filete text-xs">
              {(["valor", "pct"] as const).map((t) => (
                <button key={t} onClick={() => { setDescTipo(t); setDescValor(""); }} className={`px-2 py-1 ${descTipo === t ? "bg-noite text-ouro-claro" : ""}`}>{t === "valor" ? "R$" : "%"}</button>
              ))}
            </div>
            <input value={descValor} onChange={(e) => setDescValor(descTipo === "valor" ? mascaraMoeda(e.target.value) : e.target.value.replace(/[^\d,]/g, "").slice(0, 5))} inputMode="decimal" placeholder="0" className="w-20 rounded-lg border filete px-2 py-1 text-right" />
          </div>
        </div>
        {desconto > 0 && <p className="text-right text-xs text-jade">− {brl(desconto)}</p>}
        <button onClick={() => setVerCliente(!verCliente)} className="text-xs text-ouro-escuro underline underline-offset-2">
          {verCliente ? "Ocultar cliente" : cliente.telefone || cliente.cpf ? "Cliente identificado ✓" : "+ Identificar cliente (opcional)"}
        </button>
        {verCliente && (
          <div className="grid gap-2">
            <input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} placeholder="Nome" className="campo !py-2" />
            <div className="grid grid-cols-2 gap-2">
              <input value={cliente.telefone} onChange={(e) => setCliente({ ...cliente, telefone: mascaraTelefone(e.target.value) })} placeholder="WhatsApp" inputMode="tel" className="campo !py-2" />
              <input value={cliente.cpf} onChange={(e) => setCliente({ ...cliente, cpf: mascaraCpf(e.target.value) })} placeholder="CPF" inputMode="numeric" className="campo !py-2" />
            </div>
          </div>
        )}
        <div className="flex items-end justify-between border-t filete pt-2">
          <span className="font-semibold">Total</span>
          <span className="text-3xl font-extrabold">{brl(total)}</span>
        </div>
        <button onClick={irPagamento} disabled={!linhas.length} className="botao-ouro w-full py-4 text-lg disabled:opacity-40">
          Receber pagamento <span className="text-xs font-normal opacity-70">(F10)</span>
        </button>
        {linhas.length > 0 && (
          <button onClick={() => { if (confirm("Cancelar esta venda?")) setLinhas([]); }} className="w-full text-xs text-rubi underline underline-offset-2">Cancelar venda</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      {aviso && <p className="mb-3 rounded-xl bg-rubi/10 px-4 py-2.5 text-center text-sm font-semibold text-rubi">{aviso}</p>}

      {/* abas no celular */}
      <div className="mb-3 grid grid-cols-2 gap-2 lg:hidden">
        {(["produtos", "carrinho"] as const).map((a) => (
          <button key={a} onClick={() => setAbaMobile(a)} className={`rounded-xl py-2.5 text-sm font-bold ${abaMobile === a ? "bg-noite text-ouro-claro" : "bg-white text-cinza"}`}>
            {a === "produtos" ? "Produtos" : `Venda (${linhas.reduce((s, l) => s + l.qtd, 0)}) · ${brl(total)}`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className={abaMobile === "carrinho" ? "hidden lg:block" : ""}>
          <div className="relative">
            <input
              ref={busca}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), enter())}
              placeholder="Buscar produto ou passar o leitor de código (F2)"
              className="campo !py-4 !pl-12 text-lg"
            />
            <svg viewBox="0 0 24 24" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cinza" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14" /></svg>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {lista.map((p) => (
              <button key={p.id} onClick={() => adicionar(p)} className="flex flex-col overflow-hidden rounded-xl border filete bg-white text-left transition hover:border-ouro-escuro active:scale-[0.98]">
                <div className="aspect-[4/3] w-full bg-white">
                  {p.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urlFoto(p.foto, true)} alt="" className="h-full w-full object-contain p-2" />
                  ) : (
                    <div className="h-full w-full bg-grafite" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-2.5">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{p.titulo}</p>
                  <p className="mt-auto pt-1 text-base font-extrabold">{brl(p.precoCents)}</p>
                  <p className="text-[11px] text-cinza">#{String(p.codigo).padStart(4, "0")} · {p.estoque} em estoque</p>
                </div>
              </button>
            ))}
            {!lista.length && <p className="col-span-full py-10 text-center text-sm text-cinza">Nenhum produto encontrado.</p>}
          </div>
        </div>
        <div className={`${abaMobile === "produtos" ? "hidden lg:block" : ""} lg:sticky lg:top-4 lg:self-start`}>{carrinho}</div>
      </div>

      {/* ---------- pagamento ---------- */}
      {etapa === "pagamento" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => { setEtapa("venda"); setQrPix(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[95dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-extrabold">Pagamento</h2>
              <button onClick={() => { setEtapa("venda"); setQrPix(null); }} className="text-sm text-cinza">Voltar (Esc)</button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-grafite p-3 text-center">
              <div><p className="text-[11px] uppercase text-cinza">Total</p><p className="text-lg font-extrabold">{brl(total)}</p></div>
              <div><p className="text-[11px] uppercase text-cinza">Recebido</p><p className="text-lg font-extrabold">{brl(pago)}</p></div>
              <div><p className="text-[11px] uppercase text-cinza">{troco > 0 ? "Troco" : "Falta"}</p><p className={`text-lg font-extrabold ${troco > 0 ? "text-jade" : falta ? "text-rubi" : ""}`}>{brl(troco || falta)}</p></div>
            </div>

            {pags.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {pags.map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border filete px-3 py-2">
                    <span>{NOMES[p.forma]}</span>
                    <span className="flex items-center gap-3 font-semibold">{brl(p.valorCents)}<button onClick={() => setPags(pags.filter((_, j) => j !== i))} className="text-rubi" aria-label="Remover">✕</button></span>
                  </li>
                ))}
              </ul>
            )}

            {falta > 0 && !qrPix && (
              <>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {(["DINHEIRO", "PIX", "DEBITO", "CREDITO"] as FormaPagamento[]).map((f) => (
                    <button key={f} onClick={() => setForma(f)} className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-xs font-bold ${forma === f ? "border-ouro-escuro bg-ouro/10" : "filete"}`}>
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={ICONES[f]} /></svg>
                      {NOMES[f]}
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-center text-xs font-semibold uppercase tracking-wider text-cinza">
                  {forma === "DINHEIRO" ? "Valor entregue pelo cliente" : `Valor no ${NOMES[forma]}`}
                  <input value={valor} onChange={(e) => setValor(mascaraMoeda(e.target.value))} onKeyDown={(e) => e.key === "Enter" && adicionarPag()} inputMode="numeric" autoFocus className="campo mt-1 text-center text-3xl font-extrabold" />
                </label>
                {forma === "DINHEIRO" && (
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {[falta, ...[1000, 2000, 5000, 10000, 20000].filter((n) => n > falta)].slice(0, 5).map((n) => (
                      <button key={n} onClick={() => setValor(mascaraMoeda(String(n)))} className="rounded-full border filete px-3 py-1 text-xs font-semibold">{n === falta ? "Valor exato" : brl(n)}</button>
                    ))}
                  </div>
                )}
                <button onClick={adicionarPag} className="mt-4 w-full rounded-xl border-2 border-noite py-3 font-bold">
                  {forma === "PIX" ? "Gerar QR Code do Pix" : forma === "DINHEIRO" ? "Lançar dinheiro" : `Lançar ${NOMES[forma]} (maquininha)`}
                </button>
              </>
            )}

            {qrPix && (
              <div className="mt-4 rounded-2xl border filete p-4 text-center">
                <p className="text-sm font-bold">Pix de {brl(parseReais(valor) ?? 0)}</p>
                {qrPix.img ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrPix.img} alt="QR Code Pix" className="mx-auto mt-2 w-56" />
                    <p className="mt-1 text-xs text-cinza">O cliente lê o QR no app do banco. Confira o recebimento antes de confirmar.</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-rubi">Chave Pix da loja não configurada (Configurações). Use o Pix da maquininha e confirme.</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setQrPix(null)} className="rounded-xl border filete py-3 text-sm">Cancelar</button>
                  <button onClick={adicionarPag} className="rounded-xl bg-jade py-3 text-sm font-bold text-white">Pix recebido ✓</button>
                </div>
              </div>
            )}

            {falta === 0 && (
              <button onClick={finalizar} disabled={enviando} className="botao-ouro mt-5 w-full py-4 text-lg">
                {enviando ? "Finalizando…" : troco > 0 ? `Finalizar · troco ${brl(troco)}` : "Finalizar venda"}
              </button>
            )}
            {aviso && <p className="mt-3 text-center text-sm text-rubi">{aviso}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
