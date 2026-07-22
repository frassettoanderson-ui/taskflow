'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';

export type Dre = {
  periodo: { de: string; ate: string };
  pedidos: number;
  linhas: Array<{ rotulo: string; valorCents: number; percent: number; tipo: string }>;
  despesasPorCategoria: Array<{ categoria: string; valorCents: number }>;
  margemPercent: number;
};

export type Lancamento = {
  id: string;
  tipo: string;
  status: string;
  categoria: string;
  descricao: string;
  valorCents: number;
  vencimento: string;
  pagoEm: string | null;
  para: string | null;
  atrasado: boolean;
};

export type Resumo = {
  aPagar: { atrasadoCents: number; hojeCents: number; proximos7Cents: number; totalAbertoCents: number };
  aReceber: { atrasadoCents: number; hojeCents: number; proximos7Cents: number; totalAbertoCents: number };
};

export type Acerto = {
  id: string;
  tipo: string;
  quem: string;
  de: string;
  ate: string;
  itens: number;
  valorCents: number;
  status: string;
  pagoEm: string | null;
};

function data(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function TelaFinanceira({
  dreInicial,
  lancamentosIniciais,
  resumoInicial,
  acertosIniciais,
}: {
  dreInicial: Dre;
  lancamentosIniciais: Lancamento[];
  resumoInicial: Resumo | null;
  acertosIniciais: Acerto[];
}) {
  const [aba, setAba] = useState<'dre' | 'contas' | 'acertos'>('dre');
  const [dre, setDre] = useState(dreInicial);
  const [lancamentos, setLancamentos] = useState(lancamentosIniciais);
  const [resumo, setResumo] = useState(resumoInicial);
  const [acertos, setAcertos] = useState(acertosIniciais);
  const [de, setDe] = useState(dreInicial.periodo.de);
  const [ate, setAte] = useState(dreInicial.periodo.ate);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [d, l, r, a] = await Promise.all([
        fetch(`/api/gestao/financeiro/dre?de=${de}&ate=${ate}`, { cache: 'no-store' }),
        fetch('/api/gestao/financeiro/lancamentos', { cache: 'no-store' }),
        fetch('/api/gestao/financeiro/resumo', { cache: 'no-store' }),
        fetch('/api/gestao/acertos', { cache: 'no-store' }),
      ]);
      if (d.ok) setDre(await d.json());
      if (l.ok) setLancamentos(await l.json());
      if (r.ok) setResumo(await r.json());
      if (a.ok) setAcertos(await a.json());
    } catch {
      /* mantém a tela */
    }
  }, [de, ate]);

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

  return (
    <main className="shell" style={{ maxWidth: 1000 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Financeiro</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            DRE, contas a pagar e a receber, e acertos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/relatorios">
            <button className="ghost">Relatórios</button>
          </Link>
          <Link href="/entregadores">
            <button className="ghost">Entregas</button>
          </Link>
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {erro && <div className="error">{erro}</div>}

      {/* resumo do topo */}
      {resumo && (
        <section className="grid" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="stat-label">A pagar em aberto</div>
            <div className="stat-value">{dinheiro(resumo.aPagar.totalAbertoCents)}</div>
            {resumo.aPagar.atrasadoCents > 0 && (
              <div className="sub" style={{ color: 'var(--danger)' }}>
                {dinheiro(resumo.aPagar.atrasadoCents)} atrasado
              </div>
            )}
          </div>
          <div className="card">
            <div className="stat-label">Vence hoje</div>
            <div className="stat-value">{dinheiro(resumo.aPagar.hojeCents)}</div>
          </div>
          <div className="card">
            <div className="stat-label">Próximos 7 dias</div>
            <div className="stat-value">{dinheiro(resumo.aPagar.proximos7Cents)}</div>
          </div>
          <div className="card">
            <div className="stat-label">Resultado do período</div>
            <div
              className="stat-value"
              style={{ color: dre.margemPercent >= 0 ? 'var(--ok)' : 'var(--danger)' }}
            >
              {dre.margemPercent}%
            </div>
          </div>
        </section>
      )}

      <nav className="canais" style={{ padding: '0 0 18px' }}>
        {(
          [
            ['dre', 'DRE'],
            ['contas', 'Contas'],
            ['acertos', 'Acertos'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className="canal-aba" data-ativo={aba === id} onClick={() => setAba(id)}>
            {label}
          </button>
        ))}
      </nav>

      {/* ------------------------------- DRE --------------------------- */}
      {aba === 'dre' && (
        <>
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="filtros">
              <div>
                <label style={{ fontSize: 11 }}>De</label>
                <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ marginBottom: 0 }} />
              </div>
              <div>
                <label style={{ fontSize: 11 }}>Até</label>
                <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ marginBottom: 0 }} />
              </div>
              <button className="ghost" onClick={recarregar} disabled={ocupado}>
                Atualizar
              </button>
            </div>
          </section>

          <section className="card">
            <div className="stat-label">
              Resultado de {dre.periodo.de.split('-').reverse().join('/')} a{' '}
              {dre.periodo.ate.split('-').reverse().join('/')} · {dre.pedidos} pedidos
            </div>

            {dre.linhas.map((l) => (
              <div className="dre-linha" data-tipo={l.tipo} key={l.rotulo}>
                <span>{l.rotulo}</span>
                <span style={{ display: 'flex', gap: 12 }}>
                  <span
                    style={
                      l.tipo === 'resultado'
                        ? { color: l.valorCents >= 0 ? 'var(--ok)' : 'var(--danger)' }
                        : undefined
                    }
                  >
                    {dinheiro(l.valorCents)}
                  </span>
                  <span className="pct">{l.percent}%</span>
                </span>
              </div>
            ))}

            <p className="hint">
              As <strong>deduções</strong> são o que a plataforma retém e o que vai para o motoboy.
              O <strong>CMV</strong> vem das fichas técnicas — pratos sem ficha entram como custo
              zero, o que deixa o resultado otimista demais.
            </p>
          </section>

          {dre.despesasPorCategoria.length > 0 && (
            <section className="card" style={{ marginTop: 16 }}>
              <div className="stat-label">Despesas por categoria</div>
              {dre.despesasPorCategoria.map((d) => (
                <div className="totais" key={d.categoria}>
                  <span>{d.categoria}</span>
                  <span>{dinheiro(d.valorCents)}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {/* ----------------------------- CONTAS -------------------------- */}
      {aba === 'contas' && (
        <>
          {!novo ? (
            <button className="ghost" style={{ marginBottom: 16 }} onClick={() => setNovo(true)}>
              + Novo lançamento
            </button>
          ) : (
            <FormularioLancamento
              ocupado={ocupado}
              onCancelar={() => setNovo(false)}
              onCriar={async (d) => {
                const ok = await chamar('/api/gestao/financeiro/lancamentos', d);
                if (ok) setNovo(false);
              }}
            />
          )}

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Vencimento</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.descricao}</strong>
                      {l.para && <div className="sub">{l.para}</div>}
                    </td>
                    <td className="sub">{l.categoria}</td>
                    <td>
                      <span className="situacao" data-status={l.tipo === 'PAYABLE' ? 'CANCELED' : 'DELIVERED'}>
                        {l.tipo === 'PAYABLE' ? 'a pagar' : 'a receber'}
                      </span>
                    </td>
                    <td className="sub">
                      {data(l.vencimento)}
                      {l.atrasado && (
                        <div style={{ color: 'var(--danger)', fontWeight: 600 }}>atrasado</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{dinheiro(l.valorCents)}</td>
                    <td>
                      {l.status === 'OPEN' ? (
                        <button
                          className="ghost"
                          disabled={ocupado}
                          onClick={() => chamar(`/api/gestao/financeiro/lancamentos/${l.id}/quitar`, undefined, 'PATCH')}
                        >
                          Quitar
                        </button>
                      ) : (
                        <span className="situacao" data-status="DELIVERED">
                          pago
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------------------------- ACERTOS -------------------------- */}
      {aba === 'acertos' && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Os acertos são fechados na tela de <Link href="/entregadores">Entregas</Link>. Ao fechar,
            cada um vira automaticamente uma conta a pagar.
          </p>

          {acertos.length === 0 && <p className="vazio">Nenhum acerto fechado ainda.</p>}

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quem</th>
                  <th>Tipo</th>
                  <th>Período</th>
                  <th style={{ textAlign: 'right' }}>Itens</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {acertos.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.quem}</strong>
                    </td>
                    <td className="sub">{a.tipo === 'COURIER' ? 'motoboy' : 'garçom'}</td>
                    <td className="sub">
                      {data(a.de)} a {data(a.ate)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{a.itens}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{dinheiro(a.valorCents)}</td>
                    <td>
                      {a.status === 'OPEN' ? (
                        <button
                          className="ghost"
                          disabled={ocupado}
                          onClick={() => chamar(`/api/gestao/acertos/${a.id}/pagar`, undefined, 'PATCH')}
                        >
                          Marcar pago
                        </button>
                      ) : (
                        <span className="situacao" data-status="DELIVERED">
                          pago {data(a.pagoEm)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function FormularioLancamento({
  ocupado,
  onCriar,
  onCancelar,
}: {
  ocupado: boolean;
  onCriar: (d: unknown) => Promise<void>;
  onCancelar: () => void;
}) {
  const hoje = new Date();
  const [f, setF] = useState({
    type: 'PAYABLE',
    category: 'Insumos',
    description: '',
    valor: '',
    dueDate: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`,
    party: '',
  });

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="stat-label">Novo lançamento</div>

      <div className="form-linha">
        <div>
          <label>Tipo</label>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} style={{ width: '100%' }}>
            <option value="PAYABLE">A pagar</option>
            <option value="RECEIVABLE">A receber</option>
          </select>
        </div>
        <div>
          <label>Categoria</label>
          <input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Aluguel" />
        </div>
      </div>

      <label>Descrição</label>
      <input
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
        placeholder="Aluguel do ponto — julho"
      />

      <div className="form-linha">
        <div>
          <label>Valor (R$)</label>
          <input type="number" step="0.01" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </div>
        <div>
          <label>Vencimento</label>
          <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </div>
      </div>

      <label>Para quem (opcional)</label>
      <input value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} placeholder="Imobiliária Central" />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          disabled={ocupado || !f.description.trim() || !f.valor}
          onClick={() =>
            onCriar({
              type: f.type,
              category: f.category,
              description: f.description,
              amountCents: Math.round(Number(f.valor) * 100),
              dueDate: f.dueDate,
              party: f.party || undefined,
            })
          }
        >
          Lançar
        </button>
        <button className="ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
