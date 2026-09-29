import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { brl, mascaraCpf } from "@/lib/format";
import { FORMAS } from "@/lib/lojafisica";
import { BotaoImprimir } from "./BotaoImprimir";

export const metadata = { title: "Cupom", robots: { index: false } };

/** Comprovante de venda (não fiscal) em 80mm para impressora térmica. */
export default async function Cupom({ params }: PageProps<"/painel/cupom/[id]">) {
  await exigirUsuario();
  const { id } = await params;
  const [p, cfg] = await Promise.all([
    db.pedido.findUnique({ where: { id }, include: { itens: true, pagamentos: true, cliente: true } }),
    getConfig(),
  ]);
  if (!p) notFound();
  const bruto = p.itens.reduce((s, i) => s + i.precoUnitCents * i.quantidade, 0);
  const troco = p.pagamentos.reduce((s, x) => s + x.trocoCents, 0);
  const data = (p.pagoEm ?? p.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const identificado = p.cliente.telefone !== "00000000000";

  return (
    <div className="min-h-dvh bg-[#e5e5e5] py-6 print:bg-white print:py-0">
      <style>{`@page { size: 80mm auto; margin: 3mm; } @media print { body { background: #fff !important; } }`}</style>
      <div className="mx-auto w-[76mm] bg-white p-3 font-mono text-[11.5px] leading-snug text-black shadow print:shadow-none">
        <div className="text-center">
          <p className="text-[15px] font-bold">{cfg.loja_razao_social || "VERSÁTIL"}</p>
          {cfg.loja_cnpj && <p>CNPJ {cfg.loja_cnpj}</p>}
          <p>{cfg.loja_endereco}</p>
          <p>{cfg.loja_cidade}</p>
          <p className="mt-1 border-y border-dashed border-black py-1 font-bold">COMPROVANTE DE VENDA — NÃO É DOCUMENTO FISCAL</p>
          <p className="mt-1">Venda #{p.numero} · {data}</p>
          {p.operador && <p>Operador: {p.operador}</p>}
        </div>
        <table className="mt-2 w-full">
          <tbody>
            {p.itens.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="pb-1 pr-1">
                  {i.titulo}
                  <br />
                  {i.quantidade} x {brl(i.precoUnitCents)}
                </td>
                <td className="whitespace-nowrap pb-1 text-right">{brl(i.precoUnitCents * i.quantidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-dashed border-black pt-1">
          <p className="flex justify-between"><span>Subtotal</span><span>{brl(bruto)}</span></p>
          {p.descontoCents > 0 && <p className="flex justify-between"><span>Desconto</span><span>- {brl(p.descontoCents)}</span></p>}
          <p className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{brl(p.totalCents)}</span></p>
          {p.pagamentos.map((x) => (
            <p key={x.id} className="flex justify-between"><span>{FORMAS[x.forma]}</span><span>{brl(x.recebidoCents ?? x.valorCents)}</span></p>
          ))}
          {troco > 0 && <p className="flex justify-between font-bold"><span>Troco</span><span>{brl(troco)}</span></p>}
          {p.estornoCents > 0 && <p className="flex justify-between"><span>Estornado</span><span>- {brl(p.estornoCents)}</span></p>}
        </div>
        {identificado && (
          <p className="mt-2 border-t border-dashed border-black pt-1">
            Cliente: {p.cliente.nome}
            {p.cliente.cpf && <> · CPF {mascaraCpf(p.cliente.cpf)}</>}
          </p>
        )}
        <p className="mt-2 border-t border-dashed border-black pt-1 text-center">{cfg.cupom_rodape}</p>
      </div>
      <div className="mt-4 text-center">
        <BotaoImprimir auto />
      </div>
    </div>
  );
}
