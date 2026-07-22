'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../../../m/[slug]/cardapio';

export type Acompanhamento = {
  code: string;
  status: string;
  marca: { name: string; slug: string; primaryColor: string };
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  origem: string;
  comissaoEmbutidaCents: number;
  cupomDeGraduacao: string | null;
  linkDireto: string;
  itens: Array<{ nome: string; quantidade: number; totalCents: number; complementos: string[] }>;
  pagamento: { status: string; qrCode: string | null; amountCents: number } | null;
  divisao: {
    restauranteCents: number;
    plataformaCents: number;
    motoboyCents: number;
    comissaoDoPortalCents: number;
  } | null;
};

const NOME_DO_STATUS: Record<string, string> = {
  AWAITING_PAYMENT: 'Aguardando pagamento',
  RECEIVED: 'Recebido pelo restaurante',
  ACCEPTED: 'Aceito',
  IN_PREPARATION: 'Em preparo',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
};

export function PedidoDoPortal({ inicial, code }: { inicial: Acompanhamento; code: string }) {
  const [pedido, setPedido] = useState(inicial);
  const [pagando, setPagando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/pedido/${code}`, { cache: 'no-store' });
      if (res.ok) setPedido(await res.json());
    } catch {
      /* mantém */
    }
  }, [code]);

  /** Gera o Pix assim que a tela abre, se ainda não houver. */
  useEffect(() => {
    if (pedido.status !== 'AWAITING_PAYMENT' || pedido.pagamento) return;
    fetch(`/api/public/orders/${code}/pagamento`, { method: 'POST' }).then(() => recarregar());
  }, [pedido.status, pedido.pagamento, code, recarregar]);

  /** Enquanto o pedido anda, atualiza sozinho. */
  useEffect(() => {
    const fonte = new EventSource(`/api/public/orders/${code}/stream`);
    fonte.onmessage = (e) => {
      try {
        if (JSON.parse(e.data).type === 'ping') return;
        recarregar();
      } catch {
        /* ignora */
      }
    };
    return () => fonte.close();
  }, [code, recarregar]);

  async function simularPagamento() {
    setPagando(true);
    try {
      await fetch(`/api/public/orders/${code}/simular-pagamento`, { method: 'POST' });
      await recarregar();
    } finally {
      setPagando(false);
    }
  }

  const cor = pedido.marca.primaryColor;
  const aguardando = pedido.status === 'AWAITING_PAYMENT';

  return (
    <main className="shell" style={{ maxWidth: 620, ['--marca' as any]: cor }}>
      <header style={{ marginBottom: 22 }}>
        <Link href="/portal" style={{ fontSize: 13 }}>
          ← Portal
        </Link>
        <h1 className="title" style={{ fontSize: 24, marginTop: 8 }}>
          Pedido {pedido.code}
        </h1>
        <p className="subtitle" style={{ margin: 0 }}>
          {pedido.marca.name} · {NOME_DO_STATUS[pedido.status] ?? pedido.status}
        </p>
      </header>

      {/* pagamento */}
      {aguardando && (
        <section className="card">
          <div className="stat-label">Pague com Pix para confirmar</div>
          <div className="pix-caixa">
            <div style={{ fontWeight: 650, fontSize: 20 }}>{dinheiro(pedido.totalCents)}</div>
            {pedido.pagamento?.qrCode && <div className="pix-codigo">{pedido.pagamento.qrCode}</div>}
          </div>
          <button onClick={simularPagamento} disabled={pagando || !pedido.pagamento}>
            {pagando ? 'Confirmando…' : 'Simular pagamento aprovado'}
          </button>
          <p className="hint">Este botão existe só em desenvolvimento.</p>
        </section>
      )}

      {/* ---- O FUNIL DE GRADUAÇÃO: o coração desta etapa ---- */}
      {pedido.cupomDeGraduacao && pedido.comissaoEmbutidaCents > 0 && (
        <section className="card graduacao">
          <div className="graduacao-titulo">🎁 Da próxima vez, peça direto e pague menos</div>
          <p>
            Neste pedido você pagou <strong>{dinheiro(pedido.comissaoEmbutidaCents)}</strong> a mais
            por ter chegado pelo portal. No site da {pedido.marca.name} não tem essa diferença.
          </p>

          <div className="cupom-destaque">
            <span className="cupom-codigo">{pedido.cupomDeGraduacao}</span>
            <button
              className="ghost"
              style={{ width: 'auto' }}
              onClick={() => {
                navigator.clipboard?.writeText(pedido.cupomDeGraduacao!);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 3000);
              }}
            >
              {copiado ? 'copiado!' : 'copiar'}
            </button>
          </div>

          <p className="hint" style={{ marginTop: 12 }}>
            Vale {dinheiro(pedido.comissaoEmbutidaCents)} de desconto no próximo pedido feito
            direto com eles.
          </p>

          <Link href={pedido.linkDireto}>
            <button style={{ marginTop: 8 }}>Ir para o site da {pedido.marca.name}</button>
          </Link>
        </section>
      )}

      {/* resumo */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="stat-label">Seu pedido</div>
        {pedido.itens.map((i, n) => (
          <div className="linha-carrinho" key={n}>
            <span className="qtd">{i.quantidade}×</span>
            <span style={{ minWidth: 0 }}>
              <div>{i.nome}</div>
              {i.complementos.length > 0 && (
                <div className="complementos">{i.complementos.join(' · ')}</div>
              )}
            </span>
            <span className="valor">{dinheiro(i.totalCents)}</span>
          </div>
        ))}

        <div className="totais" style={{ marginTop: 12 }}>
          <span>Itens</span>
          <span>{dinheiro(pedido.subtotalCents)}</span>
        </div>
        <div className="totais">
          <span>Entrega</span>
          <span>{dinheiro(pedido.deliveryFeeCents)}</span>
        </div>
        <div className="totais grande">
          <span>Total</span>
          <span>{dinheiro(pedido.totalCents)}</span>
        </div>
      </section>

      {/* transparência da divisão — nenhum marketplace mostra isso */}
      {pedido.divisao && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="stat-label">Para onde vai o seu dinheiro</div>
          <div className="totais">
            <span>🍽️ Restaurante</span>
            <span>{dinheiro(pedido.divisao.restauranteCents)}</span>
          </div>
          <div className="totais">
            <span>🛵 Entregador</span>
            <span>{dinheiro(pedido.divisao.motoboyCents)}</span>
          </div>
          <div className="totais">
            <span>💻 Portal</span>
            <span>{dinheiro(pedido.divisao.plataformaCents)}</span>
          </div>
          <p className="hint">
            O restaurante recebe o <strong>valor cheio</strong> do cardápio dele. A parte do portal
            é o acréscimo que você paga por ter chegado por aqui — e o cupom acima devolve isso na
            próxima.
          </p>
        </section>
      )}
    </main>
  );
}
