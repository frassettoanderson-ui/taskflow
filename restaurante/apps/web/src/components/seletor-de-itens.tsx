'use client';

import { useMemo, useState } from 'react';
import {
  dinheiro,
  totalDaLinha,
  JanelaDoItem,
  type CategoriaCardapio,
  type ItemCardapio,
  type LinhaCarrinho,
} from '../app/m/[slug]/cardapio';

/**
 * O "monte seu pedido" reaproveitado em três lugares:
 *   - o cliente sentado na mesa (QR Code)
 *   - o totem de autoatendimento
 *   - a comanda do garçom
 *
 * Ele só monta a rodada e devolve para quem chamou; quem envia para o servidor
 * é a tela de cima, porque o endereço muda (cliente x garçom).
 */
export function SeletorDeItens({
  categorias,
  cor,
  rotuloEnviar,
  enviando,
  onEnviar,
  grande = false,
}: {
  categorias: CategoriaCardapio[];
  cor: string;
  rotuloEnviar: string;
  enviando: boolean;
  onEnviar: (linhas: LinhaCarrinho[]) => Promise<void> | void;
  /** modo totem: fontes e alvos de toque maiores */
  grande?: boolean;
}) {
  const [rodada, setRodada] = useState<LinhaCarrinho[]>([]);
  const [itemAberto, setItemAberto] = useState<ItemCardapio | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState(categorias[0]?.id ?? '');

  const total = useMemo(() => rodada.reduce((s, l) => s + totalDaLinha(l), 0), [rodada]);
  const quantidade = useMemo(() => rodada.reduce((s, l) => s + l.quantidade, 0), [rodada]);

  function irPara(id: string) {
    setCategoriaAtiva(id);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function enviar() {
    if (rodada.length === 0) return;
    await onEnviar(rodada);
    setRodada([]);
  }

  return (
    <div style={{ ['--marca' as any]: cor }}>
      <nav className="abas">
        {categorias.map((c) => (
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

      {categorias.map((categoria) => (
        <section className="secao" id={`sec-${categoria.id}`} key={categoria.id}>
          <h2 style={grande ? { fontSize: 22 } : undefined}>{categoria.name}</h2>
          {categoria.items.map((item) => (
            <button
              className="produto"
              key={item.id}
              data-indisponivel={!item.disponivel}
              disabled={!item.disponivel}
              onClick={() => item.disponivel && setItemAberto(item)}
              style={grande ? { fontSize: 17, padding: 18 } : undefined}
            >
              <span className="info">
                <span className="nome">{item.name}</span>
                {item.description && <span className="desc">{item.description}</span>}
                <span className="preco">{dinheiro(item.priceCents)}</span>
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
            setRodada((atual) => [...atual, linha]);
            setItemAberto(null);
          }}
        />
      )}

      {/* A rodada que está sendo montada agora */}
      {rodada.length > 0 && (
        <div className="barra-carrinho">
          <div className="interno">
            <div style={{ marginBottom: 10 }}>
              {rodada.map((l) => (
                <div className="linha-carrinho" key={l.linhaId} style={{ padding: '8px 0' }}>
                  <span className="qtd">{l.quantidade}×</span>
                  <span style={{ minWidth: 0 }}>
                    <div>{l.nome}</div>
                    {l.complementos.length > 0 && (
                      <div className="complementos">
                        {l.complementos.map((c) => c.name).join(' · ')}
                      </div>
                    )}
                    <button
                      className="remover"
                      onClick={() => setRodada((a) => a.filter((x) => x.linhaId !== l.linhaId))}
                    >
                      remover
                    </button>
                  </span>
                  <span className="valor">{dinheiro(totalDaLinha(l))}</span>
                </div>
              ))}
            </div>

            <button onClick={enviar} disabled={enviando}>
              <span>
                {enviando ? 'Enviando…' : rotuloEnviar} · {quantidade}{' '}
                {quantidade === 1 ? 'item' : 'itens'}
              </span>
              <span>{dinheiro(total)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
