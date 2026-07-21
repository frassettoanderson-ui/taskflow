'use client';

import { useCallback, useEffect, useState } from 'react';
import { dinheiro } from '../../m/[slug]/cardapio';

// ---------------------------------------------------------------------------

export type PedidoPublico = {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  finalizado: boolean;
  customerName: string;
  scheduledFor: string | null;
  notes: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  createdAt: string;
  brand?: { name: string; slug: string; primaryColor: string };
  payment: {
    status: string;
    method: string;
    qrCode: string | null;
    amountCents: number;
    paidAt: string | null;
  } | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    totalCents: number;
    modifiers: Array<{ name: string; priceDeltaCents: number }>;
  }>;
  events: Array<{ type: string; payload: any; at: string }>;
};

/** As etapas que o cliente vê, na ordem. */
const ETAPAS: Array<{ status: string; titulo: string }> = [
  { status: 'RECEIVED', titulo: 'Pedido recebido' },
  { status: 'ACCEPTED', titulo: 'Aceito pelo restaurante' },
  { status: 'IN_PREPARATION', titulo: 'Em preparo' },
  { status: 'READY', titulo: 'Pronto' },
  { status: 'OUT_FOR_DELIVERY', titulo: 'Saiu para entrega' },
  { status: 'DELIVERED', titulo: 'Entregue' },
];

function hora(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------

export function Acompanhamento({ inicial }: { inicial: PedidoPublico }) {
  const [pedido, setPedido] = useState(inicial);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [aoVivo, setAoVivo] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/orders/${inicial.code}`, { cache: 'no-store' });
      if (res.ok) setPedido(await res.json());
    } catch {
      /* rede oscilou: mantém o que já está na tela */
    }
  }, [inicial.code]);

  /**
   * Fica "ouvindo" o servidor. Quando a cozinha mexe no pedido, o servidor
   * avisa e esta tela se atualiza sozinha — sem o cliente apertar nada.
   */
  useEffect(() => {
    const fonte = new EventSource(`/api/public/orders/${inicial.code}/stream`);

    fonte.onopen = () => setAoVivo(true);
    fonte.onerror = () => setAoVivo(false);
    fonte.onmessage = (evento) => {
      try {
        const aviso = JSON.parse(evento.data);
        if (aviso.type === 'ping') return; // só batimento cardíaco
        recarregar();
      } catch {
        /* ignora aviso malformado */
      }
    };

    return () => fonte.close();
  }, [inicial.code, recarregar]);

  /** Gera a cobrança Pix assim que a tela abre, se ainda não houver. */
  useEffect(() => {
    if (pedido.status !== 'AWAITING_PAYMENT' || pedido.payment || gerandoPix) return;
    setGerandoPix(true);
    fetch(`/api/public/orders/${inicial.code}/pagamento`, { method: 'POST' })
      .then(() => recarregar())
      .finally(() => setGerandoPix(false));
  }, [pedido.status, pedido.payment, gerandoPix, inicial.code, recarregar]);

  async function simularPagamento() {
    setSimulando(true);
    try {
      await fetch(`/api/public/orders/${inicial.code}/simular-pagamento`, { method: 'POST' });
      await recarregar();
    } finally {
      setSimulando(false);
    }
  }

  const cor = pedido.brand?.primaryColor ?? '#f97316';
  const aguardandoPagamento = pedido.status === 'AWAITING_PAYMENT';
  const cancelado = pedido.status === 'CANCELED';

  // Em que ponto da trilha estamos?
  const indiceAtual = ETAPAS.findIndex((e) => e.status === pedido.status);

  /** Quando cada etapa aconteceu, lido do histórico de eventos. */
  function quandoAconteceu(status: string) {
    const ev = pedido.events.find(
      (e) => e.type === 'order.status_changed' && e.payload?.para === status,
    );
    if (ev) return hora(ev.at);
    if (status === 'RECEIVED') {
      const pago = pedido.events.find((e) => e.type === 'order.paid');
      return pago ? hora(pago.at) : '';
    }
    return '';
  }

  return (
    <main className="shell" style={{ ['--marca' as any]: cor, maxWidth: 620 }}>
      <header style={{ marginBottom: 26 }}>
        <p className="subtitle" style={{ margin: 0 }}>
          {pedido.brand?.name}
        </p>
        <h1 className="title" style={{ fontSize: 24 }}>
          Pedido {pedido.code}
        </h1>
        <span className="ao-vivo">
          <span className="pulso" style={{ background: aoVivo ? 'var(--ok)' : 'var(--muted)' }} />
          {aoVivo ? 'Acompanhando ao vivo' : 'Reconectando…'}
        </span>
      </header>

      {/* ---------- pagamento ---------- */}
      {aguardandoPagamento && (
        <section className="card">
          <div className="stat-label">Pague com Pix para confirmar</div>

          <div className="pix-caixa">
            {pedido.payment?.qrCode ? (
              <>
                <QrDeMentira semente={pedido.payment.qrCode} cor={cor} />
                <div style={{ marginTop: 12, fontWeight: 650, fontSize: 18 }}>
                  {dinheiro(pedido.totalCents)}
                </div>
                <div className="pix-codigo">{pedido.payment.qrCode}</div>
              </>
            ) : (
              <p className="subtitle" style={{ margin: 0 }}>
                Gerando o código Pix…
              </p>
            )}
          </div>

          <button onClick={simularPagamento} disabled={simulando || !pedido.payment}>
            {simulando ? 'Confirmando…' : 'Simular pagamento aprovado'}
          </button>
          <p className="hint" style={{ marginTop: 12 }}>
            Este botão existe só em desenvolvimento. Ele imita o aviso que um banco mandaria
            quando o Pix cai. Enquanto o pagamento não é aprovado, o pedido <strong>não</strong>{' '}
            aparece para a cozinha.
          </p>
        </section>
      )}

      {/* ---------- trilha do pedido ---------- */}
      {!aguardandoPagamento && !cancelado && (
        <section className="card">
          <div className="stat-label">Situação</div>
          <ol className="trilha">
            {ETAPAS.map((etapa, i) => {
              const feito = indiceAtual > i;
              const atual = indiceAtual === i;
              return (
                <li
                  className="passo"
                  key={etapa.status}
                  data-feito={feito}
                  data-atual={atual}
                  data-pendente={!feito && !atual}
                >
                  <span className="bolinha">{feito ? '✓' : atual ? '•' : ''}</span>
                  <span className="texto">
                    <strong>{etapa.titulo}</strong>
                    <div className="quando">
                      {quandoAconteceu(etapa.status) || (atual ? 'agora' : '')}
                    </div>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {cancelado && (
        <section className="card proof fail">
          <strong>Pedido cancelado.</strong>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Se você não pediu o cancelamento, fale com o restaurante.
          </p>
        </section>
      )}

      {/* ---------- resumo ---------- */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="stat-label">Seu pedido</div>

        {pedido.scheduledFor && (
          <div className="agendado">
            Agendado para{' '}
            {new Date(pedido.scheduledFor).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}

        {pedido.items.map((i) => (
          <div className="linha-carrinho" key={i.id}>
            <span className="qtd">{i.quantity}×</span>
            <span style={{ minWidth: 0 }}>
              <div>{i.name}</div>
              {i.modifiers.length > 0 && (
                <div className="complementos">{i.modifiers.map((m) => m.name).join(' · ')}</div>
              )}
            </span>
            <span className="valor">{dinheiro(i.totalCents)}</span>
          </div>
        ))}

        <div className="totais" style={{ marginTop: 12 }}>
          <span>Subtotal</span>
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

        {pedido.notes && (
          <p className="hint" style={{ marginTop: 12 }}>
            Observação: {pedido.notes}
          </p>
        )}
      </section>

      <p className="hint">
        Guarde o código <strong>{pedido.code}</strong> — é por ele que você volta a esta página.
      </p>
    </main>
  );
}

/**
 * Um "QR Code" decorativo, desenhado a partir do código Pix.
 * Não é um QR de verdade — é enfeite de desenvolvimento, e está escrito na tela.
 */
function QrDeMentira({ semente, cor }: { semente: string; cor: string }) {
  const lado = 21;
  const celulas: boolean[] = [];
  let h = 7;
  for (let i = 0; i < semente.length; i++) h = (h * 31 + semente.charCodeAt(i)) >>> 0;
  for (let i = 0; i < lado * lado; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    celulas.push(((h >> 16) & 1) === 1);
  }

  return (
    <div>
      <svg viewBox={`0 0 ${lado} ${lado}`} width="150" height="150" role="img" aria-label="QR de teste">
        <rect width={lado} height={lado} fill="#fff" />
        {celulas.map((ligada, i) =>
          ligada ? (
            <rect key={i} x={i % lado} y={Math.floor(i / lado)} width="1" height="1" fill={cor} />
          ) : null,
        )}
      </svg>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>QR de teste (fake)</div>
    </div>
  );
}
