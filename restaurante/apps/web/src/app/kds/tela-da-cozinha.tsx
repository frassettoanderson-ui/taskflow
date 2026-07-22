'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export type Estacao = { id: string; name: string; unitId: string };
export type MarcaKds = { id: string; name: string; primaryColor: string };

export type PedidoKds = {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  proximoStatus: string | null;
  proximoStatusLabel: string | null;
  channelLabel: string;
  customerName: string;
  scheduledFor: string | null;
  notes: string | null;
  totalCents: number;
  createdAt: string;
  brand?: { id: string; name: string; primaryColor: string };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    notes: string | null;
    stationId: string | null;
    stationName: string | null;
    modifiers: Array<{ name: string }>;
  }>;
};

/** As colunas da tela, na ordem do fluxo da cozinha. */
const COLUNAS: Array<{ status: string; titulo: string }> = [
  { status: 'RECEIVED', titulo: 'Novos' },
  { status: 'ACCEPTED', titulo: 'Aceitos' },
  { status: 'IN_PREPARATION', titulo: 'Em preparo' },
  { status: 'READY', titulo: 'Prontos' },
  { status: 'OUT_FOR_DELIVERY', titulo: 'Em entrega' },
];

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function TelaDaCozinha({
  iniciais,
  estacoes,
  marcas,
}: {
  iniciais: PedidoKds[];
  estacoes: Estacao[];
  marcas: MarcaKds[];
}) {
  const [pedidos, setPedidos] = useState(iniciais);
  const [aoVivo, setAoVivo] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  /** Filtros: "" = tudo. */
  const [estacao, setEstacao] = useState('');
  const [marca, setMarca] = useState('');

  /** Códigos que chegaram agora — ganham destaque por alguns segundos. */
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const conhecidos = useRef(new Set(iniciais.map((p) => p.code)));

  const recarregar = useCallback(async () => {
    const params = new URLSearchParams();
    if (estacao) params.set('estacao', estacao);
    if (marca) params.set('marca', marca);

    try {
      const res = await fetch(`/api/orders/kds?${params}`, { cache: 'no-store' });
      if (!res.ok) return;
      const lista: PedidoKds[] = await res.json();

      // Descobre quais são novidade para destacar na tela.
      const novidades = lista.filter((p) => !conhecidos.current.has(p.code)).map((p) => p.code);
      if (novidades.length > 0) {
        novidades.forEach((c) => conhecidos.current.add(c));
        setNovos((atual) => new Set([...atual, ...novidades]));
        setTimeout(() => {
          setNovos((atual) => {
            const copia = new Set(atual);
            novidades.forEach((c) => copia.delete(c));
            return copia;
          });
        }, 8000);
      }

      setPedidos(lista);
    } catch {
      /* rede oscilou: mantém a tela como está */
    }
  }, [estacao, marca]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  /**
   * Escuta o servidor. Pedido novo ou mudança de situação chega aqui e a tela
   * se atualiza sozinha — ninguém precisa apertar F5 na cozinha.
   */
  useEffect(() => {
    const fonte = new EventSource('/api/orders/stream');

    fonte.onopen = () => setAoVivo(true);
    fonte.onerror = () => setAoVivo(false);
    fonte.onmessage = (evento) => {
      try {
        if (JSON.parse(evento.data).type === 'ping') return;
        recarregar();
      } catch {
        /* ignora */
      }
    };

    return () => fonte.close();
  }, [recarregar]);

  async function mudar(pedido: PedidoKds, status: string) {
    setOcupado(pedido.id);
    try {
      await fetch(`/api/orders/${pedido.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await recarregar();
    } finally {
      setOcupado(null);
    }
  }

  const nomeDaEstacao = estacoes.find((e) => e.id === estacao)?.name;

  return (
    <main className="kds">
      <header className="topbar">
        <div>
          <h1 className="title">
            Cozinha{nomeDaEstacao ? ` · ${nomeDaEstacao}` : ''}
          </h1>
          <span className="ao-vivo">
            <span className="pulso" style={{ background: aoVivo ? 'var(--ok)' : 'var(--muted)' }} />
            {aoVivo ? 'Ao vivo' : 'Reconectando…'} · {pedidos.length}{' '}
            {pedidos.length === 1 ? 'pedido' : 'pedidos'} em andamento
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/pedidos">
            <button className="ghost">Todos os pedidos</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {/* Estações: cada tela da cozinha vê só o que é dela */}
      <div className="canais" style={{ padding: '0 0 12px' }}>
        <button
          className="canal-aba"
          data-ativo={estacao === ''}
          onClick={() => setEstacao('')}
          style={{ cursor: 'pointer' }}
        >
          Todas as estações
        </button>
        {estacoes.map((e) => (
          <button
            key={e.id}
            className="canal-aba"
            data-ativo={estacao === e.id}
            onClick={() => setEstacao(e.id)}
            style={{ cursor: 'pointer' }}
          >
            {e.name}
          </button>
        ))}
      </div>

      {/* Marcas: filas separadas por marca */}
      {marcas.length > 1 && (
        <div className="filtros" style={{ marginBottom: 18 }}>
          <select value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Todas as marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {pedidos.length === 0 && (
        <p className="vazio">
          Nenhum pedido em andamento{nomeDaEstacao ? ` na estação ${nomeDaEstacao}` : ''}. Faça um
          pedido pelo cardápio e ele aparece aqui sozinho.
        </p>
      )}

      <div className="kds-colunas">
        {COLUNAS.map((coluna) => {
          const daColuna = pedidos.filter((p) => p.status === coluna.status);
          return (
            <div className="kds-coluna" key={coluna.status}>
              <h3>
                {coluna.titulo}
                <span>{daColuna.length}</span>
              </h3>

              {daColuna.map((pedido) => (
                <article
                  className={`comanda ${novos.has(pedido.code) ? 'novo' : ''}`}
                  key={pedido.id}
                  style={{ borderLeft: `3px solid ${pedido.brand?.primaryColor ?? 'transparent'}` }}
                >
                  <div className="comanda-topo">
                    <span className="comanda-codigo">{pedido.code}</span>
                    <span className="comanda-hora">{hora(pedido.createdAt)}</span>
                  </div>

                  <div className="marca-tag" style={{ fontSize: 12, marginBottom: 8 }}>
                    <span
                      className="dot"
                      style={{ background: pedido.brand?.primaryColor ?? 'var(--muted)' }}
                    />
                    <strong>{pedido.brand?.name}</strong>
                    <span style={{ color: 'var(--muted)' }}>· {pedido.channelLabel}</span>
                  </div>

                  {pedido.scheduledFor && (
                    <div className="agendado">
                      Agendado{' '}
                      {new Date(pedido.scheduledFor).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}

                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                    {pedido.customerName}
                  </div>

                  <ul>
                    {pedido.items.map((i) => (
                      <li key={i.id}>
                        <strong>{i.quantity}×</strong> {i.name}
                        {/* Sem filtro de estação, mostramos para onde cada linha vai */}
                        {!estacao && i.stationName && (
                          <span className="estacao-tag">{i.stationName}</span>
                        )}
                        {i.modifiers.length > 0 && (
                          <em>{i.modifiers.map((m) => m.name).join(' · ')}</em>
                        )}
                        {i.notes && <em>obs: {i.notes}</em>}
                      </li>
                    ))}
                  </ul>

                  {pedido.notes && (
                    <div style={{ fontSize: 12.5, color: 'var(--brand)', marginBottom: 10 }}>
                      Obs. do pedido: {pedido.notes}
                    </div>
                  )}

                  <div className="acoes">
                    {pedido.proximoStatus && (
                      <button
                        disabled={ocupado === pedido.id}
                        onClick={() => mudar(pedido, pedido.proximoStatus!)}
                      >
                        {pedido.proximoStatusLabel}
                      </button>
                    )}
                    <button
                      className="cancelar"
                      disabled={ocupado === pedido.id}
                      onClick={() => mudar(pedido, 'CANCELED')}
                      title="Cancelar pedido"
                    >
                      ✕
                    </button>
                  </div>
                </article>
              ))}
            </div>
          );
        })}
      </div>
    </main>
  );
}
