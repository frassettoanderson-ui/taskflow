'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { dinheiro } from '../m/[slug]/cardapio';

export type MesaDoMapa = {
  id: string;
  numero: string;
  area: string;
  lugares: number;
  qrToken: string;
  status: string;
  marca: { id: string; name: string; primaryColor: string };
  comanda: {
    id: string;
    code: string;
    status: string;
    pessoas: number;
    totalCents: number;
    paidCents: number;
    abertaEm: string;
    garcom: string | null;
  } | null;
  chamados: Array<{ id: string; tipo: string; criadoEm: string }>;
};

export type Chamado = {
  id: string;
  tipo: string;
  mesa: string;
  area: string;
  nota: string | null;
  criadoEm: string;
};

export type FilaItem = {
  id: string;
  name: string;
  phone: string;
  guests: number;
  status: string;
  createdAt: string;
};

export type Reserva = {
  id: string;
  name: string;
  phone: string;
  guests: number;
  when: string;
  status: string;
  table: { number: string } | null;
};

/** Quem pode mexer em dinheiro (mesma regra do backend). */
const MEXE_COM_DINHEIRO = ['OWNER', 'MANAGER', 'CASHIER'];

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function haQuantoTempo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

export function MapaDeMesas({
  iniciais,
  chamadosIniciais,
  filaInicial,
  reservasIniciais,
  papel,
}: {
  iniciais: MesaDoMapa[];
  chamadosIniciais: Chamado[];
  filaInicial: FilaItem[];
  reservasIniciais: Reserva[];
  papel: string;
}) {
  const router = useRouter();
  const [mesas, setMesas] = useState(iniciais);
  const [chamados, setChamados] = useState(chamadosIniciais);
  const [fila, setFila] = useState(filaInicial);
  const [reservas, setReservas] = useState(reservasIniciais);
  const [aoVivo, setAoVivo] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const podePagar = MEXE_COM_DINHEIRO.includes(papel);

  const recarregar = useCallback(async () => {
    try {
      const [m, c, f, r] = await Promise.all([
        fetch('/api/salao/mesas', { cache: 'no-store' }),
        fetch('/api/salao/chamados', { cache: 'no-store' }),
        fetch('/api/salao/fila', { cache: 'no-store' }),
        fetch('/api/salao/reservas', { cache: 'no-store' }),
      ]);
      if (m.ok) setMesas(await m.json());
      if (c.ok) setChamados(await c.json());
      if (f.ok) setFila(await f.json());
      if (r.ok) setReservas(await r.json());
    } catch {
      /* mantém a tela */
    }
  }, []);

  /** Mesa aberta, chamado novo, conta paga — tudo aparece aqui sozinho. */
  useEffect(() => {
    const fonte = new EventSource('/api/orders/stream');
    fonte.onopen = () => setAoVivo(true);
    fonte.onerror = () => setAoVivo(false);
    fonte.onmessage = (e) => {
      try {
        if (JSON.parse(e.data).type === 'ping') return;
        recarregar();
      } catch {
        /* ignora */
      }
    };
    return () => fonte.close();
  }, [recarregar]);

  const areas = useMemo(() => {
    const mapa = new Map<string, MesaDoMapa[]>();
    for (const m of mesas) {
      if (!mapa.has(m.area)) mapa.set(m.area, []);
      mapa.get(m.area)!.push(m);
    }
    return [...mapa.entries()];
  }, [mesas]);

  const ocupadas = mesas.filter((m) => m.comanda).length;
  const emAberto = mesas.reduce((s, m) => s + (m.comanda?.totalCents ?? 0), 0);

  async function abrirMesa(mesa: MesaDoMapa) {
    setOcupado(mesa.id);
    try {
      await fetch(`/api/salao/mesas/${mesa.id}/abrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pessoas: 2 }),
      });
      await recarregar();
    } finally {
      setOcupado(null);
    }
  }

  async function atender(id: string) {
    await fetch(`/api/salao/chamados/${id}/atender`, { method: 'PATCH' });
    await recarregar();
  }

  async function mudarFila(id: string, status: string) {
    await fetch(`/api/salao/fila/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await recarregar();
  }

  async function mudarReserva(id: string, status: string) {
    await fetch(`/api/salao/reservas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await recarregar();
  }

  return (
    <main className="shell" style={{ maxWidth: 1100 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Salão</h1>
          <span className="ao-vivo">
            <span className="pulso" style={{ background: aoVivo ? 'var(--ok)' : 'var(--muted)' }} />
            {aoVivo ? 'Ao vivo' : 'Reconectando…'} · {ocupadas} de {mesas.length} mesas ocupadas ·{' '}
            {dinheiro(emAberto)} em aberto
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/kds">
            <button className="ghost">Cozinha</button>
          </Link>
          <Link href="/pedidos">
            <button className="ghost">Pedidos</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {/* ---------------- chamados ---------------- */}
      {chamados.length > 0 && (
        <section className="card" style={{ marginBottom: 18, borderColor: 'rgba(239,68,68,.4)' }}>
          <div className="stat-label">Chamados aguardando ({chamados.length})</div>
          {chamados.map((c) => (
            <div className="chamado" key={c.id}>
              <span style={{ fontSize: 20 }}>{c.tipo === 'BILL' ? '🧾' : '🙋'}</span>
              <span className="qual">
                <strong>Mesa {c.mesa}</strong> — {c.tipo === 'BILL' ? 'pediu a conta' : 'chamou o garçom'}
                <div className="sub">
                  {c.area} · há {haQuantoTempo(c.criadoEm)}
                </div>
              </span>
              <button onClick={() => atender(c.id)}>Atendi</button>
            </div>
          ))}
        </section>
      )}

      {/* ---------------- mapa ---------------- */}
      <div className="legenda">
        <span>
          <i style={{ borderColor: 'rgba(34,197,94,.6)' }} /> livre
        </span>
        <span>
          <i style={{ borderColor: 'rgba(249,115,22,.7)' }} /> ocupada
        </span>
        <span>
          <i style={{ borderColor: 'rgba(234,179,8,.7)' }} /> pediu a conta
        </span>
        <span>
          <i style={{ borderColor: 'rgba(59,130,246,.7)' }} /> reservada
        </span>
      </div>

      {areas.map(([area, doArea]) => (
        <section className="area-salao" key={area}>
          <h3>{area}</h3>
          <div className="mesas">
            {doArea.map((mesa) => (
              <button
                className="mesa"
                key={mesa.id}
                data-status={mesa.status}
                disabled={ocupado === mesa.id}
                onClick={() =>
                  mesa.comanda
                    ? router.push(`/salao/mesa/${mesa.qrToken}`)
                    : abrirMesa(mesa)
                }
              >
                {mesa.chamados.length > 0 && <span className="sino">{mesa.chamados.length}</span>}
                <div className="numero">{mesa.numero}</div>
                <div className="detalhe">
                  {mesa.comanda
                    ? `${mesa.comanda.pessoas} pessoa${mesa.comanda.pessoas > 1 ? 's' : ''} · ${haQuantoTempo(mesa.comanda.abertaEm)}`
                    : `${mesa.lugares} lugares`}
                </div>
                {mesa.comanda && (
                  <div className="valor-mesa">{dinheiro(mesa.comanda.totalCents)}</div>
                )}
                {!mesa.comanda && <div className="detalhe">toque para abrir</div>}
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* ---------------- fila e reservas ---------------- */}
      <div className="grid">
        <section className="card">
          <div className="stat-label">Fila de espera</div>
          {fila.length === 0 && <p className="subtitle">Ninguém esperando.</p>}
          {fila.map((f) => (
            <div className="chamado" key={f.id}>
              <span className="qual">
                <strong>{f.name}</strong> · {f.guests} pessoas
                <div className="sub">
                  {f.status === 'CALLED' ? 'chamado' : 'aguardando'} · há {haQuantoTempo(f.createdAt)}
                </div>
              </span>
              {f.status === 'WAITING' ? (
                <button onClick={() => mudarFila(f.id, 'CALLED')}>Chamar</button>
              ) : (
                <button onClick={() => mudarFila(f.id, 'SEATED')}>Sentou</button>
              )}
            </div>
          ))}
          <FormularioFila aoCriar={recarregar} />
        </section>

        <section className="card">
          <div className="stat-label">Reservas de hoje</div>
          {reservas.length === 0 && <p className="subtitle">Nenhuma reserva.</p>}
          {reservas.map((r) => (
            <div className="chamado" key={r.id}>
              <span className="qual">
                <strong>{r.name}</strong> · {r.guests} pessoas
                <div className="sub">
                  {hora(r.when)}
                  {r.table ? ` · mesa ${r.table.number}` : ''} · {r.status === 'SEATED' ? 'sentou' : 'confirmada'}
                </div>
              </span>
              {r.status === 'CONFIRMED' && (
                <button onClick={() => mudarReserva(r.id, 'SEATED')}>Chegou</button>
              )}
            </div>
          ))}
        </section>
      </div>

      {!podePagar && (
        <p className="hint">
          Seu perfil é <strong>garçom</strong>: você lança pedidos e atende chamados, mas quem
          fecha a conta e recebe é o caixa.
        </p>
      )}
    </main>
  );
}

/** Formulário curto para colocar alguém na fila. */
function FormularioFila({ aoCriar }: { aoCriar: () => Promise<void> }) {
  const [nome, setNome] = useState('');
  const [fone, setFone] = useState('');
  const [pessoas, setPessoas] = useState(2);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await fetch('/api/salao/fila', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, phone: fone, guests: pessoas }),
      });
      setNome('');
      setFone('');
      setPessoas(2);
      await aoCriar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div className="form-linha">
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
        <input placeholder="Telefone" value={fone} onChange={(e) => setFone(e.target.value)} required minLength={8} />
      </div>
      <div className="form-linha">
        <input
          type="number"
          min={1}
          max={30}
          value={pessoas}
          onChange={(e) => setPessoas(Number(e.target.value))}
          placeholder="Pessoas"
        />
        <button type="submit" disabled={enviando}>
          {enviando ? '…' : 'Pôr na fila'}
        </button>
      </div>
    </form>
  );
}
