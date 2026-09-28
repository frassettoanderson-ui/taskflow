/** Preço no padrão do Mercado Livre: "R$ 86" grande e os centavos pequenos em cima. */
export function Preco({ cents, tamanho = 24, className = "" }: { cents: number; tamanho?: number; className?: string }) {
  const reais = Math.floor(cents / 100).toLocaleString("pt-BR");
  const cent = String(cents % 100).padStart(2, "0");
  return (
    <span className={`inline-flex items-start font-normal leading-none text-marfim ${className}`} style={{ fontSize: tamanho }} aria-label={`R$ ${reais},${cent}`}>
      <span className="mr-1">R$</span>
      {reais}
      <span className="ml-0.5" style={{ fontSize: Math.round(tamanho * 0.45), marginTop: Math.round(tamanho * 0.08) }}>
        {cent}
      </span>
    </span>
  );
}
