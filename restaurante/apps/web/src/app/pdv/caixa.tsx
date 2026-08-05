'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SeletorDeItens } from '@/components/seletor-de-itens';
import { chamarApi, paraCentavos } from '@/lib/chamar-api';
import {
  codigoProvisorio,
  fila,
  guardar,
  novoApelido,
  sincronizar,
  type VendaNaFila,
} from './fila-offline';
import {
  dinheiro,
  totalDaLinha,
  type CategoriaCardapio,
  type LinhaCarrinho,
} from '../m/[slug]/cardapio';
import {
  IconeAmpulheta,
  IconeCartao,
  IconeCelular,
  IconeDinheiro,
  IconeRecibo,
  IconeSemInternet,
} from '@/components/icones';

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
  { valor: 'CASH', label: 'Dinheiro', Icone: IconeDinheiro },
  { valor: 'CARD', label: 'Cartão', Icone: IconeCartao },
  { valor: 'PIX', label: 'Pix', Icone: IconeCelular },
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

  // ---- contingência: vender sem internet ----
  const [online, setOnline] = useState(true);
  const [pendentes, setPendentes] = useState<VendaNaFila[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  const marca = marcas.find((m) => m.id === marcaId);
  const total = useMemo(() => carrinho.reduce((s, l) => s + totalDaLinha(l), 0), [carrinho]);

  /** Troco só faz sentido no dinheiro e quando o valor recebido cobre a conta. */
  const troco = useMemo(() => {
    if (forma !== 'CASH' || !recebido.trim()) return null;
    const dado = paraCentavos(recebido);
    return dado >= total ? dado - total : null;
  }, [forma, recebido, total]);

  // Marcas e cardápio ficam guardados no aparelho. Sem isto, o caixa até
  // abriria offline, mas com a tela vazia — e tela vazia não vende nada.
  useEffect(() => {
    chamarApi<Marca[]>('/pdv/marcas').then((r) => {
      if (r.ok) {
        setMarcas(r.dados);
        localStorage.setItem('pdv:marcas', JSON.stringify(r.dados));
        setMarcaId((atual) => atual || r.dados[0]?.id || '');
        return;
      }
      const guardadas = localStorage.getItem('pdv:marcas');
      if (guardadas) {
        const lista = JSON.parse(guardadas) as Marca[];
        setMarcas(lista);
        setMarcaId((atual) => atual || lista[0]?.id || '');
      } else {
        setErro(r.erro);
      }
    });
  }, []);

  useEffect(() => {
    if (!marcaId) return;
    setCardapio(null);
    chamarApi<Cardapio>(`/pdv/cardapio/${marcaId}`).then((r) => {
      if (r.ok) {
        setCardapio(r.dados);
        localStorage.setItem(`pdv:cardapio:${marcaId}`, JSON.stringify(r.dados));
        return;
      }
      const guardado = localStorage.getItem(`pdv:cardapio:${marcaId}`);
      if (guardado) setCardapio(JSON.parse(guardado));
      else setErro(r.erro);
    });
  }, [marcaId]);

  const carregarCaixa = useCallback(async () => {
    const r = await chamarApi<Caixa>('/pdv/caixa');
    if (r.ok) setCaixa(r.dados);
  }, []);

  useEffect(() => {
    carregarCaixa();
  }, [carregarCaixa]);

  /** Sobe as vendas guardadas. Chamada sozinha e pelo botão. */
  const subirFila = useCallback(async () => {
    if (fila().length === 0) return;
    setSincronizando(true);
    const r = await sincronizar();
    setSincronizando(false);
    setPendentes(fila());
    if (r.subiram > 0) carregarCaixa();
  }, [carregarCaixa]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPendentes(fila());

    const voltou = () => {
      setOnline(true);
      subirFila();
    };
    const caiu = () => setOnline(false);

    window.addEventListener('online', voltou);
    window.addEventListener('offline', caiu);

    // O navegador só avisa quando o CABO cai. Se a internet existe mas o
    // servidor está fora, ninguém avisa — por isso tentamos de tempo em tempo.
    const relogio = setInterval(subirFila, 30_000);
    subirFila();

    return () => {
      window.removeEventListener('online', voltou);
      window.removeEventListener('offline', caiu);
      clearInterval(relogio);
    };
  }, [subirFila]);

  /** O seletor devolve a rodada montada; aqui ela vira o carrinho da venda. */
  function irParaPagamento(linhas: LinhaCarrinho[]) {
    setCarrinho(linhas);
    setErro(null);
    setEtapa('pagar');
  }

  async function fechar() {
    setOcupado(true);
    setErro(null);

    const corpo = {
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
    };

    const trocoLocal = troco ?? 0;

    /**
     * Guarda a venda no aparelho e devolve o comprovante provisório.
     *
     * O caixa NÃO pode ficar parado esperando internet com o cliente na
     * frente: o dinheiro já está na mão dele. Então a venda é dada como feita
     * aqui, com um código "OFF-xxxx", e sobe quando a conexão voltar.
     */
    const guardarParaDepois = () => {
      const clientRef = novoApelido();
      const codigo = codigoProvisorio();

      guardar({
        clientRef,
        soldAt: new Date().toISOString(),
        codigoProvisorio: codigo,
        corpo,
        tentativas: 0,
      });

      setPendentes(fila());
      setVenda({
        pedido: { code: codigo, totalCents: total, items: [] },
        changeCents: trocoLocal,
        paymentMethod: forma,
      });
      setEtapa('pronto');
    };

    // Sem internet nem tentamos: vai direto para a fila.
    if (!navigator.onLine) {
      setOcupado(false);
      return guardarParaDepois();
    }

    const clientRef = novoApelido();
    const r = await chamarApi<Venda>('/pdv/vendas', {
      metodo: 'POST',
      corpo: { ...corpo, clientRef, soldAt: new Date().toISOString() },
    });

    setOcupado(false);

    if (!r.ok) {
      // "O servidor não respondeu" é queda de conexão: a venda vale e vai para
      // a fila. Qualquer outro erro é recusa de verdade (item apagado, marca
      // pausada) e precisa aparecer para o caixa corrigir.
      if (r.erro === 'O servidor não respondeu.') return guardarParaDepois();
      return setErro(r.erro);
    }

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
            {verCaixa ? 'Voltar à venda' : <><IconeRecibo tamanho={15} /> Fechamento do dia</>}
          </button>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {erro && <div className="erro">{erro}</div>}

      {/* Estado da conexão: o caixa precisa saber, sem susto, o que está havendo. */}
      {!online && (
        <div className="fechado" style={{ margin: '0 0 16px' }}>
          <IconeSemInternet tamanho={17} /> <strong>Sem internet.</strong> Pode continuar vendendo normalmente — as vendas ficam
          guardadas neste aparelho e sobem sozinhas quando a conexão voltar. A cozinha só recebe
          os pedidos nessa hora; até lá, produza pelo papel.
        </div>
      )}

      {pendentes.length > 0 && (
        <div
          className="fechado"
          style={{
            margin: '0 0 16px',
            background: 'var(--aviso-bg)',
            borderColor: 'var(--aviso-bg)',
            color: 'var(--aviso)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>
              <IconeAmpulheta tamanho={15} /> <strong>{pendentes.length}</strong> venda(s) esperando para subir
              {pendentes.some((p) => p.ultimoErro) && ' — alguma foi recusada, veja abaixo'}
            </span>
            <button
              className="ghost"
              style={{ width: 'auto', padding: '4px 12px', fontSize: 12.5 }}
              disabled={sincronizando}
              onClick={subirFila}
            >
              {sincronizando ? 'Enviando…' : 'Tentar agora'}
            </button>
          </div>

          {pendentes
            .filter((p) => p.ultimoErro)
            .map((p) => (
              <div className="sub" key={p.clientRef} style={{ marginTop: 6 }}>
                {p.codigoProvisorio}: {p.ultimoErro}
              </div>
            ))}
        </div>
      )}

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
              {pendentes.length > 0 && (
                <div className="sub" style={{ marginTop: 6 }}>
                  + {pendentes.length} venda(s) ainda no aparelho, fora desta conta
                </div>
              )}
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
                    <f.Icone tamanho={15} /> {f.label}{' '}
                    <span className="sub">({linha?.quantidade ?? 0} venda[s])</span>
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
                {venda.pedido.code.startsWith('OFF-')
                  ? 'Venda registrada neste aparelho. Chame o cliente por este código e AVISE A COZINHA — ela só vai receber o pedido quando a internet voltar.'
                  : 'Chame o cliente por este código quando ficar pronto. O pedido já está na cozinha.'}
              </p>

              <div className="regra-linha" style={{ marginTop: 16 }}>
                <span>Total</span>
                <strong>{dinheiro(venda.pedido.totalCents)}</strong>
              </div>

              {venda.changeCents > 0 && (
                <div
                  className="regra-linha"
                  style={{ fontSize: 22, background: 'var(--aviso-bg)', borderRadius: 8, padding: 12 }}
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
                      <f.Icone tamanho={17} />
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
                        style={{ fontSize: 22, background: 'var(--aviso-bg)', borderRadius: 8, padding: 12 }}
                      >
                        <span>
                          <strong>Troco</strong>
                        </span>
                        <strong>{dinheiro(troco)}</strong>
                      </div>
                    )}
                    {recebido.trim() && troco === null && (
                      <p className="hint" style={{ color: 'var(--danger)' }}>
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
