'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';
import { chamarApi } from '@/lib/chamar-api';
import { EditorDeCardapio } from './editor-cardapio';
import { IdentidadeDaMarca } from './identidade-marca';
import { RegrasDaMarca } from './regras-marca';
import { Estrutura } from './estrutura';
import { Usuarios } from './usuarios';

type Aba = 'identidade' | 'cardapio' | 'regras' | 'estrutura' | 'usuarios';

export function TelaDeCadastro({
  marcasIniciais,
  papel,
}: {
  marcasIniciais: MarcaResumo[];
  papel: string;
}) {
  const [aba, setAba] = useState<Aba>('cardapio');
  const [marcas, setMarcas] = useState(marcasIniciais);
  const [marcaId, setMarcaId] = useState(marcasIniciais[0]?.id ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [novaMarca, setNovaMarca] = useState(false);

  const recarregarMarcas = useCallback(async () => {
    const r = await chamarApi<MarcaResumo[]>('/brands');
    if (r.ok) setMarcas(r.dados);
  }, []);

  function mostrar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 4000);
  }

  const marca = marcas.find((m) => m.id === marcaId);

  return (
    <main className="shell" style={{ maxWidth: 1100 }}>
      <header className="topbar">
        <div>
          <h1 className="title">Cadastro</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Monte aqui o seu cardápio, suas regras e sua equipe.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {marca && (
            <Link href={`/m/${marca.slug}`} target="_blank">
              <button className="ghost">Ver cardápio publicado ↗</button>
            </Link>
          )}
          <Link href="/painel">
            <button className="ghost">Painel</button>
          </Link>
        </div>
      </header>

      {erro && <div className="error">{erro}</div>}
      {aviso && (
        <div
          className="fechado"
          style={{
            margin: '0 0 16px',
            background: 'rgba(34,197,94,.12)',
            borderColor: 'rgba(34,197,94,.35)',
            color: '#86efac',
          }}
        >
          {aviso}
        </div>
      )}

      {/* seletor de marca — quase tudo aqui é por marca */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="filtros">
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: 11 }}>Marca que você está editando</label>
            <select
              value={marcaId}
              onChange={(e) => setMarcaId(e.target.value)}
              style={{ width: '100%' }}
            >
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <button className="ghost" onClick={() => setNovaMarca(!novaMarca)}>
            {novaMarca ? 'Cancelar' : '+ Nova marca'}
          </button>
        </div>

        {novaMarca && (
          <FormularioMarca
            aoCriar={async (dados) => {
              const r = await chamarApi('/admin/marcas', { metodo: 'POST', corpo: dados });
              if (!r.ok) return setErro(r.erro);
              setErro(null);
              await recarregarMarcas();
              setMarcaId(r.dados.id);
              setNovaMarca(false);
              mostrar(`Marca "${r.dados.name}" criada! O endereço é /m/${r.dados.slug}`);
            }}
          />
        )}
      </section>

      <nav className="canais" style={{ padding: '0 0 18px' }}>
        {(
          [
            ['identidade', 'A cara da marca'],
            ['cardapio', 'Cardápio'],
            ['regras', 'Horários e entrega'],
            ['estrutura', 'Unidades e mesas'],
            ['usuarios', 'Usuários'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className="canal-aba" data-ativo={aba === id} onClick={() => setAba(id)}>
            {label}
          </button>
        ))}
      </nav>

      {!marca ? (
        <p className="vazio">Crie uma marca para começar.</p>
      ) : (
        <>
          {aba === 'identidade' && (
            <IdentidadeDaMarca
              marca={marca}
              onErro={setErro}
              onAviso={mostrar}
              onMudou={recarregarMarcas}
            />
          )}
          {aba === 'cardapio' && (
            <EditorDeCardapio marca={marca} onErro={setErro} onAviso={mostrar} />
          )}
          {aba === 'regras' && <RegrasDaMarca marca={marca} onErro={setErro} onAviso={mostrar} />}
          {aba === 'estrutura' && <Estrutura marcas={marcas} onErro={setErro} onAviso={mostrar} />}
          {aba === 'usuarios' && (
            <Usuarios papel={papel} onErro={setErro} onAviso={mostrar} />
          )}
        </>
      )}
    </main>
  );
}

/** Criar uma marca nova. */
function FormularioMarca({ aoCriar }: { aoCriar: (d: unknown) => Promise<void> }) {
  const [f, setF] = useState({ name: '', description: '', primaryColor: '#E11D48' });
  const [salvando, setSalvando] = useState(false);

  return (
    <div className="grupo">
      <label>Nome da marca</label>
      <input
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
        placeholder="Sushi do Bairro"
      />

      <label>Frase curta (aparece no topo do cardápio)</label>
      <input
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
        placeholder="Sushi fresco, feito na hora"
      />

      <label>Cor da marca</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <input
          type="color"
          value={f.primaryColor}
          onChange={(e) => setF({ ...f, primaryColor: e.target.value })}
          style={{ width: 60, height: 40, padding: 4, marginBottom: 0 }}
        />
        <span className="sub">É a cor que pinta o cardápio do cliente.</span>
      </div>

      <button
        disabled={salvando || f.name.trim().length < 2}
        onClick={async () => {
          setSalvando(true);
          await aoCriar(f);
          setSalvando(false);
        }}
      >
        {salvando ? 'Criando…' : 'Criar marca'}
      </button>
      <p className="hint">
        O endereço público sai do nome: <strong>Sushi do Bairro</strong> vira{' '}
        <code>/m/sushi-do-bairro</code>. Ele não muda depois.
      </p>
    </div>
  );
}
