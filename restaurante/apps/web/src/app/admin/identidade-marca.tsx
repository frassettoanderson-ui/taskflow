'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarcaResumo } from '../pedidos/painel-de-pedidos';
import { chamarApi, enviarFoto } from '@/lib/chamar-api';

/**
 * A cara da marca: logo, cor e frase.
 *
 * É o "white-label" do produto — o cardápio que o cliente abre tem que parecer
 * do restaurante, não do nosso sistema. Fica na tela de cadastro porque muda
 * junto com o nome, não junto com o cardápio.
 */
export function IdentidadeDaMarca({
  marca,
  onErro,
  onAviso,
  onMudou,
}: {
  marca: MarcaResumo;
  onErro: (e: string | null) => void;
  onAviso: (t: string) => void;
  /** avisa a tela de cima para recarregar a lista de marcas */
  onMudou: () => Promise<void>;
}) {
  const [nome, setNome] = useState(marca.name);
  const [frase, setFrase] = useState(marca.description ?? '');
  const [cor, setCor] = useState(marca.primaryColor);
  const [logo, setLogo] = useState<string | null>(marca.logoUrl ?? null);
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  // Trocar de marca no seletor de cima tem que trocar o que está nos campos.
  useEffect(() => {
    setNome(marca.name);
    setFrase(marca.description ?? '');
    setCor(marca.primaryColor);
    setLogo(marca.logoUrl ?? null);
  }, [marca.id, marca.name, marca.description, marca.primaryColor, marca.logoUrl]);

  const mudou =
    nome !== marca.name ||
    frase !== (marca.description ?? '') ||
    cor !== marca.primaryColor ||
    logo !== (marca.logoUrl ?? null);

  async function salvar(campos: Record<string, unknown>, sucesso: string) {
    setOcupado(true);
    onErro(null);
    const r = await chamarApi(`/admin/marcas/${marca.id}`, { metodo: 'PATCH', corpo: campos });
    setOcupado(false);
    if (!r.ok) return onErro(r.erro);
    await onMudou();
    onAviso(sucesso);
  }

  async function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setOcupado(true);
    onErro(null);
    const r = await enviarFoto(f);
    setOcupado(false);
    if (!r.ok) return onErro(r.erro);

    setLogo(r.url);
    // A logo salva na hora: quem sobe uma imagem espera vê-la aplicada, não
    // ter que lembrar de clicar em "salvar" depois.
    await salvar({ logoUrl: r.url }, 'Logo trocada.');
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="stat-label">A cara da marca</div>
      <p className="hint" style={{ marginTop: 0 }}>
        É o que o cliente vê ao abrir <code>/m/{marca.slug}</code>. O endereço não muda; o resto,
        sim.
      </p>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* logo */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,.15)',
              background: logo ? `center/cover url(${logo})` : cor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 30,
            }}
          >
            {!logo && nome.trim().charAt(0).toUpperCase()}
          </div>

          <input
            ref={arquivo}
            type="file"
            accept="image/*"
            onChange={escolherLogo}
            style={{ display: 'none' }}
          />
          <button
            className="ghost"
            disabled={ocupado}
            onClick={() => arquivo.current?.click()}
            style={{ marginTop: 8, width: '100%', padding: '6px 10px', fontSize: 12.5 }}
          >
            {logo ? 'Trocar logo' : 'Enviar logo'}
          </button>
          {logo && (
            <button
              className="remover"
              disabled={ocupado}
              onClick={() => {
                setLogo(null);
                salvar({ logoUrl: null }, 'Logo removida.');
              }}
              style={{ marginTop: 4, width: '100%' }}
            >
              remover
            </button>
          )}
          <p className="hint" style={{ marginTop: 6, fontSize: 11 }}>
            Quadrada, a partir de 200×200. JPG, PNG ou WebP.
          </p>
        </div>

        {/* nome, frase e cor */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <label>Nome da marca</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} />

          <label>Frase curta (aparece no topo do cardápio)</label>
          <input
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            placeholder="Sushi fresco, feito na hora"
          />

          <label>Cor da marca</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              style={{ width: 60, height: 40, padding: 4, marginBottom: 0 }}
            />
            <span
              style={{
                background: cor,
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              É assim que os botões ficam
            </span>
          </div>

          <button
            disabled={ocupado || !mudou || nome.trim().length < 2}
            onClick={() =>
              salvar(
                { name: nome.trim(), description: frase.trim(), primaryColor: cor },
                'Identidade salva.',
              )
            }
          >
            {ocupado ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </section>
  );
}
