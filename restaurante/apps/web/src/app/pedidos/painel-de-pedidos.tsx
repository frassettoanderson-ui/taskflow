'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';

export type MarcaResumo = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl?: string | null;
  description?: string | null;
  paused: boolean;
  pausedReason: string | null;
  canais: Array<{
    channel: string;
    apelido: string;
    label: string;
    aberto: boolean;
    motivo: string | null;
    horarioDeHoje: string | null;
  }>;
};

export type PedidoDoPainel = {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  channel: string;
  channelLabel: string;
  finalizado: boolean;
  customerName: string;
  customerPhone: string;
  totalCents: number;
  createdAt: string;
  scheduledFor: string | null;
  brand?: { id: string; name: string; primaryColor: string };
  table?: { number: string; area: string } | null;
  payment: { status: string } | null;
  items: Array<{ id: string; name: string; quantity: number }>;
};

const SITUACOES = [
  { valor: '', label: 'Todas as situações' },
  { valor: 'AWAITING_PAYMENT', label: 'Aguardando pagamento' },
  { valor: 'RECEIVED', label: 'Recebido' },
  { valor: 'ACCEPTED', label: 'Aceito' },
  { valor: 'IN_PREPARATION', label: 'Em preparo' },
  { valor: 'READY', label: 'Pronto' },
  { valor: 'OUT_FOR_DELIVERY', label: 'Saiu para entrega' },
  { valor: 'DELIVERED', label: 'Entregue' },
  { valor: 'CANCELED', label: 'Cancelado' },
];

const CANAIS = [
  { valor: '', label: 'Todos os canais' },
  { valor: 'delivery', label: 'Delivery' },
  { valor: 'salao', label: 'Salão' },
  { valor: 'balcao', label: 'Balcão' },
];

function quando(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PainelDePedidos({
  iniciais,
  marcas,
}: {
  iniciais: PedidoDoPainel[];
  marcas: MarcaResumo[];
}) {
  const [pedidos, setPedidos] = useState(iniciais);
  const [marca, setMarca] = useState('');
  const [canal, setCanal] = useState('');
  const [situacao, setSituacao] = useState('');
  const [aoVivo, setAoVivo] = useState(false);

  const buscar = useCallback(async () => {
    const params = new URLSearchParams({ limite: '100' });
    if (marca) params.set('marca', marca);
    if (canal) params.set('canal', canal);
    if (situacao) params.set('situacao', situacao);

    try {
      const res = await fetch(`/api/orders?${params}`, { cache: 'no-store' });
      if (res.ok) setPedidos(await res.json());
    } catch {
      /* rede oscilou: mantém a tela */
    }
  }, [marca, canal, situacao]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  // Tempo real: pedido novo de QUALQUER marca aparece aqui sozinho.
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

  /** Quantos pedidos de cada marca estão na tela — o resumo do topo. */
  const porMarca = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of pedidos) {
      const nome = p.brand?.name ?? '—';
      mapa.set(nome, (mapa.get(nome) ?? 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [pedidos]);

  const faturamento = useMemo(
    () => pedidos.filter((p) => !p.finalizado || p.status === 'DELIVERED').reduce((s, p) => s + p.totalCents, 0),
    [pedidos],
  );

  return (
    <main className="shell" style={{ maxWidth: 1100 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Pedidos</h1>
          <span className="ao-vivo">
            <span className="pulso" style={{ background: aoVivo ? 'var(--ok)' : 'var(--muted)' }} />
            {aoVivo ? 'Ao vivo' : 'Reconectando…'} · todas as marcas num painel só
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/kds">
            <button className="ghost">Cozinha</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {/* resumo por marca */}
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">Pedidos na tela</div>
          <div className="stat-value">{pedidos.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Soma dos pedidos</div>
          <div className="stat-value">{dinheiro(faturamento)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Por marca</div>
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>
            {porMarca.length === 0 && <span style={{ color: 'var(--muted)' }}>—</span>}
            {porMarca.map(([nome, qtd]) => (
              <div key={nome}>
                <strong>{qtd}</strong> {nome}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* filtros */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="stat-label">Filtrar</div>
        <div className="filtros">
          <select value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Todas as marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select value={canal} onChange={(e) => setCanal(e.target.value)}>
            {CANAIS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </select>

          <select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            {SITUACOES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>

          {(marca || canal || situacao) && (
            <button
              className="ghost"
              onClick={() => {
                setMarca('');
                setCanal('');
                setSituacao('');
              }}
            >
              Limpar
            </button>
          )}
        </div>
      </section>

      {/* lista */}
      {pedidos.length === 0 ? (
        <p className="vazio">Nenhum pedido com esses filtros.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr>
                <th>Código</th>
                <th>Marca</th>
                <th>Canal</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Situação</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pedido/${p.code}`} className="codigo">
                      {p.code}
                    </Link>
                  </td>
                  <td>
                    <span className="marca-tag">
                      <span
                        className="dot"
                        style={{ background: p.brand?.primaryColor ?? 'var(--muted)' }}
                      />
                      {p.brand?.name ?? '—'}
                    </span>
                  </td>
                  <td>{p.channelLabel}</td>
                  <td>
                    {p.customerName}
                    <div className="sub">{p.customerPhone}</div>
                  </td>
                  <td>{p.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td>
                    <span className="situacao" data-status={p.status}>
                      {p.statusLabel}
                    </span>
                    {p.scheduledFor && <div className="sub">agendado</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{dinheiro(p.totalCents)}</td>
                  <td className="sub">{quando(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
