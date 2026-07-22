'use client';

/**
 * A contingência do caixa.
 *
 * Quando a internet cai, o restaurante NÃO pode parar de vender. Então a venda
 * é guardada aqui, neste aparelho, e sobe sozinha quando a conexão volta.
 *
 * Duas decisões que valem explicar:
 *
 * 1. Guardamos no `localStorage`, não em memória. Se o navegador fechar, o
 *    tablet descarregar ou a página recarregar, a venda continua lá. Dinheiro
 *    recebido não pode sumir porque alguém apertou F5.
 *
 * 2. Cada venda leva um APELIDO único gerado aqui (`clientRef`). Se a resposta
 *    do servidor se perder no caminho, o aparelho reenvia — e o servidor, ao
 *    ver o mesmo apelido, devolve o pedido que já existe em vez de cobrar o
 *    cliente duas vezes. Sem isso, "reenviar" seria um jeito de duplicar venda.
 */

const CHAVE = 'pdv:fila-offline';

export type VendaNaFila = {
  /** o apelido que impede a venda de virar duas */
  clientRef: string;
  /** quando a venda aconteceu de verdade, no balcão */
  soldAt: string;
  /** o código provisório que o caixa mostra ao cliente enquanto não sobe */
  codigoProvisorio: string;
  corpo: Record<string, unknown>;
  /** quantas vezes já tentamos subir (só para não insistir para sempre) */
  tentativas: number;
  /** último erro que o servidor devolveu, se houve */
  ultimoErro?: string;
};

function ler(): VendaNaFila[] {
  if (typeof window === 'undefined') return [];
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as VendaNaFila[]) : [];
  } catch {
    return [];
  }
}

function gravar(fila: VendaNaFila[]) {
  localStorage.setItem(CHAVE, JSON.stringify(fila));
}

/** Um apelido que não repete, mesmo em dois tablets ao mesmo tempo. */
export function novoApelido(): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `pdv-${aleatorio}`;
}

/** "OFF-4821" — o código que o caixa canta enquanto a venda não subiu. */
export function codigoProvisorio(): string {
  return `OFF-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function fila(): VendaNaFila[] {
  return ler();
}

export function guardar(venda: VendaNaFila) {
  gravar([...ler(), venda]);
}

export function remover(clientRef: string) {
  gravar(ler().filter((v) => v.clientRef !== clientRef));
}

function anotarErro(clientRef: string, erro: string) {
  gravar(
    ler().map((v) =>
      v.clientRef === clientRef ? { ...v, tentativas: v.tentativas + 1, ultimoErro: erro } : v,
    ),
  );
}

/**
 * Tenta subir a fila inteira, uma venda de cada vez e na ordem em que foram
 * feitas — o fechamento do caixa fica na mesma sequência do balcão.
 *
 * Devolve quantas subiram e quantas ficaram.
 */
export async function sincronizar(): Promise<{ subiram: number; ficaram: number }> {
  const pendentes = ler();
  let subiram = 0;

  for (const venda of pendentes) {
    try {
      const res = await fetch('/api/pdv/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...venda.corpo,
          clientRef: venda.clientRef,
          soldAt: venda.soldAt,
        }),
      });

      if (res.ok) {
        remover(venda.clientRef);
        subiram++;
        continue;
      }

      // 4xx é venda que o servidor NUNCA vai aceitar (item apagado, marca
      // pausada). Insistir seria travar a fila para sempre: tiramos ela e
      // deixamos o aviso na tela para o gerente resolver na mão.
      if (res.status >= 400 && res.status < 500) {
        const corpo = await res.json().catch(() => ({}));
        anotarErro(venda.clientRef, corpo.message ?? 'O servidor recusou esta venda.');
        continue;
      }

      // 5xx é problema do servidor: paramos aqui e tentamos tudo de novo depois.
      break;
    } catch {
      // Sem internet ainda. Paramos e esperamos a próxima chance.
      break;
    }
  }

  return { subiram, ficaram: ler().length };
}
