'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

/**
 * Cartão de cada marca no painel, com o BOTÃO DE PAUSAR.
 *
 * Pausar tira o cardápio do ar na hora e recusa pedidos novos — é o botão de
 * emergência de quando a cozinha entope ou acaba o gás.
 */
type Listagem = {
  ativo: boolean;
  categoria: string | null;
  comissaoPercentual: number;
  pedidosDoPortal: number;
};

export function Marcas({ iniciais }: { iniciais: MarcaResumo[] }) {
  const [marcas, setMarcas] = useState(iniciais);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [portal, setPortal] = useState<Record<string, Listagem>>({});

  /** Busca a situação de cada marca no portal da rede. */
  const carregarPortal = useCallback(async () => {
    const mapa: Record<string, Listagem> = {};
    await Promise.all(
      iniciais.map(async (m) => {
        try {
          const res = await fetch(`/api/portal-admin/listagem/${m.id}`, { cache: 'no-store' });
          if (res.ok) mapa[m.id] = await res.json();
        } catch {
          /* ignora */
        }
      }),
    );
    setPortal(mapa);
  }, [iniciais]);

  useEffect(() => {
    carregarPortal();
  }, [carregarPortal]);

  async function recarregar() {
    try {
      const res = await fetch('/api/brands', { cache: 'no-store' });
      if (res.ok) setMarcas(await res.json());
      await carregarPortal();
    } catch {
      /* mantém a tela */
    }
  }

  /** Liga ou desliga a marca na vitrine do portal. */
  async function alternarPortal(marca: MarcaResumo) {
    const atual = portal[marca.id];
    setOcupada(marca.id);
    try {
      await fetch(`/api/portal-admin/listagem/${marca.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: !atual?.ativo,
          category: atual?.categoria ?? 'Outros',
        }),
      });
      await carregarPortal();
    } finally {
      setOcupada(null);
    }
  }

  async function alternarPausa(marca: MarcaResumo) {
    setOcupada(marca.id);
    try {
      await fetch(`/api/brands/${marca.id}/pausa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paused: !marca.paused,
          reason: !marca.paused ? 'Pausada pelo painel' : undefined,
        }),
      });
      await recarregar();
    } finally {
      setOcupada(null);
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="stat-label">Marcas desta empresa</div>

      {marcas.length === 0 && <p className="subtitle">Nenhuma marca cadastrada.</p>}

      {marcas.map((m) => (
        <div
          className="marca-card"
          key={m.id}
          style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}
        >
          <span className="dot" style={{ background: m.primaryColor, marginTop: 5 }} />

          <div className="corpo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>{m.name}</strong>
              {m.paused && (
                <span className="situacao" data-status="CANCELED">
                  Pausada
                </span>
              )}
            </div>

            {m.paused && m.pausedReason && (
              <div className="sub" style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>
                {m.pausedReason}
              </div>
            )}

            {/* Portal da rede — o opt-in da marca */}
            <div className="canal-linha" style={{ marginTop: 6 }}>
              <b>Portal da rede</b>{' '}
              <span className={portal[m.id]?.ativo ? 'aberto-sim' : 'aberto-nao'}>
                {portal[m.id]?.ativo ? 'na vitrine' : 'fora'}
              </span>
              {portal[m.id]?.ativo && (
                <>
                  {' · '}
                  {portal[m.id].categoria} · comissão {portal[m.id].comissaoPercentual}% ·{' '}
                  {portal[m.id].pedidosDoPortal} pedido(s) vindos de lá ·{' '}
                  <Link href="/portal">ver vitrine</Link>
                </>
              )}
              {' · '}
              <button
                className="remover"
                disabled={ocupada === m.id}
                onClick={() => alternarPortal(m)}
              >
                {portal[m.id]?.ativo ? 'sair do portal' : 'entrar no portal'}
              </button>
            </div>

            {/* Um canal por linha: cada um abre e fecha na sua hora */}
            <div style={{ marginTop: 8 }}>
              {m.canais.map((c) => (
                <div className="canal-linha" key={c.channel}>
                  <b>{c.label}</b>{' '}
                  <span className={c.aberto ? 'aberto-sim' : 'aberto-nao'}>
                    {c.aberto ? 'aberto' : 'fechado'}
                  </span>
                  {c.horarioDeHoje && ` · ${c.horarioDeHoje}`}
                  {!c.aberto && c.motivo && !c.horarioDeHoje && ` · ${c.motivo}`}
                  {' · '}
                  <Link href={`/m/${m.slug}?canal=${c.apelido}`}>ver cardápio</Link>
                </div>
              ))}
            </div>
          </div>

          <button
            className="botao-pausa"
            data-pausada={m.paused}
            disabled={ocupada === m.id}
            onClick={() => alternarPausa(m)}
          >
            {ocupada === m.id ? '…' : m.paused ? 'Reabrir' : 'Pausar'}
          </button>
        </div>
      ))}

      <p className="hint">
        Pausar tira o cardápio do ar na hora e recusa pedidos novos. Os pedidos que já entraram
        continuam normalmente.
      </p>
    </section>
  );
}
