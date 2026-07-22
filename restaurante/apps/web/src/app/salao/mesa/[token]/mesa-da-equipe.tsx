'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dinheiro, type CategoriaCardapio, type LinhaCarrinho } from '../../../m/[slug]/cardapio';
import type { EstadoDaMesa } from '../../../mesa/[token]/mesa-cliente';
import { SeletorDeItens } from '@/components/seletor-de-itens';

/** Quem pode mexer em dinheiro (mesma regra do backend). */
const MEXE_COM_DINHEIRO = ['OWNER', 'MANAGER', 'CASHIER'];

const NOME_DO_STATUS: Record<string, string> = {
  RECEIVED: 'Na cozinha',
  ACCEPTED: 'Aceito',
  IN_PREPARATION: 'Preparando',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
};

export function MesaDaEquipe({
  token,
  inicial,
  categorias,
  papel,
  nome,
}: {
  token: string;
  inicial: EstadoDaMesa;
  categorias: CategoriaCardapio[];
  papel: string;
  nome: string;
}) {
  const [estado, setEstado] = useState(inicial);
  const [aba, setAba] = useState<'lancar' | 'conta'>('lancar');
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [partes, setPartes] = useState(2);
  const [valorLivre, setValorLivre] = useState('');

  const podePagar = MEXE_COM_DINHEIRO.includes(papel);
  const comanda = estado.comanda;

  const recarregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/mesa/${token}`, { cache: 'no-store' });
      if (res.ok) setEstado(await res.json());
    } catch {
      /* mantém a tela */
    }
  }, [token]);

  useEffect(() => {
    const fonte = new EventSource('/api/orders/stream');
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

  function mostrar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 5000);
  }

  async function chamar(url: string, corpo?: unknown, metodo = 'POST') {
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch(url, {
        method: metodo,
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Não deu certo.'));
        return null;
      }
      await recarregar();
      return data;
    } catch {
      setErro('O servidor não respondeu.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  /** O garçom lança uma rodada — vai direto para a cozinha. */
  async function lancarRodada(linhas: LinhaCarrinho[]) {
    setEnviando(true);
    try {
      const r = await chamar(`/api/salao/mesas/${token}/pedido`, {
        itens: linhas.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantidade,
          modifierIds: l.complementos.map((c) => c.id),
        })),
      });
      if (r) mostrar('Rodada lançada na cozinha ✅');
    } finally {
      setEnviando(false);
    }
  }

  /** Em desenvolvimento: finge que o Pix daquela parte caiu. */
  async function simularPagamento(chargeId: string) {
    await chamar('/api/public/payments/webhook', {
      eventId: `evt-${chargeId}-${Date.now()}`,
      chargeId,
      status: 'PAID',
    });
    mostrar('Pagamento confirmado 💸');
  }

  return (
    <main className="shell" style={{ maxWidth: 720, ['--marca' as any]: estado.marca.primaryColor }}>
      <header className="topbar">
        <div>
          <h1 className="title">Mesa {estado.mesa.numero}</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {estado.mesa.area} · {estado.marca.name}
            {comanda ? ` · comanda ${comanda.code}` : ' · mesa livre'}
          </p>
        </div>
        <Link href="/salao">
          <button className="ghost">Voltar ao salão</button>
        </Link>
      </header>

      {aviso && (
        <div
          className="fechado"
          style={{ background: 'rgba(34,197,94,.12)', borderColor: 'rgba(34,197,94,.35)', color: '#86efac', margin: '0 0 16px' }}
        >
          {aviso}
        </div>
      )}
      {erro && <div className="error">{erro}</div>}

      <nav className="canais" style={{ padding: '0 0 16px' }}>
        <button className="canal-aba" data-ativo={aba === 'lancar'} onClick={() => setAba('lancar')}>
          Lançar pedido
        </button>
        <button className="canal-aba" data-ativo={aba === 'conta'} onClick={() => setAba('conta')}>
          Conta{comanda ? ` · ${dinheiro(comanda.totalCents)}` : ''}
        </button>
      </nav>

      {aba === 'lancar' && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Lançando como <strong>{nome}</strong>. O pedido vai direto para a cozinha e entra na
            conta da mesa.
          </p>
          <SeletorDeItens
            categorias={categorias}
            cor={estado.marca.primaryColor}
            rotuloEnviar="Lançar na cozinha"
            enviando={enviando}
            onEnviar={lancarRodada}
          />
        </>
      )}

      {aba === 'conta' && (
        <>
          {!comanda && <p className="vazio">Mesa livre — nada lançado ainda.</p>}

          {comanda && (
            <>
              {/* rodadas */}
              {comanda.rodadas.map((r, i) => (
                <div className="card" key={r.id} style={{ marginBottom: 10 }}>
                  <div className="comanda-topo">
                    <span className="stat-label" style={{ margin: 0 }}>
                      {i + 1}ª rodada {r.porGarcom ? '· garçom' : '· cliente pelo QR'}
                    </span>
                    <span className="situacao" data-status={r.status}>
                      {NOME_DO_STATUS[r.status] ?? r.status}
                    </span>
                  </div>
                  {r.itens.map((it) => (
                    <div className="linha-carrinho" key={it.id}>
                      <span className="qtd">{it.quantidade}×</span>
                      <span style={{ minWidth: 0 }}>
                        <div>{it.nome}</div>
                        {it.complementos.length > 0 && (
                          <div className="complementos">{it.complementos.join(' · ')}</div>
                        )}
                      </span>
                      <span className="valor">{dinheiro(it.totalCents)}</span>
                    </div>
                  ))}
                </div>
              ))}

              {/* totais */}
              <div className="card">
                <div className="totais">
                  <span>Consumo</span>
                  <span>{dinheiro(comanda.subtotalCents)}</span>
                </div>
                <div className="totais">
                  <span>
                    Serviço {comanda.taxaDeServico.percentual}%{' '}
                    {podePagar && (
                      <button
                        className="remover"
                        disabled={ocupado}
                        onClick={() =>
                          chamar(
                            `/api/salao/comandas/${comanda.id}/taxa`,
                            { ligada: !comanda.taxaDeServico.ligada },
                            'PATCH',
                          )
                        }
                      >
                        {comanda.taxaDeServico.ligada ? 'tirar' : 'incluir'}
                      </button>
                    )}
                  </span>
                  <span>
                    {comanda.taxaDeServico.ligada ? dinheiro(comanda.taxaDeServico.valorCents) : '—'}
                  </span>
                </div>
                <div className="totais grande">
                  <span>Total</span>
                  <span>{dinheiro(comanda.totalCents)}</span>
                </div>
                {comanda.paidCents > 0 && (
                  <>
                    <div className="totais">
                      <span>Recebido</span>
                      <span>{dinheiro(comanda.paidCents)}</span>
                    </div>
                    <div className="totais grande">
                      <span>Falta</span>
                      <span>{dinheiro(comanda.faltaCents)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* ações de dinheiro */}
              {!podePagar ? (
                <p className="hint">
                  Você é <strong>garçom</strong>: pode lançar pedidos, mas quem fecha a conta e
                  recebe é o caixa.
                </p>
              ) : (
                <section className="card" style={{ marginTop: 16 }}>
                  <div className="stat-label">Receber</div>

                  {comanda.status === 'OPEN' && (
                    <button
                      disabled={ocupado}
                      onClick={() => chamar(`/api/salao/comandas/${comanda.id}/fechar`)}
                    >
                      Fechar a conta
                    </button>
                  )}

                  {comanda.status === 'CLOSING' && (
                    <>
                      <div className="form-linha" style={{ marginBottom: 12 }}>
                        <input
                          type="number"
                          min={2}
                          max={20}
                          value={partes}
                          onChange={(e) => setPartes(Number(e.target.value))}
                        />
                        <button
                          disabled={ocupado}
                          onClick={() =>
                            chamar(`/api/salao/comandas/${comanda.id}/dividir`, { partes })
                          }
                        >
                          Dividir em {partes}
                        </button>
                      </div>

                      <div className="form-linha">
                        <input
                          placeholder="Valor livre (ex.: 50,00)"
                          value={valorLivre}
                          onChange={(e) => setValorLivre(e.target.value)}
                        />
                        <button
                          disabled={ocupado || !valorLivre}
                          onClick={() => {
                            const cents = Math.round(
                              Number(valorLivre.replace(/\./g, '').replace(',', '.')) * 100,
                            );
                            if (!cents || cents <= 0) {
                              setErro('Informe um valor válido.');
                              return;
                            }
                            chamar(`/api/salao/comandas/${comanda.id}/pagamentos`, {
                              amountCents: cents,
                            });
                            setValorLivre('');
                          }}
                        >
                          Gerar Pix
                        </button>
                      </div>

                      <button
                        className="ghost"
                        style={{ width: '100%', marginTop: 12 }}
                        disabled={ocupado}
                        onClick={() => chamar(`/api/salao/comandas/${comanda.id}/reabrir`)}
                      >
                        Reabrir a conta (o cliente pediu mais)
                      </button>
                    </>
                  )}

                  {comanda.status === 'PAID' && (
                    <p style={{ margin: 0, color: 'var(--ok)', fontWeight: 600 }}>
                      ✅ Conta paga. A mesa já está livre.
                    </p>
                  )}

                  {/* partes geradas */}
                  {comanda.pagamentos && comanda.pagamentos.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div className="stat-label">Partes</div>
                      {comanda.pagamentos.map((p, i) => (
                        <div className="chamado" key={p.id}>
                          <span className="qual">
                            <strong>Parte {i + 1}</strong> — {dinheiro(p.amountCents)}
                            <div className="sub">
                              {p.status === 'PAID' ? `paga ${p.pagoEm ? '' : ''}` : 'aguardando Pix'}
                            </div>
                          </span>
                          {p.status !== 'PAID' && (
                            <button disabled={ocupado} onClick={() => simularPagamento(p.chargeId)}>
                              Simular Pix
                            </button>
                          )}
                        </div>
                      ))}
                      <p className="hint">
                        O botão "Simular Pix" existe só em desenvolvimento — ele imita o aviso que o
                        banco mandaria.
                      </p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
