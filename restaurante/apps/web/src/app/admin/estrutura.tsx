'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';
import { chamarApi } from '@/lib/chamar-api';

type Unidade = {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: { rua: string | null; numero: string | null; bairro: string | null; cidade: string | null };
  latitude: number | null;
  longitude: number | null;
  estacoes: number;
  mesas: number;
  marcas: Array<{ id: string; name: string }>;
};

type Estacao = { id: string; nome: string; unidade: string; unitId: string; itensLigados: number };

type Mesa = {
  id: string;
  numero: string;
  area: string;
  lugares: number;
  qrToken: string;
  enderecoDoQr: string;
  ativa: boolean;
  marca: { id: string; name: string };
};

export function Estrutura({
  marcas,
  onErro,
  onAviso,
}: {
  marcas: MarcaResumo[];
  onErro: (e: string | null) => void;
  onAviso: (t: string) => void;
}) {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [unitId, setUnitId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [novaUnidade, setNovaUnidade] = useState(false);
  const [novaEstacao, setNovaEstacao] = useState('');

  const carregar = useCallback(async () => {
    const [u, e, m] = await Promise.all([
      chamarApi<Unidade[]>('/admin/unidades'),
      chamarApi<Estacao[]>('/admin/estacoes'),
      chamarApi<Mesa[]>('/admin/mesas'),
    ]);
    if (u.ok) {
      setUnidades(u.dados);
      setUnitId((a) => (u.dados.some((x) => x.id === a) ? a : (u.dados[0]?.id ?? '')));
    }
    if (e.ok) setEstacoes(e.dados);
    if (m.ok) setMesas(m.dados);
  }, []);

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

  const unidade = unidades.find((u) => u.id === unitId);
  const estacoesDaUnidade = estacoes.filter((e) => e.unitId === unitId);
  const mesasDaUnidade = mesas.filter(() => true);

  return (
    <>
      {/* --------------------------- UNIDADES -------------------------- */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="grupo-cabecalho">
          <div className="stat-label" style={{ margin: 0 }}>
            Unidades (suas cozinhas / lojas)
          </div>
          <button className="ghost" style={{ width: 'auto' }} onClick={() => setNovaUnidade(!novaUnidade)}>
            {novaUnidade ? 'Cancelar' : '+ Nova unidade'}
          </button>
        </div>

        {novaUnidade && (
          <FormularioUnidade
            ocupado={ocupado}
            onCriar={async (d) => {
              const r = await agir('/admin/unidades', { metodo: 'POST', corpo: d }, 'Unidade criada.');
              if (r) setNovaUnidade(false);
            }}
          />
        )}

        {unidades.map((u) => (
          <div className="chamado" key={u.id}>
            <span className="qual">
              <strong>{u.nome}</strong>
              {u.cnpj && <span className="sub"> · {u.cnpj}</span>}
              <div className="sub">
                {u.endereco.rua ? `${u.endereco.rua}, ${u.endereco.numero} — ${u.endereco.bairro}` : 'sem endereço'}
                {' · '}
                {u.estacoes} estações · {u.mesas} mesas
              </div>
              <div className="sub">
                Marcas: {u.marcas.length > 0 ? u.marcas.map((m) => m.name).join(', ') : 'nenhuma'}
              </div>
            </span>
            <button className="ghost" onClick={() => setUnitId(u.id)} data-ativo={unitId === u.id}>
              {unitId === u.id ? 'editando' : 'editar'}
            </button>
          </div>
        ))}
      </section>

      {unidade && (
        <>
          {/* vincular marcas */}
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="stat-label">Quais marcas operam em {unidade.nome}</div>
            <p className="hint" style={{ marginTop: 0 }}>
              Uma dark kitchen é uma cozinha só com várias marcas dentro.
            </p>
            {marcas.map((m) => {
              const ligada = unidade.marcas.some((x) => x.id === m.id);
              return (
                <div className="chamado" key={m.id}>
                  <span className="qual">
                    <span className="marca-tag">
                      <span className="dot" style={{ background: m.primaryColor }} />
                      <strong>{m.name}</strong>
                    </span>
                  </span>
                  <button
                    className="ghost"
                    disabled={ocupado}
                    onClick={() =>
                      agir(
                        `/admin/unidades/${unidade.id}/marcas/${m.id}`,
                        { metodo: 'POST', corpo: { active: !ligada } },
                        ligada ? 'Marca desligada da unidade.' : 'Marca ligada à unidade.',
                      )
                    }
                  >
                    {ligada ? 'Desligar' : 'Ligar aqui'}
                  </button>
                </div>
              );
            })}
          </section>

          {/* estações */}
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="stat-label">Estações de produção</div>
            <p className="hint" style={{ marginTop: 0 }}>
              É para onde cada prato vai na cozinha: forno, chapa, montagem, bebidas.
            </p>

            {estacoesDaUnidade.map((e) => (
              <div className="chamado" key={e.id}>
                <span className="qual">
                  <strong>{e.nome}</strong>
                  <div className="sub">{e.itensLigados} item(ns) mandam para cá</div>
                </span>
                <button
                  className="remover"
                  disabled={ocupado}
                  onClick={() => {
                    if (!confirm(`Apagar a estação "${e.nome}"? Os itens ficam sem estação.`)) return;
                    agir(`/admin/estacoes/${e.id}`, { metodo: 'DELETE' }, 'Estação apagada.');
                  }}
                >
                  remover
                </button>
              </div>
            ))}

            <div className="cupom-caixa" style={{ marginTop: 12 }}>
              <input
                value={novaEstacao}
                onChange={(e) => setNovaEstacao(e.target.value)}
                placeholder="Nome da estação"
                style={{ textTransform: 'none' }}
              />
              <button
                disabled={ocupado || !novaEstacao.trim()}
                onClick={async () => {
                  const r = await agir(
                    '/admin/estacoes',
                    { metodo: 'POST', corpo: { unitId: unidade.id, name: novaEstacao } },
                    'Estação criada.',
                  );
                  if (r) setNovaEstacao('');
                }}
              >
                + Estação
              </button>
            </div>
          </section>

          {/* mesas */}
          <section className="card">
            <div className="stat-label">Mesas do salão ({mesasDaUnidade.length})</div>

            <FormularioMesas
              marcas={marcas}
              unitId={unidade.id}
              ocupado={ocupado}
              onCriar={async (caminho, corpo) => {
                const r = await agir(caminho, { metodo: 'POST', corpo });
                if (r) onAviso(r.criadas != null ? `${r.criadas} mesas criadas.` : 'Mesa criada.');
              }}
            />

            {mesasDaUnidade.length === 0 && (
              <p className="subtitle">Nenhuma mesa. Se você não tem salão, pode pular.</p>
            )}

            <div className="mesas" style={{ marginTop: 14 }}>
              {mesasDaUnidade.map((m) => (
                <div className="mesa" key={m.id} style={{ cursor: 'default' }}>
                  <div className="numero">{m.numero}</div>
                  <div className="detalhe">
                    {m.area} · {m.lugares} lugares
                  </div>
                  <div className="detalhe" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5 }}>
                    {m.enderecoDoQr}
                  </div>
                  <button
                    className="remover"
                    disabled={ocupado}
                    onClick={() => {
                      if (!confirm(`Apagar a mesa ${m.numero}?`)) return;
                      agir(`/admin/mesas/${m.id}`, { metodo: 'DELETE' }, 'Mesa apagada.');
                    }}
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>

            <p className="hint">
              O endereço abaixo de cada mesa é o que vai dentro do QR Code que você cola nela.
            </p>
          </section>
        </>
      )}
    </>
  );
}

function FormularioUnidade({
  ocupado,
  onCriar,
}: {
  ocupado: boolean;
  onCriar: (d: unknown) => Promise<void>;
}) {
  const [f, setF] = useState({
    name: '',
    cnpj: '',
    addressStreet: '',
    addressNumber: '',
    addressDistrict: '',
    addressCity: '',
  });

  return (
    <div className="grupo">
      <div className="form-linha">
        <div>
          <label>Nome</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Cozinha Centro" />
        </div>
        <div>
          <label>CNPJ (opcional)</label>
          <input value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
        </div>
      </div>

      <div className="form-linha">
        <div>
          <label>Rua</label>
          <input value={f.addressStreet} onChange={(e) => setF({ ...f, addressStreet: e.target.value })} />
        </div>
        <div>
          <label>Número</label>
          <input value={f.addressNumber} onChange={(e) => setF({ ...f, addressNumber: e.target.value })} />
        </div>
      </div>

      <div className="form-linha">
        <div>
          <label>Bairro</label>
          <input value={f.addressDistrict} onChange={(e) => setF({ ...f, addressDistrict: e.target.value })} />
        </div>
        <div>
          <label>Cidade</label>
          <input value={f.addressCity} onChange={(e) => setF({ ...f, addressCity: e.target.value })} />
        </div>
      </div>

      <button disabled={ocupado || f.name.trim().length < 2} onClick={() => onCriar(f)}>
        Criar unidade
      </button>
      <p className="hint">
        A localização exata (para calcular frete por distância) é preenchida depois, quando você
        tiver o mapa de verdade ligado.
      </p>
    </div>
  );
}

function FormularioMesas({
  marcas,
  unitId,
  ocupado,
  onCriar,
}: {
  marcas: MarcaResumo[];
  unitId: string;
  ocupado: boolean;
  onCriar: (caminho: string, corpo: unknown) => Promise<void>;
}) {
  const [brandId, setBrandId] = useState(marcas[0]?.id ?? '');
  const [area, setArea] = useState('Salão');
  const [lugares, setLugares] = useState(4);
  const [de, setDe] = useState('1');
  const [ate, setAte] = useState('10');

  return (
    <div className="grupo" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
      <div className="form-linha">
        <div>
          <label>De qual marca são as mesas</label>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} style={{ width: '100%' }}>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Área</label>
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Salão, Varanda…" />
        </div>
      </div>

      <div className="form-linha">
        <div>
          <label>Da mesa nº</label>
          <input type="number" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <label>Até a mesa nº</label>
          <input type="number" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      <div className="form-linha">
        <div>
          <label>Lugares por mesa</label>
          <input type="number" value={lugares} onChange={(e) => setLugares(Number(e.target.value))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            disabled={ocupado || !brandId}
            onClick={() =>
              onCriar('/admin/mesas/lote', {
                unitId,
                brandId,
                de: Number(de),
                ate: Number(ate),
                area,
                seats: lugares,
              })
            }
          >
            Criar mesas
          </button>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Cria várias de uma vez. Mesas que já existem são puladas.
      </p>
    </div>
  );
}
