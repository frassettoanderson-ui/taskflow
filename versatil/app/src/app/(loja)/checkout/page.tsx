import { getConfig } from "@/lib/config";
import { modoDemo } from "@/lib/asaas";
import { FormCheckout } from "./FormCheckout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finalizar compra" };

export default async function Checkout() {
  const cfg = await getConfig();
  return (
    <FormCheckout
      endereco={cfg.loja_endereco}
      horario={cfg.loja_horario}
      reservaPix={Number(cfg.reserva_pix_min)}
      demo={modoDemo()}
    />
  );
}
