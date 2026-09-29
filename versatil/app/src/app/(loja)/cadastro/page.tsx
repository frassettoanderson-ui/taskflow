import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteAtual } from "@/lib/conta";
import { FormCadastro } from "./FormCadastro";

export const metadata = { title: "Criar conta" };

export default async function Cadastro({ searchParams }: PageProps<"/cadastro">) {
  const voltar = typeof (await searchParams).voltar === "string" ? String((await searchParams).voltar) : "/conta";
  if (await clienteAtual()) redirect(voltar);
  return (
    <div className="mx-auto max-w-[480px] px-4 py-10">
      <div className="cartao p-6 md:p-8">
        <h1 className="text-[24px] font-semibold">Crie sua conta</h1>
        <p className="mt-1 text-[14px] text-cinza">Leva menos de 1 minuto. Seus dados já ficam salvos para as próximas compras.</p>
        <FormCadastro voltar={voltar} />
        <p className="mt-6 text-center text-[14px]">
          Já tem cadastro?{" "}
          <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="font-semibold text-ouro-escuro hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
