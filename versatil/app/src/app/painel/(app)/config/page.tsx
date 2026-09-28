import { getConfig } from "@/lib/config";
import { modoDemo } from "@/lib/asaas";
import { FormConfig } from "./FormConfig";

export default async function Config() {
  const cfg = await getConfig();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-center text-2xl font-extrabold">Configurações</h1>
      <p className="mt-2 text-center text-xs text-cinza">
        Pagamentos: {modoDemo() ? "modo demonstração (sem chave Asaas)" : `Asaas ${process.env.ASAAS_ENV === "producao" ? "produção" : "sandbox"}`}
      </p>
      <FormConfig cfg={cfg} />
    </div>
  );
}
