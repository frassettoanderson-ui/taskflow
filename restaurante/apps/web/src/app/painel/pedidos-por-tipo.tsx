'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo, PedidoDoPainel } from '../pedidos/painel-de-pedidos';

/**
 * A TELA PRINCIPAL do restaurante.
 *
 * De cima para baixo:
 *   1. um painel de RESULTADOS do dia (faturado, pedidos);
 *   2. uma barra de AÇÕES (por ora só "+ Novo pedido");
 *   3. as ABAS por tipo (Todos, Salão, Retirada, Delivery) — e, só quando há
 *      mais de um estabelecimento, uma 2ª fileira de abas por marca;
 *   4. a lista de pedidos, filtrada pelas abas escolhidas.
 *
 * Tudo ao vivo: pedido novo entra sozinho e os números do topo se atualizam.
 */

const ABAS_TIPO = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'DINE_IN', label: 'Salão' },
  { valor: 'COUNTER', label: 'Retirada' },
  { valor: 'DELIVERY', label: 'Delivery' },
];

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
  const [resumo, setResumo] = useState<{ faturadoCents: number; quantidade: number }>({
    faturadoCents: 0,
    quantidade: 0,
  });
  const [aoVivo, setAoVivo] = useState(false);
  const [abaTipo, setAbaTipo] = useState('TODOS');
  const [abaMarca, setAbaMarca] = useState('TODAS');

  /** Multi só aparece com mais de uma marca (prioridade: 1 estabelecimento). */
  const multi = marcas.length > 1;

  const buscar = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([
        fetch('/api/orders?limite=100', { cache: 'no-store' }),
        fetch('/api/orders/resumo', { cache: 'no-store' }),
      ]);
      if (pRes.ok) setPedidos(await pRes.json());
      if (rRes.ok) setResumo(await rRes.json());
    } catch {
      /* rede oscilou: mantém a tela */
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  // Tempo real: pedido novo aparece sozinho e os números do topo se atualizam.
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

  /** A lista visível: em andamento, do tipo e da marca escolhidos. */
  const lista = useMemo(
    () =>
      pedidos.filter((p) => {
        if (p.status === 'CANCELED' || p.finalizado) return false;
        if (abaTipo !== 'TODOS' && p.channel !== abaTipo) return false;
        if (multi && abaMarca !== 'TODAS' && p.brand?.id !== abaMarca) return false;
        return true;
      }),
    [pedidos, abaTipo, abaMarca, multi],
  );

  return (
    <main className="pedidos-tela">
      {/* 1) PAINEL DE RESULTADOS */}
      <section className="resultados">
        <div className="resultado-card">
          <span className="resultado-rotulo">Faturado hoje</span>
          <span className="resultado-valor">{dinheiro(resumo.faturadoCents)}</span>
        </div>
        <div className="resultado-card">
          <span className="resultado-rotulo">Pedidos hoje</span>
          <span className="resultado-valor">{resumo.quantidade}</span>
        </div>
        <span className={`ao-vivo ${aoVivo ? 'on' : ''}`}>{aoVivo ? '● ao vivo' : '○ reconectando'}</span>
      </section>

      {/* 2) BARRA DE AÇÕES */}
      <div className="acoes-barra">
        <Link href="/pdv" className="botao-acao destaque">
          + Novo pedido
        </Link>
      </div>

      {/* 3) ABAS */}
      <div className="abas-tipo">
        {ABAS_TIPO.map((a) => (
          <button
            key={a.valor}
            className="aba-tab"
            data-ativa={abaTipo === a.valor}
            onClick={() => setAbaTipo(a.valor)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {multi && (
        <div className="abas-marca">
          <button
            className="aba-tab menor"
            data-ativa={abaMarca === 'TODAS'}
            onClick={() => setAbaMarca('TODAS')}
          >
            Todos estabelecimentos
          </button>
          {marcas.map((m) => (
            <button
              key={m.id}
              className="aba-tab menor"
              data-ativa={abaMarca === m.id}
              onClick={() => setAbaMarca(m.id)}
            >
              <span className="dot" style={{ background: m.primaryColor }} />
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* 4) LISTA */}
      {lista.length === 0 ? (
        <p className="vazio">Nenhum pedido em andamento por aqui.</p>
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
