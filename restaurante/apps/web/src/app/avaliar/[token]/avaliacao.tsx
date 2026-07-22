'use client';

import { useState } from 'react';

export type Pesquisa = {
  token: string;
  marca: { name: string; primaryColor: string };
  pedido: string;
  jaRespondeu: boolean;
  nota: number | null;
  comentario: string | null;
};

/**
 * A pesquisa de satisfação (NPS), pelo link que o cliente recebe.
 * Sem login, sem cadastro — uma pergunta só.
 */
export function Avaliacao({ token, inicial }: { token: string; inicial: Pesquisa }) {
  const [nota, setNota] = useState<number | null>(inicial.nota);
  const [comentario, setComentario] = useState(inicial.comentario ?? '');
  const [enviado, setEnviado] = useState(inicial.jaRespondeu);
  const [enviando, setEnviando] = useState(false);

  const cor = inicial.marca.primaryColor;

  async function enviar() {
    if (nota == null) return;
    setEnviando(true);
    try {
      await fetch(`/api/public/avaliar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota, comentario }),
      });
      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="center-screen" style={{ ['--marca' as any]: cor }}>
        <div className="card card--login" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🙏</div>
          <h1 className="title">Obrigado!</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Sua opinião ajuda a {inicial.marca.name} a melhorar.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="center-screen" style={{ ['--marca' as any]: cor }}>
      <div className="card card--login" style={{ maxWidth: 460 }}>
        <p className="subtitle" style={{ margin: 0 }}>
          {inicial.marca.name} · pedido {inicial.pedido}
        </p>
        <h1 className="title">Como foi seu pedido?</h1>
        <p className="subtitle">
          De 0 a 10, o quanto você indicaria a {inicial.marca.name} a um amigo?
        </p>

        <div className="notas">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              className="nota"
              data-ativa={nota === n}
              data-faixa={n <= 6 ? 'baixa' : n <= 8 ? 'media' : 'alta'}
              onClick={() => setNota(n)}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="notas-legenda">
          <span>não indicaria</span>
          <span>indicaria com certeza</span>
        </div>

        <label htmlFor="comentario">Quer contar mais alguma coisa? (opcional)</label>
        <input
          id="comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="A massa estava ótima…"
          maxLength={500}
        />

        <button onClick={enviar} disabled={nota == null || enviando}>
          {enviando ? 'Enviando…' : 'Enviar avaliação'}
        </button>
      </div>
    </main>
  );
}
