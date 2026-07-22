'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  dinheiro,
  totalDaLinha,
  JanelaDoItem,
  type CategoriaCardapio,
  type ItemCardapio,
  type LinhaCarrinho,
} from '../../m/[slug]/cardapio';

/** No portal, cada item carrega TAMBÉM o preço do canal direto. */
export type ItemDoPortal = ItemCardapio & { precoDiretoCents: number };

export type MenuDoPortal = {
  marca: { slug: string; nome: string; descricao: string | null; categoria: string; cor: string };
  situacao: { aberto: boolean; motivo: string | null; horarioDeHoje: string | null };
  comissaoPercentual: number;
  categories: Array<Omit<CategoriaCardapio, 'items'> & { items: ItemDoPortal[] }>;
};

/**
 * O cardápio visto pelo PORTAL.
 *
 * Os preços já vêm com a comissão embutida — e mostramos, com todas as letras,
 * quanto sairia pedindo direto. Nenhum marketplace faz isso; aqui é o ponto.
 */
export function CardapioDoPortal({ menu, slug }: { menu: MenuDoPortal; slug: string }) {
  const router = useRouter();
  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([]);
  const [itemAberto, setItemAberto] = useState<ItemDoPortal | null>(null);
  const [checkout, setCheckout] = useState(false);

  const total = useMemo(() => carrinho.reduce((s, l) => s + totalDaLinha(l), 0), [carrinho]);
  const qtd = useMemo(() => carrinho.reduce((s, l) => s + l.quantidade, 0), [carrinho]);

  /** Quanto o mesmo carrinho custaria no site do restaurante. */
  const totalDireto = useMemo(() => {
    let soma = 0;
    for (const l of carrinho) {
      for (const c of menu.categories) {
        const item = c.items.find((i) => i.id === l.itemId);
        if (item) {
          const extras = l.complementos.reduce((s, m) => s + m.priceDeltaCents, 0);
          const fator = item.precoDiretoCents / (item.priceCents || 1);
          soma += Math.round((item.precoDiretoCents + extras * fator) * l.quantidade);
        }
      }
    }
    return soma;
  }, [carrinho, menu.categories]);

  return (
    <div className="cardapio" style={{ ['--marca' as any]: menu.marca.cor }}>
      <header className="capa">
        <Link href="/portal" className="voltar-portal">
          ← Portal
        </Link>
        <span className="selo">{menu.marca.categoria}</span>
        <h1>{menu.marca.nome}</h1>
        {menu.marca.descricao && <p>{menu.marca.descricao}</p>}
      </header>

      {!menu.situacao.aberto && (
        <div className="fechado">
          <strong>Fechado agora.</strong>
          <br />
          {menu.situacao.motivo}
        </div>
      )}

      {/* O aviso que nenhum marketplace dá */}
      <div className="aviso-portal">
        Os preços aqui incluem <strong>{menu.comissaoPercentual}%</strong> do portal. Pedindo direto
        no site do restaurante sai mais barato — e depois deste pedido você ganha um cupom para
        fazer exatamente isso.
      </div>

      {menu.categories.map((categoria) => (
        <section className="secao" key={categoria.id}>
          <h2>{categoria.name}</h2>
          {categoria.items.map((item) => (
            <button
              className="produto"
              key={item.id}
              data-indisponivel={!item.disponivel}
              disabled={!item.disponivel}
              onClick={() => item.disponivel && setItemAberto(item)}
            >
              <span className="info">
                <span className="nome">{item.name}</span>
                {item.description && <span className="desc">{item.description}</span>}
                <span className="preco">
                  {dinheiro(item.priceCents)}
                  <span className="preco-direto">direto: {dinheiro(item.precoDiretoCents)}</span>
                </span>
                {!item.disponivel && <span className="esgotado">Indisponível</span>}
              </span>
              {item.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={item.imageUrl} alt={item.name} />
              )}
            </button>
          ))}
        </section>
      ))}

      {itemAberto && (
        <JanelaDoItem
          item={itemAberto}
          onFechar={() => setItemAberto(null)}
          onAdicionar={(linha) => {
            setCarrinho((a) => [...a, linha]);
            setItemAberto(null);
          }}
        />
      )}

      {checkout && (
        <CheckoutDoPortal
          slug={slug}
          linhas={carrinho}
          total={total}
          totalDireto={totalDireto}
          onFechar={() => setCheckout(false)}
          onCriado={(code) => router.push(`/portal/pedido/${code}`)}
        />
      )}

      {qtd > 0 && !itemAberto && !checkout && (
        <div className="barra-carrinho">
          <div className="interno">
            <button onClick={() => setCheckout(true)} disabled={!menu.situacao.aberto}>
              <span>
                {menu.situacao.aberto ? 'Finalizar' : 'Fechado agora'} · {qtd}{' '}
                {qtd === 1 ? 'item' : 'itens'}
              </span>
              <span>{dinheiro(total)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckoutDoPortal({
  slug,
  linhas,
  total,
  totalDireto,
  onFechar,
  onCriado,
}: {
  slug: string;
  linhas: LinhaCarrinho[];
  total: number;
  totalDireto: number;
  onFechar: () => void;
  onCriado: (code: string) => void;
}) {
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    addressStreet: '',
    addressNumber: '',
    addressDistrict: '',
    addressCity: 'Imbituba',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // ---- carteira da rede ----
  // O saldo é do consumidor e vale em QUALQUER restaurante do portal. Para
  // gastar, ele confirma um código: o telefone identifica, não prova.
  const [saldo, setSaldo] = useState(0);
  const [usar, setUsar] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [enviado, setEnviado] = useState<{ para: string; teste?: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [erroCodigo, setErroCodigo] = useState<string | null>(null);

  const usadoDaCarteira = usar && token ? Math.min(saldo, total) : 0;

  async function consultarCarteira(telefone: string) {
    const so = telefone.replace(/\D/g, '');
    if (so.length < 10) return setSaldo(0);
    try {
      const res = await fetch(`/api/portal/carteira?telefone=${so}`, { cache: 'no-store' });
      const d = await res.json();
      setSaldo(d.saldoCents ?? 0);
    } catch {
      setSaldo(0);
    }
  }

  async function pedirCodigo() {
    setErroCodigo(null);
    try {
      const res = await fetch('/api/portal/carteira/codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandSlug: slug, telefone: form.customerPhone }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? 'Não consegui enviar o código.');
      setEnviado({ para: d.para, teste: d.codigoDeTeste });
    } catch (e: any) {
      setErroCodigo(e.message);
    }
  }

  async function confirmarCodigo() {
    setErroCodigo(null);
    try {
      const res = await fetch('/api/portal/carteira/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandSlug: slug, telefone: form.customerPhone, codigo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? 'Código inválido.');
      setToken(d.token);
    } catch (e: any) {
      setErroCodigo(e.message);
    }
  }

  function campo(nome: keyof typeof form) {
    return {
      value: form[nome],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [nome]: e.target.value })),
    };
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch(`/api/portal/marca/${slug}/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          paymentMethod: 'PIX',
          useNetworkWalletCents: usadoDaCarteira > 0 ? usadoDaCarteira : undefined,
          cashbackToken: usadoDaCarteira > 0 ? token : undefined,
          items: linhas.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantidade,
            modifierIds: l.complementos.map((c) => c.id),
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(Array.isArray(d.message) ? d.message[0] : (d.message ?? 'Não consegui registrar.'));
        return;
      }
      onCriado(d.code);
    } catch {
      setErro('O servidor não respondeu.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <div className="modal-corpo" style={{ paddingTop: 22 }}>
          <div className="grupo-cabecalho">
            <h2 className="title" style={{ fontSize: 19, margin: 0 }}>
              Seus dados
            </h2>
            <button type="button" className="modal-fechar" style={{ position: 'static' }} onClick={onFechar}>
              ×
            </button>
          </div>

          {erro && <div className="error">{erro}</div>}

          <label htmlFor="nome">Nome</label>
          <input id="nome" required minLength={2} {...campo('customerName')} />

          <label htmlFor="fone">Telefone (com DDD)</label>
          <input
            id="fone"
            required
            minLength={8}
            placeholder="48 99999-0000"
            value={form.customerPhone}
            onChange={(e) => {
              setForm((f) => ({ ...f, customerPhone: e.target.value }));
              consultarCarteira(e.target.value);
            }}
          />

          {/* Carteira da rede: o saldo que o portal deu de volta */}
          {saldo > 0 && (
            <div className="oferta">
              👛 Você tem <strong>{dinheiro(saldo)}</strong> na sua carteira da rede.
              <label className="opcao" style={{ borderBottom: 0, paddingBottom: 0 }}>
                <input type="checkbox" checked={usar} onChange={(e) => setUsar(e.target.checked)} />
                <span>Usar {dinheiro(Math.min(saldo, total))} neste pedido</span>
              </label>

              {usar && !token && (
                <div style={{ marginTop: 10 }}>
                  {!enviado ? (
                    <>
                      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                        Confirme que este telefone é seu.
                      </p>
                      <button type="button" className="ghost" onClick={pedirCodigo}>
                        Enviar código
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                        Código enviado para <strong>{enviado.para}</strong>.
                      </p>
                      {enviado.teste && (
                        <p style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.8 }}>
                          (modo de teste — seu código é <strong>{enviado.teste}</strong>)
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value)}
                          placeholder="000000"
                          inputMode="numeric"
                          maxLength={6}
                          style={{ letterSpacing: 4, textAlign: 'center', marginBottom: 0 }}
                        />
                        <button
                          type="button"
                          disabled={codigo.replace(/\D/g, '').length !== 6}
                          onClick={confirmarCodigo}
                        >
                          Confirmar
                        </button>
                      </div>
                    </>
                  )}
                  {erroCodigo && (
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: '#fca5a5' }}>{erroCodigo}</p>
                  )}
                </div>
              )}

              {usar && token && (
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  ✅ Confirmado. {dinheiro(usadoDaCarteira)} saem do total.
                </p>
              )}
            </div>
          )}

          <label htmlFor="rua">Rua</label>
          <input id="rua" required {...campo('addressStreet')} />

          <div className="form-linha">
            <div>
              <label htmlFor="num">Número</label>
              <input id="num" required {...campo('addressNumber')} />
            </div>
            <div>
              <label htmlFor="bairro">Bairro</label>
              <input id="bairro" required {...campo('addressDistrict')} />
            </div>
          </div>

          <label htmlFor="cidade">Cidade</label>
          <input id="cidade" required {...campo('addressCity')} />

          <div className="totais grande" style={{ marginTop: 12 }}>
            <span>Itens</span>
            <span>{dinheiro(total)}</span>
          </div>

          {totalDireto > 0 && total > totalDireto && (
            <div className="oferta">
              💡 Pedindo direto no site da casa, os mesmos itens sairiam por{' '}
              <strong>{dinheiro(totalDireto)}</strong>. Finalize aqui e você recebe um{' '}
              <strong>cupom de {dinheiro(total - totalDireto)}</strong> para a próxima.
            </div>
          )}

          <button type="submit" disabled={enviando}>
            {enviando ? 'Registrando…' : 'Ir para o pagamento'}
          </button>
        </div>
      </form>
    </div>
  );
}
