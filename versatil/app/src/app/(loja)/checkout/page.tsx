import { getConfig } from "@/lib/config";
import { modoDemo } from "@/lib/asaas";
import { FormCheckout } from "./FormCheckout";
import { clienteAtual } from "@/lib/conta";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finalizar compra" };

export default async function Checkout() {
  const [cfg, cliente] = await Promise.all([getConfig(), clienteAtual()]);
  return (
    <FormCheckout
      endereco={cfg.loja_endereco}
      horario={cfg.loja_horario}
      reservaPix={Number(cfg.reserva_pix_min)}
      demo={modoDemo()}
      cliente={cliente ? { nome: cliente.nome, telefone: cliente.telefone, cpf: cliente.cpf ?? "", email: cliente.email ?? "" } : null}
    />
  );
}
