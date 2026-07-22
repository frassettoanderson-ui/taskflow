'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';

export type Entregador = {
  id: string;
  nome: string;
  telefone: string;
  veiculo: string;
  formaDePagamento: string;
  formaLabel: string;
  fixedPayCents: number;
  ativo: boolean;
  emRota: number;
};

export type Corrida = {
  id: string;
  status: string;
  rastreio: string;
  distanciaKm: number | null;
  pagamentoCents: number;
  entregador: { id: string; name: string; phone: string; vehicle: string } | null;
  pedido: {
    code: string;
    customerName: string;
    addressStreet: string | null;
    addressNumber: string | null;
    addressDistrict: string | null;
    totalCents: number;
    deliveryFeeCents: number;
    brand: { name: string; primaryColor: string };
  };
  atribuidoEm: string | null;
  saiuEm: string | null;
  entregueEm: string | null;
  acertado: boolean;
};

export type PedidoSemEntregador = {
  id: string;
  code: string;
  status: string;
  customerName: string;
  addressStreet: string | null;
  addressNumber: string | null;
  addressDistrict: string | null;
  deliveryFeeCents: number;
  totalCents: number;
  brand: { name: string; primaryColor: string };
};

const STATUS_CORRIDA: Record<string, string> = {
  SEARCHING: 'procurando',
  ASSIGNED: 'com o motoboy',
  PICKED_UP: 'a caminho',
  DELIVERED: 'entregue',
  CANCELED: 'cancelada',
};

const PROXIMO: Record<string, { status: string; label: string }> = {
  ASSIGNED: { status: 'PICKED_UP', label: 'Saiu para entrega' },
  PICKED_UP: { status: 'DELIVERED', label: 'Entregou' },
};

function hora(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TelaDeEntregas({
  entregadoresIniciais,
  corridasIniciais,
  semEntregadorIniciais,
}: {
  entregadoresIniciais: Entregador[];
  corridasIniciais: Corrida[];
  semEntregadorIniciais: PedidoSemEntregador[];
}) {
  const [entregadores, setEntregadores] = useState(entregadoresIniciais);
  const [corridas, setCorridas] = useState(corridasIniciais);
  const [semEntregador, setSemEntregador] = useState(semEntregadorIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState(false);
  const [escolhido, setEscolhido] = useState<Record<string, string>>({});

  const recarregar = useCallback(async () => {
    try {
      const [e, c, s] = await Promise.all([
        fetch('/api/gestao/entregadores', { cache: 'no-store' }),
        fetch('/api/gestao/entregas', { cache: 'no-store' }),
        fetch('/api/gestao/entregas/sem-entregador', { cache: 'no-store' }),
      ]);
      if (e.ok) setEntregadores(await e.json());
      if (c.ok) setCorridas(await c.json());
      if (s.ok) setSemEntregador(await s.json());
    } catch {
      /* mantém a tela */
    }
  }, []);

  /** Pedido novo pronto para sair aparece aqui sozinho. */
  useEffect(() => {
    const fonte = new EventSource('/api/orders/stream');
    fonte.onmessage = (ev) => {
      try {
        if (JSON.parse(ev.data).type === 'ping') return;
        recarregar();
      } catch {
        /* ignora */
      }
    };
    return () => fonte.close();
  }, [recarregar]);

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

  const emAndamento = corridas.filter((c) => c.status === 'ASSIGNED' || c.status === 'PICKED_UP');
  const finalizadas = corridas.filter((c) => c.status === 'DELIVERED' || c.status === 'CANCELED');

  return (
    <main className="shell" style={{ maxWidth: 1100 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Entregas</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {emAndamento.length} em rota · {semEntregador.length} esperando entregador
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/financeiro">
            <button className="ghost">Financeiro</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {erro && <div className="error">{erro}</div>}

      {/* ------------------- pedidos esperando entregador ------------------- */}
      {semEntregador.length > 0 && (
        <section className="card" style={{ marginBottom: 18, borderColor: 'rgba(249,115,22,.4)' }}>
          <div className="stat-label">Esperando entregador ({semEntregador.length})</div>
          {semEntregador.map((p) => (
            <div className="chamado" key={p.id}>
              <span className="qual">
                <strong className="codigo">{p.code}</strong> · {p.customerName}
                <div className="sub">
                  {p.addressStreet}, {p.addressNumber} — {p.addressDistrict} · frete{' '}
                  {dinheiro(p.deliveryFeeCents)}
                </div>
              </span>
              <select
                value={escolhido[p.id] ?? ''}
                onChange={(e) => setEscolhido({ ...escolhido, [p.id]: e.target.value })}
                style={{ padding: '7px 10px', fontSize: 13 }}
              >
                <option value="">Escolha o motoboy</option>
                {entregadores
                  .filter((e) => e.ativo)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome} · {e.formaLabel}
                    </option>
                  ))}
              </select>
              <button
                disabled={ocupado || !escolhido[p.id]}
                onClick={() =>
                  chamar('/api/gestao/entregas/atribuir', {
                    orderId: p.id,
                    courierId: escolhido[p.id],
                  })
                }
              >
                Atribuir
              </button>
            </div>
          ))}
        </section>
      )}

      {/* ------------------------- corridas em rota ------------------------- */}
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="stat-label">Em rota ({emAndamento.length})</div>
        {emAndamento.length === 0 && <p className="subtitle">Nenhuma entrega em andamento.</p>}
        {emAndamento.map((c) => (
          <div className="chamado" key={c.id}>
            <span className="qual">
              <strong className="codigo">{c.pedido.code}</strong> · {c.entregador?.name}
              <div className="sub">
                {c.pedido.addressDistrict} · {c.distanciaKm ?? '?'} km · motoboy recebe{' '}
                {dinheiro(c.pagamentoCents)} · rastreio <strong>{c.rastreio}</strong>
              </div>
            </span>
            <span className="situacao" data-status={c.status === 'PICKED_UP' ? 'OUT_FOR_DELIVERY' : 'ACCEPTED'}>
              {STATUS_CORRIDA[c.status]}
            </span>
            {PROXIMO[c.status] && (
              <button
                disabled={ocupado}
                onClick={() =>
                  chamar(`/api/gestao/entregas/${c.id}/status`, { status: PROXIMO[c.status].status }, 'PATCH')
                }
              >
                {PROXIMO[c.status].label}
              </button>
            )}
          </div>
        ))}
      </section>

      {/* --------------------------- entregadores --------------------------- */}
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="grupo-cabecalho">
          <div className="stat-label" style={{ margin: 0 }}>
            Entregadores
          </div>
          {!novo && (
            <button className="ghost" onClick={() => setNovo(true)} style={{ width: 'auto' }}>
              + Novo
            </button>
          )}
        </div>

        {novo && (
          <FormularioEntregador
            ocupado={ocupado}
            onCancelar={() => setNovo(false)}
            onCriar={async (d) => {
              const ok = await chamar('/api/gestao/entregadores', d);
              if (ok) setNovo(false);
            }}
          />
        )}

        {entregadores.map((e) => (
          <div className="chamado" key={e.id}>
            <span className="qual">
              <strong>{e.nome}</strong> · {e.veiculo}
              <div className="sub">
                {e.telefone} · {e.formaLabel} · {e.emRota} em rota
              </div>
            </span>
            <AcertoRapido
              entregador={e}
              ocupado={ocupado}
              onFechar={(d) => chamar('/api/gestao/acertos/motoboy', d)}
            />
          </div>
        ))}
      </section>

      {/* --------------------------- finalizadas ---------------------------- */}
      {finalizadas.length > 0 && (
        <section className="card">
          <div className="stat-label">Finalizadas</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Entregador</th>
                  <th>Bairro</th>
                  <th style={{ textAlign: 'right' }}>km</th>
                  <th style={{ textAlign: 'right' }}>Motoboy</th>
                  <th>Entregue</th>
                  <th>Acerto</th>
                </tr>
              </thead>
              <tbody>
                {finalizadas.map((c) => (
                  <tr key={c.id}>
                    <td className="codigo">{c.pedido.code}</td>
                    <td>{c.entregador?.name ?? '—'}</td>
                    <td className="sub">{c.pedido.addressDistrict}</td>
                    <td style={{ textAlign: 'right' }}>{c.distanciaKm ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{dinheiro(c.pagamentoCents)}</td>
                    <td className="sub">{hora(c.entregueEm)}</td>
                    <td>
                      <span className="situacao" data-status={c.acertado ? 'DELIVERED' : 'AWAITING_PAYMENT'}>
                        {c.acertado ? 'acertado' : 'a acertar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

/** Fechar o acerto de um entregador num período. */
function AcertoRapido({
  entregador,
  ocupado,
  onFechar,
}: {
  entregador: Entregador;
  ocupado: boolean;
  onFechar: (d: unknown) => Promise<unknown>;
}) {
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(hoje());
  const [ate, setAte] = useState(hoje());

  if (!aberto) {
    return (
      <button className="ghost" disabled={ocupado} onClick={() => setAberto(true)}>
        Fechar acerto
      </button>
    );
  }

  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ marginBottom: 0, padding: '6px 8px', fontSize: 12.5 }} />
      <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ marginBottom: 0, padding: '6px 8px', fontSize: 12.5 }} />
      <button
        disabled={ocupado}
        onClick={async () => {
          const ok = await onFechar({ courierId: entregador.id, de, ate });
          if (ok) setAberto(false);
        }}
      >
        Fechar
      </button>
      <button className="ghost" onClick={() => setAberto(false)}>
        ✕
      </button>
    </span>
  );
}

function FormularioEntregador({
  ocupado,
  onCriar,
  onCancelar,
}: {
  ocupado: boolean;
  onCriar: (d: unknown) => Promise<void>;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({
    name: '',
    phone: '',
    vehicle: 'Moto',
    payModel: 'PERCENT_OF_FEE',
    fixo: '8',
  });

  return (
    <div className="grupo">
      <div className="form-linha">
        <div>
          <label>Nome</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="João" />
        </div>
        <div>
          <label>Telefone</label>
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="48 99999-0000" />
        </div>
      </div>

      <div className="form-linha">
        <div>
          <label>Como recebe</label>
          <select
            value={f.payModel}
            onChange={(e) => setF({ ...f, payModel: e.target.value })}
            style={{ width: '100%' }}
          >
            <option value="PERCENT_OF_FEE">Fatia do frete</option>
            <option value="FIXED_PER_DELIVERY">Valor fixo por entrega</option>
          </select>
        </div>
        <div>
          <label>Valor fixo (R$)</label>
          <input
            type="number"
            step="0.01"
            value={f.fixo}
            onChange={(e) => setF({ ...f, fixo: e.target.value })}
            disabled={f.payModel !== 'FIXED_PER_DELIVERY'}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          disabled={ocupado || !f.name.trim() || !f.phone.trim()}
          onClick={() =>
            onCriar({
              name: f.name,
              phone: f.phone,
              vehicle: f.vehicle,
              payModel: f.payModel,
              fixedPayCents: Math.round(Number(f.fixo) * 100),
            })
          }
        >
          Criar entregador
        </button>
        <button className="ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
