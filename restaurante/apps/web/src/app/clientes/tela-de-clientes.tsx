'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';
import { IconeBaixar, IconeProibido } from '@/components/icones';

export type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string;
  marca: { id: string; name: string; primaryColor: string };
  pedidos: number;
  totalGastoCents: number;
  ticketMedioCents: number;
  cashbackCents: number;
  ultimoPedido: string | null;
  diasSemPedir: number | null;
  bairro: string | null;
  optOut: boolean;
};

export type SegmentoContagem = { segmento: string; label: string; total: number };

type Ficha = {
  id: string;
  nome: string;
  telefone: string;
  marca: { name: string; primaryColor: string };
  pedidos: number;
  totalGastoCents: number;
  ticketMedioCents: number;
  cashbackCents: number;
  primeiroPedido: string | null;
  ultimoPedido: string | null;
  endereco: { rua: string | null; numero: string | null; bairro: string | null; cidade: string | null };
  historico: Array<{
    id: string;
    code: string;
    status: string;
    channel: string;
    totalCents: number;
    discountCents: number;
    cashbackRedeemedCents: number;
    cashbackEarnedCents: number;
    createdAt: string;
  }>;
  extratoCashback: Array<{
    id: string;
    tipo: string;
    valorCents: number;
    descricao: string | null;
    pedido: string | null;
    venceEm: string | null;
    quando: string;
  }>;
  mensagens: Array<{ id: string; tipo: string; status: string; texto: string; quando: string }>;
};

const TIPO_EXTRATO: Record<string, string> = {
  EARN: 'ganhou',
  REDEEM: 'usou',
  EXPIRE: 'venceu',
  ADJUST: 'ajuste',
};

function data(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function TelaDeClientes({
  iniciais,
  segmentosIniciais,
  marcas,
}: {
  iniciais: ClienteResumo[];
  segmentosIniciais: SegmentoContagem[];
  marcas: MarcaResumo[];
}) {
  const [clientes, setClientes] = useState(iniciais);
  const [segmentos, setSegmentos] = useState(segmentosIniciais);
  const [segmento, setSegmento] = useState('ALL');
  const [marca, setMarca] = useState('');
  const [busca, setBusca] = useState('');
  const [ficha, setFicha] = useState<Ficha | null>(null);

  const buscar = useCallback(async () => {
    const p = new URLSearchParams({ segmento });
    if (marca) p.set('marca', marca);
    if (busca.trim()) p.set('busca', busca.trim());

    try {
      const [c, s] = await Promise.all([
        fetch(`/api/marketing/clientes?${p}`, { cache: 'no-store' }),
        fetch(`/api/marketing/segmentos${marca ? `?marca=${marca}` : ''}`, { cache: 'no-store' }),
      ]);
      if (c.ok) setClientes(await c.json());
      if (s.ok) setSegmentos(await s.json());
    } catch {
      /* mantém a tela */
    }
  }, [segmento, marca, busca]);

  useEffect(() => {
    const t = setTimeout(buscar, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  async function abrirFicha(id: string) {
    const res = await fetch(`/api/marketing/clientes/${id}`, { cache: 'no-store' });
    if (res.ok) setFicha(await res.json());
  }

  /** LGPD — portabilidade: baixa um arquivo com tudo que guardamos. */
  async function baixarDados(id: string, nome: string) {
    const res = await fetch(`/api/gestao/lgpd/${id}/exportar`, { cache: 'no-store' });
    if (!res.ok) return alert('Não consegui exportar agora.');

    const dados = await res.json();
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `dados-${nome.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** LGPD — direito ao esquecimento. */
  async function anonimizar(id: string) {
    const ok = confirm(
      'Apagar os dados pessoais deste cliente?\n\n' +
        'Nome, telefone e endereço serão removidos e não há como desfazer.\n' +
        'Os valores dos pedidos continuam, por obrigação fiscal.',
    );
    if (!ok) return;

    const res = await fetch(`/api/gestao/lgpd/${id}/anonimizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'Pedido do titular pelo painel' }),
    });

    if (res.ok) {
      await abrirFicha(id);
      await buscar();
    }
  }

  return (
    <main className="shell" style={{ maxWidth: 1100 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Clientes</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            A base é de cada marca — seus clientes, seus dados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/marketing">
            <button className="ghost">Marketing</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {/* segmentos */}
      <div className="chips">
        {segmentos.map((s) => (
          <button
            key={s.segmento}
            className="chip"
            data-ativo={segmento === s.segmento}
            onClick={() => setSegmento(s.segmento)}
          >
            {s.label}
            <b>{s.total}</b>
          </button>
        ))}
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="filtros">
          <select value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="">Todas as marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Buscar por nome ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ marginBottom: 0, flex: 1, minWidth: 220 }}
          />
        </div>
      </section>

      {clientes.length === 0 ? (
        <p className="vazio">Nenhum cliente com esses filtros.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Marca</th>
                <th style={{ textAlign: 'right' }}>Pedidos</th>
                <th style={{ textAlign: 'right' }}>Total gasto</th>
                <th style={{ textAlign: 'right' }}>Ticket médio</th>
                <th style={{ textAlign: 'right' }}>Cashback</th>
                <th>Último pedido</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} onClick={() => abrirFicha(c.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <strong>{c.nome}</strong>
                    <div className="sub">
                      {c.telefone}
                      {c.bairro ? ` · ${c.bairro}` : ''}
                    </div>
                  </td>
                  <td>
                    <span className="marca-tag">
                      <span className="dot" style={{ background: c.marca.primaryColor }} />
                      {c.marca.name}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{c.pedidos}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {dinheiro(c.totalGastoCents)}
                  </td>
                  <td style={{ textAlign: 'right' }}>{dinheiro(c.ticketMedioCents)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {c.cashbackCents > 0 ? (
                      <span className="cashback-tag">{dinheiro(c.cashbackCents)}</span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  <td className="sub">
                    {data(c.ultimoPedido)}
                    {c.diasSemPedir != null && c.diasSemPedir > 0 && (
                      <div>há {c.diasSemPedir} dias</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ficha do cliente */}
      {ficha && (
        <div className="modal-fundo" onClick={() => setFicha(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-corpo" style={{ paddingTop: 22 }}>
              <div className="grupo-cabecalho">
                <div>
                  <h2 className="title" style={{ fontSize: 20, margin: 0 }}>
                    {ficha.nome}
                  </h2>
                  <p className="subtitle" style={{ margin: 0 }}>
                    {ficha.telefone} · {ficha.marca.name}
                  </p>
                </div>
                <button className="modal-fechar" style={{ position: 'static' }} onClick={() => setFicha(null)}>
                  ×
                </button>
              </div>

              <div className="grid" style={{ marginTop: 12 }}>
                <div className="card">
                  <div className="stat-label">Pedidos</div>
                  <div className="stat-value">{ficha.pedidos}</div>
                </div>
                <div className="card">
                  <div className="stat-label">Total gasto</div>
                  <div className="stat-value">{dinheiro(ficha.totalGastoCents)}</div>
                </div>
                <div className="card">
                  <div className="stat-label">Cashback</div>
                  <div className="stat-value">{dinheiro(ficha.cashbackCents)}</div>
                </div>
              </div>

              <div className="grupo">
                <div className="grupo-cabecalho">
                  <strong>Histórico de pedidos</strong>
                </div>
                {ficha.historico.length === 0 && <p className="subtitle">Nenhum pedido ainda.</p>}
                {ficha.historico.map((o) => (
                  <div className="linha-carrinho" key={o.id}>
                    <span className="qtd" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      {o.code}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <div className="sub">{data(o.createdAt)}</div>
                      {(o.discountCents > 0 || o.cashbackRedeemedCents > 0 || o.cashbackEarnedCents > 0) && (
                        <div className="complementos">
                          {o.discountCents > 0 && `cupom −${dinheiro(o.discountCents)} `}
                          {o.cashbackRedeemedCents > 0 && `cashback −${dinheiro(o.cashbackRedeemedCents)} `}
                          {o.cashbackEarnedCents > 0 && `ganhou ${dinheiro(o.cashbackEarnedCents)}`}
                        </div>
                      )}
                    </span>
                    <span className="valor">{dinheiro(o.totalCents)}</span>
                  </div>
                ))}
              </div>

              <div className="grupo">
                <div className="grupo-cabecalho">
                  <strong>Extrato de cashback</strong>
                </div>
                {ficha.extratoCashback.length === 0 && (
                  <p className="subtitle">Nenhum movimento ainda.</p>
                )}
                {ficha.extratoCashback.map((e) => (
                  <div className="linha-carrinho" key={e.id}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <div>
                        {TIPO_EXTRATO[e.tipo] ?? e.tipo}
                        {e.pedido ? ` · pedido ${e.pedido}` : ''}
                      </div>
                      <div className="complementos">
                        {data(e.quando)}
                        {e.venceEm ? ` · vence ${data(e.venceEm)}` : ''}
                      </div>
                    </span>
                    <span
                      className="valor"
                      style={{ color: e.valorCents >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                    >
                      {e.valorCents >= 0 ? '+' : '−'} {dinheiro(Math.abs(e.valorCents))}
                    </span>
                  </div>
                ))}
              </div>

              {/* LGPD */}
              <div className="grupo">
                <div className="grupo-cabecalho">
                  <strong>Dados pessoais (LGPD)</strong>
                </div>
                <p className="hint" style={{ marginTop: 0 }}>
                  O cliente tem direito de levar seus dados embora e de pedir que sejam apagados.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="ghost"
                    style={{ width: 'auto' }}
                    onClick={() => baixarDados(ficha.id, ficha.nome)}
                  >
                    <IconeBaixar tamanho={15} /> Exportar dados
                  </button>
                  <button
                    className="ghost"
                    style={{ width: 'auto', color: 'var(--danger)' }}
                    onClick={() => anonimizar(ficha.id)}
                  >
                    <IconeProibido tamanho={15} /> Apagar dados pessoais
                  </button>
                </div>
                <p className="hint">
                  Apagar <strong>anonimiza</strong>: nome, telefone e endereço somem, mas os valores
                  dos pedidos ficam — a venda é obrigação fiscal e precisa ser guardada.
                </p>
              </div>

              <div className="grupo">
                <div className="grupo-cabecalho">
                  <strong>Mensagens enviadas</strong>
                </div>
                {ficha.mensagens.length === 0 && <p className="subtitle">Nenhuma mensagem.</p>}
                {ficha.mensagens.map((m) => (
                  <div className="linha-carrinho" key={m.id}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <div className="complementos">
                        {m.tipo} · {data(m.quando)}
                      </div>
                      <div style={{ fontSize: 13 }}>{m.texto.slice(0, 120)}</div>
                    </span>
                    <span className="situacao" data-status={m.status === 'SENT' ? 'DELIVERED' : 'CANCELED'}>
                      {m.status === 'SENT' ? 'enviada' : m.status.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
