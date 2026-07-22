'use client';

import { useCallback, useEffect, useState } from 'react';
import { dinheiro } from '../m/[slug]/cardapio';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';
import { chamarApi, paraCampo, paraCentavos } from './api';

type Dia = { weekday: number; dia: string; fechado: boolean; faixas: Array<{ id: string; abre: string; fecha: string }> };
type Area = {
  id: string;
  tipo: string;
  bairro: string | null;
  ateKm: number | null;
  freteCents: number;
  pedidoMinimoCents: number;
  ativa: boolean;
};
type Cashback = {
  ativo: boolean;
  percentual: number;
  pedidoMinimoCents: number;
  validadeDias: number;
  maxResgatePercentual: number;
};

const CANAIS = [
  { valor: 'delivery', label: 'Delivery' },
  { valor: 'salao', label: 'Salão' },
  { valor: 'balcao', label: 'Balcão' },
];

export function RegrasDaMarca({
  marca,
  onErro,
  onAviso,
}: {
  marca: MarcaResumo;
  onErro: (e: string | null) => void;
  onAviso: (t: string) => void;
}) {
  const [canal, setCanal] = useState('delivery');
  const [semana, setSemana] = useState<Dia[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cashback, setCashback] = useState<Cashback | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [h, a, c] = await Promise.all([
      chamarApi<Dia[]>(`/admin/marcas/${marca.id}/horarios?canal=${canal}`),
      chamarApi<Area[]>(`/admin/marcas/${marca.id}/areas`),
      chamarApi<Cashback>(`/admin/marcas/${marca.id}/cashback`),
    ]);
    if (h.ok) setSemana(h.dados);
    if (a.ok) setAreas(a.dados);
    if (c.ok) setCashback(c.dados);
  }, [marca.id, canal]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(caminho: string, opcoes: any, sucesso?: string) {
    setOcupado(true);
    onErro(null);
    const r = await chamarApi(caminho, opcoes);
    setOcupado(false);
    if (!r.ok) return onErro(r.erro), null;
    if (sucesso) onAviso(sucesso);
    await carregar();
    return r.dados;
  }

  /** Muda um dia da semana na tela (só grava quando você clicar em salvar). */
  function mudarDia(weekday: number, campo: 'abre' | 'fecha', valor: string) {
    setSemana((atual) =>
      atual.map((d) =>
        d.weekday !== weekday
          ? d
          : {
              ...d,
              fechado: false,
              faixas:
                d.faixas.length > 0
                  ? [{ ...d.faixas[0], [campo]: valor }]
                  : [{ id: '', abre: campo === 'abre' ? valor : '18:00', fecha: campo === 'fecha' ? valor : '23:00' }],
            },
      ),
    );
  }

  function alternarFechado(weekday: number) {
    setSemana((atual) =>
      atual.map((d) =>
        d.weekday !== weekday
          ? d
          : d.fechado
            ? { ...d, fechado: false, faixas: [{ id: '', abre: '18:00', fecha: '23:00' }] }
            : { ...d, fechado: true, faixas: [] },
      ),
    );
  }

  async function salvarHorarios() {
    await agir(
      `/admin/marcas/${marca.id}/horarios`,
      {
        metodo: 'POST',
        corpo: {
          canal,
          semana: semana.map((d) => ({
            weekday: d.weekday,
            faixas: d.fechado ? [] : d.faixas.map((f) => ({ abre: f.abre, fecha: f.fecha })),
          })),
        },
      },
      'Horários salvos.',
    );
  }

  const porBairro = areas.filter((a) => a.tipo === 'DISTRICT');
  const porRaio = areas.filter((a) => a.tipo === 'RADIUS');

  return (
    <>
      {/* -------------------------- HORÁRIOS -------------------------- */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="grupo-cabecalho">
          <div className="stat-label" style={{ margin: 0 }}>
            Horário de funcionamento
          </div>
          <select value={canal} onChange={(e) => setCanal(e.target.value)}>
            {CANAIS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {semana.map((d) => (
          <div className="dia-linha" key={d.weekday}>
            <span style={{ width: 90 }}>{d.dia}</span>

            {d.fechado ? (
              <span className="sub" style={{ flex: 1 }}>
                fechado
              </span>
            ) : (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                <input
                  type="time"
                  value={d.faixas[0]?.abre ?? '18:00'}
                  onChange={(e) => mudarDia(d.weekday, 'abre', e.target.value)}
                  style={{ marginBottom: 0, width: 110 }}
                />
                <span className="sub">às</span>
                <input
                  type="time"
                  value={d.faixas[0]?.fecha ?? '23:00'}
                  onChange={(e) => mudarDia(d.weekday, 'fecha', e.target.value)}
                  style={{ marginBottom: 0, width: 110 }}
                />
              </span>
            )}

            <button className="remover" onClick={() => alternarFechado(d.weekday)}>
              {d.fechado ? 'abrir neste dia' : 'fechar neste dia'}
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button disabled={ocupado} onClick={salvarHorarios}>
            Salvar horários
          </button>
          <button
            className="ghost"
            disabled={ocupado}
            onClick={() =>
              agir(
                `/admin/marcas/${marca.id}/horarios/todo-dia`,
                { metodo: 'POST', corpo: { canal, abre: '00:00', fecha: '23:59' } },
                'Aberto 24 horas, todos os dias.',
              )
            }
          >
            Abrir 24h todo dia
          </button>
        </div>
        <p className="hint">
          Fora do horário, o cardápio mostra "fechado agora" e recusa pedidos novos.
        </p>
      </section>

      {/* ------------------------ ÁREA DE ENTREGA ---------------------- */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="stat-label">Onde esta marca entrega</div>
        <p className="hint" style={{ marginTop: 0 }}>
          Escolha um dos dois jeitos: <strong>por bairro</strong> (você lista cada um) ou{' '}
          <strong>por distância</strong> (faixas de km a partir da cozinha).
        </p>

        <div className="grid">
          <div>
            <div className="stat-label">Por bairro</div>
            {porBairro.length === 0 && <p className="subtitle">Nenhum bairro cadastrado.</p>}
            {porBairro.map((a) => (
              <div className="chamado" key={a.id}>
                <span className="qual">
                  <strong>{a.bairro}</strong>
                  <div className="sub">
                    frete {dinheiro(a.freteCents)}
                    {a.pedidoMinimoCents > 0 && ` · mínimo ${dinheiro(a.pedidoMinimoCents)}`}
                  </div>
                </span>
                <button
                  className="remover"
                  disabled={ocupado}
                  onClick={() => agir(`/admin/areas/${a.id}`, { metodo: 'DELETE' }, 'Bairro removido.')}
                >
                  remover
                </button>
              </div>
            ))}
            <FormularioArea
              tipo="DISTRICT"
              ocupado={ocupado}
              onCriar={(d) =>
                agir(`/admin/marcas/${marca.id}/areas`, { metodo: 'POST', corpo: d }, 'Bairro adicionado.')
              }
            />
          </div>

          <div>
            <div className="stat-label">Por distância</div>
            {porRaio.length === 0 && <p className="subtitle">Nenhuma faixa cadastrada.</p>}
            {porRaio.map((a) => (
              <div className="chamado" key={a.id}>
                <span className="qual">
                  <strong>até {a.ateKm} km</strong>
                  <div className="sub">
                    frete {dinheiro(a.freteCents)}
                    {a.pedidoMinimoCents > 0 && ` · mínimo ${dinheiro(a.pedidoMinimoCents)}`}
                  </div>
                </span>
                <button
                  className="remover"
                  disabled={ocupado}
                  onClick={() => agir(`/admin/areas/${a.id}`, { metodo: 'DELETE' }, 'Faixa removida.')}
                >
                  remover
                </button>
              </div>
            ))}
            <FormularioArea
              tipo="RADIUS"
              ocupado={ocupado}
              onCriar={(d) =>
                agir(`/admin/marcas/${marca.id}/areas`, { metodo: 'POST', corpo: d }, 'Faixa adicionada.')
              }
            />
          </div>
        </div>
      </section>

      {/* --------------------------- CASHBACK -------------------------- */}
      {cashback && (
        <section className="card">
          <div className="stat-label">Cashback desta marca</div>

          <div className="form-linha">
            <div>
              <label>Quanto volta (%)</label>
              <input
                type="number"
                step="0.5"
                value={cashback.percentual}
                onChange={(e) => setCashback({ ...cashback, percentual: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>Validade (dias)</label>
              <input
                type="number"
                value={cashback.validadeDias}
                onChange={(e) => setCashback({ ...cashback, validadeDias: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-linha">
            <div>
              <label>Pedido mínimo para gerar (R$)</label>
              <input
                value={paraCampo(cashback.pedidoMinimoCents)}
                onChange={(e) =>
                  setCashback({ ...cashback, pedidoMinimoCents: paraCentavos(e.target.value) })
                }
                inputMode="decimal"
              />
            </div>
            <div>
              <label>Pode pagar até (%) do pedido</label>
              <input
                type="number"
                value={cashback.maxResgatePercentual}
                onChange={(e) =>
                  setCashback({ ...cashback, maxResgatePercentual: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <label className="opcao" style={{ borderBottom: 0 }}>
            <input
              type="checkbox"
              checked={cashback.ativo}
              onChange={(e) => setCashback({ ...cashback, ativo: e.target.checked })}
            />
            <span>Cashback ligado</span>
          </label>

          <button
            style={{ marginTop: 12 }}
            disabled={ocupado}
            onClick={() =>
              agir(
                `/admin/marcas/${marca.id}/cashback`,
                { metodo: 'POST', corpo: { active: cashback.ativo, ...cashback } },
                'Cashback salvo.',
              )
            }
          >
            Salvar cashback
          </button>
        </section>
      )}
    </>
  );
}

function FormularioArea({
  tipo,
  ocupado,
  onCriar,
}: {
  tipo: 'DISTRICT' | 'RADIUS';
  ocupado: boolean;
  onCriar: (d: unknown) => Promise<unknown>;
}) {
  const [alvo, setAlvo] = useState('');
  const [frete, setFrete] = useState('');
  const [minimo, setMinimo] = useState('');

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div className="form-linha">
        <div>
          <label>{tipo === 'DISTRICT' ? 'Bairro' : 'Até quantos km'}</label>
          <input
            value={alvo}
            onChange={(e) => setAlvo(e.target.value)}
            placeholder={tipo === 'DISTRICT' ? 'Centro' : '5'}
            inputMode={tipo === 'RADIUS' ? 'decimal' : 'text'}
          />
        </div>
        <div>
          <label>Frete (R$)</label>
          <input value={frete} onChange={(e) => setFrete(e.target.value)} placeholder="8,00" inputMode="decimal" />
        </div>
      </div>
      <div className="form-linha">
        <div>
          <label>Pedido mínimo (R$, opcional)</label>
          <input value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            disabled={ocupado || !alvo.trim() || !frete.trim()}
            onClick={async () => {
              await onCriar({
                kind: tipo,
                districtName: tipo === 'DISTRICT' ? alvo : undefined,
                maxDistanceKm: tipo === 'RADIUS' ? Number(alvo.replace(',', '.')) : undefined,
                feeCents: paraCentavos(frete),
                minOrderCents: minimo ? paraCentavos(minimo) : 0,
              });
              setAlvo('');
              setFrete('');
              setMinimo('');
            }}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
