import { Martelo } from "./Martelo";
import { urlFoto } from "@/lib/uploads-url";

export function FotoProduto({ arquivo, alt, miniatura = false, className = "" }: { arquivo?: string | null; alt: string; miniatura?: boolean; className?: string }) {
  if (!arquivo)
    return (
      <div className={`flex items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#1d1d22,#101013)] ${className}`}>
        <Martelo className="w-1/4 text-ouro-escuro/40" />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={urlFoto(arquivo, miniatura)} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}
