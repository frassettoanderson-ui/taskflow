import { IconeImagem } from "./Icones";
import { urlFoto } from "@/lib/uploads-url";

export function FotoProduto({ arquivo, alt, miniatura = false, className = "" }: { arquivo?: string | null; alt: string; miniatura?: boolean; className?: string }) {
  if (!arquivo)
    return (
      <div className={`flex items-center justify-center bg-grafite ${className}`}>
        <IconeImagem className="w-1/4 text-cinza/40" />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={urlFoto(arquivo, miniatura)} alt={alt} loading="lazy" className={`bg-white object-cover ${className}`} />;
}
