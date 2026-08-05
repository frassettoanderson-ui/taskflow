'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo, PedidoDoPainel } from '../pedidos/painel-de-pedidos';

/**
 * A TELA PRINCIPAL do restaurante.
 *
 * De cima para baixo:
 *   1. RESULTADOS do dia (faturado, pedidos) + quantos pedidos há em cada etapa;
 *   2. AÇÕES: + Novo pedido, Abrir/Fechar caixa, Parar/Receber pedidos e (no
 *      modo multi) um menu para ligar/desligar cada estabelecimento;
 *   3. ABAS por tipo e (no multi) por estabelecimento;
 *   4. a lista de pedidos em cards quadrados, cada um com o NÚMERO do dia.
 */

const ABAS_TIPO = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'DINE_IN', label: 'Salão' },
  { valor: 'COUNTER', label: 'Retirada' },
  { valor: 'DELIVERY', label: 'Delivery' },
];

/** As etapas mostradas nos indicadores de cima, na ordem do fluxo. */
const ETAPAS = [
  { status: 'AWAITING_PAYMENT', label: 'Aguardando pgto' },
  { status: 'RECEIVED', label: 'Recebido' },
  { status: 'IN_PREPARATION', label: 'Em preparo', tambem: ['ACCEPTED'] },
  { status: 'READY', label: 'Pronto' },
  { status: 'OUT_FOR_DELIVERY', label: 'Saiu' },
];

function tagDoTipo(p: PedidoDoPainel): { texto: string; icone: string; cls: string } {
  if (p.channel === 'DINE_IN') {
    const mesa = p.table?.number ? ` · mesa ${p.table.number}` : '';
    return { texto: `Salão${mesa}`, icone: '🍽️', cls: 'salao' };
  }
  if (p.channel === 'COUNTER') return { texto: 'Retirada / Balcão', icone: '🥡', cls: 'balcao' };
  return { texto: 'Delivery', icone: '🛵', cls: 'delivery' };
}

function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

type Caixa = { aberto: boolean; pedidosNaSessao?: number };

export function PedidosPorTipo({
  iniciais,
  marcas,
}: {
  iniciais: PedidoDoPainel[];
  marcas: MarcaResumo[];
}) {
  const [pedidos, setPedidos] = useState(iniciais);
  const [resumo, setResumo] = useState({ faturadoCents: 0, quantidade: 0 });
  const [caixa, setCaixa] = useState<Caixa>({ aberto: false });
  const [listaMarcas, setListaMarcas] = useState(marcas);
  const [aoVivo, setAoVivo] = useState(false);
  const [abaTipo, setAbaTipo] = useState('TODOS');
  const [abaMarca, setAbaMarca] = useState('TODAS');
  const [menuEstab, setMenuEstab] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const multi = listaMarcas.length > 1;

  const buscar = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        fetch('/api/orders?limite=100', { cache: 'no-store' }),
        fetch('/api/orders/resumo', { cache: 'no-store' }),
      ]);
      if (p.ok) setPedidos(await p.json());
      if (r.ok) setResumo(await r.json());
    } catch {
      /* rede oscilou */
    }
  }, []);

  const buscarCaixa = useCallback(async () => {
    try {
      const r = await fetch('/api/caixa', { cache: 'no-store' });
      if (r.ok) setCaixa(await r.json());
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    buscar();
    buscarCaixa();
  }, [buscar, buscarCaixa]);

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

  // ---- caixa ----
  async function alternarCaixa() {
    setOcupado(true);
    try {
      await fetch(`/api/caixa/${caixa.aberto ? 'fechar' : 'abrir'}`, { method: 'POST' });
      await buscarCaixa();
    } finally {
      setOcupado(false);
    }
  }

  // ---- pausar/receber ----
  async function definirPausa(marca: MarcaResumo, pausar: boolean) {
    await fetch(`/api/brands/${marca.id}/pausa`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: pausar, reason: pausar ? 'Pausado no painel' : undefined }),
    });
    setListaMarcas((atual) => atual.map((m) => (m.id === marca.id ? { ...m, paused: pausar } : m)));
  }

  const algumRecebendo = listaMarcas.some((m) => !m.paused);

  async function alternarTodos() {
    setOcupado(true);
    try {
      // Se algum recebe, o clique PARA todos; se todos pausados, RETOMA todos.
      await Promise.all(listaMarcas.map((m) => definirPausa(m, algumRecebendo)));
    } finally {
      setOcupado(false);
    }
  }

  // ---- indicadores por etapa ----
  const emAndamento = useMemo(
    () => pedidos.filter((p) => !p.finalizado && p.status !== 'CANCELED'),
    [pedidos],
  );
  const contarEtapa = (etapa: (typeof ETAPAS)[number]) =>
    emAndamento.filter((p) => p.status === etapa.status || etapa.tambem?.includes(p.status)).length;

  // ---- lista filtrada pelas abas ----
  const lista = useMemo(
    () =>
      emAndamento.filter((p) => {
        if (abaTipo !== 'TODOS' && p.channel !== abaTipo) return false;
        if (multi && abaMarca !== 'TODAS' && p.brand?.id !== abaMarca) return false;
        return true;
      }),
    [emAndamento, abaTipo, abaMarca, multi],
  );

  return (
    <main className="pedidos-tela">
      {/* 1) RESULTADOS + ETAPAS */}
      <section className="resultados">
        <div className="resultado-card">
          <span className="resultado-rotulo">Faturado hoje</span>
          <span className="resultado-valor">{dinheiro(resumo.faturadoCents)}</span>
        </div>
        <div className="resultado-card">
          <span className="resultado-rotulo">Pedidos hoje</span>
          <span className="resultado-valor">{resumo.quantidade}</span>
        </div>

        <div className="etapas">
          {ETAPAS.map((e) => (
            <div className="etapa-chip" key={e.status}>
              <span className="etapa-n">{contarEtapa(e)}</span>
              <span className="etapa-l">{e.label}</span>
            </div>
          ))}
        </div>

        <span className={`ao-vivo ${aoVivo ? 'on' : ''}`}>{aoVivo ? '● ao vivo' : '○ reconectando'}</span>
      </section>

      {/* 2) AÇÕES */}
      <div className="acoes-barra">
        <Link href="/pdv" className="botao-acao destaque">
          + Novo pedido
        </Link>

        <button className="botao-acao" disabled={ocupado} onClick={alternarCaixa}>
          {caixa.aberto ? '🔒 Fechar caixa' : '🔓 Abrir caixa'}
        </button>

        <button
          className={`botao-acao ${algumRecebendo ? 'perigo' : ''}`}
          disabled={ocupado || listaMarcas.length === 0}
          onClick={alternarTodos}
        >
          {algumRecebendo ? '⏸ Parar pedidos' : '▶ Receber pedidos'}
        </button>

        {multi && (
          <div className="dropdown">
            <button className="botao-acao" onClick={() => setMenuEstab((v) => !v)}>
              Estabelecimentos ▾
            </button>
            {menuEstab && (
              <>
                <div className="dropdown-fundo" onClick={() => setMenuEstab(false)} />
                <div className="dropdown-menu">
                  {listaMarcas.map((m) => (
                    <button
                      key={m.id}
                      className="dropdown-item"
                      onClick={() => definirPausa(m, !m.paused)}
                    >
                      <span className="dot" style={{ background: m.primaryColor }} />
                      <span className="dropdown-nome">{m.name}</span>
                      <span className={`mini-status ${m.paused ? 'off' : 'on'}`}>
                        {m.paused ? 'Pausado' : 'Recebendo'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
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
          {listaMarcas.map((m) => (
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

      {/* 4) LISTA (cards quadrados) */}
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
                </div>

                <div className="pedido-miolo">
                  <span className="pedido-numero">{p.numero != null ? `#${p.numero}` : '—'}</span>
                  <span className="situacao" data-status={p.status}>
                    {p.statusLabel}
                  </span>
                </div>

                <div className="pedido-baixo">
                  <div className="pedido-linha">
                    <span className="pedido-cod">{p.code}</span>
                    <strong>{dinheiro(p.totalCents)}</strong>
                  </div>
                  <div className="pedido-linha sub">
                    <span>{p.customerName}</span>
                    <span>
                      {p.items.reduce((s, i) => s + i.quantity, 0)} item(ns) · {horaCurta(p.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
