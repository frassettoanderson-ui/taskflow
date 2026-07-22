'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SeletorDeItens } from '@/components/seletor-de-itens';
import { chamarApi, paraCentavos } from '@/lib/chamar-api';
import {
  dinheiro,
  totalDaLinha,
  type CategoriaCardapio,
  type LinhaCarrinho,
} from '../m/[slug]/cardapio';

type Marca = { id: string; name: string; slug: string; primaryColor: string };
type Cardapio = { menuId: string; categories: CategoriaCardapio[] };

type Venda = {
  pedido: { code: string; totalCents: number; items: Array<{ nameSnapshot: string; quantity: number }> };
  changeCents: number;
  paymentMethod: string;
};

type Caixa = {
  quantidade: number;
  totalCents: number;
  porForma: Record<string, { quantidade: number; totalCents: number }>;
  ultimas: Array<{
    id: string;
    code: string;
    marca: string;
    cliente: string;
    totalCents: number;
    forma: string | null;
    status: string;
  }>;
};

const FORMAS = [
  { valor: 'CASH', label: '💵 Dinheiro' },
  { valor: 'CARD', label: '💳 Cartão' },
  { valor: 'PIX', label: '📱 Pix' },
];

/**
 * O caixa do balcão.
 *
 * São três momentos, um de cada vez, porque é assim que a fila anda:
 *   1. montar   — clica nos itens
 *   2. pagar    — escolhe a forma e, no dinheiro, calcula o troco
 *   3. pronto   — mostra o código para chamar o cliente
 */
export function Caixa({ operador }: { operador: string }) {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [marcaId, setMarcaId] = useState('');
  const [cardapio, setCardapio] = useState<Cardapio | null>(null);

  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([]);
  const [etapa, setEtapa] = useState<'montar' | 'pagar' | 'pronto'>('montar');

  const [forma, setForma] = useState('CASH');
  const [recebido, setRecebido] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  const [venda, setVenda] = useState<Venda | null>(null);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [verCaixa, setVerCaixa] = useState(false);

  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const marca = marcas.find((m) => m.id === marcaId);
  const total = useMemo(() => carrinho.reduce((s, l) => s + totalDaLinha(l), 0), [carrinho]);

  /** Troco só faz sentido no dinheiro e quando o valor recebido cobre a conta. */
  const troco = useMemo(() => {
    if (forma !== 'CASH' || !recebido.trim()) return null;
    const dado = paraCentavos(recebido);
    return dado >= total ? dado - total : null;
  }, [forma, recebido, total]);

  useEffect(() => {
    chamarApi<Marca[]>('/pdv/marcas').then((r) => {
      if (!r.ok) return setErro(r.erro);
      setMarcas(r.dados);
      setMarcaId((atual) => atual || r.dados[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    if (!marcaId) return;
    setCardapio(null);
    chamarApi<Cardapio>(`/pdv/cardapio/${marcaId}`).then((r) =>
      r.ok ? setCardapio(r.dados) : setErro(r.erro),
    );
  }, [marcaId]);

  const carregarCaixa = useCallback(async () => {
    const r = await chamarApi<Caixa>('/pdv/caixa');
    if (r.ok) setCaixa(r.dados);
  }, []);

  useEffect(() => {
    carregarCaixa();
  }, [carregarCaixa]);

  /** O seletor devolve a rodada montada; aqui ela vira o carrinho da venda. */
  function irParaPagamento(linhas: LinhaCarrinho[]) {
    setCarrinho(linhas);
    setErro(null);
    setEtapa('pagar');
  }

  async function fechar() {
    setOcupado(true);
    setErro(null);

    const r = await chamarApi<Venda>('/pdv/vendas', {
      metodo: 'POST',
      corpo: {
        brandId: marcaId,
        customerName: nome.trim() || undefined,
        customerPhone: telefone.trim() || undefined,
        paymentMethod: forma,
        receivedCents: forma === 'CASH' && recebido.trim() ? paraCentavos(recebido) : undefined,
        items: carrinho.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantidade,
          modifierIds: l.complementos.map((c) => c.id),
        })),
      },
    });

    setOcupado(false);
    if (!r.ok) return setErro(r.erro);

    setVenda(r.dados);
    setEtapa('pronto');
    carregarCaixa();
  }

  /** Zera tudo para o próximo cliente da fila. */
  function proximoCliente() {
    setCarrinho([]);
    setVenda(null);
    setNome('');
    setTelefone('');
    setRecebido('');
    setForma('CASH');
    setErro(null);
    setEtapa('montar');
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">PDV — Balcão</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Caixa: {operador}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => setVerCaixa((v) => !v)}>
            {verCaixa ? 'Voltar à venda' : '🧾 Fechamento do dia'}
          </button>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {erro && <div className="erro">{erro}</div>}

      {/* ---------------- FECHAMENTO DE CAIXA ---------------- */}
      {verCaixa ? (
        <>
          <section className="grid">
            <div className="card">
              <div className="stat-label">Vendas no balcão hoje</div>
              <div className="stat-value">{caixa?.quantidade ?? 0}</div>
            </div>
            <div className="card">
              <div className="stat-label">Total do dia</div>
              <div className="stat-value">{dinheiro(caixa?.totalCents ?? 0)}</div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="stat-label">Por forma de pagamento</div>
            <p className="hint" style={{ marginTop: 0 }}>
              Confira a gaveta pela linha <strong>Dinheiro</strong> — o total inclui cartão e Pix,
              que não estão na gaveta.
            </p>
            {FORMAS.map((f) => {
              const linha = caixa?.porForma?.[f.valor];
              return (
                <div className="regra-linha" key={f.valor}>
                  <span>
                    {f.label} <span className="sub">({linha?.quantidade ?? 0} venda[s])</span>
                  </span>
                  <strong>{dinheiro(linha?.totalCents ?? 0)}</strong>
                </div>
              );
            })}
          </section>

          <section className="card">
            <div className="stat-label">Últimas vendas</div>
            {(caixa?.ultimas.length ?? 0) === 0 && <p className="vazio">Nada vendido ainda hoje.</p>}
            {caixa?.ultimas.map((p) => (
              <div className="chamado" key={p.id}>
                <span className="qual">
                  <strong>{p.code}</strong>
                  <div className="sub">
                    {p.marca} · {p.cliente}
                  </div>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <strong>{dinheiro(p.totalCents)}</strong>
                  <div className="sub">{FORMAS.find((f) => f.valor === p.forma)?.label ?? '—'}</div>
                </span>
              </div>
            ))}
          </section>
        </>
      ) : (
        <>
          {/* ---------------- 3. VENDA CONCLUÍDA ---------------- */}
          {etapa === 'pronto' && venda && (
            <section className="card proof" style={{ textAlign: 'center' }}>
              <div className="stat-label">Venda concluída</div>
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: 2, margin: '8px 0' }}>
                {venda.pedido.code}
              </div>
              <p className="subtitle" style={{ margin: 0 }}>
                Chame o cliente por este código quando ficar pronto. O pedido já está na cozinha.
              </p>

              <div className="regra-linha" style={{ marginTop: 16 }}>
                <span>Total</span>
                <strong>{dinheiro(venda.pedido.totalCents)}</strong>
              </div>

              {venda.changeCents > 0 && (
                <div
                  className="regra-linha"
                  style={{ fontSize: 22, background: '#FEF3C7', borderRadius: 8, padding: 12 }}
                >
                  <span>
                    <strong>TROCO</strong>
                  </span>
                  <strong>{dinheiro(venda.changeCents)}</strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={proximoCliente}>Próximo cliente</button>
                <button className="ghost" onClick={() => window.print()}>
                  Imprimir
                </button>
              </div>
            </section>
          )}

          {/* ---------------- 2. PAGAMENTO ---------------- */}
          {etapa === 'pagar' && (
            <>
              <section className="card" style={{ marginBottom: 16 }}>
                <div className="stat-label">Conferir a venda</div>
                {carrinho.map((l) => (
                  <div className="regra-linha" key={l.linhaId}>
                    <span>
                      {l.quantidade}× {l.nome}
                      {l.complementos.length > 0 && (
                        <div className="sub">{l.complementos.map((c) => c.name).join(', ')}</div>
                      )}
                    </span>
                    <strong>{dinheiro(totalDaLinha(l))}</strong>
                  </div>
                ))}
                <div className="regra-linha" style={{ fontSize: 22, marginTop: 8 }}>
                  <span>
                    <strong>Total</strong>
                  </span>
                  <strong>{dinheiro(total)}</strong>
                </div>
              </section>

              <section className="card" style={{ marginBottom: 16 }}>
                <div className="stat-label">Como o cliente vai pagar</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {FORMAS.map((f) => (
                    <button
                      key={f.valor}
                      className="canal-aba"
                      data-ativo={forma === f.valor}
                      onClick={() => setForma(f.valor)}
                      style={{ fontSize: 16, padding: '12px 18px' }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {forma === 'CASH' && (
                  <>
                    <label>Quanto o cliente entregou (opcional)</label>
                    <input
                      value={recebido}
                      onChange={(e) => setRecebido(e.target.value)}
                      placeholder="50,00"
                      inputMode="decimal"
                      style={{ fontSize: 22, textTransform: 'none' }}
                    />
                    {troco !== null && (
                      <div
                        className="regra-linha"
                        style={{ fontSize: 22, background: '#FEF3C7', borderRadius: 8, padding: 12 }}
                      >
                        <span>
                          <strong>Troco</strong>
                        </span>
                        <strong>{dinheiro(troco)}</strong>
                      </div>
                    )}
                    {recebido.trim() && troco === null && (
                      <p className="hint" style={{ color: '#B91C1C' }}>
                        Esse valor não cobre o total de {dinheiro(total)}.
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className="card" style={{ marginBottom: 16 }}>
                <div className="stat-label">Identificar o cliente (opcional)</div>
                <p className="hint" style={{ marginTop: 0 }}>
                  Com o telefone, a pessoa entra na sua base e ganha cashback. Sem, a venda sai
                  igual — só não dá para reconhecê-la depois.
                </p>
                <div className="form-linha">
                  <div>
                    <label>Nome</label>
                    <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ana" />
                  </div>
                  <div>
                    <label>Telefone</label>
                    <input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="48 99999-0000"
                      inputMode="tel"
                    />
                  </div>
                </div>
              </section>

              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={ocupado} onClick={fechar} style={{ fontSize: 18 }}>
                  {ocupado ? 'Fechando…' : `Receber ${dinheiro(total)}`}
                </button>
                <button className="ghost" disabled={ocupado} onClick={() => setEtapa('montar')}>
                  Voltar
                </button>
              </div>
            </>
          )}

          {/* ---------------- 1. MONTAR ---------------- */}
          {etapa === 'montar' && (
            <>
              {marcas.length > 1 && (
                <section className="card" style={{ marginBottom: 16 }}>
                  <label>Marca</label>
                  <select
                    value={marcaId}
                    onChange={(e) => setMarcaId(e.target.value)}
                    style={{ width: '100%', padding: 10 }}
                  >
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </section>
              )}

              {marcas.length === 0 && (
                <p className="vazio">
                  Nenhuma marca tem cardápio de balcão. Crie um em{' '}
                  <Link href="/admin">Cadastro → Cardápio → + Balcão</Link>.
                </p>
              )}

              {cardapio && (
                <SeletorDeItens
                  categorias={cardapio.categories}
                  cor={marca?.primaryColor ?? '#E11D48'}
                  rotuloEnviar="Ir para o pagamento"
                  enviando={false}
                  onEnviar={irParaPagamento}
                  grande
                />
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
