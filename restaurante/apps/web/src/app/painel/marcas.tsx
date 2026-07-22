'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

/**
 * Cartão de cada marca no painel, com o BOTÃO DE PAUSAR.
 *
 * Pausar tira o cardápio do ar na hora e recusa pedidos novos — é o botão de
 * emergência de quando a cozinha entope ou acaba o gás.
 */
export function Marcas({ iniciais }: { iniciais: MarcaResumo[] }) {
  const [marcas, setMarcas] = useState(iniciais);
  const [ocupada, setOcupada] = useState<string | null>(null);

  async function recarregar() {
    try {
      const res = await fetch('/api/brands', { cache: 'no-store' });
      if (res.ok) setMarcas(await res.json());
    } catch {
      /* mantém a tela */
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
