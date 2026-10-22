// Funil em quadro: uma coluna por etapa; arrastar o cartão muda a etapa do contato.
// No modo "Etiquetas do WhatsApp" as colunas são as etiquetas e arrastar troca a etiqueta.
import { memo, useEffect, useMemo, useState } from 'react';
import { FUNIL_ETIQUETAS, gravar, totalNegocios, type Contato } from '../shared/dados';
import type { ChatResumo } from '../shared/protocolo';
import { iniciais, moeda, telefone } from '../ui/formato';
import { useEsc } from '../ui/hooks';
import { IconBaixar, IconBusca, IconFechar } from '../ui/icones';
import { useCRM, useFunilAtivo } from './contexto';
import { exportarFunil } from './exportar';
import { wa } from './wa';

const SEM = '__sem__';
const fotos = new Map<string, string | null>();

interface Cartao {
  id: string;
  nome: string;
  numero: string;
  info: string;
  contato?: Contato;
  t: number;
}

interface Coluna {
  id: string;
  nome: string;
  cor: string;
  cartoes: Cartao[];
}

export function Kanban({ fechar }: { fechar: () => void }) {
  const { contatos, chats, chatPorId, salvarContato, funis, config, business, etiquetasWA, avisar, atualizarChats } = useCRM();
  const funil = useFunilAtivo();
  const modoEtiquetas = config?.funilAtivo === FUNIL_ETIQUETAS && business;
  const [busca, setBusca] = useState('');
  const [alvo, setAlvo] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<{ id: string; de: string } | null>(null);
  useEsc(fechar);

  const cartaoDe = (id: string, chat?: ChatResumo): Cartao => {
    const c = contatos[id];
    return {
      id,
      nome: c?.nome || chat?.nome || telefone(c?.numero ?? chat?.numero ?? ''),
      numero: c?.numero ?? chat?.numero ?? '',
      info: chat?.ultimaMsg || c?.empresa || '',
      contato: c,
      t: chat?.t ? chat.t * 1000 : c?.atualizadoEm ?? 0,
    };
  };

  const colunas = useMemo<Coluna[]>(() => {
    const termo = busca.trim().toLowerCase();
    const passa = (c: Cartao) => !termo || c.nome.toLowerCase().includes(termo) || c.numero.includes(termo) || !!c.contato?.tags.some((t) => t.toLowerCase().includes(termo));
    const ordenar = (l: Cartao[]) => l.filter(passa).sort((a, b) => b.t - a.t);

    if (modoEtiquetas) {
      const sem = chats.filter((ch) => !ch.grupo && !ch.etiquetas.length).slice(0, 80);
      return [
        { id: SEM, nome: 'Sem etiqueta', cor: 'var(--tinta-3)', cartoes: ordenar(sem.map((ch) => cartaoDe(ch.id, ch))) },
        ...etiquetasWA.map((e) => ({ id: e.id, nome: e.nome, cor: e.cor, cartoes: ordenar(chats.filter((ch) => ch.etiquetas.includes(e.id)).map((ch) => cartaoDe(ch.id, ch))) })),
      ];
    }
    if (!funil) return [];
    const porEtapa = new Map<string, Cartao[]>();
    for (const c of Object.values(contatos)) {
      const e = c.posicoes[funil.id];
      if (!e) continue;
      const l = porEtapa.get(e) ?? [];
      l.push(cartaoDe(c.id, chatPorId.get(c.id)));
      porEtapa.set(e, l);
    }
    const sem = chats.filter((ch) => !ch.grupo && !contatos[ch.id]?.posicoes[funil.id]).slice(0, 80);
    return [
      { id: SEM, nome: 'Sem etapa', cor: 'var(--tinta-3)', cartoes: ordenar(sem.map((ch) => cartaoDe(ch.id, ch))) },
      ...[...funil.etapas].sort((a, b) => a.ordem - b.ordem).map((e) => ({ id: e.id, nome: e.nome, cor: e.cor, cartoes: ordenar(porEtapa.get(e.id) ?? []) })),
    ];
  }, [contatos, chats, chatPorId, busca, funil, modoEtiquetas, etiquetasWA]);

  const soltar = async (destino: string) => {
    const a = arrastando;
    setAlvo(null);
    setArrastando(null);
    if (!a || a.de === destino) return;
    if (modoEtiquetas) {
      const mud: { id: string; tipo: 'add' | 'remove' }[] = [];
      if (a.de !== SEM) mud.push({ id: a.de, tipo: 'remove' });
      if (destino !== SEM) mud.push({ id: destino, tipo: 'add' });
      try {
        await wa('etiquetarChat', [a.id], mud);
        atualizarChats();
      } catch (e) {
        avisar(`Não foi possível mudar a etiqueta: ${(e as Error).message}`, true);
      }
      return;
    }
    if (!funil) return;
    const chat = chatPorId.get(a.id) ?? { id: a.id, nome: contatos[a.id]?.nome ?? '', numero: contatos[a.id]?.numero ?? '' };
    salvarContato(chat, (c) => {
      if (destino === SEM) delete c.posicoes[funil.id];
      else c.posicoes[funil.id] = destino;
    });
  };

  const abrir = (id: string) => {
    wa('abrirChat', id);
    fechar();
  };

  const trocarFunil = (id: string) => config && gravar('config', { ...config, funilAtivo: id });

  const exportar = async () => {
    try {
      await exportarFunil(modoEtiquetas ? 'Etiquetas do WhatsApp' : funil?.nome ?? 'Funil', colunas.filter((c) => c.id !== SEM).map((c) => ({ nome: c.nome, contatos: c.cartoes.map((x) => ({ id: x.id, nome: x.nome, numero: x.numero, contato: x.contato })) })));
    } catch (e) {
      avisar(`Não deu para exportar: ${(e as Error).message}`, true);
    }
  };

  return (
    <div className="camada">
      <div className="camada__topo">
        <div>
          <div className="camada__titulo">{modoEtiquetas ? 'Etiquetas do WhatsApp' : funil?.nome ?? 'Funil'}</div>
          <div className="camada__sub">Arraste os cartões entre as colunas. Clique para abrir a conversa.</div>
        </div>
        <div className="abas abas--topo">
          {[...funis]
            .sort((a, b) => a.ordem - b.ordem)
            .map((f) => (
              <button key={f.id} className="aba" aria-pressed={!modoEtiquetas && f.id === funil?.id} onClick={() => trocarFunil(f.id)}>
                {f.nome}
              </button>
            ))}
          {business && (
            <button className="aba" aria-pressed={modoEtiquetas} onClick={() => trocarFunil(FUNIL_ETIQUETAS)}>
              Etiquetas do WhatsApp
            </button>
          )}
        </div>
        <div className="espaco" />
        <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconBusca />
          <input className="entrada" style={{ width: 220 }} placeholder="Buscar nome, número ou etiqueta" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
        </label>
        <button className="btn" onClick={exportar} title="Baixar planilha deste funil">
          <IconBaixar tam={16} />
          Planilha
        </button>
        <button className="icone-btn" onClick={fechar} title="Fechar (Esc)">
          <IconFechar />
        </button>
      </div>
      <div className="kanban">
        {colunas.map((col) => {
          const total = col.cartoes.reduce((s, c) => s + totalNegocios(c.contato), 0);
          return (
            <section
              key={col.id}
              className={`coluna${alvo === col.id ? ' coluna--alvo' : ''}`}
              style={{ ['--cor' as string]: col.cor }}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvo(col.id);
              }}
              onDragLeave={() => setAlvo((x) => (x === col.id ? null : x))}
              onDrop={() => soltar(col.id)}
            >
              <div className="coluna__topo">
                <div className="coluna__nome">{col.nome}</div>
                <div className="coluna__meta">
                  {col.cartoes.length} {col.cartoes.length === 1 ? 'contato' : 'contatos'}
                  {total > 0 && ` · ${moeda.format(total)}`}
                </div>
              </div>
              <div className="coluna__lista">
                {col.cartoes.map((c) => (
                  <CartaoKanban key={c.id} c={c} arrastando={arrastando?.id === c.id} aoArrastar={(id) => setArrastando(id ? { id, de: col.id } : null)} abrir={abrir} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const CartaoKanban = memo(function CartaoKanban({ c, arrastando, aoArrastar, abrir }: { c: Cartao; arrastando: boolean; aoArrastar: (id: string | null) => void; abrir: (id: string) => void }) {
  const [foto, setFoto] = useState(fotos.get(c.id) ?? null);
  useEffect(() => {
    if (fotos.has(c.id)) return;
    fotos.set(c.id, null);
    wa('foto', c.id)
      .then((u) => {
        fotos.set(c.id, u);
        setFoto(u);
      })
      .catch(() => {});
  }, [c.id]);
  const total = totalNegocios(c.contato);

  return (
    <article
      className={`cartao${arrastando ? ' cartao--arrastando' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        aoArrastar(c.id);
      }}
      onDragEnd={() => aoArrastar(null)}
      onClick={() => abrir(c.id)}
    >
      {foto ? <img className="cartao__foto" src={foto} alt="" /> : <div className="cartao__foto">{iniciais(c.nome)}</div>}
      <div style={{ minWidth: 0 }}>
        <div className="cartao__nome">{c.nome}</div>
        <div className="cartao__info">{c.info || telefone(c.numero)}</div>
      </div>
      {(!!c.contato?.tags.length || total > 0) && (
        <div className="cartao__rodape">
          {c.contato?.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          {total > 0 && <span className="cartao__valor">{moeda.format(total)}</span>}
        </div>
      )}
    </article>
  );
});
