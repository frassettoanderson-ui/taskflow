"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AguardarProcessamento() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div className="px-6 py-20 text-center">
      <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-ouro border-t-transparent" />
      <p className="mt-4 font-semibold">Identificando o produto…</p>
      <p className="mt-1 text-sm text-cinza">Lendo o código de barras, buscando no Mercado Livre e montando a descrição.</p>
    </div>
  );
}
