'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

export type Cupom = {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  minOrderCents: number;
  maxDiscountCents: number;
  segment: string;
  inactiveDays: number;
  weekdays: number[];
  usedCount: number;
  usageLimit: number;
  active: boolean;
  _count?: { redemptions: number };
};

export type Campanha = {
  id: string;
  name: string;
  message: string;
  segment: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  brand?: { name: string; primaryColor: string };
};

export type Nps = {
  nps: number | null;
  total: number;
  enviadas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  respostas: Array<{
    id: string;
    nota: number | null;
    comentario: string | null;
    cliente: string;
    marca: string;
    pedido: string;
    quando: string | null;
  }>;
};

export type Mensagem = {
  id: string;
  kind: string;
  to: string;
  body: string;
  status: string;
  createdAt: string;
  customer?: { name: string } | null;
};

export type Carrinho = {
  id: string;
  name: string | null;
  phone: string | null;
  subtotalCents: number;
  status: string;
  updatedAt: string;
  brand?: { name: string };
};

const SEGMENTOS = [
  { valor: 'ALL', label: 'Todos os clientes' },
  { valor: 'NEW', label: 'Novos (1 pedido)' },
  { valor: 'RECURRING', label: 'Recorrentes (3+)' },
  { valor: 'INACTIVE', label: 'Inativos' },
  { valor: 'FIRST_ORDER', label: 'Ainda não pediram' },
];

const TIPOS_CUPOM = [
  { valor: 'PERCENT', label: 'Percentual (%)' },
  { valor: 'FIXED', label: 'Valor fixo (R$)' },
  { valor: 'FREE_DELIVERY', label: 'Frete grátis' },
];

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function data(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function descreverCupom(c: Cupom) {
  if (c.type === 'FREE_DELIVERY') return 'frete grátis';
  if (c.type === 'PERCENT') {
    return `${c.value / 100}%${c.maxDiscountCents > 0 ? ` (máx. ${dinheiro(c.maxDiscountCents)})` : ''}`;
  }
  return dinheiro(c.value);
}

export function TelaDeMarketing({
  cuponsIniciais,
  campanhasIniciais,
  npsInicial,
  mensagensIniciais,
  carrinhosIniciais,
  marcas,
}: {
  cuponsIniciais: Cupom[];
  campanhasIniciais: Campanha[];
  npsInicial: Nps | null;
  mensagensIniciais: Mensagem[];
  carrinhosIniciais: Carrinho[];
  marcas: MarcaResumo[];
}) {
  const [aba, setAba] = useState<'cupons' | 'campanhas' | 'nps' | 'mensagens'>('cupons');
  const [cupons, setCupons] = useState(cuponsIniciais);
  const [campanhas, setCampanhas] = useState(campanhasIniciais);
  const [nps, setNps] = useState(npsInicial);
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const [carrinhos, setCarrinhos] = useState(carrinhosIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [c, k, n, m, a] = await Promise.all([
        fetch('/api/marketing/cupons', { cache: 'no-store' }),
        fetch('/api/marketing/campanhas', { cache: 'no-store' }),
        fetch('/api/marketing/nps', { cache: 'no-store' }),
        fetch('/api/marketing/mensagens?limite=50', { cache: 'no-store' }),
        fetch('/api/marketing/carrinhos', { cache: 'no-store' }),
      ]);
      if (c.ok) setCupons(await c.json());
      if (k.ok) setCampanhas(await k.json());
      if (n.ok) setNps(await n.json());
      if (m.ok) setMensagens(await m.json());
      if (a.ok) setCarrinhos(await a.json());
    } catch {
      /* mantém a tela */
    }
  }, []);

  /** Enquanto uma campanha está disparando, atualiza sozinho. */
  useEffect(() => {
    const disparando = campanhas.some((c) => c.status === 'QUEUED' || c.status === 'SENDING');
    if (!disparando) return;
    const t = setInterval(recarregar, 2000);
    return () => clearInterval(t);
  }, [campanhas, recarregar]);

  async function chamar(url: string, corpo?: unknown, metodo = 'POST') {
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch(url, {
        method: metodo,
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(Array.isArray(d.message) ? d.message[0] : (d.message ?? 'Não deu certo.'));
        return null;
      }
      await recarregar();
      return d;
    } catch {
      setErro('O servidor não respondeu.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="shell" style={{ maxWidth: 1100 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Marketing</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Cupons, campanhas, satisfação e recuperação de carrinho.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/clientes">
            <button className="ghost">Clientes</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {erro && <div className="error">{erro}</div>}

      <nav className="canais" style={{ padding: '0 0 18px' }}>
        {(
          [
            ['cupons', 'Cupons'],
            ['campanhas', 'Campanhas'],
            ['nps', 'Satisfação'],
            ['mensagens', 'Enviadas'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className="canal-aba" data-ativo={aba === id} onClick={() => setAba(id)}>
            {label}
          </button>
        ))}
      </nav>

      {/* ------------------------------- CUPONS ------------------------------- */}
      {aba === 'cupons' && (
        <>
          <FormularioCupom marcas={marcas} ocupado={ocupado} aoCriar={(d) => chamar('/api/marketing/cupons', d)} />

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Desconto</th>
                  <th>Para quem</th>
                  <th>Regras</th>
                  <th style={{ textAlign: 'right' }}>Usos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cupons.map((c) => (
                  <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                    <td>
                      <strong className="codigo">{c.code}</strong>
                      <div className="sub">{c.description}</div>
                    </td>
                    <td>{descreverCupom(c)}</td>
                    <td>{SEGMENTOS.find((s) => s.valor === c.segment)?.label ?? c.segment}</td>
                    <td className="sub">
                      {c.minOrderCents > 0 && <div>mín. {dinheiro(c.minOrderCents)}</div>}
                      {c.weekdays.length > 0 && <div>{c.weekdays.map((d) => DIAS[d]).join(', ')}</div>}
                      {c.segment === 'INACTIVE' && <div>{c.inactiveDays} dias sem pedir</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {c.usedCount}
                      {c.usageLimit > 0 ? ` / ${c.usageLimit}` : ''}
                    </td>
                    <td>
                      <button
                        className="ghost"
                        disabled={ocupado}
                        onClick={() => chamar(`/api/marketing/cupons/${c.id}`, { active: !c.active }, 'PATCH')}
                      >
                        {c.active ? 'Desligar' : 'Ligar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ----------------------------- CAMPANHAS ------------------------------ */}
      {aba === 'campanhas' && (
        <>
          <FormularioCampanha
            marcas={marcas}
            ocupado={ocupado}
            aoCriar={(d) => chamar('/api/marketing/campanhas', d)}
          />

          {campanhas.length === 0 && <p className="vazio">Nenhuma campanha ainda.</p>}

          {campanhas.map((c) => (
            <section className="card" key={c.id} style={{ marginBottom: 12 }}>
              <div className="comanda-topo">
                <div>
                  <strong style={{ fontSize: 15 }}>{c.name}</strong>
                  <div className="sub">
                    {c.brand?.name} · {SEGMENTOS.find((s) => s.valor === c.segment)?.label} ·{' '}
                    {data(c.createdAt)}
                  </div>
                </div>
                <span className="situacao" data-status={c.status === 'DONE' ? 'DELIVERED' : 'RECEIVED'}>
                  {c.status === 'DRAFT'
                    ? 'rascunho'
                    : c.status === 'QUEUED'
                      ? 'na fila'
                      : c.status === 'SENDING'
                        ? 'enviando…'
                        : c.status === 'DONE'
                          ? 'concluída'
                          : c.status.toLowerCase()}
                </span>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--muted)', whiteSpace: 'pre-wrap', margin: '4px 0 12px' }}>
                {c.message}
              </p>

              {c.recipientCount > 0 && (
                <div className="totais" style={{ padding: 0 }}>
                  <span>
                    {c.sentCount} enviadas · {c.failedCount} falhas
                  </span>
                  <span>de {c.recipientCount}</span>
                </div>
              )}

              {c.status === 'DRAFT' && (
                <button
                  disabled={ocupado}
                  onClick={() => chamar(`/api/marketing/campanhas/${c.id}/disparar`)}
                  style={{ marginTop: 10 }}
                >
                  Disparar agora
                </button>
              )}
            </section>
          ))}
        </>
      )}

      {/* -------------------------------- NPS --------------------------------- */}
      {aba === 'nps' && nps && (
        <>
          <section className="grid" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="stat-label">NPS</div>
              <div className="nps-numero" style={{ color: (nps.nps ?? 0) >= 50 ? 'var(--ok)' : (nps.nps ?? 0) >= 0 ? '#eab308' : 'var(--danger)' }}>
                {nps.nps ?? '—'}
              </div>
              <div className="barra-nps">
                {nps.total > 0 && (
                  <>
                    <i style={{ width: `${(nps.promotores / nps.total) * 100}%`, background: 'var(--ok)' }} />
                    <i style={{ width: `${(nps.neutros / nps.total) * 100}%`, background: '#eab308' }} />
                    <i style={{ width: `${(nps.detratores / nps.total) * 100}%`, background: 'var(--danger)' }} />
                  </>
                )}
              </div>
              <div className="sub">
                {nps.promotores} promotores · {nps.neutros} neutros · {nps.detratores} detratores
              </div>
            </div>
            <div className="card">
              <div className="stat-label">Respostas</div>
              <div className="stat-value">
                {nps.total} <span style={{ fontSize: 14, color: 'var(--muted)' }}>de {nps.enviadas}</span>
              </div>
            </div>
            <div className="card">
              <div className="stat-label">Carrinhos abandonados</div>
              <div className="stat-value">{carrinhos.filter((c) => c.status !== 'RECOVERED').length}</div>
              <div className="sub">{carrinhos.filter((c) => c.status === 'RECOVERED').length} recuperados</div>
            </div>
          </section>

          <section className="card">
            <div className="stat-label">Últimas respostas</div>
            {nps.respostas.length === 0 && <p className="subtitle">Ninguém respondeu ainda.</p>}
            {nps.respostas.map((r) => (
              <div className="chamado" key={r.id}>
                <span
                  className="nota"
                  data-ativa="true"
                  data-faixa={(r.nota ?? 0) <= 6 ? 'baixa' : (r.nota ?? 0) <= 8 ? 'media' : 'alta'}
                  style={{ width: 42, flex: 'none' }}
                >
                  {r.nota}
                </span>
                <span className="qual">
                  <strong>{r.cliente}</strong> · {r.marca} · pedido {r.pedido}
                  {r.comentario && <div style={{ fontSize: 13.5 }}>"{r.comentario}"</div>}
                  <div className="sub">{data(r.quando)}</div>
                </span>
              </div>
            ))}
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="stat-label">Carrinhos parados</div>
            {carrinhos.length === 0 && <p className="subtitle">Nenhum carrinho abandonado.</p>}
            {carrinhos.map((c) => (
              <div className="chamado" key={c.id}>
                <span className="qual">
                  <strong>{c.name ?? 'Sem nome'}</strong> · {dinheiro(c.subtotalCents)}
                  <div className="sub">
                    {c.phone ?? 'sem telefone'} · {c.brand?.name} · {data(c.updatedAt)}
                  </div>
                </span>
                <span className="situacao" data-status={c.status === 'RECOVERED' ? 'DELIVERED' : 'AWAITING_PAYMENT'}>
                  {c.status === 'OPEN'
                    ? 'parado'
                    : c.status === 'NOTIFIED'
                      ? 'lembrete enviado'
                      : c.status === 'RECOVERED'
                        ? 'recuperado'
                        : 'expirado'}
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      {/* ----------------------------- MENSAGENS ------------------------------ */}
      {aba === 'mensagens' && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Tudo que o sistema mandou. O WhatsApp ainda é <strong>fake</strong>: nada sai da sua
            máquina — as mensagens aparecem aqui e no log do backend.
          </p>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Para</th>
                  <th>Mensagem</th>
                  <th>Situação</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {mensagens.map((m) => (
                  <tr key={m.id}>
                    <td className="sub">
                      {m.kind === 'CAMPAIGN'
                        ? '📣 campanha'
                        : m.kind === 'CART_RECOVERY'
                          ? '🛒 carrinho'
                          : m.kind === 'NPS'
                            ? '⭐ pesquisa'
                            : m.kind}
                    </td>
                    <td>
                      {m.customer?.name ?? '—'}
                      <div className="sub">{m.to}</div>
                    </td>
                    <td style={{ maxWidth: 420, whiteSpace: 'pre-wrap', fontSize: 13 }}>{m.body}</td>
                    <td>
                      <span
                        className="situacao"
                        data-status={m.status === 'SENT' ? 'DELIVERED' : m.status === 'FAILED' ? 'CANCELED' : 'RECEIVED'}
                      >
                        {m.status === 'SENT' ? 'enviada' : m.status === 'FAILED' ? 'falhou' : 'na fila'}
                      </span>
                    </td>
                    <td className="sub">{data(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

/** Criar cupom. */
function FormularioCupom({
  marcas,
  ocupado,
  aoCriar,
}: {
  marcas: MarcaResumo[];
  ocupado: boolean;
  aoCriar: (d: unknown) => Promise<unknown>;
}) {
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({
    brandId: marcas[0]?.id ?? '',
    code: '',
    description: '',
    type: 'PERCENT',
    valor: '10',
    minOrderCents: '30',
    segment: 'ALL',
  });

  if (!aberto) {
    return (
      <button className="ghost" style={{ marginBottom: 16 }} onClick={() => setAberto(true)}>
        + Novo cupom
      </button>
    );
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="stat-label">Novo cupom</div>

      <div className="form-linha">
        <div>
          <label>Marca</label>
          <select
            value={f.brandId}
            onChange={(e) => setF({ ...f, brandId: e.target.value })}
            style={{ width: '100%' }}
          >
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Código</label>
          <input
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
            placeholder="PROMO10"
          />
        </div>
      </div>

      <label>Descrição</label>
      <input
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
        placeholder="10% de desconto"
      />

      <div className="form-linha">
        <div>
          <label>Tipo</label>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} style={{ width: '100%' }}>
            {TIPOS_CUPOM.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>{f.type === 'PERCENT' ? 'Percentual (%)' : 'Valor (R$)'}</label>
          <input
            type="number"
            value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value })}
            disabled={f.type === 'FREE_DELIVERY'}
          />
        </div>
      </div>

      <div className="form-linha">
        <div>
          <label>Pedido mínimo (R$)</label>
          <input
            type="number"
            value={f.minOrderCents}
            onChange={(e) => setF({ ...f, minOrderCents: e.target.value })}
          />
        </div>
        <div>
          <label>Para quem</label>
          <select
            value={f.segment}
            onChange={(e) => setF({ ...f, segment: e.target.value })}
            style={{ width: '100%' }}
          >
            {SEGMENTOS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          disabled={ocupado || !f.code.trim()}
          onClick={async () => {
            const ok = await aoCriar({
              brandId: f.brandId,
              code: f.code,
              description: f.description,
              type: f.type,
              value: f.type === 'PERCENT' ? Number(f.valor) * 100 : Number(f.valor) * 100,
              minOrderCents: Number(f.minOrderCents) * 100,
              segment: f.segment,
            });
            if (ok) {
              setAberto(false);
              setF({ ...f, code: '', description: '' });
            }
          }}
        >
          Criar cupom
        </button>
        <button className="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </section>
  );
}

/** Criar campanha. */
function FormularioCampanha({
  marcas,
  ocupado,
  aoCriar,
}: {
  marcas: MarcaResumo[];
  ocupado: boolean;
  aoCriar: (d: unknown) => Promise<unknown>;
}) {
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({
    brandId: marcas[0]?.id ?? '',
    name: '',
    message: 'Oi {nome}! Hoje tem novidade na nossa cozinha 🍝',
    segment: 'ALL',
  });

  if (!aberto) {
    return (
      <button className="ghost" style={{ marginBottom: 16 }} onClick={() => setAberto(true)}>
        + Nova campanha
      </button>
    );
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="stat-label">Nova campanha</div>

      <div className="form-linha">
        <div>
          <label>Marca</label>
          <select
            value={f.brandId}
            onChange={(e) => setF({ ...f, brandId: e.target.value })}
            style={{ width: '100%' }}
          >
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Para quem</label>
          <select
            value={f.segment}
            onChange={(e) => setF({ ...f, segment: e.target.value })}
            style={{ width: '100%' }}
          >
            {SEGMENTOS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label>Nome da campanha</label>
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Promoção de terça" />

      <label>Mensagem</label>
      <input
        value={f.message}
        onChange={(e) => setF({ ...f, message: e.target.value })}
        placeholder="Oi {nome}! ..."
      />
      <p className="hint" style={{ marginTop: 6 }}>
        Escreva <code>{'{nome}'}</code> onde quiser o primeiro nome do cliente.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          disabled={ocupado || !f.name.trim() || !f.message.trim()}
          onClick={async () => {
            const ok = await aoCriar(f);
            if (ok) {
              setAberto(false);
              setF({ ...f, name: '' });
            }
          }}
        >
          Criar (fica como rascunho)
        </button>
        <button className="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
