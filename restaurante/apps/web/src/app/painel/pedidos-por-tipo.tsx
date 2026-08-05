'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo, PedidoDoPainel } from '../pedidos/painel-de-pedidos';

/**
 * A TELA PRINCIPAL do restaurante: TODOS os pedidos numa lista só.
 *
 * Nada de colunas separadas — o dono vê tudo junto, na ordem de chegada, e cada
 * pedido carrega TAGS que dizem de onde veio:
 *   - o TIPO (Delivery, Balcão ou Salão · mesa X);
 *   - o ESTABELECIMENTO (só aparece quando o cliente usa mais de uma marca —
 *     para quem tem uma loja só, essa tag nem existe).
 *
 * Os pedidos chegam sozinhos (tempo real): não precisa recarregar.
 */

/** Descreve a tag de tipo de um pedido. */
function tagDoTipo(p: PedidoDoPainel): { texto: string; icone: string; cls: string } {
  if (p.channel === 'DINE_IN') {
    const mesa = p.table?.number ? ` · mesa ${p.table.number}` : '';
    return { texto: `Salão${mesa}`, icone: '🍽️', cls: 'salao' };
  }
  if (p.channel === 'COUNTER') {
    return { texto: 'Retirada / Balcão', icone: '🥡', cls: 'balcao' };
  }
  return { texto: 'Delivery', icone: '🛵', cls: 'delivery' };
}

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

  /** Multi só aparece quando há de fato mais de uma marca (prioridade: 1 loja). */
  const multi = marcas.length > 1;

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

  /** A lista, já sem cancelados e (por padrão) sem finalizados. */
  const lista = useMemo(
    () =>
      pedidos.filter((p) => {
        if (p.status === 'CANCELED') return false;
        if (!verFinalizados && p.finalizado) return false;
        return true;
      }),
    [pedidos, verFinalizados],
  );

  const emAndamento = pedidos.filter((p) => !p.finalizado && p.status !== 'CANCELED').length;

  return (
    <main className="pedidos-tela">
      <header className="pedidos-cabecalho">
        <div>
          <h1 className="title" style={{ marginBottom: 2 }}>
            Pedidos
          </h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {emAndamento === 0 ? 'Nenhum pedido em andamento agora.' : `${emAndamento} pedido(s) em andamento`}
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

      {lista.length === 0 ? (
        <p className="vazio">Nenhum pedido para mostrar.</p>
      ) : (
        <div className="pedidos-lista">
          {lista.map((p) => {
            const tipo = tagDoTipo(p);
            return (
              <Link href={`/pedido/${p.code}`} className="pedido-card" key={p.id}>
                <div className="pedido-tags">
                  <span className={`tag tag-tipo ${tipo.cls}`}>
                    <span>{tipo.icone}</span>
                    {tipo.texto}
                  </span>
                  {multi && p.brand && (
                    <span className="tag tag-marca">
                      <span className="dot" style={{ background: p.brand.primaryColor }} />
                      {p.brand.name}
                    </span>
                  )}
                  <span className="situacao" data-status={p.status}>
                    {p.statusLabel}
                  </span>
                </div>

                <div className="pedido-card-topo">
                  <strong className="pedido-codigo">{p.code}</strong>
                  <strong>{dinheiro(p.totalCents)}</strong>
                </div>

                <div className="pedido-rodape">
                  <span>{p.customerName}</span>
                  <span>
                    {p.items.reduce((s, i) => s + i.quantity, 0)} item(ns) · {horaCurta(p.createdAt)}
                    {p.scheduledFor && ' · agendado'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
