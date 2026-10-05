import Link from "next/link";
import { redirect } from "next/navigation";
import { acessoCadastro } from "@/lib/cadastroRapido";
import { db } from "@/lib/db";
import { esteiraAcao, sairAcao } from "./acoes";
import { Esteira } from "./Esteira";
import { Cabecalho } from "./Cabecalho";

export default async function InicioCadastro() {
  const a = await acessoCadastro();
  if (!a) redirect("/recebimento/entrar");
  const [itens, hoje] = await Promise.all([
    esteiraAcao(),
    db.cadastroRascunho.count({ where: { status: "PUBLICADO", atualizadoEm: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);
  return (
    <>
      <Cabecalho nome={a.nome} sair={sairAcao} />
      <div className="px-4 pt-4 text-center">
        <Link href="/recebimento/novo" className="botao-ouro flex flex-col items-center gap-1 rounded-2xl py-7 text-lg">
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Cadastrar produto
        </Link>
        <p className="mt-2 text-xs text-cinza">{hoje} produto(s) cadastrado(s) hoje</p>
      </div>
      <Esteira inicial={itens} />
    </>
  );
}
