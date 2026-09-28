import { cookies } from "next/headers";
import { criarPedido, ErroIndisponivel, ErroValidacao } from "@/lib/pedidos";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !Array.isArray(b.itens)) return Response.json({ erro: "Requisição inválida." }, { status: 400 });
  try {
    const pedido = await criarPedido({
      nome: String(b.nome || ""),
      telefone: String(b.telefone || ""),
      cpf: String(b.cpf || ""),
      email: b.email ? String(b.email) : undefined,
      metodo: b.metodo === "CARTAO" ? "CARTAO" : "PIX",
      itens: b.itens.map((i: { produtoId: unknown; quantidade: unknown }) => ({ produtoId: String(i.produtoId), quantidade: Number(i.quantidade) })),
      origemGrupo: (await cookies()).get("vs_g")?.value ?? null,
    });
    return Response.json({ token: pedido.acessoToken });
  } catch (e) {
    if (e instanceof ErroIndisponivel) {
      return Response.json({ erro: e.message + " Removemos ele do seu carrinho.", produtoId: e.produtoId }, { status: 409 });
    }
    if (e instanceof ErroValidacao) return Response.json({ erro: e.message }, { status: 400 });
    console.error("[checkout]", e);
    return Response.json({ erro: "Não conseguimos gerar o pagamento agora. Tente novamente em instantes." }, { status: 502 });
  }
}
