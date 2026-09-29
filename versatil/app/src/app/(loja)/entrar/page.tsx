import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteAtual } from "@/lib/conta";
import { FormEntrar } from "./FormEntrar";

export const metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const voltar = typeof (await searchParams).voltar === "string" ? String((await searchParams).voltar) : "/conta";
  if (await clienteAtual()) redirect(voltar);
  return (
    <div className="mx-auto max-w-[420px] px-4 py-10">
      <div className="cartao p-6 md:p-8">
        <h1 className="text-[24px] font-semibold">Entre na sua conta</h1>
        <p className="mt-1 text-[14px] text-cinza">Acompanhe seus pedidos e compre mais rápido.</p>
        <FormEntrar voltar={voltar} />
        <p className="mt-6 text-center text-[14px]">
          Ainda não tem cadastro?{" "}
          <Link href={`/cadastro?voltar=${encodeURIComponent(voltar)}`} className="font-semibold text-ouro-escuro hover:underline">
            Clique aqui!
          </Link>
        </p>
      </div>
      <p className="mt-4 text-center text-[12px] text-cinza">Não precisa de conta para comprar: é só finalizar o pedido com seus dados.</p>
    </div>
  );
}
