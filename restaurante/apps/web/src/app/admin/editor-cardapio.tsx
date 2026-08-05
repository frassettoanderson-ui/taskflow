'use client';

import { useCallback, useEffect, useState } from 'react';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';
import { chamarApi, enviarFoto, paraCampo, paraCentavos } from '@/lib/chamar-api';
import {
  IconeCopiar,
  IconeDescer,
  IconeFechar,
  IconeLapis,
  IconeLixeira,
  IconeOlho,
  IconeOlhoCortado,
  IconeSubir,
} from '@/components/icones';

type Cardapio = { id: string; channel: string; channelLabel: string; name: string; categorias: number };

type Opcao = { id: string; nome: string; acrescimoCents: number; ativo: boolean };
type Grupo = { id: string; nome: string; minimo: number; maximo: number; opcoes: Opcao[] };
type Item = {
  id: string;
  nome: string;
  descricao: string | null;
  precoCents: number;
  imagemUrl: string | null;
  ativo: boolean;
  estacao: { id: string; name: string } | null;
  grupos: Grupo[];
  /** só preenchido quando é um item NOVO, para saber em que categoria criar */
  categoryId?: string;
};
type Categoria = { id: string; nome: string; ativa: boolean; itens: Item[] };
type CardapioCompleto = {
  id: string;
  channelLabel: string;
  categorias: Categoria[];
};

type Estacao = { id: string; nome: string };

const CANAIS = [
  { valor: 'delivery', label: 'Delivery' },
  { valor: 'salao', label: 'Salão' },
  { valor: 'balcao', label: 'Balcão' },
];

export function EditorDeCardapio({
  marca,
  onErro,
  onAviso,
}: {
  marca: MarcaResumo;
  onErro: (e: string | null) => void;
  onAviso: (t: string) => void;
}) {
  const [cardapios, setCardapios] = useState<Cardapio[]>([]);
  const [menuId, setMenuId] = useState('');
  const [cardapio, setCardapio] = useState<CardapioCompleto | null>(null);
  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [itemAberto, setItemAberto] = useState<Item | null>(null);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [copiando, setCopiando] = useState(false);

  /** Carrega a lista de cardápios da marca (um por canal). */
  const carregarCardapios = useCallback(async () => {
    const r = await chamarApi<Cardapio[]>(`/admin/marcas/${marca.id}/cardapios`);
    if (!r.ok) return onErro(r.erro);
    setCardapios(r.dados);
    setMenuId((atual) => (r.dados.some((c) => c.id === atual) ? atual : (r.dados[0]?.id ?? '')));
  }, [marca.id, onErro]);

  const carregarCardapio = useCallback(async () => {
    if (!menuId) return setCardapio(null);
    const r = await chamarApi<CardapioCompleto>(`/admin/cardapios/${menuId}`);
    if (r.ok) setCardapio(r.dados);
  }, [menuId]);

  useEffect(() => {
    carregarCardapios();
    chamarApi<Estacao[]>('/admin/estacoes').then((r) => r.ok && setEstacoes(r.dados));
  }, [carregarCardapios]);

  useEffect(() => {
    carregarCardapio();
  }, [carregarCardapio]);

  /** Faz a chamada, mostra o erro e recarrega. */
  async function agir(
    caminho: string,
    opcoes: { metodo?: string; corpo?: unknown } = {},
    sucesso?: string,
  ) {
    setOcupado(true);
    onErro(null);
    const r = await chamarApi(caminho, opcoes);
    setOcupado(false);

    if (!r.ok) {
      onErro(r.erro);
      return null;
    }
    if (sucesso) onAviso(sucesso);
    await carregarCardapio();
    await carregarCardapios();
    return r.dados;
  }

  const canaisFaltando = CANAIS.filter(
    (c) => !cardapios.some((m) => m.channelLabel.toLowerCase() === c.label.toLowerCase()),
  );

  return (
    <>
      {/* qual canal estou editando */}
      <div className="canais" style={{ padding: '0 0 16px' }}>
        {cardapios.map((c) => (
          <button
            key={c.id}
            className="canal-aba"
            data-ativo={menuId === c.id}
            onClick={() => setMenuId(c.id)}
          >
            {c.channelLabel}
            <b style={{ marginLeft: 6, opacity: 0.7 }}>{c.categorias}</b>
          </button>
        ))}

        {canaisFaltando.map((c) => (
          <button
            key={c.valor}
            className="canal-aba"
            style={{ borderStyle: 'dashed' }}
            disabled={ocupado}
            onClick={() =>
              agir(
                `/admin/marcas/${marca.id}/cardapios`,
                { metodo: 'POST', corpo: { canal: c.valor } },
                `Cardápio de ${c.label} criado.`,
              )
            }
          >
            + {c.label}
          </button>
        ))}
      </div>

      {/* copiar de um canal para outro */}
      {cardapios.length > 1 && (
        <section className="card" style={{ marginBottom: 16 }}>
          {!copiando ? (
            <button className="ghost" style={{ width: 'auto' }} onClick={() => setCopiando(true)}>
              <IconeCopiar tamanho={16} />
              Copiar cardápio de outro canal
            </button>
          ) : (
            <FormularioCopiar
              cardapios={cardapios}
              destinoId={menuId}
              ocupado={ocupado}
              onCancelar={() => setCopiando(false)}
              onCopiar={async (d) => {
                const r = await agir('/admin/cardapios/copiar', { metodo: 'POST', corpo: d });
                if (r) {
                  setCopiando(false);
                  onAviso(`Copiado: ${r.itens} itens com ${r.ajuste}.`);
                }
              }}
            />
          )}
        </section>
      )}

      {!cardapio ? (
        <p className="vazio">Escolha um canal acima.</p>
      ) : (
        <>
          {/* nova categoria */}
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="cupom-caixa">
              <input
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Nome da categoria (ex.: Pizzas, Bebidas)"
                style={{ textTransform: 'none' }}
              />
              <button
                disabled={ocupado || novaCategoria.trim().length < 2}
                onClick={async () => {
                  const r = await agir(
                    `/admin/cardapios/${cardapio.id}/categorias`,
                    { metodo: 'POST', corpo: { name: novaCategoria } },
                    'Categoria criada.',
                  );
                  if (r) setNovaCategoria('');
                }}
              >
                + Categoria
              </button>
            </div>
          </section>

          {cardapio.categorias.length === 0 && (
            <p className="vazio">
              Cardápio vazio. Crie a primeira categoria acima — depois os pratos entram dentro dela.
            </p>
          )}

          {cardapio.categorias.map((cat, i) => (
            <section className="card categoria-bloco" key={cat.id}>
              <div className="grupo-cabecalho">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 16 }}>{cat.nome}</strong>
                  <span className="sub">
                    {cat.itens.length} {cat.itens.length === 1 ? 'item' : 'itens'}
                  </span>
                  {!cat.ativa && <span className="situacao" data-status="CANCELED">oculta</span>}
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="botao-mini"
                    disabled={ocupado || i === 0}
                    title="Subir"
                    onClick={() =>
                      agir(`/admin/categorias/${cat.id}/mover`, {
                        metodo: 'PATCH',
                        corpo: { direcao: 'cima' },
                      })
                    }
                  >
                    <IconeSubir tamanho={15} />
                  </button>
                  <button
                    className="botao-mini"
                    disabled={ocupado || i === cardapio.categorias.length - 1}
                    title="Descer"
                    onClick={() =>
                      agir(`/admin/categorias/${cat.id}/mover`, {
                        metodo: 'PATCH',
                        corpo: { direcao: 'baixo' },
                      })
                    }
                  >
                    <IconeDescer tamanho={15} />
                  </button>
                  <button
                    className="botao-mini"
                    disabled={ocupado}
                    title={cat.ativa ? 'Ocultar do cardápio' : 'Mostrar'}
                    onClick={() =>
                      agir(`/admin/categorias/${cat.id}`, {
                        metodo: 'PATCH',
                        corpo: { active: !cat.ativa },
                      })
                    }
                  >
                    {cat.ativa ? <IconeOlho tamanho={15} /> : <IconeOlhoCortado tamanho={15} />}
                  </button>
                  <button
                    className="botao-mini perigo"
                    disabled={ocupado}
                    title="Apagar categoria"
                    onClick={() => {
                      const ok = confirm(
                        `Apagar "${cat.nome}" e os ${cat.itens.length} itens dentro dela?\n\n` +
                          'Os pedidos antigos não se perdem — eles guardam cópia do nome e do preço.',
                      );
                      if (ok) agir(`/admin/categorias/${cat.id}`, { metodo: 'DELETE' }, 'Categoria apagada.');
                    }}
                  >
                    <IconeLixeira tamanho={15} />
                  </button>
                </div>
              </div>

              {cat.itens.map((item, j) => (
                <div className="item-linha" key={item.id}>
                  {item.imagemUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.imagemUrl} alt={item.nome} className="item-foto" />
                  ) : (
                    <div className="item-foto vazia">sem foto</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{item.nome}</strong>
                      {!item.ativo && (
                        <span className="situacao" data-status="CANCELED">
                          pausado
                        </span>
                      )}
                      {item.estacao && <span className="estacao-tag">{item.estacao.name}</span>}
                    </div>
                    {item.descricao && <div className="sub">{item.descricao}</div>}
                    {item.grupos.length > 0 && (
                      <div className="sub">
                        {item.grupos.length} grupo(s) de complemento ·{' '}
                        {item.grupos.reduce((s, g) => s + g.opcoes.length, 0)} opções
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 650 }}>{dinheiro(item.precoCents)}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      <button
                        className="botao-mini"
                        disabled={ocupado || j === 0}
                        title="Subir"
                        onClick={() =>
                          agir(`/admin/itens/${item.id}/mover`, {
                            metodo: 'PATCH',
                            corpo: { direcao: 'cima' },
                          })
                        }
                      >
                        <IconeSubir tamanho={14} />
                      </button>
                      <button
                        className="botao-mini"
                        disabled={ocupado || j === cat.itens.length - 1}
                        title="Descer"
                        onClick={() =>
                          agir(`/admin/itens/${item.id}/mover`, {
                            metodo: 'PATCH',
                            corpo: { direcao: 'baixo' },
                          })
                        }
                      >
                        <IconeDescer tamanho={14} />
                      </button>
                      <button className="botao-mini" onClick={() => setItemAberto(item)} title="Editar">
                        <IconeLapis tamanho={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                className="ghost"
                style={{ width: '100%', marginTop: 10 }}
                disabled={ocupado}
                onClick={() =>
                  setItemAberto({
                    id: '',
                    nome: '',
                    descricao: '',
                    precoCents: 0,
                    imagemUrl: null,
                    ativo: true,
                    estacao: null,
                    grupos: [],
                    // item ainda não existe: guardamos em qual categoria criar
                    categoryId: cat.id,
                  })
                }
              >
                + Item em {cat.nome}
              </button>
            </section>
          ))}
        </>
      )}

      {itemAberto && (
        <JanelaDoItem
          item={itemAberto}
          estacoes={estacoes}
          ocupado={ocupado}
          onFechar={() => setItemAberto(null)}
          onAgir={agir}
          onRecarregar={async () => {
            await carregarCardapio();
            // mantém a janela aberta com os dados novos
            const r = await chamarApi<CardapioCompleto>(`/admin/cardapios/${menuId}`);
            if (r.ok) {
              const atualizado = r.dados.categorias
                .flatMap((c) => c.itens)
                .find((i) => i.id === itemAberto.id);
              if (atualizado) setItemAberto(atualizado);
            }
          }}
        />
      )}
    </>
  );
}

/** Copiar cardápio de um canal para outro com ajuste de preço. */
function FormularioCopiar({
  cardapios,
  destinoId,
  ocupado,
  onCancelar,
  onCopiar,
}: {
  cardapios: Cardapio[];
  destinoId: string;
  ocupado: boolean;
  onCancelar: () => void;
  onCopiar: (d: unknown) => Promise<void>;
}) {
  const origens = cardapios.filter((c) => c.id !== destinoId && c.categorias > 0);
  const [origemId, setOrigemId] = useState(origens[0]?.id ?? '');
  const [ajuste, setAjuste] = useState('0');

  if (origens.length === 0) {
    return (
      <>
        <p className="subtitle" style={{ margin: 0 }}>
          Nenhum outro canal tem cardápio para copiar ainda.
        </p>
        <button className="ghost" style={{ width: 'auto', marginTop: 10 }} onClick={onCancelar}>
          Fechar
        </button>
      </>
    );
  }

  return (
    <>
      <div className="stat-label">Copiar cardápio</div>
      <div className="form-linha">
        <div>
          <label>De qual canal</label>
          <select value={origemId} onChange={(e) => setOrigemId(e.target.value)} style={{ width: '100%' }}>
            {origens.map((c) => (
              <option key={c.id} value={c.id}>
                {c.channelLabel} ({c.categorias} categorias)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Ajuste de preço (%)</label>
          <input
            type="number"
            value={ajuste}
            onChange={(e) => setAjuste(e.target.value)}
            placeholder="15"
          />
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Exemplo: o salão costuma ser o delivery com 15% a mais. Use um número negativo para ficar
        mais barato.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={ocupado}
          onClick={() =>
            onCopiar({ origemMenuId: origemId, destinoMenuId: destinoId, ajustePercentual: Number(ajuste) })
          }
        >
          Copiar agora
        </button>
        <button className="ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </>
  );
}

/** Criar/editar um item, com foto e complementos. */
function JanelaDoItem({
  item,
  estacoes,
  ocupado,
  onFechar,
  onAgir,
  onRecarregar,
}: {
  item: Item;
  estacoes: Estacao[];
  ocupado: boolean;
  onFechar: () => void;
  onAgir: (c: string, o?: any, s?: string) => Promise<any>;
  onRecarregar: () => Promise<void>;
}) {
  const novo = !item.id;
  const [f, setF] = useState({
    nome: item.nome,
    descricao: item.descricao ?? '',
    preco: item.precoCents ? paraCampo(item.precoCents) : '',
    imagemUrl: item.imagemUrl ?? '',
    stationId: item.estacao?.id ?? '',
  });
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [novoGrupo, setNovoGrupo] = useState(false);

  async function subirFoto(arquivo: File) {
    setEnviandoFoto(true);
    setErroFoto(null);
    const r = await enviarFoto(arquivo);
    setEnviandoFoto(false);
    if (!r.ok) return setErroFoto(r.erro);
    setF((atual) => ({ ...atual, imagemUrl: r.url }));
  }

  async function salvar() {
    const corpo = {
      name: f.nome,
      description: f.descricao || undefined,
      priceCents: paraCentavos(f.preco),
      imageUrl: f.imagemUrl || undefined,
      stationId: f.stationId || null,
    };

    if (novo) {
      const r = await onAgir(
        '/admin/itens',
        { metodo: 'POST', corpo: { ...corpo, categoryId: item.categoryId } },
        'Item criado.',
      );
      if (r) onFechar();
    } else {
      const r = await onAgir(`/admin/itens/${item.id}`, { metodo: 'PATCH', corpo }, 'Item salvo.');
      if (r) onFechar();
    }
  }

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-corpo" style={{ paddingTop: 22 }}>
          <div className="grupo-cabecalho">
            <h2 className="title" style={{ fontSize: 19, margin: 0 }}>
              {novo ? 'Novo item' : item.nome}
            </h2>
            <button className="modal-fechar" style={{ position: 'static' }} onClick={onFechar}>
              <IconeFechar tamanho={17} />
            </button>
          </div>

          {/* foto */}
          <label>Foto do prato</label>
          <div className="foto-upload">
            {f.imagemUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={f.imagemUrl} alt="" />
            ) : (
              <div className="foto-vazia">sem foto</div>
            )}
            <div style={{ flex: 1 }}>
              <input
                type="file"
                accept="image/*"
                disabled={enviandoFoto}
                onChange={(e) => {
                  const arq = e.target.files?.[0];
                  if (arq) subirFoto(arq);
                }}
                style={{ marginBottom: 6 }}
              />
              <div className="sub">
                {enviandoFoto ? 'Enviando…' : 'JPG, PNG ou WEBP, até 5 MB.'}
              </div>
              {f.imagemUrl && (
                <button
                  className="remover"
                  onClick={() => setF({ ...f, imagemUrl: '' })}
                  style={{ marginTop: 4 }}
                >
                  remover foto
                </button>
              )}
            </div>
          </div>
          {erroFoto && <div className="error">{erroFoto}</div>}

          <label>Nome</label>
          <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Pizza Margherita" />

          <label>Descrição</label>
          <input
            value={f.descricao}
            onChange={(e) => setF({ ...f, descricao: e.target.value })}
            placeholder="Molho de tomate, muçarela de búfala e manjericão"
          />

          <div className="form-linha">
            <div>
              <label>Preço (R$)</label>
              <input
                value={f.preco}
                onChange={(e) => setF({ ...f, preco: e.target.value })}
                placeholder="59,90"
                inputMode="decimal"
              />
            </div>
            <div>
              <label>Vai para qual estação?</label>
              <select
                value={f.stationId}
                onChange={(e) => setF({ ...f, stationId: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="">Nenhuma</option>
                {estacoes.map((e2) => (
                  <option key={e2.id} value={e2.id}>
                    {e2.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button disabled={ocupado || !f.nome.trim()} onClick={salvar}>
              {novo ? 'Criar item' : 'Salvar'}
            </button>
            {!novo && (
              <>
                <button
                  className="ghost"
                  disabled={ocupado}
                  onClick={() =>
                    onAgir(
                      `/admin/itens/${item.id}`,
                      { metodo: 'PATCH', corpo: { active: !item.ativo } },
                      item.ativo ? 'Item pausado.' : 'Item liberado.',
                    ).then(onRecarregar)
                  }
                >
                  {item.ativo ? 'Pausar' : 'Liberar'}
                </button>
                <button
                  className="ghost"
                  disabled={ocupado}
                  onClick={async () => {
                    const r = await onAgir(`/admin/itens/${item.id}/duplicar`, { metodo: 'POST' }, 'Item duplicado.');
                    if (r) onFechar();
                  }}
                >
                  Duplicar
                </button>
                <button
                  className="ghost"
                  style={{ color: 'var(--danger)' }}
                  disabled={ocupado}
                  onClick={async () => {
                    if (!confirm(`Apagar "${item.nome}"?`)) return;
                    const r = await onAgir(`/admin/itens/${item.id}`, { metodo: 'DELETE' }, 'Item apagado.');
                    if (r) onFechar();
                  }}
                >
                  Apagar
                </button>
              </>
            )}
          </div>

          {/* complementos — só depois do item existir */}
          {!novo && (
            <div className="grupo">
              <div className="grupo-cabecalho">
                <strong>Complementos</strong>
                {!novoGrupo && (
                  <button className="ghost" style={{ width: 'auto' }} onClick={() => setNovoGrupo(true)}>
                    + Grupo
                  </button>
                )}
              </div>

              {novoGrupo && (
                <FormularioGrupo
                  ocupado={ocupado}
                  onCancelar={() => setNovoGrupo(false)}
                  onCriar={async (d) => {
                    const r = await onAgir('/admin/grupos', {
                      metodo: 'POST',
                      corpo: { itemId: item.id, ...d },
                    });
                    if (r) {
                      setNovoGrupo(false);
                      await onRecarregar();
                    }
                  }}
                />
              )}

              {item.grupos.length === 0 && !novoGrupo && (
                <p className="subtitle">
                  Nenhum complemento. Use para "ponto da carne", "tamanho", "adicionais".
                </p>
              )}

              {item.grupos.map((g) => (
                <div key={g.id} className="grupo-bloco">
                  <div className="grupo-cabecalho">
                    <div>
                      <strong>{g.nome}</strong>
                      <div className="sub">
                        {g.minimo === 0
                          ? `opcional, até ${g.maximo}`
                          : g.minimo === g.maximo
                            ? `obrigatório, escolhe ${g.minimo}`
                            : `escolhe de ${g.minimo} a ${g.maximo}`}
                      </div>
                    </div>
                    <button
                      className="botao-mini perigo"
                      disabled={ocupado}
                      onClick={async () => {
                        if (!confirm(`Apagar o grupo "${g.nome}"?`)) return;
                        await onAgir(`/admin/grupos/${g.id}`, { metodo: 'DELETE' });
                        await onRecarregar();
                      }}
                    >
                      <IconeLixeira tamanho={14} />
                    </button>
                  </div>

                  {g.opcoes.map((o) => (
                    <div className="opcao-linha" key={o.id}>
                      <span style={{ flex: 1 }}>{o.nome}</span>
                      <span className="sub">
                        {o.acrescimoCents > 0 ? `+ ${dinheiro(o.acrescimoCents)}` : 'sem custo'}
                      </span>
                      <button
                        className="remover"
                        disabled={ocupado}
                        onClick={async () => {
                          await onAgir(`/admin/opcoes/${o.id}`, { metodo: 'DELETE' });
                          await onRecarregar();
                        }}
                      >
                        remover
                      </button>
                    </div>
                  ))}

                  <FormularioOpcao
                    ocupado={ocupado}
                    onCriar={async (d) => {
                      await onAgir('/admin/opcoes', { metodo: 'POST', corpo: { groupId: g.id, ...d } });
                      await onRecarregar();
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {novo && (
            <p className="hint">
              Crie o item primeiro; os complementos aparecem para cadastrar logo depois.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FormularioGrupo({
  ocupado,
  onCriar,
  onCancelar,
}: {
  ocupado: boolean;
  onCriar: (d: { name: string; minSelect: number; maxSelect: number }) => Promise<void>;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({ name: '', minSelect: 0, maxSelect: 1 });

  return (
    <div className="grupo-bloco">
      <label>Nome do grupo</label>
      <input
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
        placeholder="Ponto da carne"
      />

      <div className="form-linha">
        <div>
          <label>Mínimo</label>
          <input
            type="number"
            min={0}
            value={f.minSelect}
            onChange={(e) => setF({ ...f, minSelect: Number(e.target.value) })}
          />
        </div>
        <div>
          <label>Máximo</label>
          <input
            type="number"
            min={1}
            value={f.maxSelect}
            onChange={(e) => setF({ ...f, maxSelect: Number(e.target.value) })}
          />
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Mínimo 1 e máximo 1 = obrigatório escolher uma. Mínimo 0 = opcional.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={ocupado || !f.name.trim()} onClick={() => onCriar(f)}>
          Criar grupo
        </button>
        <button className="ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FormularioOpcao({
  ocupado,
  onCriar,
}: {
  ocupado: boolean;
  onCriar: (d: { name: string; priceDeltaCents: number }) => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');

  return (
    <div className="cupom-caixa" style={{ marginTop: 8 }}>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da opção"
        style={{ textTransform: 'none' }}
      />
      <input
        value={preco}
        onChange={(e) => setPreco(e.target.value)}
        placeholder="+ R$"
        style={{ width: 90, textTransform: 'none' }}
        inputMode="decimal"
      />
      <button
        className="ghost"
        disabled={ocupado || !nome.trim()}
        onClick={async () => {
          await onCriar({ name: nome, priceDeltaCents: preco ? paraCentavos(preco) : 0 });
          setNome('');
          setPreco('');
        }}
      >
        +
      </button>
    </div>
  );
}
