'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo, PedidoDoPainel } from '../pedidos/painel-de-pedidos';

/**
 * A TELA PRINCIPAL do restaurante: os pedidos, separados por tipo.
 *
 * Três colunas — Delivery, Salão e Retirada (balcão) — para o dono bater o olho
 * e saber o que está acontecendo em cada frente, sem filtrar nada. Os pedidos
 * chegam sozinhos (tempo real): não precisa recarregar a página.
 */

/** As três colunas. `channel` casa com o valor que vem do backend. */
const COLUNAS = [
  { channel: 'DELIVERY', titulo: 'Delivery', icone: '🛵' },
  { channel: 'DINE_IN', titulo: 'Salão', icone: '🍽️' },
  { channel: 'COUNTER', titulo: 'Retirada / Balcão', icone: '🥡' },
];

function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function PedidosPorTipo({
  iniciais,
  marcas,
}: {
  iniciais: PedidoDoPainel[];
  marcas: MarcaResumo[];
}) {
  const [pedidos, setPedidos] = useState(iniciais);
  const [aoVivo, setAoVivo] = useState(false);
  const [verFinalizados, setVerFinalizados] = useState(false);
  const [listaMarcas, setListaMarcas] = useState(marcas);
  const [pausando, setPausando] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limite=100', { cache: 'no-store' });
      if (res.ok) setPedidos(await res.json());
    } catch {
      /* rede oscilou: mantém a tela */
    }
  }, []);

  // Tempo real: pedido novo de qualquer tipo aparece aqui sozinho.
  useEffect(() => {
    const fonte = new EventSource('/api/orders/stream');
    fonte.onopen = () => setAoVivo(true);
    fonte.onerror = () => setAoVivo(false);
    fonte.onmessage = (e) => {
      try {
        if (JSON.parse(e.data).type === 'ping') return;
        buscar();
      } catch {
        /* ignora */
      }
    };
    return () => fonte.close();
  }, [buscar]);

  /** Liga/desliga o recebimento de pedidos de uma marca (pausar/reabrir). */
  async function alternarRecebimento(marca: MarcaResumo) {
    setPausando(marca.id);
    try {
      await fetch(`/api/brands/${marca.id}/pausa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paused: !marca.paused,
          reason: !marca.paused ? 'Pausado no painel' : undefined,
        }),
      });
      setListaMarcas((atual) =>
        atual.map((m) => (m.id === marca.id ? { ...m, paused: !m.paused } : m)),
      );
    } finally {
      setPausando(null);
    }
  }

  /** Separa os pedidos nas três colunas, já sem os cancelados. */
  const porTipo = useMemo(() => {
    const mapa: Record<string, PedidoDoPainel[]> = { DELIVERY: [], DINE_IN: [], COUNTER: [] };
    for (const p of pedidos) {
      if (p.status === 'CANCELED') continue;
      if (!verFinalizados && p.finalizado) continue;
      (mapa[p.channel] ?? (mapa[p.channel] = [])).push(p);
    }
    return mapa;
  }, [pedidos, verFinalizados]);

  const totalEmAndamento = pedidos.filter((p) => !p.finalizado && p.status !== 'CANCELED').length;

  return (
    <main className="pedidos-tela">
      <header className="pedidos-cabecalho">
        <div>
          <h1 className="title" style={{ marginBottom: 2 }}>
            Pedidos
          </h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {totalEmAndamento === 0
              ? 'Nenhum pedido em andamento agora.'
              : `${totalEmAndamento} pedido(s) em andamento`}
            <span className={`ao-vivo ${aoVivo ? 'on' : ''}`}>{aoVivo ? '● ao vivo' : '○ reconectando'}</span>
          </p>
        </div>

        <label className="ver-finalizados">
          <input
            type="checkbox"
            checked={verFinalizados}
            onChange={(e) => setVerFinalizados(e.target.checked)}
          />
          Mostrar entregues/finalizados
        </label>
      </header>

      {/* Recebendo pedidos? (liga/desliga por marca) */}
      <div className="recebimento">
        {listaMarcas.map((m) => (
          <button
            key={m.id}
            className="recebimento-pill"
            data-pausado={m.paused}
            disabled={pausando === m.id}
            onClick={() => alternarRecebimento(m)}
            title={m.paused ? 'Clique para voltar a receber' : 'Clique para pausar o recebimento'}
          >
            <span className="bolinha" />
            {listaMarcas.length > 1 && <b>{m.name}:</b>}
            {m.paused ? 'Pausado — não recebe pedidos' : 'Recebendo pedidos'}
          </button>
        ))}
      </div>

      {/* Três colunas por tipo */}
      <div className="pedidos-colunas">
        {COLUNAS.map((col) => {
          const lista = porTipo[col.channel] ?? [];
          return (
            <section className="coluna" key={col.channel}>
              <div className="coluna-topo">
                <span className="coluna-icone">{col.icone}</span>
                <h2>{col.titulo}</h2>
                <span className="coluna-conta">{lista.length}</span>
              </div>

              {lista.length === 0 ? (
                <p className="coluna-vazia">Nada por aqui.</p>
              ) : (
                lista.map((p) => (
                  <Link href={`/pedido/${p.code}`} className="pedido-card" key={p.id}>
                    <div className="pedido-card-topo">
                      <strong className="pedido-codigo">{p.code}</strong>
                      <span className="situacao" data-status={p.status}>
                        {p.statusLabel}
                      </span>
                    </div>
                    <div className="pedido-cliente">{p.customerName}</div>
                    <div className="pedido-rodape">
                      <span>
                        {p.items.reduce((s, i) => s + i.quantity, 0)} item(ns) · {horaCurta(p.createdAt)}
                        {p.scheduledFor && ' · agendado'}
                      </span>
                      <strong>{dinheiro(p.totalCents)}</strong>
                    </div>
                    {listaMarcas.length > 1 && p.brand && (
                      <span className="pedido-marca">
                        <span className="dot" style={{ background: p.brand.primaryColor }} />
                        {p.brand.name}
                      </span>
                    )}
                  </Link>
                ))
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
