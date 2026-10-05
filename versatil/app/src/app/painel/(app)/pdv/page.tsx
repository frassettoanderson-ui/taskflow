import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { caixaAberto } from "@/lib/lojafisica";
import { expirarPedidos } from "@/lib/pedidos";
import { AbrirCaixa } from "../caixa/FormsCaixa";
import { Pdv } from "./Pdv";
import { MARCA } from "@/lib/marca";

export const metadata = { title: "Frente de caixa" };

export default async function PaginaPdv() {
  const u = await exigirUsuario();
  await expirarPedidos();
  const caixa = await caixaAberto();
  if (!caixa)
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <h1 className="text-2xl font-extrabold">Frente de caixa</h1>
        <p className="mt-2 text-sm text-cinza">Para começar a vender, abra o caixa informando o troco que está na gaveta.</p>
        <div className="mt-6">
          <AbrirCaixa />
        </div>
      </div>
    );

  const [produtos, cfg] = await Promise.all([
    db.produto.findMany({
      where: { status: "ATIVO", estoqueDisponivel: { gt: 0 } },
      select: { id: true, codigo: true, titulo: true, marca: true, sku: true, ean: true, precoCents: true, estoqueDisponivel: true, fotos: { select: { arquivo: true }, orderBy: { ordem: "asc" }, take: 1 } },
      orderBy: { titulo: "asc" },
      take: 3000,
    }),
    getConfig(),
  ]);

  return (
    <Pdv
      operador={u.nome}
      caixaNumero={caixa.numero}
      produtos={produtos.map((p) => ({ id: p.id, codigo: p.codigo, titulo: p.titulo, marca: p.marca, sku: p.sku, ean: p.ean, precoCents: p.precoCents, estoque: p.estoqueDisponivel, foto: p.fotos[0]?.arquivo ?? null }))}
      pix={{ chave: cfg.loja_pix_chave, nome: cfg.loja_pix_nome || MARCA.pix, cidade: (cfg.loja_cidade || "Imbituba").split("-")[0].trim() }}
    />
  );
}
