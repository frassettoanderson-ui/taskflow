'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Formatos que vêm do backend
// ---------------------------------------------------------------------------

export type Modificador = { id: string; name: string; priceDeltaCents: number };

export type GrupoComplemento = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: Modificador[];
};

export type ItemCardapio = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  /** item pausado continua aparecendo, mas não pode ser pedido */
  disponivel: boolean;
  modifierGroups: GrupoComplemento[];
};

export type CategoriaCardapio = { id: string; name: string; items: ItemCardapio[] };

export type CanalDisponivel = { channel: string; apelido: string; label: string };

export type MenuPublico = {
  brand: {
    name: string;
    slug: string;
    primaryColor: string;
    logoUrl: string | null;
    description: string | null;
  };
  channel: string;
  channelLabel: string;
  /** os canais em que esta marca tem cardápio (viram as abas do topo) */
  canais: CanalDisponivel[];
  /** está aceitando pedidos agora? */
  situacao: { aberto: boolean; motivo: string | null; horarioDeHoje: string | null };
  categories: CategoriaCardapio[];
};

type Sugestao = { id: string; name: string; priceCents: number; imageUrl: string | null };

export type RegrasPublicas = {
  horarios: Array<{ weekday: number; dia: string; fechado: boolean; faixas: string[] }>;
  areas: Array<{
    id: string;
    kind: 'DISTRICT' | 'RADIUS';
    districtName: string | null;
    maxDistanceKm: number | null;
    feeCents: number;
    minOrderCents: number;
  }>;
};

// ---------------------------------------------------------------------------
// Carrinho (fica só no navegador do cliente — sem cadastro, sem conta)
// ---------------------------------------------------------------------------

export type LinhaCarrinho = {
  /** identifica esta linha; o mesmo prato com complementos diferentes vira 2 linhas */
  linhaId: string;
  itemId: string;
  nome: string;
  precoUnitarioCents: number;
  quantidade: number;
  complementos: Modificador[];
};

/** Preço de uma linha = (item + complementos) x quantidade. */
export function totalDaLinha(l: LinhaCarrinho) {
  const extras = l.complementos.reduce((s, c) => s + c.priceDeltaCents, 0);
  return (l.precoUnitarioCents + extras) * l.quantidade;
}

export function dinheiro(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Um apelido fixo para este navegador.
 *
 * Serve para reconhecer o MESMO carrinho quando o cliente volta — é o que
 * permite a recuperação de carrinho abandonado sem exigir cadastro.
 */
export function chaveDoNavegador(): string {
  if (typeof window === 'undefined') return 'servidor';
  const CHAVE = 'restaurante:navegador';
  let valor = localStorage.getItem(CHAVE);
  if (!valor) {
    valor = `nav-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(CHAVE, valor);
  }
  return valor;
}

// ---------------------------------------------------------------------------

export function Cardapio({
  menu,
  canalAtual,
  regras,
}: {
  menu: MenuPublico;
  canalAtual: string;
  regras: RegrasPublicas | null;
}) {
  const router = useRouter();

  // O carrinho é POR MARCA E POR CANAL: o que você montou no salão não pode
  // vazar para o delivery, porque os preços e os itens são outros.
  const chaveCarrinho = `carrinho:${menu.brand.slug}:${canalAtual}`;

  const aceitandoPedidos = menu.situacao.aberto;

  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([]);
  const [itemAberto, setItemAberto] = useState<ItemCardapio | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [verCheckout, setVerCheckout] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState(menu.categories[0]?.id ?? '');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);

  // Recupera o carrinho salvo (só depois que a página montou, para não brigar
  // com o HTML que veio do servidor).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveCarrinho);
      if (salvo) setCarrinho(JSON.parse(salvo));
    } catch {
      /* carrinho corrompido: começa vazio */
    }
  }, [chaveCarrinho]);

  useEffect(() => {
    localStorage.setItem(chaveCarrinho, JSON.stringify(carrinho));
  }, [carrinho, chaveCarrinho]);

  const totalCarrinho = useMemo(
    () => carrinho.reduce((s, l) => s + totalDaLinha(l), 0),
    [carrinho],
  );
  const qtdTotal = useMemo(() => carrinho.reduce((s, l) => s + l.quantidade, 0), [carrinho]);

  /** Cross-sell: pede ao backend o que costuma sair junto com o que já está no carrinho. */
  const buscarSugestoes = useCallback(async () => {
    const ids = [...new Set(carrinho.map((l) => l.itemId))];
    if (ids.length === 0) return setSugestoes([]);
    try {
      const res = await fetch(
        `/api/public/menu/${menu.brand.slug}/sugestoes?itemIds=${ids.join(',')}`,
      );
      if (res.ok) setSugestoes(await res.json());
    } catch {
      setSugestoes([]); // sugestão é enfeite: se falhar, o pedido segue
    }
  }, [carrinho, menu.brand.slug]);

  useEffect(() => {
    if (verCarrinho) buscarSugestoes();
  }, [verCarrinho, buscarSugestoes]);

  /**
   * Avisa o servidor sobre o carrinho, para a recuperação de carrinho
   * abandonado. Esperamos 3 segundos parado para não mandar a cada clique.
   */
  useEffect(() => {
    if (carrinho.length === 0) return;

    const timer = setTimeout(() => {
      fetch(`/api/public/carrinho/${menu.brand.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: chaveDoNavegador(),
          subtotalCents: totalCarrinho,
          itens: carrinho.map((l) => ({
            nome: l.nome,
            quantidade: l.quantidade,
            totalCents: totalDaLinha(l),
          })),
        }),
      }).catch(() => {
        /* recuperação de carrinho é um extra: se falhar, o pedido segue */
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [carrinho, totalCarrinho, menu.brand.slug]);

  function adicionar(linha: LinhaCarrinho) {
    setCarrinho((atual) => [...atual, linha]);
    setItemAberto(null);
  }

  function remover(linhaId: string) {
    setCarrinho((atual) => atual.filter((l) => l.linhaId !== linhaId));
  }

  /** Abre a janela do item sugerido (para o cliente escolher complementos). */
  function abrirSugestao(id: string) {
    for (const c of menu.categories) {
      const item = c.items.find((i) => i.id === id);
      if (item) {
        setVerCarrinho(false);
        setItemAberto(item);
        return;
      }
    }
  }

  function irPara(categoriaId: string) {
    setCategoriaAtiva(categoriaId);
    document.getElementById(`cat-${categoriaId}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  /** Deu certo o pedido: limpa o carrinho e vai para o acompanhamento. */
  function pedidoCriado(code: string) {
    localStorage.removeItem(chaveCarrinho);
    setCarrinho([]);
    router.push(`/pedido/${code}`);
  }

  return (
    <div className="cardapio" style={{ ['--marca' as any]: menu.brand.primaryColor }}>
      <header className="capa">
        <span className="selo">Peça direto — sem app, sem cadastro</span>
        <div className="capa-marca">
          {/* A logo é o que faz a página parecer do restaurante, e não nossa. */}
          {menu.brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="capa-logo" src={menu.brand.logoUrl} alt={menu.brand.name} />
          )}
          <div>
            <h1>{menu.brand.name}</h1>
            {menu.brand.description && <p>{menu.brand.description}</p>}
          </div>
        </div>
      </header>

      {/* Abas de canal: a mesma marca com cardápios diferentes */}
      {menu.canais.length > 1 && (
        <nav className="canais">
          {menu.canais.map((c) => (
            <a
              key={c.channel}
              className="canal-aba"
              data-ativo={c.apelido === canalAtual}
              href={`/m/${menu.brand.slug}?canal=${c.apelido}`}
            >
              {c.label}
            </a>
          ))}
        </nav>
      )}

      {!aceitandoPedidos && (
        <div className="fechado">
          <strong>Não estamos aceitando pedidos agora.</strong>
          <br />
          {menu.situacao.motivo}
          {/* Só repete o horário quando o motivo não o mencionou (ex.: marca pausada). */}
          {menu.situacao.horarioDeHoje &&
            !menu.situacao.motivo?.includes('das ') &&
            ` · ${menu.situacao.horarioDeHoje}`}
          <br />
          Você pode ver o cardápio à vontade — só não dá para finalizar o pedido.
        </div>
      )}

      <nav className="abas">
        {menu.categories.map((c) => (
          <button
            key={c.id}
            className="aba"
            data-ativa={c.id === categoriaAtiva}
            onClick={() => irPara(c.id)}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {menu.categories.map((categoria) => (
        <section className="secao" id={`cat-${categoria.id}`} key={categoria.id}>
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
                <span className="preco">{dinheiro(item.priceCents)}</span>
                {!item.disponivel && <span className="esgotado">Indisponível hoje</span>}
              </span>
              {item.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={item.imageUrl} alt={item.name} />
              )}
            </button>
          ))}
        </section>
      ))}

      {regras && <RodapeDeRegras regras={regras} entrega={menu.channel === 'DELIVERY'} />}

      {itemAberto && (
        <JanelaDoItem
          item={itemAberto}
          onFechar={() => setItemAberto(null)}
          onAdicionar={adicionar}
        />
      )}

      {verCarrinho && (
        <JanelaDoCarrinho
          linhas={carrinho}
          total={totalCarrinho}
          sugestoes={sugestoes}
          aceitandoPedidos={aceitandoPedidos}
          motivoFechado={menu.situacao.motivo}
          onFechar={() => setVerCarrinho(false)}
          onRemover={remover}
          onSugestao={abrirSugestao}
          onFinalizar={() => {
            setVerCarrinho(false);
            setVerCheckout(true);
          }}
        />
      )}

      {verCheckout && (
        <JanelaCheckout
          slug={menu.brand.slug}
          canal={canalAtual}
          precisaEndereco={menu.channel === 'DELIVERY'}
          linhas={carrinho}
          total={totalCarrinho}
          onFechar={() => setVerCheckout(false)}
          onCriado={pedidoCriado}
        />
      )}

      {qtdTotal > 0 && !verCarrinho && !itemAberto && !verCheckout && (
        <div className="barra-carrinho">
          <div className="interno">
            <button onClick={() => setVerCarrinho(true)}>
              <span>
                Ver carrinho · {qtdTotal} {qtdTotal === 1 ? 'item' : 'itens'}
              </span>
              <span>{dinheiro(totalCarrinho)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rodapé: horários e onde a marca entrega
// ---------------------------------------------------------------------------

function RodapeDeRegras({ regras, entrega }: { regras: RegrasPublicas; entrega: boolean }) {
  const hoje = new Date().getDay();
  const porBairro = regras.areas.filter((a) => a.kind === 'DISTRICT');
  const porRaio = regras.areas
    .filter((a) => a.kind === 'RADIUS')
    .sort((a, b) => (a.maxDistanceKm ?? 0) - (b.maxDistanceKm ?? 0));

  return (
    <section className="regras">
      <div className="regras-bloco">
        <h3>Horário de funcionamento</h3>
        {regras.horarios.map((h) => (
          <div className="regra-linha" key={h.weekday} data-hoje={h.weekday === hoje}>
            <span style={{ textTransform: 'capitalize' }}>{h.dia}</span>
            <span>{h.fechado ? 'fechado' : h.faixas.join(' e ')}</span>
          </div>
        ))}
      </div>

      {entrega && regras.areas.length > 0 && (
        <div className="regras-bloco">
          <h3>Onde entregamos</h3>

          {porBairro.map((a) => (
            <div className="regra-linha" key={a.id}>
              <span>{a.districtName}</span>
              <span>
                {dinheiro(a.feeCents)}
                {a.minOrderCents > 0 && (
                  <em style={{ color: 'var(--muted)', fontStyle: 'normal' }}>
                    {' '}
                    · mín. {dinheiro(a.minOrderCents)}
                  </em>
                )}
              </span>
            </div>
          ))}

          {porRaio.map((a) => (
            <div className="regra-linha" key={a.id}>
              <span>até {a.maxDistanceKm} km</span>
              <span>
                {dinheiro(a.feeCents)}
                {a.minOrderCents > 0 && (
                  <em style={{ color: 'var(--muted)', fontStyle: 'normal' }}>
                    {' '}
                    · mín. {dinheiro(a.minOrderCents)}
                  </em>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Janela de um item: escolher complementos e quantidade
// ---------------------------------------------------------------------------

export function JanelaDoItem({
  item,
  onFechar,
  onAdicionar,
}: {
  item: ItemCardapio;
  onFechar: () => void;
  onAdicionar: (linha: LinhaCarrinho) => void;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, string[]>>({});
  const [quantidade, setQuantidade] = useState(1);
  const [aviso, setAviso] = useState<string | null>(null);

  function alternar(grupo: GrupoComplemento, modificadorId: string) {
    setAviso(null);
    setEscolhas((atual) => {
      const atuais = atual[grupo.id] ?? [];

      // Grupo de escolha única: troca direto.
      if (grupo.maxSelect === 1) {
        return { ...atual, [grupo.id]: atuais[0] === modificadorId ? [] : [modificadorId] };
      }

      // Grupo de várias escolhas: marca/desmarca respeitando o máximo.
      if (atuais.includes(modificadorId)) {
        return { ...atual, [grupo.id]: atuais.filter((id) => id !== modificadorId) };
      }
      if (atuais.length >= grupo.maxSelect) {
        setAviso(`Em "${grupo.name}" você pode escolher no máximo ${grupo.maxSelect}.`);
        return atual;
      }
      return { ...atual, [grupo.id]: [...atuais, modificadorId] };
    });
  }

  const complementosEscolhidos: Modificador[] = useMemo(() => {
    const lista: Modificador[] = [];
    for (const grupo of item.modifierGroups) {
      for (const id of escolhas[grupo.id] ?? []) {
        const m = grupo.modifiers.find((x) => x.id === id);
        if (m) lista.push(m);
      }
    }
    return lista;
  }, [escolhas, item.modifierGroups]);

  const extras = complementosEscolhidos.reduce((s, c) => s + c.priceDeltaCents, 0);
  const total = (item.priceCents + extras) * quantidade;

  function confirmar() {
    const faltando = item.modifierGroups.find(
      (g) => g.minSelect > 0 && (escolhas[g.id]?.length ?? 0) < g.minSelect,
    );
    if (faltando) {
      setAviso(`Escolha ${faltando.minSelect} opção em "${faltando.name}".`);
      document.getElementById(`grupo-${faltando.id}`)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    onAdicionar({
      linhaId: `${item.id}-${Date.now()}`,
      itemId: item.id,
      nome: item.name,
      precoUnitarioCents: item.priceCents,
      quantidade,
      complementos: complementosEscolhidos,
    });
  }

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          {item.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.imageUrl} alt={item.name} />
          )}
          <button className="modal-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-corpo">
          <h2 className="title" style={{ fontSize: 19 }}>
            {item.name}
          </h2>
          {item.description && <p className="subtitle">{item.description}</p>}
          <div className="preco" style={{ fontWeight: 650 }}>
            {dinheiro(item.priceCents)}
          </div>

          {item.modifierGroups.map((grupo) => {
            const escolhidos = escolhas[grupo.id] ?? [];
            const obrigatorio = grupo.minSelect > 0;
            return (
              <div className="grupo" id={`grupo-${grupo.id}`} key={grupo.id}>
                <div className="grupo-cabecalho">
                  <strong>{grupo.name}</strong>
                  <span className={`etiqueta ${obrigatorio ? 'obrigatorio' : ''}`}>
                    {obrigatorio
                      ? 'Obrigatório'
                      : `Até ${grupo.maxSelect} ${grupo.maxSelect === 1 ? 'opção' : 'opções'}`}
                  </span>
                </div>

                {grupo.modifiers.map((m) => (
                  <label className="opcao" key={m.id}>
                    <input
                      type={grupo.maxSelect === 1 ? 'radio' : 'checkbox'}
                      name={grupo.id}
                      checked={escolhidos.includes(m.id)}
                      onChange={() => alternar(grupo, m.id)}
                    />
                    <span>{m.name}</span>
                    {m.priceDeltaCents > 0 && (
                      <span className="mais">+ {dinheiro(m.priceDeltaCents)}</span>
                    )}
                  </label>
                ))}
              </div>
            );
          })}

          {aviso && (
            <div className="error" style={{ marginTop: 18 }}>
              {aviso}
            </div>
          )}
        </div>

        <div className="modal-rodape">
          <div className="contador">
            <button onClick={() => setQuantidade((q) => Math.max(1, q - 1))} aria-label="Menos">
              −
            </button>
            <strong>{quantidade}</strong>
            <button onClick={() => setQuantidade((q) => q + 1)} aria-label="Mais">
              +
            </button>
          </div>
          <button className="adicionar" onClick={confirmar}>
            Adicionar · {dinheiro(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Janela do carrinho (com cross-sell)
// ---------------------------------------------------------------------------

function JanelaDoCarrinho({
  linhas,
  total,
  sugestoes,
  aceitandoPedidos,
  motivoFechado,
  onFechar,
  onRemover,
  onSugestao,
  onFinalizar,
}: {
  linhas: LinhaCarrinho[];
  total: number;
  sugestoes: Sugestao[];
  aceitandoPedidos: boolean;
  motivoFechado: string | null;
  onFechar: () => void;
  onRemover: (linhaId: string) => void;
  onSugestao: (itemId: string) => void;
  onFinalizar: () => void;
}) {
  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-corpo" style={{ paddingTop: 22 }}>
          <div className="grupo-cabecalho">
            <h2 className="title" style={{ fontSize: 19, margin: 0 }}>
              Seu carrinho
            </h2>
            <button className="modal-fechar" style={{ position: 'static' }} onClick={onFechar}>
              ×
            </button>
          </div>

          {linhas.length === 0 && <p className="vazio">Seu carrinho está vazio.</p>}

          {linhas.map((l) => (
            <div className="linha-carrinho" key={l.linhaId}>
              <span className="qtd">{l.quantidade}×</span>
              <span style={{ minWidth: 0 }}>
                <div>{l.nome}</div>
                {l.complementos.length > 0 && (
                  <div className="complementos">
                    {l.complementos.map((c) => c.name).join(' · ')}
                  </div>
                )}
                <button className="remover" onClick={() => onRemover(l.linhaId)}>
                  remover
                </button>
              </span>
              <span className="valor">{dinheiro(totalDaLinha(l))}</span>
            </div>
          ))}

          {linhas.length > 0 && (
            <>
              {sugestoes.length > 0 && (
                <div className="sugestoes">
                  <strong style={{ fontSize: 15 }}>Quem pediu isto também levou…</strong>
                  {sugestoes.map((s) => (
                    <button className="sugestao" key={s.id} onClick={() => onSugestao(s.id)}>
                      {s.imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.imageUrl} alt={s.name} />
                      )}
                      <span>{s.name}</span>
                      <span className="preco-sug">+ {dinheiro(s.priceCents)}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="totais" style={{ marginTop: 14 }}>
                <span>Subtotal</span>
                <span>{dinheiro(total)}</span>
              </div>
              <div className="totais">
                <span>Entrega</span>
                <span>calculada no próximo passo</span>
              </div>

              {aceitandoPedidos ? (
                <button style={{ marginTop: 18 }} onClick={onFinalizar}>
                  Continuar · {dinheiro(total)}
                </button>
              ) : (
                <>
                  <button style={{ marginTop: 18 }} disabled>
                    Fechado no momento
                  </button>
                  <p className="hint" style={{ marginTop: 10 }}>
                    {motivoFechado}. Seu carrinho fica guardado — é só voltar quando abrirmos.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fechamento do pedido: dados de entrega, agendamento e envio
// ---------------------------------------------------------------------------

function JanelaCheckout({
  slug,
  canal,
  precisaEndereco,
  linhas,
  total,
  onFechar,
  onCriado,
}: {
  slug: string;
  canal: string;
  /** salão e balcão não têm entrega — não faz sentido pedir endereço */
  precisaEndereco: boolean;
  linhas: LinhaCarrinho[];
  total: number;
  onFechar: () => void;
  onCriado: (code: string) => void;
}) {
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    addressStreet: '',
    addressNumber: '',
    addressDistrict: '',
    addressCity: '',
    addressNote: '',
    notes: '',
  });
  const [agendar, setAgendar] = useState(false);
  const [quando, setQuando] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // ---- cupom e cashback ----
  const [cupom, setCupom] = useState('');
  const [cupomOk, setCupomOk] = useState<{ desconto: number; texto: string } | null>(null);
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const [conferindoCupom, setConferindoCupom] = useState(false);
  const [carteira, setCarteira] = useState<{ saldo: number; maxUsavel: number } | null>(null);
  const [usarCashback, setUsarCashback] = useState(false);

  // ---- confirmação do cashback por código ----
  // Marcar "usar" não basta mais: o cliente precisa provar que o telefone é
  // dele digitando um código de 6 dígitos.
  const [codigo, setCodigo] = useState('');
  const [tokenCashback, setTokenCashback] = useState<string | null>(null);
  const [codigoPedido, setCodigoPedido] = useState<{ para: string; teste?: string } | null>(null);
  const [codigoErro, setCodigoErro] = useState<string | null>(null);
  const [ocupadoCodigo, setOcupadoCodigo] = useState(false);

  async function pedirCodigoCashback() {
    setOcupadoCodigo(true);
    setCodigoErro(null);
    try {
      const res = await fetch(`/api/public/cashback/${slug}/codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: form.customerPhone }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? 'Não consegui enviar o código.');
      setCodigoPedido({ para: d.para, teste: d.codigoDeTeste });
    } catch (e: any) {
      setCodigoErro(e.message);
    } finally {
      setOcupadoCodigo(false);
    }
  }

  async function confirmarCodigoCashback() {
    setOcupadoCodigo(true);
    setCodigoErro(null);
    try {
      const res = await fetch(`/api/public/cashback/${slug}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: form.customerPhone, codigo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? 'Código inválido.');
      setTokenCashback(d.token);
    } catch (e: any) {
      setCodigoErro(e.message);
    } finally {
      setOcupadoCodigo(false);
    }
  }

  /** Ao digitar o telefone, buscamos o saldo de cashback daquele cliente. */
  async function consultarCashback(telefone: string) {
    const so = telefone.replace(/\D/g, '');
    if (so.length < 10) return setCarteira(null);

    // De quebra, o carrinho passa a ter dono: se a pessoa desistir agora,
    // conseguimos mandar o lembrete.
    fetch(`/api/public/carrinho/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: chaveDoNavegador(),
        subtotalCents: total,
        nome: form.customerName,
        telefone: so,
        itens: linhas.map((l) => ({ nome: l.nome, quantidade: l.quantidade })),
      }),
    }).catch(() => {});

    try {
      const res = await fetch(
        `/api/public/cashback/${slug}?telefone=${so}&subtotal=${total}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const d = await res.json();
      if (d.temPrograma && d.saldoCents > 0) {
        setCarteira({ saldo: d.saldoCents, maxUsavel: d.maxUsavelCents });
      } else {
        setCarteira(null);
      }
    } catch {
      setCarteira(null);
    }
  }

  /** Confere o cupom no servidor — a tela só mostra o resultado. */
  async function conferirCupom() {
    if (!cupom.trim()) return;
    setConferindoCupom(true);
    setCupomErro(null);
    setCupomOk(null);
    try {
      const res = await fetch(`/api/public/cupom/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cupom.trim(),
          subtotalCents: total,
          telefone: form.customerPhone,
        }),
      });
      const d = await res.json();
      if (d.valido) {
        setCupomOk({
          desconto: d.discountCents,
          texto: d.freteGratis
            ? 'Frete grátis aplicado!'
            : `Desconto de ${dinheiro(d.discountCents)} aplicado!`,
        });
      } else {
        setCupomErro(d.motivo ?? 'Cupom inválido.');
      }
    } catch {
      setCupomErro('Não consegui conferir o cupom agora.');
    } finally {
      setConferindoCupom(false);
    }
  }

  // Sem o código confirmado, o desconto nem entra na conta — assim o total na
  // tela é sempre o total que vai ser cobrado.
  const cashbackUsado = usarCashback && carteira && tokenCashback ? carteira.maxUsavel : 0;
  const descontoCupom = cupomOk?.desconto ?? 0;
  const totalEstimado = Math.max(0, total - descontoCupom - cashbackUsado);

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

    if (agendar && !quando) {
      setErro('Escolha a data e a hora da entrega.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(`/api/public/orders/${slug}?canal=${encodeURIComponent(canal)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          paymentMethod: 'PIX',
          couponCode: cupomOk ? cupom.trim() : undefined,
          useCashbackCents: cashbackUsado > 0 ? cashbackUsado : undefined,
          cashbackToken: cashbackUsado > 0 ? tokenCashback : undefined,
          clientKey: chaveDoNavegador(),
          scheduledFor: agendar && quando ? new Date(quando).toISOString() : undefined,
          // Mandamos apenas O QUE foi escolhido. O preço é recalculado no servidor.
          items: linhas.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantidade,
            modifierIds: l.complementos.map((c) => c.id),
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErro(Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Não consegui registrar o pedido.'));
        return;
      }

      onCriado(data.code);
    } catch {
      setErro('O servidor não respondeu. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  // Sugere "daqui a uma hora" como padrão do agendamento.
  const minimo = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <div className="modal-corpo" style={{ paddingTop: 22 }}>
          <div className="grupo-cabecalho">
            <h2 className="title" style={{ fontSize: 19, margin: 0 }}>
              Seus dados
            </h2>
            <button
              type="button"
              className="modal-fechar"
              style={{ position: 'static' }}
              onClick={onFechar}
            >
              ×
            </button>
          </div>
          <p className="subtitle">Sem cadastro. Só o necessário para entregar.</p>

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
              consultarCashback(e.target.value);
            }}
          />

          {/* Cashback deste cliente nesta marca */}
          {carteira && (
            <div className="oferta">
              💰 Você tem <strong>{dinheiro(carteira.saldo)}</strong> de cashback aqui.
              <label className="opcao" style={{ borderBottom: 0, paddingBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={usarCashback}
                  onChange={(e) => setUsarCashback(e.target.checked)}
                />
                <span>Usar {dinheiro(carteira.maxUsavel)} neste pedido</span>
              </label>

              {/* Confirmação: o telefone identifica, o código é quem prova. */}
              {usarCashback && !tokenCashback && (
                <div style={{ marginTop: 10 }}>
                  {!codigoPedido ? (
                    <>
                      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                        Para usar o saldo, confirme que este telefone é seu.
                      </p>
                      <button
                        type="button"
                        className="ghost"
                        disabled={ocupadoCodigo}
                        onClick={pedirCodigoCashback}
                      >
                        {ocupadoCodigo ? 'Enviando…' : 'Enviar código'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                        Enviamos um código para <strong>{codigoPedido.para}</strong>. Digite
                        abaixo:
                      </p>
                      {codigoPedido.teste && (
                        <p style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.8 }}>
                          (modo de teste — o WhatsApp ainda não está ligado. Seu código é{' '}
                          <strong>{codigoPedido.teste}</strong>)
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
                          disabled={ocupadoCodigo || codigo.replace(/\D/g, '').length !== 6}
                          onClick={confirmarCodigoCashback}
                        >
                          Confirmar
                        </button>
                      </div>
                    </>
                  )}
                  {codigoErro && (
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--danger)' }}>
                      {codigoErro}
                    </p>
                  )}
                </div>
              )}

              {usarCashback && tokenCashback && (
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  ✅ Confirmado. {dinheiro(carteira.maxUsavel)} vão sair do total.
                </p>
              )}
            </div>
          )}

          {precisaEndereco && (
            <>
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

              <label htmlFor="compl">Complemento / ponto de referência</label>
              <input id="compl" placeholder="Apto 302, portão azul…" {...campo('addressNote')} />
            </>
          )}

          <label>Quando você quer receber?</label>
          <div className="escolha-quando">
            <button type="button" data-ativo={!agendar} onClick={() => setAgendar(false)}>
              Assim que ficar pronto
            </button>
            <button type="button" data-ativo={agendar} onClick={() => setAgendar(true)}>
              Agendar
            </button>
          </div>

          {agendar && (
            <>
              <label htmlFor="quando">Data e hora</label>
              <input
                id="quando"
                type="datetime-local"
                min={minimo}
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
              />
            </>
          )}

          <label htmlFor="obs">Observação do pedido</label>
          <input id="obs" placeholder="Sem cebola, por favor…" {...campo('notes')} />

          <label htmlFor="cupom">Cupom de desconto</label>
          <div className="cupom-caixa">
            <input
              id="cupom"
              value={cupom}
              onChange={(e) => {
                setCupom(e.target.value);
                setCupomOk(null);
                setCupomErro(null);
              }}
              placeholder="PRIMEIRA10"
            />
            <button type="button" className="ghost" onClick={conferirCupom} disabled={conferindoCupom}>
              {conferindoCupom ? '…' : 'Aplicar'}
            </button>
          </div>
          {cupomOk && <div className="oferta">🎟️ {cupomOk.texto}</div>}
          {cupomErro && <div className="oferta ruim">{cupomErro}</div>}

          <div className="totais" style={{ marginTop: 10 }}>
            <span>Itens</span>
            <span>{dinheiro(total)}</span>
          </div>
          {descontoCupom > 0 && (
            <div className="totais">
              <span>Cupom {cupom.toUpperCase()}</span>
              <span>− {dinheiro(descontoCupom)}</span>
            </div>
          )}
          {cashbackUsado > 0 && (
            <div className="totais">
              <span>Cashback</span>
              <span>− {dinheiro(cashbackUsado)}</span>
            </div>
          )}
          <div className="totais grande">
            <span>Subtotal</span>
            <span>{dinheiro(totalEstimado)}</span>
          </div>
          <p className="hint" style={{ marginTop: 4 }}>
            {precisaEndereco
              ? 'A taxa de entrega é calculada pelo seu bairro no próximo passo, junto com o Pix.'
              : 'Sem taxa de entrega neste canal.'}
          </p>

          <button type="submit" disabled={enviando} style={{ marginTop: 8 }}>
            {enviando ? 'Registrando…' : 'Ir para o pagamento'}
          </button>
        </div>
      </form>
    </div>
  );
}
