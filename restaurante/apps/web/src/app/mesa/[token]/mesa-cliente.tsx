'use client';

import { useCallback, useEffect, useState } from 'react';
import { dinheiro, type CategoriaCardapio, type LinhaCarrinho } from '../../m/[slug]/cardapio';
import { SeletorDeItens } from '@/components/seletor-de-itens';

export type Comanda = {
  id: string;
  code: string;
  status: string;
  pessoas: number;
  subtotalCents: number;
  totalCents: number;
  paidCents: number;
  faltaCents: number;
  taxaDeServico: { ligada: boolean; percentual: number; valorCents: number };
  rodadas: Array<{
    id: string;
    code: string;
    status: string;
    criadoEm: string;
    porGarcom: boolean;
    totalCents: number;
    itens: Array<{ id: string; nome: string; quantidade: number; totalCents: number; complementos: string[] }>;
  }>;
  /** as partes da conta, quando ela é dividida */
  pagamentos?: Array<{
    id: string;
    chargeId: string;
    status: string;
    amountCents: number;
    qrCode: string | null;
    pagoEm: string | null;
  }>;
};

export type EstadoDaMesa = {
  mesa: { id: string; numero: string; area: string; lugares: number; status: string };
  marca: { id: string; slug: string; name: string; primaryColor: string };
  comanda: Comanda | null;
};

const NOME_DO_STATUS: Record<string, string> = {
  RECEIVED: 'Na cozinha',
  ACCEPTED: 'Aceito',
  IN_PREPARATION: 'Preparando',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  OUT_FOR_DELIVERY: 'A caminho',
  CANCELED: 'Cancelado',
};

export function MesaCliente({
  token,
  inicial,
  categorias,
  totem,
}: {
  token: string;
  inicial: EstadoDaMesa;
  categorias: CategoriaCardapio[];
  totem: boolean;
}) {
  const [estado, setEstado] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<'cardapio' | 'conta'>('cardapio');

  const cor = estado.marca.primaryColor;

  const recarregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/mesa/${token}`, { cache: 'no-store' });
      if (res.ok) setEstado(await res.json());
    } catch {
      /* mantém a tela */
    }
  }, [token]);

  /** A tela se atualiza sozinha quando a cozinha avança ou o caixa recebe. */
  useEffect(() => {
    const fonte = new EventSource(`/api/public/mesa/${token}/stream`);
    fonte.onmessage = (e) => {
      try {
        if (JSON.parse(e.data).type === 'ping') return;
        recarregar();
      } catch {
        /* ignora */
      }
    };
    return () => fonte.close();
  }, [token, recarregar]);

  /** Mensagem temporária no topo. */
  function mostrar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 5000);
  }

  async function enviarRodada(linhas: LinhaCarrinho[]) {
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/public/mesa/${token}/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: linhas.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantidade,
            modifierIds: l.complementos.map((c) => c.id),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(Array.isArray(data.message) ? data.message[0] : (data.message ?? 'Não consegui enviar.'));
        return;
      }
      await recarregar();
      mostrar(
        totem
          ? `Pedido enviado! Retire no balcão com o código ${data.pedido?.code ?? ''}.`
          : 'Pedido enviado para a cozinha! 🍽️',
      );
    } catch {
      setErro('O servidor não respondeu. Chame o garçom.');
    } finally {
      setEnviando(false);
    }
  }

  async function chamar(qual: 'chamar-garcom' | 'pedir-conta') {
    try {
      const res = await fetch(`/api/public/mesa/${token}/${qual}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.message ?? 'Não consegui chamar.');
        return;
      }
      mostrar(
        data.repetido
          ? 'Já avisamos — o garçom está a caminho.'
          : qual === 'chamar-garcom'
            ? 'Garçom chamado! 🙋'
            : 'Pedimos a conta. Já vamos aí. 🧾',
      );
      await recarregar();
    } catch {
      setErro('O servidor não respondeu.');
    }
  }

  const comanda = estado.comanda;

  return (
    <div className="cardapio" style={{ ['--marca' as any]: cor }}>
      <header className="capa">
        <span className="selo">{totem ? 'Autoatendimento' : 'Peça pelo celular'}</span>
        <h1 style={totem ? { fontSize: 34 } : undefined}>
          {totem ? estado.marca.name : `Mesa ${estado.mesa.numero}`}
        </h1>
        <p>
          {totem
            ? 'Monte seu pedido e finalize na tela'
            : `${estado.marca.name} · ${estado.mesa.area}`}
        </p>
      </header>

      {aviso && (
        <div className="fechado" style={{ background: 'var(--ok-bg)', borderColor: 'color-mix(in srgb, var(--ok) 30%, transparent)', color: 'var(--ok)' }}>
          {aviso}
        </div>
      )}
      {erro && <div className="fechado">{erro}</div>}

      {/* No totem não faz sentido chamar garçom nem ver conta de mesa */}
      {!totem && (
        <>
          <div className="acoes-mesa">
            <button className="ghost" onClick={() => chamar('chamar-garcom')}>
              🙋 Chamar garçom
            </button>
            <button className="ghost" onClick={() => chamar('pedir-conta')}>
              🧾 Pedir a conta
            </button>
          </div>

          <nav className="canais">
            <button className="canal-aba" data-ativo={aba === 'cardapio'} onClick={() => setAba('cardapio')}>
              Cardápio
            </button>
            <button className="canal-aba" data-ativo={aba === 'conta'} onClick={() => setAba('conta')}>
              Minha conta{comanda ? ` · ${dinheiro(comanda.totalCents)}` : ''}
            </button>
          </nav>
        </>
      )}

      {(aba === 'cardapio' || totem) && (
        <SeletorDeItens
          categorias={categorias}
          cor={cor}
          rotuloEnviar={totem ? 'Finalizar pedido' : 'Enviar para a cozinha'}
          enviando={enviando}
          onEnviar={enviarRodada}
          grande={totem}
        />
      )}

      {aba === 'conta' && !totem && (
        <section className="secao">
          {!comanda && <p className="vazio">Nada pedido ainda. Escolha algo no cardápio!</p>}

          {comanda && (
            <>
              <h2>Comanda {comanda.code}</h2>

              {comanda.rodadas.map((r, i) => (
                <div className="card" key={r.id} style={{ marginBottom: 10 }}>
                  <div className="comanda-topo">
                    <span className="stat-label" style={{ margin: 0 }}>
                      {i + 1}ª rodada {r.porGarcom ? '· pelo garçom' : '· pelo celular'}
                    </span>
                    <span className="situacao" data-status={r.status}>
                      {NOME_DO_STATUS[r.status] ?? r.status}
                    </span>
                  </div>
                  {r.itens.map((i2) => (
                    <div className="linha-carrinho" key={i2.id}>
                      <span className="qtd">{i2.quantidade}×</span>
                      <span style={{ minWidth: 0 }}>
                        <div>{i2.nome}</div>
                        {i2.complementos.length > 0 && (
                          <div className="complementos">{i2.complementos.join(' · ')}</div>
                        )}
                      </span>
                      <span className="valor">{dinheiro(i2.totalCents)}</span>
                    </div>
                  ))}
                </div>
              ))}

              <div className="card">
                <div className="totais">
                  <span>Consumo</span>
                  <span>{dinheiro(comanda.subtotalCents)}</span>
                </div>
                {comanda.taxaDeServico.ligada && (
                  <div className="totais">
                    <span>Serviço {comanda.taxaDeServico.percentual}%</span>
                    <span>{dinheiro(comanda.taxaDeServico.valorCents)}</span>
                  </div>
                )}
                <div className="totais grande">
                  <span>Total</span>
                  <span>{dinheiro(comanda.totalCents)}</span>
                </div>
                {comanda.paidCents > 0 && (
                  <>
                    <div className="totais">
                      <span>Já pago</span>
                      <span>{dinheiro(comanda.paidCents)}</span>
                    </div>
                    <div className="totais grande">
                      <span>Falta</span>
                      <span>{dinheiro(comanda.faltaCents)}</span>
                    </div>
                  </>
                )}
                <p className="hint">
                  A taxa de serviço é opcional — se quiser tirar, é só avisar o garçom.
                </p>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
