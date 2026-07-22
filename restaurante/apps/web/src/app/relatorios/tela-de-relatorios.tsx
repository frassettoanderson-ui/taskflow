'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';

export type PainelDeVendas = {
  periodo: { de: string; ate: string };
  resumo: {
    pedidos: number;
    faturamentoCents: number;
    ticketMedioCents: number;
    itensCents: number;
    descontosCents: number;
    fretesCents: number;
  };
  porMarca: Array<{
    brandId: string;
    nome: string;
    cor: string;
    pedidos: number;
    totalCents: number;
    ticketMedioCents: number;
  }>;
  porCanal: Array<{ canal: string; label: string; pedidos: number; totalCents: number }>;
  porDia: Array<{ dia: string; pedidos: number; totalCents: number }>;
  itensMaisVendidos: Array<{ itemId: string; nome: string; quantidade: number; totalCents: number }>;
  horarios: {
    porHora: Array<{ hora: number; label: string; pedidos: number; totalCents: number }>;
    porDiaSemana: Array<{ dia: number; label: string; pedidos: number; totalCents: number }>;
    pico: { label: string; pedidos: number } | null;
  };
};

function diaCurto(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Barra horizontal simples — sem biblioteca de gráfico. */
function Barra({ valor, maximo, cor }: { valor: number; maximo: number; cor?: string }) {
  const largura = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0;
  return (
    <div className="barra-fundo">
      <div className="barra-valor" style={{ width: `${largura}%`, background: cor }} />
    </div>
  );
}

export function TelaDeRelatorios({
  inicial,
  marcas,
}: {
  inicial: PainelDeVendas;
  marcas: MarcaResumo[];
}) {
  const [dados, setDados] = useState(inicial);
  const [marca, setMarca] = useState('');
  const [canal, setCanal] = useState('');
  const [de, setDe] = useState(inicial.periodo.de);
  const [ate, setAte] = useState(inicial.periodo.ate);
  const [carregando, setCarregando] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const p = new URLSearchParams({ de, ate });
    if (marca) p.set('marca', marca);
    if (canal) p.set('canal', canal);
    try {
      const res = await fetch(`/api/gestao/relatorios?${p}`, { cache: 'no-store' });
      if (res.ok) setDados(await res.json());
    } catch {
      /* mantém a tela */
    } finally {
      setCarregando(false);
    }
  }, [de, ate, marca, canal]);

  useEffect(() => {
    const t = setTimeout(buscar, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const maxDia = Math.max(1, ...dados.porDia.map((d) => d.totalCents));
  const maxHora = Math.max(1, ...dados.horarios.porHora.map((h) => h.pedidos));
  const maxItem = Math.max(1, ...dados.itensMaisVendidos.map((i) => i.quantidade));

  return (
    <main className="shell" style={{ maxWidth: 1100 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Relatórios</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {dados.periodo.de.split('-').reverse().join('/')} a{' '}
            {dados.periodo.ate.split('-').reverse().join('/')}
            {carregando ? ' · atualizando…' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/financeiro">
            <button className="ghost">Financeiro</button>
          </Link>
          <Link href="/estoque">
            <button className="ghost">Estoque</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {/* filtros */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="filtros">
          <div>
            <label style={{ fontSize: 11 }}>De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <div>
            <label style={{ fontSize: 11 }}>Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <select value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Todas as marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="">Todos os canais</option>
            <option value="delivery">Delivery</option>
            <option value="salao">Salão</option>
            <option value="balcao">Balcão</option>
          </select>
        </div>
      </section>

      {/* números do topo */}
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">Faturamento</div>
          <div className="stat-value" style={{ fontSize: 26 }}>
            {dinheiro(dados.resumo.faturamentoCents)}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Pedidos</div>
          <div className="stat-value" style={{ fontSize: 26 }}>
            {dados.resumo.pedidos}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Ticket médio</div>
          <div className="stat-value" style={{ fontSize: 26 }}>
            {dinheiro(dados.resumo.ticketMedioCents)}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Horário de pico</div>
          <div className="stat-value" style={{ fontSize: 26 }}>
            {dados.horarios.pico?.label ?? '—'}
          </div>
          <div className="sub">{dados.horarios.pico?.pedidos ?? 0} pedidos</div>
        </div>
      </section>

      {/* por marca */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="stat-label">Por marca</div>
        {dados.porMarca.length === 0 && <p className="subtitle">Nenhuma venda no período.</p>}
        {dados.porMarca.map((m) => (
          <div key={m.brandId} style={{ marginBottom: 14 }}>
            <div className="totais" style={{ padding: '4px 0' }}>
              <span className="marca-tag">
                <span className="dot" style={{ background: m.cor }} />
                <strong>{m.nome}</strong>
                <span className="sub">
                  {m.pedidos} pedidos · ticket {dinheiro(m.ticketMedioCents)}
                </span>
              </span>
              <strong>{dinheiro(m.totalCents)}</strong>
            </div>
            <Barra valor={m.totalCents} maximo={dados.porMarca[0]?.totalCents ?? 1} cor={m.cor} />
          </div>
        ))}
      </section>

      <div className="grid">
        {/* por canal */}
        <section className="card">
          <div className="stat-label">Por canal</div>
          {dados.porCanal.map((c) => (
            <div className="totais" key={c.canal}>
              <span>
                {c.label} <span className="sub">({c.pedidos})</span>
              </span>
              <span>{dinheiro(c.totalCents)}</span>
            </div>
          ))}
        </section>

        {/* composição */}
        <section className="card">
          <div className="stat-label">Composição</div>
          <div className="totais">
            <span>Itens</span>
            <span>{dinheiro(dados.resumo.itensCents)}</span>
          </div>
          <div className="totais">
            <span>Descontos e cashback</span>
            <span>− {dinheiro(dados.resumo.descontosCents)}</span>
          </div>
          <div className="totais">
            <span>Fretes</span>
            <span>{dinheiro(dados.resumo.fretesCents)}</span>
          </div>
          <div className="totais grande">
            <span>Total</span>
            <span>{dinheiro(dados.resumo.faturamentoCents)}</span>
          </div>
        </section>
      </div>

      {/* itens mais vendidos */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="stat-label">Itens mais vendidos</div>
        {dados.itensMaisVendidos.length === 0 && <p className="subtitle">Nada vendido no período.</p>}
        {dados.itensMaisVendidos.map((i) => (
          <div key={i.itemId} style={{ marginBottom: 10 }}>
            <div className="totais" style={{ padding: '3px 0' }}>
              <span>
                <strong>{i.quantidade}×</strong> {i.nome}
              </span>
              <span>{dinheiro(i.totalCents)}</span>
            </div>
            <Barra valor={i.quantidade} maximo={maxItem} />
          </div>
        ))}
      </section>

      {/* horários de pico */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="stat-label">Horários de pico</div>
        <div className="horas">
          {dados.horarios.porHora.map((h) => (
            <div className="hora" key={h.hora} title={`${h.label}: ${h.pedidos} pedidos`}>
              <div
                className="hora-barra"
                style={{ height: `${maxHora > 0 ? (h.pedidos / maxHora) * 100 : 0}%` }}
                data-pico={h.pedidos === maxHora && h.pedidos > 0}
              />
              <span className="hora-rotulo">{h.hora % 3 === 0 ? h.hora : ''}</span>
            </div>
          ))}
        </div>

        <div className="stat-label" style={{ marginTop: 20 }}>
          Por dia da semana
        </div>
        {dados.horarios.porDiaSemana.map((d) => (
          <div className="totais" key={d.dia} style={{ padding: '3px 0' }}>
            <span>{d.label}</span>
            <span>
              {d.pedidos} pedidos · {dinheiro(d.totalCents)}
            </span>
          </div>
        ))}
      </section>

      {/* evolução diária */}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="stat-label">Dia a dia</div>
        {dados.porDia.length === 0 && <p className="subtitle">Sem vendas no período.</p>}
        {dados.porDia.map((d) => (
          <div key={d.dia} style={{ marginBottom: 8 }}>
            <div className="totais" style={{ padding: '2px 0' }}>
              <span className="sub">
                {diaCurto(d.dia)} · {d.pedidos} pedidos
              </span>
              <span>{dinheiro(d.totalCents)}</span>
            </div>
            <Barra valor={d.totalCents} maximo={maxDia} />
          </div>
        ))}
      </section>
    </main>
  );
}
