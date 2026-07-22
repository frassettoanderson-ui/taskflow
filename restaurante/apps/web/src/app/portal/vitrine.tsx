'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { dinheiro } from '../m/[slug]/cardapio';

export type MarcaNaVitrine = {
  slug: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  cor: string;
  capa: string | null;
  cidade: string | null;
  distanciaKm: number | null;
  aberta: boolean;
  motivo: string | null;
  horarioDeHoje: string | null;
};

export type Categoria = { categoria: string; total: number };

/** Bairros que o mapa de exemplo conhece. */
const BAIRROS = [
  'Centro',
  'Praia da Vila',
  'Vila Nova',
  'Divinéia',
  'Mirim',
  'Alto Arroio',
  'Araçatuba',
  'Ibiraquera',
];

export function Vitrine({
  iniciais,
  categorias,
}: {
  iniciais: MarcaNaVitrine[];
  categorias: Categoria[];
}) {
  const [marcas, setMarcas] = useState(iniciais);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [bairro, setBairro] = useState('');
  const [apenasAbertas, setApenasAbertas] = useState(false);
  const [carteira, setCarteira] = useState<{ nome: string | null; saldoCents: number } | null>(null);
  const [telefone, setTelefone] = useState('');

  const buscar = useCallback(async () => {
    const p = new URLSearchParams();
    if (busca.trim()) p.set('busca', busca.trim());
    if (categoria) p.set('categoria', categoria);
    if (bairro) p.set('bairro', bairro);
    if (apenasAbertas) p.set('abertas', 'sim');

    try {
      const res = await fetch(`/api/portal/vitrine?${p}`, { cache: 'no-store' });
      if (res.ok) setMarcas(await res.json());
    } catch {
      /* mantém a tela */
    }
  }, [busca, categoria, bairro, apenasAbertas]);

  useEffect(() => {
    const t = setTimeout(buscar, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  /** Consulta a carteira da rede (vale em qualquer restaurante daqui). */
  async function verCarteira() {
    const so = telefone.replace(/\D/g, '');
    if (so.length < 10) return;
    try {
      const res = await fetch(`/api/portal/carteira?telefone=${so}`, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setCarteira({ nome: d.nome, saldoCents: d.saldoCents });
      }
    } catch {
      /* ignora */
    }
  }

  return (
    <div className="portal">
      <header className="portal-capa">
        <div className="portal-interno">
          <span className="selo">Portal da rede</span>
          <h1>Peça dos melhores da sua região</h1>
          <p>
            Descubra restaurantes perto de você e acumule <strong>cashback que vale em toda a
            rede</strong>.
          </p>

          <div className="portal-busca">
            <input
              placeholder="Buscar restaurante ou tipo de comida…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select value={bairro} onChange={(e) => setBairro(e.target.value)}>
              <option value="">Onde você está?</option>
              {BAIRROS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="portal-interno">
        {/* carteira da rede */}
        <section className="card carteira-card">
          <div>
            <div className="stat-label">Sua carteira da rede</div>
            {carteira ? (
              <>
                <div className="stat-value" style={{ color: 'var(--ok)' }}>
                  {dinheiro(carteira.saldoCents)}
                </div>
                <div className="sub">
                  {carteira.nome ? `${carteira.nome.split(' ')[0]}, ` : ''}vale em qualquer
                  restaurante do portal
                </div>
              </>
            ) : (
              <div className="sub">Consulte pelo seu telefone — o saldo vale em toda a rede.</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Seu telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              style={{ marginBottom: 0, width: 170 }}
            />
            <button className="ghost" style={{ width: 'auto' }} onClick={verCarteira}>
              Ver saldo
            </button>
          </div>
        </section>

        {/* categorias */}
        {categorias.length > 0 && (
          <div className="chips">
            <button className="chip" data-ativo={categoria === ''} onClick={() => setCategoria('')}>
              Todas
            </button>
            {categorias.map((c) => (
              <button
                key={c.categoria}
                className="chip"
                data-ativo={categoria === c.categoria}
                onClick={() => setCategoria(c.categoria)}
              >
                {c.categoria}
                <b>{c.total}</b>
              </button>
            ))}
            <button
              className="chip"
              data-ativo={apenasAbertas}
              onClick={() => setApenasAbertas(!apenasAbertas)}
            >
              Abertas agora
            </button>
          </div>
        )}

        {/* a vitrine */}
        {marcas.length === 0 ? (
          <p className="vazio">
            Nenhum restaurante por aqui ainda. Se você tem um, fale com a gente para entrar no
            portal.
          </p>
        ) : (
          <div className="vitrine-grade">
            {marcas.map((m) => (
              <Link key={m.slug} href={`/portal/${m.slug}`} className="vitrine-card">
                <div className="vitrine-capa" style={{ background: m.cor }}>
                  <span className="vitrine-categoria">{m.categoria}</span>
                  {!m.aberta && <span className="vitrine-fechada">fechada agora</span>}
                </div>
                <div className="vitrine-corpo">
                  <strong>{m.nome}</strong>
                  {m.descricao && <p>{m.descricao}</p>}
                  <div className="vitrine-rodape">
                    {m.distanciaKm != null && <span>{m.distanciaKm} km</span>}
                    {m.aberta ? (
                      <span className="aberto-sim">aberta</span>
                    ) : (
                      <span className="aberto-nao">{m.motivo ?? 'fechada'}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <footer className="portal-rodape">
          <h3>Por que este portal é diferente</h3>
          <p>
            Aqui o restaurante recebe o <strong>valor cheio</strong> do cardápio dele — a comissão
            é um acréscimo pago por quem chegou pelo portal, não um desconto no bolso de quem
            cozinha.
          </p>
          <p>
            E a cada pedido você recebe um cupom para <strong>pedir direto na próxima vez</strong>,
            mais barato. É o contrário do pedágio: o portal existe para apresentar, não para
            aprisionar.
          </p>
        </footer>
      </div>
    </div>
  );
}
