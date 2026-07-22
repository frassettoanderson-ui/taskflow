'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';

export type Insumo = {
  id: string;
  nome: string;
  medida: string;
  medidaLabel: string;
  custoPorUnidadeCents: number;
  estoque: number;
  estoqueMinimo: number;
  abaixoDoMinimo: boolean;
  usadoEmPratos: number;
  ativo: boolean;
};

export type Rentabilidade = {
  itemId: string;
  nome: string;
  marca: string;
  canal: string;
  precoCents: number;
  cmvCents: number;
  margemCents: number;
  cmvPercent: number;
  margemPercent: number;
  temFicha: boolean;
};

type Ficha = {
  item: { id: string; nome: string; precoCents: number; marca: string };
  linhas: Array<{
    id: string;
    supplyId: string;
    insumo: string;
    medida: string;
    quantidade: number;
    perdaPercent: number;
    quantidadeBruta: number;
    custoCents: number;
  }>;
  cmvCents: number;
  margemCents: number;
  cmvPercent: number;
  margemPercent: number;
  completa: boolean;
};

const MEDIDAS = [
  { valor: 'KG', label: 'Quilo (kg)' },
  { valor: 'G', label: 'Grama (g)' },
  { valor: 'L', label: 'Litro (L)' },
  { valor: 'ML', label: 'Mililitro (ml)' },
  { valor: 'UN', label: 'Unidade (un)' },
];

export function TelaDeEstoque({
  insumosIniciais,
  rentabilidadeInicial,
}: {
  insumosIniciais: Insumo[];
  rentabilidadeInicial: Rentabilidade[];
}) {
  const [aba, setAba] = useState<'insumos' | 'fichas'>('insumos');
  const [insumos, setInsumos] = useState(insumosIniciais);
  const [rentabilidade, setRentabilidade] = useState(rentabilidadeInicial);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novoInsumo, setNovoInsumo] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [i, r] = await Promise.all([
        fetch('/api/gestao/insumos', { cache: 'no-store' }),
        fetch('/api/gestao/rentabilidade', { cache: 'no-store' }),
      ]);
      if (i.ok) setInsumos(await i.json());
      if (r.ok) setRentabilidade(await r.json());
    } catch {
      /* mantém a tela */
    }
  }, []);

  async function chamar(url: string, corpo?: unknown, metodo = 'POST') {
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch(url, {
        method: metodo,
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(Array.isArray(d.message) ? d.message[0] : (d.message ?? 'Não deu certo.'));
        return null;
      }
      await recarregar();
      return d;
    } catch {
      setErro('O servidor não respondeu.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function abrirFicha(itemId: string) {
    const res = await fetch(`/api/gestao/ficha/${itemId}`, { cache: 'no-store' });
    if (res.ok) setFicha(await res.json());
  }

  const alertas = insumos.filter((i) => i.abaixoDoMinimo);

  return (
    <main className="shell" style={{ maxWidth: 1100 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Estoque</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Insumos, fichas técnicas e o custo real de cada prato.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/relatorios">
            <button className="ghost">Relatórios</button>
          </Link>
          <Link href="/financeiro">
            <button className="ghost">Financeiro</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {erro && <div className="error">{erro}</div>}

      {alertas.length > 0 && (
        <section className="card" style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,.4)' }}>
          <div className="stat-label">⚠️ Abaixo do estoque mínimo ({alertas.length})</div>
          {alertas.map((a) => (
            <div className="totais" key={a.id}>
              <span>
                <strong>{a.nome}</strong>
              </span>
              <span style={{ color: 'var(--danger)' }}>
                {a.estoque} {a.medidaLabel} (mínimo {a.estoqueMinimo})
              </span>
            </div>
          ))}
        </section>
      )}

      <nav className="canais" style={{ padding: '0 0 18px' }}>
        <button className="canal-aba" data-ativo={aba === 'insumos'} onClick={() => setAba('insumos')}>
          Insumos
        </button>
        <button className="canal-aba" data-ativo={aba === 'fichas'} onClick={() => setAba('fichas')}>
          Fichas técnicas e margem
        </button>
      </nav>

      {/* --------------------------- INSUMOS --------------------------- */}
      {aba === 'insumos' && (
        <>
          {!novoInsumo ? (
            <button className="ghost" style={{ marginBottom: 16 }} onClick={() => setNovoInsumo(true)}>
              + Novo insumo
            </button>
          ) : (
            <FormularioInsumo
              ocupado={ocupado}
              onCancelar={() => setNovoInsumo(false)}
              onCriar={async (d) => {
                const ok = await chamar('/api/gestao/insumos', d);
                if (ok) setNovoInsumo(false);
              }}
            />
          )}

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th style={{ textAlign: 'right' }}>Custo</th>
                  <th style={{ textAlign: 'right' }}>Estoque</th>
                  <th style={{ textAlign: 'right' }}>Mínimo</th>
                  <th style={{ textAlign: 'right' }}>Em pratos</th>
                  <th>Movimentar</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.nome}</strong>
                      {i.abaixoDoMinimo && (
                        <div className="sub" style={{ color: 'var(--danger)' }}>
                          abaixo do mínimo
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {dinheiro(i.custoPorUnidadeCents)}
                      <div className="sub">por {i.medidaLabel}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {i.estoque} {i.medidaLabel}
                    </td>
                    <td style={{ textAlign: 'right' }} className="sub">
                      {i.estoqueMinimo}
                    </td>
                    <td style={{ textAlign: 'right' }} className="sub">
                      {i.usadoEmPratos}
                    </td>
                    <td>
                      <MovimentarInsumo
                        insumo={i}
                        ocupado={ocupado}
                        onMovimentar={(d) => chamar(`/api/gestao/insumos/${i.id}/movimento`, d)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ------------------------ FICHAS E MARGEM ---------------------- */}
      {aba === 'fichas' && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Ordenado pela <strong>pior margem primeiro</strong> — é onde o dinheiro está escapando.
            Clique num prato para montar ou ajustar a ficha técnica.
          </p>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Prato</th>
                  <th>Marca</th>
                  <th style={{ textAlign: 'right' }}>Preço</th>
                  <th style={{ textAlign: 'right' }}>CMV</th>
                  <th style={{ textAlign: 'right' }}>Margem</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {rentabilidade.map((r) => (
                  <tr key={r.itemId} onClick={() => abrirFicha(r.itemId)} style={{ cursor: 'pointer' }}>
                    <td>
                      <strong>{r.nome}</strong>
                      {!r.temFicha && <div className="sub">sem ficha técnica</div>}
                    </td>
                    <td className="sub">{r.marca}</td>
                    <td style={{ textAlign: 'right' }}>{dinheiro(r.precoCents)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {r.temFicha ? dinheiro(r.cmvCents) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {r.temFicha ? dinheiro(r.margemCents) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.temFicha ? (
                        <span
                          className="situacao"
                          data-status={
                            r.margemPercent >= 65 ? 'DELIVERED' : r.margemPercent >= 50 ? 'READY' : 'CANCELED'
                          }
                        >
                          {r.margemPercent}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --------------------------- A FICHA --------------------------- */}
      {ficha && (
        <div className="modal-fundo" onClick={() => setFicha(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-corpo" style={{ paddingTop: 22 }}>
              <div className="grupo-cabecalho">
                <div>
                  <h2 className="title" style={{ fontSize: 20, margin: 0 }}>
                    {ficha.item.nome}
                  </h2>
                  <p className="subtitle" style={{ margin: 0 }}>
                    {ficha.item.marca} · vende por {dinheiro(ficha.item.precoCents)}
                  </p>
                </div>
                <button className="modal-fechar" style={{ position: 'static' }} onClick={() => setFicha(null)}>
                  ×
                </button>
              </div>

              <div className="grid" style={{ marginTop: 12 }}>
                <div className="card">
                  <div className="stat-label">CMV (custo)</div>
                  <div className="stat-value">{dinheiro(ficha.cmvCents)}</div>
                  <div className="sub">{ficha.cmvPercent}% do preço</div>
                </div>
                <div className="card">
                  <div className="stat-label">Margem</div>
                  <div className="stat-value" style={{ color: 'var(--ok)' }}>
                    {dinheiro(ficha.margemCents)}
                  </div>
                  <div className="sub">{ficha.margemPercent}%</div>
                </div>
              </div>

              <div className="grupo">
                <div className="grupo-cabecalho">
                  <strong>Ficha técnica</strong>
                </div>
                {ficha.linhas.length === 0 && (
                  <p className="subtitle">
                    Sem ficha técnica ainda — sem ela não dá para saber o custo real deste prato.
                  </p>
                )}
                {ficha.linhas.map((l) => (
                  <div className="linha-carrinho" key={l.id}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <div>{l.insumo}</div>
                      <div className="complementos">
                        {l.quantidade} {l.medida}
                        {l.perdaPercent > 0 && ` + ${l.perdaPercent}% de perda → ${l.quantidadeBruta} ${l.medida}`}
                      </div>
                    </span>
                    <span className="valor">{dinheiro(l.custoCents)}</span>
                    <button
                      className="remover"
                      disabled={ocupado}
                      onClick={async () => {
                        await chamar(`/api/gestao/ficha/linha/${l.id}`, undefined, 'DELETE');
                        await abrirFicha(ficha.item.id);
                      }}
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>

              <AdicionarNaFicha
                insumos={insumos}
                ocupado={ocupado}
                onAdicionar={async (d) => {
                  await chamar(`/api/gestao/ficha/${ficha.item.id}`, d);
                  await abrirFicha(ficha.item.id);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Entrada de compra, perda ou acerto. */
function MovimentarInsumo({
  insumo,
  ocupado,
  onMovimentar,
}: {
  insumo: Insumo;
  ocupado: boolean;
  onMovimentar: (d: unknown) => Promise<unknown>;
}) {
  const [qtd, setQtd] = useState('');
  const [tipo, setTipo] = useState('IN');

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ padding: '6px 8px', fontSize: 12.5 }}>
        <option value="IN">Entrada</option>
        <option value="LOSS">Perda</option>
        <option value="ADJUST">Acerto</option>
      </select>
      <input
        type="number"
        step="0.001"
        value={qtd}
        onChange={(e) => setQtd(e.target.value)}
        placeholder={insumo.medidaLabel}
        style={{ marginBottom: 0, width: 90, padding: '6px 8px', fontSize: 13 }}
      />
      <button
        className="ghost"
        disabled={ocupado || !qtd}
        style={{ padding: '6px 10px', fontSize: 12.5 }}
        onClick={async () => {
          await onMovimentar({ type: tipo, quantity: Number(qtd) });
          setQtd('');
        }}
      >
        OK
      </button>
    </div>
  );
}

/** Novo insumo. */
function FormularioInsumo({
  ocupado,
  onCriar,
  onCancelar,
}: {
  ocupado: boolean;
  onCriar: (d: unknown) => Promise<void>;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({ name: '', measure: 'KG', custo: '', estoque: '0', minimo: '0' });

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="stat-label">Novo insumo</div>

      <div className="form-linha">
        <div>
          <label>Nome</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Queijo muçarela" />
        </div>
        <div>
          <label>Medida</label>
          <select value={f.measure} onChange={(e) => setF({ ...f, measure: e.target.value })} style={{ width: '100%' }}>
            {MEDIDAS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-linha">
        <div>
          <label>Custo por unidade (R$)</label>
          <input type="number" step="0.01" value={f.custo} onChange={(e) => setF({ ...f, custo: e.target.value })} />
        </div>
        <div>
          <label>Estoque atual</label>
          <input type="number" step="0.001" value={f.estoque} onChange={(e) => setF({ ...f, estoque: e.target.value })} />
        </div>
      </div>

      <label>Estoque mínimo (avisa abaixo disto)</label>
      <input type="number" step="0.001" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value })} />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          disabled={ocupado || !f.name.trim() || !f.custo}
          onClick={() =>
            onCriar({
              name: f.name,
              measure: f.measure,
              costPerUnitCents: Math.round(Number(f.custo) * 100),
              stockQty: Number(f.estoque),
              minStockQty: Number(f.minimo),
            })
          }
        >
          Criar insumo
        </button>
        <button className="ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </section>
  );
}

/** Adicionar um insumo à ficha técnica. */
function AdicionarNaFicha({
  insumos,
  ocupado,
  onAdicionar,
}: {
  insumos: Insumo[];
  ocupado: boolean;
  onAdicionar: (d: unknown) => Promise<void>;
}) {
  const [supplyId, setSupplyId] = useState(insumos[0]?.id ?? '');
  const [quantidade, setQuantidade] = useState('');
  const [perda, setPerda] = useState('0');

  const escolhido = insumos.find((i) => i.id === supplyId);

  return (
    <div className="grupo">
      <div className="grupo-cabecalho">
        <strong>Adicionar insumo</strong>
      </div>

      <label>Insumo</label>
      <select value={supplyId} onChange={(e) => setSupplyId(e.target.value)} style={{ width: '100%', marginBottom: 12 }}>
        {insumos.map((i) => (
          <option key={i.id} value={i.id}>
            {i.nome} ({dinheiro(i.custoPorUnidadeCents)}/{i.medidaLabel})
          </option>
        ))}
      </select>

      <div className="form-linha">
        <div>
          <label>Quantidade ({escolhido?.medidaLabel})</label>
          <input
            type="number"
            step="0.001"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="0,18"
          />
        </div>
        <div>
          <label>Perda (%)</label>
          <input type="number" step="1" value={perda} onChange={(e) => setPerda(e.target.value)} />
        </div>
      </div>

      <button
        disabled={ocupado || !quantidade}
        onClick={async () => {
          await onAdicionar({
            supplyId,
            quantity: Number(quantidade),
            wastePercent: Number(perda),
          });
          setQuantidade('');
          setPerda('0');
        }}
      >
        Adicionar à ficha
      </button>
    </div>
  );
}
