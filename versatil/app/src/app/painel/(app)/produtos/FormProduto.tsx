"use client";
import { useActionState, useRef, useState, startTransition } from "react";
import Link from "next/link";
import { salvarProduto } from "../../acoes";
import { CONDICOES, descontoPct, mascaraMoeda, parseReais } from "@/lib/format";
import { urlFoto } from "@/lib/uploads-url";

type Produto = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  condicao: string;
  categoriaId: string | null;
  marca: string | null;
  sku: string | null;
  aplicacao: string;
  precoCents: number;
  precoMercadoCents: number | null;
  custoCents: number | null;
  estoqueDisponivel: number;
  estoqueReservado: number;
  status: string;
  fotos: { id: string; arquivo: string }[];
};

const reais = (c?: number | null) => (c ? mascaraMoeda(String(c)) : "");

/** Reduz a foto no próprio celular antes de enviar (upload rápido no 4G). */
async function comprimir(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size < 400_000) return f;
  try {
    const bmp = await createImageBitmap(f);
    const esc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * esc);
    c.height = Math.round(bmp.height * esc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
    return new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return f;
  }
}

export function FormProduto({
  produto,
  categorias,
  gruposAtivos,
  autoDisparo,
}: {
  produto?: Produto;
  categorias: { id: string; nome: string }[];
  gruposAtivos: number;
  autoDisparo: boolean;
}) {
  const [estado, acao, salvando] = useActionState(salvarProduto, undefined);
  const [novas, setNovas] = useState<{ file: File; url: string }[]>([]);
  const [remover, setRemover] = useState<string[]>([]);
  const [capa, setCapa] = useState("");
  const [condicao, setCondicao] = useState(produto?.condicao ?? "CAIXA_ABERTA");
  const [preco, setPreco] = useState(reais(produto?.precoCents));
  const [mercado, setMercado] = useState(reais(produto?.precoMercadoCents));
  const [custo, setCusto] = useState(reais(produto?.custoCents));
  const [estoque, setEstoque] = useState(produto?.estoqueDisponivel ?? 1);
  const [comprimindo, setComprimindo] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

  const p = parseReais(preco) || 0;
  const m = parseReais(mercado) || 0;
  const desc = descontoPct(p, m);

  async function escolherFotos(lista: FileList | null) {
    if (!lista?.length) return;
    setComprimindo(true);
    const arr = await Promise.all([...lista].slice(0, 10).map(comprimir));
    setNovas((a) => [...a, ...arr.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 10));
    setComprimindo(false);
    if (inputFoto.current) inputFoto.current.value = "";
  }

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("fotosInput");
    novas.forEach((n) => fd.append("fotos", n.file));
    remover.forEach((id) => fd.append("removerFoto", id));
    if (capa) fd.set("capa", capa);
    startTransition(() => acao(fd));
  }

  const fotosAtuais = produto?.fotos ?? [];
  const chip = (ativo: boolean) => `rounded-full border px-3 py-2 text-xs font-semibold transition ${ativo ? "border-ouro bg-ouro/10 text-ouro-escuro" : "filete text-cinza"}`;

  return (
    <form onSubmit={enviar} className="mx-auto max-w-2xl space-y-6">
      {produto && <input type="hidden" name="id" value={produto.id} />}
      {produto && <input type="hidden" name="estoqueAnterior" value={produto.estoqueDisponivel} />}

      {/* FOTOS primeiro: é o que mais demora no balcão */}
      <section>
        <input ref={inputFoto} name="fotosInput" type="file" accept="image/*" multiple className="hidden" onChange={(e) => escolherFotos(e.target.files)} />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotosAtuais.map((f, i) => {
            const fora = remover.includes(f.id);
            const ehCapa = capa ? capa === f.id : i === 0;
            return (
              <div key={f.id} className={`relative aspect-square overflow-hidden rounded-xl border ${ehCapa ? "border-ouro" : "filete"} ${fora ? "opacity-30" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlFoto(f.arquivo, true)} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setRemover((r) => (fora ? r.filter((x) => x !== f.id) : [...r, f.id]))} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs">
                  {fora ? "↺" : "✕"}
                </button>
                {!fora && (
                  <button type="button" onClick={() => setCapa(f.id)} className={`absolute bottom-1 left-1 rounded-full px-2 text-[10px] font-semibold ${ehCapa ? "bg-ouro text-noite" : "bg-white/90"}`}>
                    {ehCapa ? "capa" : "usar capa"}
                  </button>
                )}
              </div>
            );
          })}
          {novas.map((n, i) => (
            <div key={n.url} className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-ouro-escuro">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={n.url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setNovas((a) => a.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs">✕</button>
              <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-2 text-[10px]">nova</span>
            </div>
          ))}
          <button type="button" onClick={() => inputFoto.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ouro-escuro/70 text-ouro-escuro">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            <span className="text-[11px] font-semibold">{comprimindo ? "Preparando…" : "Foto"}</span>
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-cinza">Fotos reais do item (até 10). Mostre as avarias, se houver.</p>
      </section>

      <section className="space-y-3">
        <input name="titulo" defaultValue={produto?.titulo} required placeholder="Nome do produto" className="campo text-base font-semibold" />
        <div>
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-cinza">Condição</p>
          <input type="hidden" name="condicao" value={condicao} />
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(CONDICOES).map(([k, v]) => (
              <button type="button" key={k} onClick={() => setCondicao(k)} className={chip(condicao === k)}>{v.rotulo}</button>
            ))}
          </div>
        </div>
        <select name="categoriaId" defaultValue={produto?.categoriaId ?? ""} className="campo">
          <option value="">Categoria (opcional)</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input name="marca" defaultValue={produto?.marca ?? ""} placeholder="Marca" className="campo" />
          <input name="sku" defaultValue={produto?.sku ?? ""} placeholder="Código / SKU" className="campo" />
        </div>
        <textarea
          name="aplicacao"
          defaultValue={produto?.aplicacao}
          rows={3}
          placeholder={"Aplicação / compatibilidade (uma por linha)\nEx.: Renault Clio até 1999\nRenault 19"}
          className="campo"
        />
      </section>

      <section className="rounded-2xl border filete bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ouro-escuro">Preço de venda</span>
            <input name="preco" value={preco} onChange={(e) => setPreco(mascaraMoeda(e.target.value))} inputMode="numeric" required placeholder="0,00" className="campo text-center text-lg font-bold" />
          </label>
          <label className="block">
            <span className="mb-1 block text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-cinza">Preço de mercado</span>
            <input name="precoMercado" value={mercado} onChange={(e) => setMercado(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="0,00" className="campo text-center text-lg" />
          </label>
        </div>
        <p className="mt-2 text-center text-xs text-cinza">
          {desc > 0 ? <>Aparece na loja como <b className="text-ouro-escuro">{desc}% abaixo do mercado</b>.</> : "O preço de mercado aparece riscado na loja."}
          <br />A pesquisa automática da média de mercado chega na próxima fase.
        </p>
        <label className="mt-3 block">
          <span className="mb-1 block text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-cinza">Custo (opcional, só você vê)</span>
          <input name="custo" value={custo} onChange={(e) => setCusto(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="0,00" className="campo text-center" />
        </label>
      </section>

      <section className="flex flex-col items-center">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cinza">Quantidade disponível</p>
        <input type="hidden" name="estoque" value={estoque} />
        <div className="flex items-center rounded-full border filete">
          <button type="button" onClick={() => setEstoque(Math.max(0, estoque - 1))} className="h-12 w-12 text-xl text-ouro-escuro">−</button>
          <span className="w-12 text-center font-mono text-xl">{estoque}</span>
          <button type="button" onClick={() => setEstoque(estoque + 1)} className="h-12 w-12 text-xl text-ouro-escuro">+</button>
        </div>
        {produto && produto.estoqueReservado > 0 && <p className="mt-2 text-xs text-ouro-escuro">+ {produto.estoqueReservado} reservado(s) em pagamento agora</p>}
      </section>

      <textarea name="descricao" defaultValue={produto?.descricao} rows={4} placeholder="Descrição: o que acompanha, detalhes da avaria, voltagem…" className="campo" />

      <section>
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-cinza">Situação</p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            ["ATIVO", "Na vitrine"],
            ["RASCUNHO", "Rascunho"],
            ...(produto ? [["ARQUIVADO", "Arquivar"]] : []),
          ].map(([v, r]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="status" value={v} defaultChecked={(produto?.status === "ESGOTADO" ? "ATIVO" : produto?.status ?? "ATIVO") === v} className="peer sr-only" />
              <span className="block rounded-full border filete px-4 py-2 text-xs font-semibold text-cinza peer-checked:border-ouro peer-checked:bg-ouro/10 peer-checked:text-ouro-escuro">{r}</span>
            </label>
          ))}
        </div>
      </section>

      <label className={`flex items-center justify-center gap-3 rounded-2xl border p-4 text-sm ${gruposAtivos ? "border-ouro-escuro/60 bg-ouro/5" : "filete opacity-60"}`}>
        <input type="checkbox" name="disparar" defaultChecked={!produto && autoDisparo && gruposAtivos > 0} disabled={!gruposAtivos} className="h-5 w-5 accent-[#d4af55]" />
        <span className="text-center">
          {produto ? "Avisar nos grupos de WhatsApp ao salvar" : "Disparar nos grupos de WhatsApp ao publicar"}
          <span className="block text-xs text-cinza">
            {gruposAtivos ? `${gruposAtivos} grupo(s) ativo(s) · envio espaçado automaticamente${produto ? " · se baixar o preço, vai como promoção" : ""}` : "Nenhum grupo ativo — configure em Disparos"}
          </span>
        </span>
      </label>

      {estado?.erro && <p className="rounded-lg bg-rubi/10 px-3 py-2 text-center text-sm text-rubi">{estado.erro}</p>}

      <div className="safe-bottom sticky bottom-16 z-20 -mx-4 bg-gradient-to-t from-fundo via-fundo to-transparent px-4 pt-4 md:bottom-0">
        <button disabled={salvando || comprimindo} className="botao-ouro w-full rounded-xl py-4 text-base">
          {salvando ? "Salvando…" : produto ? "Salvar alterações" : "Publicar produto"}
        </button>
        {produto && (
          <Link href={`/p/${produto.slug}`} target="_blank" className="mt-2 block text-center text-xs text-cinza underline underline-offset-2">
            ver na loja
          </Link>
        )}
      </div>
    </form>
  );
}
