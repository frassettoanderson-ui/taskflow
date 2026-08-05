'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo, PedidoDoPainel } from '../pedidos/painel-de-pedidos';
import {
  ICONE_DO_CANAL,
  IconeCadeadoAberto,
  IconeCadeadoFechado,
  IconeMais,
  IconePausa,
  IconePlay,
  IconeRelogio,
  IconeSeta,
} from '@/components/icones';

/**
 * A TELA PRINCIPAL do restaurante.
 *
 * De cima para baixo:
 *   1. RESULTADOS do dia e quantos pedidos há em cada etapa;
 *   2. AÇÕES: novo pedido, abrir/fechar caixa, parar/receber pedidos;
 *   3. ABAS por tipo e (no multi) por estabelecimento;
 *   4. os pedidos, cada um com o NÚMERO do dia e o TEMPO correndo.
 *
 * O tempo correndo é o detalhe que os sistemas de referência têm e que muda o
 * jogo na hora do pico: o cartão avisa sozinho quando o pedido está demorando,
 * em vez de o dono ter que reparar.
 */

const ABAS_TIPO = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'DINE_IN', label: 'Salão' },
  { valor: 'COUNTER', label: 'Retirada' },
  { valor: 'DELIVERY', label: 'Delivery' },
];

const ETAPAS = [
  { status: 'AWAITING_PAYMENT', label: 'Aguardando pgto' },
  { status: 'RECEIVED', label: 'Recebido' },
  { status: 'IN_PREPARATION', label: 'Em preparo', tambem: ['ACCEPTED'] },
  { status: 'READY', label: 'Pronto' },
  { status: 'OUT_FOR_DELIVERY', label: 'Saiu' },
];

/**
 * Quanto tempo se espera que um pedido leve, por canal (em minutos).
 * É o parâmetro do alerta: metade disso fica âmbar, o dobro fica vermelho.
 * Vira configuração por marca quando o fundador quiser.
 */
const MINUTOS_ESPERADOS: Record<string, number> = {
  DELIVERY: 45,
  DINE_IN: 25,
  COUNTER: 20,
};

const ROTULO_DO_CANAL: Record<string, string> = {
  DELIVERY: 'Delivery',
  DINE_IN: 'Salão',
  COUNTER: 'Retirada',
};

const CLASSE_DO_CANAL: Record<string, string> = {
  DELIVERY: 'delivery',
  DINE_IN: 'salao',
  COUNTER: 'balcao',
};

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
  /** relógio que faz o tempo do cartão andar sozinho */
  const [agora, setAgora] = useState(() => Date.now());

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

  // O relógio do alerta: de meio em meio minuto basta (o alerta é grosso).
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

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

  async function alternarCaixa() {
    setOcupado(true);
    try {
      await fetch(`/api/caixa/${caixa.aberto ? 'fechar' : 'abrir'}`, { method: 'POST' });
      await buscarCaixa();
    } finally {
      setOcupado(false);
    }
  }

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
      await Promise.all(listaMarcas.map((m) => definirPausa(m, algumRecebendo)));
    } finally {
      setOcupado(false);
    }
  }

  const emAndamento = useMemo(
    () => pedidos.filter((p) => !p.finalizado && p.status !== 'CANCELED'),
    [pedidos],
  );
  const contarEtapa = (etapa: (typeof ETAPAS)[number]) =>
    emAndamento.filter((p) => p.status === etapa.status || etapa.tambem?.includes(p.status)).length;

  const lista = useMemo(
    () =>
      emAndamento.filter((p) => {
        if (abaTipo !== 'TODOS' && p.channel !== abaTipo) return false;
        if (multi && abaMarca !== 'TODAS' && p.brand?.id !== abaMarca) return false;
        return true;
      }),
    [emAndamento, abaTipo, abaMarca, multi],
  );

  /**
   * Há quanto tempo o pedido está aberto, e se isso já é motivo de aflição.
   *
   * Pedido esperando o cliente pagar não conta como atraso: a demora é dele,
   * não da cozinha — seria injusto pintar o cartão de vermelho por isso.
   */
  function tempo(p: PedidoDoPainel) {
    const minutos = Math.max(0, Math.floor((agora - new Date(p.createdAt).getTime()) / 60000));
    if (p.status === 'AWAITING_PAYMENT') return { minutos, nivel: 'neutro' as const };

    const esperado = MINUTOS_ESPERADOS[p.channel] ?? 30;
    const nivel = minutos >= esperado ? 'atrasado' : minutos >= esperado / 2 ? 'atencao' : 'ok';
    return { minutos, nivel };
  }

  function textoDoTempo(minutos: number) {
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    // Acima de um dia, contar hora vira ruído ("318h04" não diz nada a ninguém).
    if (horas >= 24) {
      const dias = Math.floor(horas / 24);
      return dias === 1 ? 'ontem' : `${dias} dias`;
    }
    return `${horas}h${String(minutos % 60).padStart(2, '0')}`;
  }

  return (
    <main className="pedidos-tela">
      {/* ---------- 1) RESULTADOS + ETAPAS ---------- */}
      <section className="resultados">
        <div className="resultado-card destaque">
          <span className="resultado-rotulo">Faturado hoje</span>
          <span className="resultado-valor">{dinheiro(resumo.faturadoCents)}</span>
        </div>
        <div className="resultado-card">
          <span className="resultado-rotulo">Pedidos hoje</span>
          <span className="resultado-valor">{resumo.quantidade}</span>
        </div>

        <div className="etapas">
          {ETAPAS.map((e) => {
            const n = contarEtapa(e);
            return (
              <div className="etapa-chip" key={e.status} data-cheio={n > 0}>
                <span className="etapa-n">{n}</span>
                <span className="etapa-l">{e.label}</span>
              </div>
            );
          })}
        </div>

        <span className={`ao-vivo ${aoVivo ? 'on' : ''}`}>
          <i />
          {aoVivo ? 'ao vivo' : 'reconectando'}
        </span>
      </section>

      {/* ---------- 2) AÇÕES ---------- */}
      <div className="acoes-barra">
        <Link href="/pdv" className="botao-acao destaque">
          <IconeMais tamanho={18} />
          Novo pedido
        </Link>

        <button className="botao-acao" disabled={ocupado} onClick={alternarCaixa}>
          {caixa.aberto ? <IconeCadeadoFechado tamanho={17} /> : <IconeCadeadoAberto tamanho={17} />}
          {caixa.aberto ? 'Fechar caixa' : 'Abrir caixa'}
        </button>

        {!multi ? (
          <button
            className={`botao-acao ${algumRecebendo ? 'perigo' : 'positivo'}`}
            disabled={ocupado || listaMarcas.length === 0}
            onClick={alternarTodos}
          >
            {algumRecebendo ? <IconePausa tamanho={16} /> : <IconePlay tamanho={16} />}
            {algumRecebendo ? 'Parar pedidos' : 'Receber pedidos'}
          </button>
        ) : (
          <div className="dropdown">
            <button
              className={`botao-acao ${algumRecebendo ? 'perigo' : 'positivo'}`}
              disabled={ocupado}
              onClick={() => setMenuEstab((v) => !v)}
            >
              {algumRecebendo ? <IconePausa tamanho={16} /> : <IconePlay tamanho={16} />}
              {algumRecebendo ? 'Parar pedidos' : 'Receber pedidos'}
              <IconeSeta tamanho={15} />
            </button>
            {menuEstab && (
              <>
                <div className="dropdown-fundo" onClick={() => setMenuEstab(false)} />
                <div className="dropdown-menu">
                  <button className="dropdown-item forte" disabled={ocupado} onClick={alternarTodos}>
                    {algumRecebendo ? 'Parar todos' : 'Receber em todos'}
                  </button>
                  <div className="dropdown-sep" />
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

      {/* ---------- 3) ABAS ---------- */}
      <div className="abas-tipo">
        {ABAS_TIPO.map((a) => {
          const n =
            a.valor === 'TODOS'
              ? emAndamento.length
              : emAndamento.filter((p) => p.channel === a.valor).length;
          return (
            <button
              key={a.valor}
              className="aba-tab"
              data-ativa={abaTipo === a.valor}
              onClick={() => setAbaTipo(a.valor)}
            >
              {a.label}
              <span className="aba-conta">{n}</span>
            </button>
          );
        })}
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

      {/* ---------- 4) OS PEDIDOS ---------- */}
      {lista.length === 0 ? (
        <div className="vazio-caixa">
          <div className="vazio-icone">
            <IconeRelogio tamanho={26} />
          </div>
          <strong>Nenhum pedido em andamento</strong>
          <span>Quando entrar um pedido, ele aparece aqui sozinho.</span>
        </div>
      ) : (
        <div className="pedidos-lista">
          {lista.map((p) => {
            const t = tempo(p);
            const Icone = ICONE_DO_CANAL[p.channel as keyof typeof ICONE_DO_CANAL];
            const mesa = p.channel === 'DINE_IN' && p.table?.number ? `Mesa ${p.table.number}` : null;

            return (
              <Link
                href={`/pedido/${p.code}`}
                className="pedido-card"
                key={p.id}
                data-canal={CLASSE_DO_CANAL[p.channel] ?? 'delivery'}
              >
                <div className="pedido-tags">
                  <span className={`tag tag-tipo ${CLASSE_DO_CANAL[p.channel]}`}>
                    {Icone && <Icone tamanho={14} />}
                    {mesa ?? ROTULO_DO_CANAL[p.channel] ?? p.channelLabel}
                  </span>
                  <span className={`tempo-chip ${t.nivel}`} title="Tempo desde que o pedido entrou">
                    <IconeRelogio tamanho={13} />
                    {textoDoTempo(t.minutos)}
                  </span>
                </div>

                <div className="pedido-miolo">
                  <span className="pedido-numero">{p.numero != null ? p.numero : '—'}</span>
                  <span className="situacao" data-status={p.status}>
                    {p.statusLabel}
                  </span>
                </div>

                <div className="pedido-baixo">
                  <div className="pedido-linha">
                    <span className="pedido-cliente">{p.customerName}</span>
                    <strong className="pedido-total">{dinheiro(p.totalCents)}</strong>
                  </div>
                  <div className="pedido-linha sub">
                    <span>
                      {p.code} · {p.items.reduce((s, i) => s + i.quantity, 0)} item(ns)
                    </span>
                    <span>{horaCurta(p.createdAt)}</span>
                  </div>
                  {multi && p.brand && (
                    <div className="pedido-marca-linha">
                      <span className="dot" style={{ background: p.brand.primaryColor }} />
                      {p.brand.name}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
