"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aoConectarAcao, desconectarWhatsAcao, estadoWhatsAcao, gerarQrAcao } from "../../acoes";
import type { EstadoWhats } from "@/lib/evolution";

type Perfil = { numero?: string; nome?: string; foto?: string } | null;

const foneBR = (n?: string) => {
  const d = (n || "").replace(/\D/g, "").replace(/^55/, "");
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : n || "";
};

/** Status do número de disparo + QR Code para conectar/trocar. */
export function ConexaoWhats({ estadoInicial, perfilInicial }: { estadoInicial: EstadoWhats; perfilInicial: Perfil }) {
  const router = useRouter();
  const [estado, setEstado] = useState(estadoInicial);
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | undefined>();
  const [erro, setErro] = useState("");
  const [pend, iniciar] = useTransition();
  const ultimoQr = useRef(0);

  const gerar = useCallback(async () => {
    setErro("");
    const r = await gerarQrAcao();
    if (r.erro) return setErro(r.erro);
    if (r.conectado) return setEstado("open");
    if (r.qr) {
      setQr(r.qr);
      setCodigo(r.codigo);
      ultimoQr.current = Date.now();
    }
  }, []);

  // enquanto o QR está na tela: confere a cada 3s se pareou e renova o QR a cada 40s (ele expira)
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(async () => {
      const r = await estadoWhatsAcao();
      if (r.estado === "open") {
        setQr(null);
        setEstado("open");
        setPerfil(r.perfil);
        await aoConectarAcao();
        router.refresh();
      } else if (Date.now() - ultimoQr.current > 40_000) gerar();
    }, 3000);
    return () => clearInterval(t);
  }, [qr, gerar, router]);

  if (estado === "demo")
    return (
      <div className="text-center">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-ouro-escuro"><span className="h-2 w-2 rounded-full bg-ouro" />Modo demonstração</p>
        <p className="mt-1 text-xs text-cinza">A Evolution ainda não foi configurada no servidor: os envios são simulados e os grupos são de teste.</p>
      </div>
    );

  if (estado === "open")
    return (
      <div className="flex flex-col items-center text-center">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-jade"><span className="h-2 w-2 rounded-full bg-jade" />WhatsApp conectado</p>
        <p className="mt-1 text-base font-bold">{perfil?.nome || "Número de disparo"}</p>
        {perfil?.numero && <p className="text-sm text-cinza">{foneBR(perfil.numero)}</p>}
        <button
          disabled={pend}
          onClick={() => confirm("Desconectar este número? Os disparos param até conectar de novo.") && iniciar(async () => {
            const r = await desconectarWhatsAcao();
            if (r?.erro) setErro(r.erro);
            else { setEstado("close"); setPerfil(null); }
          })}
          className="mt-2 text-xs text-rubi underline underline-offset-4"
        >
          {pend ? "Desconectando…" : "Desconectar / trocar número"}
        </button>
        {erro && <p className="mt-2 text-xs text-rubi">{erro}</p>}
      </div>
    );

  return (
    <div className="flex flex-col items-center text-center">
      <p className="inline-flex items-center gap-2 text-sm font-bold text-rubi">
        <span className="h-2 w-2 rounded-full bg-rubi" />
        {estado === "erro" ? "Sem resposta da Evolution" : estado === "connecting" && !qr ? "Conectando…" : "WhatsApp desconectado"}
      </p>
      {qr ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code para conectar o WhatsApp" className="mt-3 h-56 w-56 rounded-xl border filete bg-white p-2" />
          <ol className="mt-3 space-y-0.5 text-xs text-cinza">
            <li>1. No celular do número de disparo, abra o WhatsApp</li>
            <li>2. Toque em <b>⋮ → Aparelhos conectados → Conectar aparelho</b></li>
            <li>3. Aponte a câmera para este QR Code</li>
          </ol>
          {codigo && <p className="mt-2 font-mono text-sm tracking-widest">Código: {codigo}</p>}
          <p className="mt-2 animate-pulse text-[11px] text-ouro-escuro">Aguardando a leitura…</p>
          <button onClick={() => setQr(null)} className="mt-1 text-xs text-cinza underline underline-offset-4">Cancelar</button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-cinza">
            {estado === "erro" ? "Confira EVOLUTION_URL e a chave no servidor." : "Conecte o número que está nos grupos da loja. Ele só publica os produtos."}
          </p>
          {estado !== "erro" && (
            <button disabled={pend} onClick={() => iniciar(gerar)} className="botao-ouro mt-3 rounded-xl px-6 py-2.5 text-sm">
              {pend ? "Gerando QR Code…" : "Conectar número (QR Code)"}
            </button>
          )}
        </>
      )}
      {erro && <p className="mt-2 text-xs text-rubi">{erro}</p>}
    </div>
  );
}
