import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormUsuario, ToggleUsuario } from "./FormUsuario";
import { CodigosCadastro } from "./CodigosCadastro";
import { diaBR } from "@/lib/periodo";

export const metadata = { title: "Usuários" };

export default async function Usuarios() {
  const eu = await exigirAdmin();
  const usuarios = await db.usuario.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] });
  const codigos = await db.tokenCadastro.findMany({ orderBy: [{ ativo: "desc" }, { criadoEm: "desc" }] });
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-extrabold">Usuários do painel</h1>
      <p className="mt-1 text-sm text-cinza">
        <b>Administrador</b> vê tudo. <b>Operador de caixa</b> acessa só frente de caixa, caixa, pedidos e retirada.
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_320px]">
        <ul className="space-y-2">
          {usuarios.map((u) => (
            <li key={u.id} className={`flex items-center justify-between gap-3 rounded-2xl border filete bg-white px-4 py-3 ${u.ativo ? "" : "opacity-50"}`}>
              <div className="min-w-0">
                <p className="font-semibold">{u.nome}{u.id === eu.id && <span className="ml-2 text-xs text-cinza">(você)</span>}</p>
                <p className="text-xs text-cinza">{u.email} · {u.papel === "ADMIN" ? "Administrador" : "Operador de caixa"}</p>
              </div>
              <div className="flex items-center gap-2">
                <FormUsuario usuario={{ id: u.id, nome: u.nome, email: u.email, papel: u.papel }} />
                {u.id !== eu.id && <ToggleUsuario id={u.id} ativo={u.ativo} />}
              </div>
            </li>
          ))}
        </ul>
        <div>
          <FormUsuario />
        </div>
      </div>
      <CodigosCadastro codigos={codigos.map((c) => ({ id: c.id, nome: c.nome, final: c.final, ativo: c.ativo, ultimoUso: c.ultimoUsoEm ? diaBR(c.ultimoUsoEm) : null }))} />
    </div>
  );
}
