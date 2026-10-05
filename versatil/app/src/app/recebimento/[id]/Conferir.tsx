"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { descartarAcao, publicarAcao, rebuscarAcao } from "../acoes";
import type { DadosRascunho } from "@/lib/cadastroRapido";
import type { ResultadoPreco } from "@/lib/precoMercado";
import { brl, CONDICOES, descontoPct, mascaraMoeda, parseReais } from "@/lib/format";
import { urlFoto } from "@/lib/uploads-url";

const centsParaCampo = (c?: number | null) => (c ? mascaraMoeda(String(c)) : "");

/** Conferência do produto identificado: tudo editável, publica e volta para a câmera. */
export function Conferir(props: {
  id: string;
  fotos: string[];
  ean: string | null;
  dados: DadosRascunho;
  preco: ResultadoPreco | null;
  erro: string | null;
  categorias: { id: string; nome: string }[];
  enviarPadrao: boolean;
  gruposAtivos: number;
}) {
  const { id, fotos, dados, preco, categorias } = props;
  const router = useRouter();
  const ident = dados.ident;
  const [estado, acao, publicando] = useActionState(publicarAcao, undefined);
  const [buscando, iniciarBusca] = useTransition();
  const [erroBusca, setErroBusca] = useState("");
  const [consulta, setConsulta] = useState(ident?.consulta || ident?.titulo || "");
  const [condicao, setCondicao] = useState("CAIXA_ABERTA");
  const [precoV, setPrecoV] = useState(centsParaCampo(preco?.sugeridoCents));
  const [mercado, setMercado] = useState(centsParaCampo(preco?.medianaCents));
  const [custo, setCusto] = useState("");
  const [qtd, setQtd] = useState(1);
  const [ficha, setFicha] = useState(dados.catalogo?.ficha?.length ? dados.catalogo.ficha : [{ nome: "", valor: "" }]);
  const catSugerida = categorias.find((c) => c.nome.toLowerCase() === (ident?.categoria ?? "").toLowerCase())?.id ?? "";
  const desc = descontoPct(parseReais(precoV) || 0, parseReais(mercado) || 0);

  function rebuscar() {
    setErroBusca("");
    iniciarBusca(async () => {
      const r = await rebuscarAcao(id, consulta);
      if (r.erro) setErroBusca(r.erro);
      else router.refresh();
    });
  }
  const rotulo = "mb-1 block text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-cinza";

  return (
    <form action={acao} className="space-y-4 px-4 pt-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="condicao" value={condicao} />
      <input type="hidden" name="quantidade" value={qtd} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {fotos.map((f, i) => (
          <div key={f} className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlFoto(f, true)} alt="" className={`h-24 w-24 rounded-xl object-cover ${i === 1 ? "opacity-60" : ""}`} />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-noite px-1.5 text-[9px] font-bold text-ouro-claro">CAPA</span>}
            {i === 1 && <span className="absolute inset-x-1 bottom-1 rounded bg-black/60 text-center text-[9px] text-white">cód. barras (não vai p/ loja)</span>}
          </div>
        ))}
      </div>

      {dados.avisoIa && <p className="rounded-xl bg-ouro/15 px-3 py-2 text-center text-xs text-ouro-escuro">{dados.avisoIa}</p>}
      {props.erro && <p className="rounded-xl bg-rubi/10 px-3 py-2 text-center text-xs text-rubi">{props.erro}</p>}

      {/* busca / preço */}
      <section className="rounded-2xl border border-ouro/60 bg-white p-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ouro-escuro">Preço no Mercado Livre</p>
        {preco ? (
          <>
            {preco.simulado && <p className="mt-2 rounded-lg bg-ouro/15 px-2 py-1 text-[11px] font-semibold text-ouro-escuro">SIMULAÇÃO — Mercado Livre ainda não conectado</p>}
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[["Menor", preco.minCents], ["Do meio", preco.medianaCents], ["Maior", preco.maxCents]].map(([r, v]) => (
                <div key={r as string} className="rounded-lg bg-grafite p-2">
                  <p className="text-[10px] uppercase tracking-wider text-cinza">{r}</p>
                  <p className="text-sm font-bold">{brl(v as number)}</p>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-cinza">
              {preco.anuncios.length} anúncio(s) novos · {preco.porCodigoBarras ? "achado pelo código de barras" : `busca: “${preco.consulta}”`}
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-ouro-escuro underline underline-offset-2">Conferir anúncios</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-left">
                {preco.anuncios.slice(0, 15).map((a, i) => (
                  <li key={i} className="flex justify-between gap-2 text-xs">
                    <a href={a.link} target="_blank" className="line-clamp-1">{a.titulo}</a>
                    <b className="shrink-0">{brl(a.precoCents)}</b>
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : (
          <p className="mt-2 text-sm text-cinza">Sem referência de preço. Digite o nome/modelo e busque, ou preencha o preço manualmente.</p>
        )}
        <div className="mt-3 flex gap-2">
          <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Nome ou modelo para buscar" className="campo !py-2 text-sm" />
          <button type="button" onClick={rebuscar} disabled={buscando || !consulta.trim()} className="shrink-0 rounded-xl border border-ouro-escuro px-3 text-xs font-semibold text-ouro-escuro disabled:opacity-40">
            {buscando ? "…" : "Buscar"}
          </button>
        </div>
        {erroBusca && <p className="mt-1 text-xs text-rubi">{erroBusca}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-ouro-escuro">Preço de venda</span>
            <input name="preco" value={precoV} onChange={(e) => setPrecoV(mascaraMoeda(e.target.value))} inputMode="numeric" required placeholder="0,00" className="campo text-center text-xl font-extrabold" />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-cinza">“De” (mercado)</span>
            <input name="precoMercado" value={mercado} onChange={(e) => setMercado(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="0,00" className="campo text-center text-xl" />
          </label>
        </div>
        {desc > 0 && <p className="mt-1 text-xs text-jade">{desc}% abaixo do mercado</p>}
      </section>

      {/* identificação */}
      <section className="space-y-3 rounded-2xl border filete bg-white p-4">
        <label className="block">
          <span className={rotulo}>Nome do produto</span>
          <textarea name="titulo" defaultValue={ident?.titulo} rows={2} required className="campo text-center font-semibold" />
        </label>
        <div>
          <span className={rotulo}>Condição</span>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CONDICOES).filter(([k]) => k !== "USADO_REVISADO").map(([k, v]) => (
              <button type="button" key={k} onClick={() => setCondicao(k)} className={`rounded-xl border-2 py-2.5 text-sm font-bold ${condicao === k ? "border-ouro bg-ouro/15 text-ouro-escuro" : "filete text-cinza"}`}>
                {v.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={rotulo}>Quantidade</span>
          <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={() => setQtd((q) => Math.max(1, q - 1))} className="h-12 w-12 rounded-full border filete text-2xl font-bold">−</button>
            <span className="w-12 text-center text-3xl font-extrabold">{qtd}</span>
            <button type="button" onClick={() => setQtd((q) => Math.min(999, q + 1))} className="h-12 w-12 rounded-full border filete text-2xl font-bold">+</button>
          </div>
        </div>
        <label className="block">
          <span className={rotulo}>Categoria</span>
          <select name="categoriaId" defaultValue={catSugerida} className="campo text-center">
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={rotulo}>Marca</span>
            <input name="marca" defaultValue={ident?.marca} className="campo text-center" />
          </label>
          <label>
            <span className={rotulo}>Modelo / SKU</span>
            <input name="sku" defaultValue={ident?.modelo} className="campo text-center" />
          </label>
        </div>
        <label className="block">
          <span className={rotulo}>Código de barras</span>
          <input name="ean" defaultValue={props.ean ?? ident?.ean ?? ""} inputMode="numeric" onChange={(e) => (e.target.value = e.target.value.replace(/\D/g, "").slice(0, 14))} className="campo text-center font-mono" />
        </label>
        <label className="block">
          <span className={rotulo}>Custo (opcional, só você vê)</span>
          <input name="custo" value={custo} onChange={(e) => setCusto(mascaraMoeda(e.target.value))} inputMode="numeric" placeholder="0,00" className="campo text-center" />
        </label>
      </section>

      {/* ficha técnica + descrição */}
      <section className="space-y-3 rounded-2xl border filete bg-white p-4">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-cinza">Ficha técnica (vira “Características” na loja)</p>
        {ficha.map((f, i) => (
          <div key={i} className="flex gap-2">
            <input name="fichaNome" value={f.nome} onChange={(e) => setFicha(ficha.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} placeholder="Item" className="campo !py-2 w-2/5 text-sm" />
            <input name="fichaValor" value={f.valor} onChange={(e) => setFicha(ficha.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} placeholder="Valor" className="campo !py-2 flex-1 text-sm" />
            <button type="button" onClick={() => setFicha(ficha.filter((_, j) => j !== i))} aria-label="Remover" className="px-1 text-cinza">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setFicha([...ficha, { nome: "", valor: "" }])} className="w-full text-xs font-semibold text-ouro-escuro">+ adicionar item</button>
        <label className="block">
          <span className={rotulo}>Descrição</span>
          <textarea name="descricao" defaultValue={dados.descricao} rows={9} className="campo text-sm" />
        </label>
      </section>

      <label className="flex items-center justify-center gap-3 rounded-2xl border filete bg-white p-4 text-sm font-semibold">
        <input type="checkbox" name="enviarGrupos" defaultChecked={props.enviarPadrao} disabled={!props.gruposAtivos} className="h-6 w-6 accent-[#d4af55]" />
        Enviar nos grupos {props.gruposAtivos ? `(${props.gruposAtivos})` : "— nenhum grupo ativo"}
      </label>

      {estado?.erro && <p className="text-center text-sm text-rubi">{estado.erro}</p>}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t filete bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
        <button name="modo" value="publicar" disabled={publicando} className="botao-ouro w-full rounded-xl py-4 text-base">
          {publicando ? "Publicando…" : "Publicar e cadastrar o próximo"}
        </button>
        <div className="mt-2 flex justify-between text-sm">
          <button name="modo" value="rascunho" disabled={publicando} className="font-semibold text-ouro-escuro">Salvar sem publicar</button>
          <button type="button" onClick={() => confirm("Descartar este produto e as fotos?") && descartarAcao(id)} className="text-rubi">Descartar</button>
        </div>
      </div>
    </form>
  );
}
