import { urlFoto } from "@/lib/uploads-url";
import { IconeWhats } from "./Icones";
import { MARCA } from "@/lib/marca";

/** Mini banner (padrão dos banners baixos do ML): texto à esquerda, ilustração do grupo à direita. Leva ao grupo.
 *  Sem link configurado no painel, aparece sem clique (para a loja já ver o layout). */
export function BannerGrupoWhats({ href, fotos }: { href: string | null; fotos: string[] }) {
  const Tag = href ? "a" : "div";
  return (
    <Tag
      {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group mt-6 flex h-[120px] overflow-hidden rounded-[6px] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] md:h-[130px]"
    >
      <div className="flex flex-1 items-center bg-noite px-5 md:px-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ouro md:text-[11px]">Grupo de ofertas {MARCA.nome}</p>
          <p className="mt-1 text-[15px] font-semibold leading-tight text-white md:text-[20px]">
            Receba as ofertas na frente de todo mundo!
          </p>
          <p className="mt-1 hidden text-[13px] text-white/70 sm:block">Entre no nosso grupo do WhatsApp e seja avisado primeiro.</p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#25d366] group-hover:underline md:text-[13px]">
            Entrar no grupo <span aria-hidden>›</span>
          </span>
        </div>
      </div>
      <div className="relative hidden w-[46%] items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#25d366,#128c7e)] sm:flex">
        {/* balões de conversa com produtos da loja */}
        <span className="absolute -left-10 top-0 h-full w-20 skew-x-[-12deg] bg-noite" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg md:h-16 md:w-16">
            <IconeWhats className="h-8 w-8 text-[#25d366] md:h-9 md:w-9" />
          </span>
          <div className="flex flex-col gap-1.5">
            {fotos.slice(0, 2).map((f, i) => (
              <span key={f} className={`flex items-center gap-2 rounded-[10px] rounded-tl-[2px] bg-white px-2 py-1 shadow ${i ? "ml-6" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlFoto(f, true)} alt="" className="h-8 w-8 rounded object-contain md:h-9 md:w-9" />
                <span className="text-[11px] font-semibold text-marfim md:text-[12px]">{i ? "Baixou o preço! 🔥" : "Chegou novidade!"}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex w-14 items-center justify-center bg-[#25d366] sm:hidden">
        <IconeWhats className="h-8 w-8 text-white" />
      </div>
    </Tag>
  );
}
