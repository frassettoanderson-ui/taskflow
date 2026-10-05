import { db } from "./db";

export const CONFIG_PADRAO = {
  reserva_pix_min: "15",
  reserva_cartao_min: "30",
  loja_nome: "L3 Salvados",
  loja_endereco: "Endereço da loja — configure no painel",
  loja_horario: "Seg a Sáb, 9h às 18h",
  loja_whatsapp: "",
  loja_cidade: "Imbituba - SC",
  loja_grupo_whatsapp: "", // link de convite do grupo de ofertas (chat.whatsapp.com/...)
  // loja física
  loja_pix_chave: "", // chave Pix que recebe no balcão
  loja_pix_nome: "L3 SALVADOS", // nome do recebedor (aparece no app do banco)
  loja_razao_social: "",
  loja_cnpj: "",
  cupom_rodape: "Obrigado pela preferência! Trocas em até 7 dias com este comprovante.",
  preco_desconto_pct: "30", // preço sugerido = mediana do Mercado Livre − este %
  parado_amarelo_dias: "8",
  parado_vermelho_dias: "21",
  // disparo nos grupos (fase 2)
  disparo_ativo: "1", // 0 = fila pausada
  disparo_auto_publicar: "1", // enfileira ao publicar produto novo
  disparo_intervalo_min: "45", // segundos entre duas mensagens (qualquer grupo)
  disparo_intervalo_max: "120",
  disparo_intervalo_grupo_min: "6", // minutos mínimos entre duas mensagens no MESMO grupo
  disparo_limite_hora: "40", // teto de mensagens por hora (todos os grupos)
  disparo_hora_inicio: "8",
  disparo_hora_fim: "21",
};
export type ChaveConfig = keyof typeof CONFIG_PADRAO;

export async function getConfig(): Promise<Record<ChaveConfig, string>> {
  const rows = await db.config.findMany();
  const out = { ...CONFIG_PADRAO };
  for (const r of rows) if (r.chave in out) out[r.chave as ChaveConfig] = r.valor;
  return out;
}

export async function setConfig(valores: Partial<Record<ChaveConfig, string>>) {
  await db.$transaction(
    Object.entries(valores).map(([chave, valor]) =>
      db.config.upsert({ where: { chave }, create: { chave, valor: String(valor) }, update: { valor: String(valor) } }),
    ),
  );
}
