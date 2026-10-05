"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { enviarFotosAcao } from "../acoes";
import { comprimir } from "@/lib/comprimir";

const VAGAS = [
  { rotulo: "Produto de frente", dica: "Vira a foto principal da loja" },
  { rotulo: "Código de barras", dica: "Bem de perto, reto e com luz" },
  { rotulo: "Etiqueta ou outro ângulo", dica: "Modelo, voltagem, detalhes" },
];
type Foto = { file: File; url: string };

/** Fotos guiadas: 3 obrigatórias (produto, código de barras, etiqueta) + até 7 extras. Enviou → já pode fotografar o próximo. */
export function Captura({ naFila }: { naFila: number }) {
  const [fotos, setFotos] = useState<(Foto | null)[]>([null, null, null]);
  const [extras, setExtras] = useState<Foto[]>([]);
  const [fila, setFila] = useState(naFila);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [preparando, setPreparando] = useState(false);
  const [pend, iniciar] = useTransition();
  const completas = fotos.every(Boolean);

  async function escolher(i: number, lista: FileList | null) {
    if (!lista?.[0]) return;
    setPreparando(true);
    const file = await comprimir(lista[0]);
    setFotos((f) => f.map((x, j) => (j === i ? { file, url: URL.createObjectURL(file) } : x)));
    setPreparando(false);
  }
  async function escolherExtras(lista: FileList | null) {
    if (!lista?.length) return;
    setPreparando(true);
    const arr = await Promise.all([...lista].slice(0, 7).map(comprimir));
    setExtras((e) => [...e, ...arr.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 7));
    setPreparando(false);
  }
  function enviar() {
    setErro("");
    const fd = new FormData();
    [...fotos, ...extras].forEach((f) => f && fd.append("foto", f.file));
    iniciar(async () => {
      const r = await enviarFotosAcao(fd);
      if (r.erro) return setErro(r.erro);
      setFotos([null, null, null]);
      setExtras([]);
      setFila((n) => n + 1);
      setMsg("Enviado! A IA está identificando. Já pode fotografar o próximo.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <div className="px-4 pt-4 text-center">
      {msg && <p className="mb-3 rounded-xl bg-ouro/15 px-3 py-2 text-sm font-semibold text-ouro-escuro">{msg}</p>}
      <div className="grid grid-cols-3 gap-2">
        {VAGAS.map((v, i) => (
          <label key={v.rotulo} className={`relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 bg-white ${fotos[i] ? "border-jade" : "border-dashed border-ouro"}`}>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { escolher(i, e.target.files); e.target.value = ""; }} />
            {fotos[i] ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotos[i]!.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute right-1.5 top-1.5 rounded-full bg-jade px-1.5 text-[11px] font-bold text-white">✓</span>
                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[10px] font-semibold text-white">trocar</span>
              </>
            ) : (
              <>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ouro/20 text-lg font-extrabold text-ouro-escuro">{i + 1}</span>
                <span className="mt-2 px-1 text-[12px] font-bold leading-tight">{v.rotulo}</span>
                <span className="mt-1 px-1.5 text-[10px] leading-tight text-cinza">{v.dica}</span>
              </>
            )}
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {extras.map((f, i) => (
          <button key={f.url} type="button" onClick={() => setExtras((e) => e.filter((_, j) => j !== i))} className="relative h-14 w-14 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" className="h-full w-full object-cover" />
            <span className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1 text-[10px] text-white">✕</span>
          </button>
        ))}
        {extras.length < 7 && (
          <label className="flex h-14 cursor-pointer items-center rounded-xl border filete bg-white px-3 text-xs font-semibold text-cinza">
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { escolherExtras(e.target.files); e.target.value = ""; }} />
            + fotos extras (opcional)
          </label>
        )}
      </div>

      {erro && <p className="mt-3 text-sm text-rubi">{erro}</p>}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t filete bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
        <button type="button" onClick={enviar} disabled={!completas || pend || preparando} className="botao-ouro w-full rounded-xl py-4 text-base disabled:opacity-40">
          {pend ? "Enviando fotos…" : preparando ? "Preparando foto…" : completas ? "Enviar e fotografar o próximo" : `Faltam ${fotos.filter((f) => !f).length} foto(s)`}
        </button>
        <Link href="/recebimento" className="mt-2 block text-center text-sm font-semibold text-ouro-escuro">
          Conferir fila ({fila})
        </Link>
      </div>
    </div>
  );
}
