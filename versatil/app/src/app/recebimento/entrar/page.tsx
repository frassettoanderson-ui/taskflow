import { redirect } from "next/navigation";
import { acessoCadastro } from "@/lib/cadastroRapido";
import { Marca } from "@/components/Marca";
import { FormCodigo } from "./FormCodigo";

export const metadata = { title: "Entrar" };

export default async function EntrarCadastro() {
  if (await acessoCadastro()) redirect("/recebimento");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Marca tom="claro" className="text-[30px]" />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-ouro-escuro">Cadastro de produtos</p>
      <FormCodigo />
      <p className="mt-6 text-xs text-cinza">O código de acesso é gerado pelo administrador no painel (Usuários).</p>
    </div>
  );
}
