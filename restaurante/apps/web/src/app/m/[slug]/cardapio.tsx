'use client';

import { useEffect, useMemo, useState } from 'react';

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
  modifierGroups: GrupoComplemento[];
};

export type CategoriaCardapio = { id: string; name: string; items: ItemCardapio[] };

export type MenuPublico = {
  brand: {
    name: string;
    slug: string;
    primaryColor: string;
    logoUrl: string | null;
    description: string | null;
  };
  channel: string;
  categories: CategoriaCardapio[];
};

// ---------------------------------------------------------------------------
// Carrinho (fica só no navegador do cliente — sem cadastro, sem conta)
// ---------------------------------------------------------------------------

type LinhaCarrinho = {
  /** identifica esta linha; o mesmo prato com complementos diferentes vira 2 linhas */
  linhaId: string;
  itemId: string;
  nome: string;
  precoUnitarioCents: number;
  quantidade: number;
  complementos: Modificador[];
};

/** Preço de uma linha = (item + complementos) x quantidade. */
function totalDaLinha(l: LinhaCarrinho) {
  const extras = l.complementos.reduce((s, c) => s + c.priceDeltaCents, 0);
  return (l.precoUnitarioCents + extras) * l.quantidade;
}

export function dinheiro(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---------------------------------------------------------------------------

export function Cardapio({ menu }: { menu: MenuPublico }) {
  const chaveCarrinho = `carrinho:${menu.brand.slug}`;

  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([]);
  const [itemAberto, setItemAberto] = useState<ItemCardapio | null>(null);
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState(menu.categories[0]?.id ?? '');

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

  function adicionar(linha: LinhaCarrinho) {
    setCarrinho((atual) => [...atual, linha]);
    setItemAberto(null);
  }

  function remover(linhaId: string) {
    setCarrinho((atual) => atual.filter((l) => l.linhaId !== linhaId));
  }

  function irPara(categoriaId: string) {
    setCategoriaAtiva(categoriaId);
    document.getElementById(`cat-${categoriaId}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="cardapio" style={{ ['--marca' as any]: menu.brand.primaryColor }}>
      <header className="capa">
        <span className="selo">Peça direto — sem app, sem cadastro</span>
        <h1>{menu.brand.name}</h1>
        {menu.brand.description && <p>{menu.brand.description}</p>}
      </header>

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
            <button className="produto" key={item.id} onClick={() => setItemAberto(item)}>
              <span className="info">
                <span className="nome">{item.name}</span>
                {item.description && <span className="desc">{item.description}</span>}
                <span className="preco">{dinheiro(item.priceCents)}</span>
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
        <JanelaDoItem item={itemAberto} onFechar={() => setItemAberto(null)} onAdicionar={adicionar} />
      )}

      {verCarrinho && (
        <JanelaDoCarrinho
          linhas={carrinho}
          total={totalCarrinho}
          onFechar={() => setVerCarrinho(false)}
          onRemover={remover}
        />
      )}

      {qtdTotal > 0 && !verCarrinho && !itemAberto && (
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
// Janela de um item: escolher complementos e quantidade
// ---------------------------------------------------------------------------

function JanelaDoItem({
  item,
  onFechar,
  onAdicionar,
}: {
  item: ItemCardapio;
  onFechar: () => void;
  onAdicionar: (linha: LinhaCarrinho) => void;
}) {
  // Guarda os ids escolhidos por grupo.
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
    // Falta escolher algo obrigatório?
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
// Janela do carrinho
// ---------------------------------------------------------------------------

function JanelaDoCarrinho({
  linhas,
  total,
  onFechar,
  onRemover,
}: {
  linhas: LinhaCarrinho[];
  total: number;
  onFechar: () => void;
  onRemover: (linhaId: string) => void;
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
              <div className="totais" style={{ marginTop: 14 }}>
                <span>Subtotal</span>
                <span>{dinheiro(total)}</span>
              </div>
              <div className="totais">
                <span>Entrega</span>
                <span>a calcular</span>
              </div>
              <div className="totais grande">
                <span>Total</span>
                <span>{dinheiro(total)}</span>
              </div>

              <button style={{ marginTop: 18 }} disabled title="Chega na próxima parte da Etapa 1">
                Finalizar pedido (em construção)
              </button>
              <p className="hint" style={{ marginTop: 12 }}>
                O fechamento do pedido — nome, telefone, endereço, agendamento e pagamento — é a
                próxima parte da Etapa 1.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
