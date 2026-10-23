// Respostas rápidas: cadastro e envio. Também aparecem ao digitar "/" no campo de mensagem.
import { useMemo, useState, type ReactNode } from 'react';
import { alterar, gravar, normResposta, novoId, passoVazio, type Categoria, type PassoFluxo, type RespostaRapida, type TipoResposta } from '../shared/dados';
import { useColecao, useEsc } from '../ui/hooks';
import { IconBaixar, IconDocumento, IconEnviar, IconFechar, IconImagem, IconInserir, IconLapis, IconLixo, IconMais, IconMicrofone, IconQuadro, IconRaio, IconSubir, IconVideo } from '../ui/icones';
import { ConteudoPasso, type ConteudoEditavel } from './ConteudoPasso';
import { useCRM } from './contexto';
import { destinoDe, enviarResposta, inserirResposta } from './envio';

export const ICONE_TIPO: Record<TipoResposta, (p: { tam?: number }) => ReactNode> = {
  texto: IconRaio,
  image: IconImagem,
  video: IconVideo,
  audio: IconMicrofone,
  document: IconDocumento,
  script: IconQuadro,
};
const NOME_TIPO: Record<TipoResposta, string> = { texto: 'Texto', image: 'Imagem', video: 'Vídeo', audio: 'Áudio', document: 'Arquivo', script: 'Fluxo' };
const ACEITA: Partial<Record<TipoResposta, string>> = { image: 'image/*', video: 'video/*', audio: 'audio/*', document: '*/*' };
const LIMITE_MB = 15;
const CORES = ['#5B8DEF', '#E0A030', '#B96AD9', '#3FA66B', '#D9534F', '#2BB3B1', '#C8551F', '#8A8F98'];

type Filtro = 'todas' | 'mais' | 'sem' | string;

export function Respostas({ fechar }: { fechar: () => void }) {
  const { ativo, contatos, avisar } = useCRM();
  const respostas = useColecao('respostas') ?? [];
  const categorias = useColecao('categorias') ?? [];
  const [editando, setEditando] = useState<RespostaRapida | null>(null);
  const [vendoCategorias, setVendoCategorias] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [enviando, setEnviando] = useState<string | null>(null);
  useEsc(editando ? () => setEditando(null) : vendoCategorias ? () => setVendoCategorias(false) : fechar);

  const destino = ativo ? destinoDe(ativo, contatos[ativo.id]) : null;
  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const cats = [...categorias].sort((a, b) => a.ordem - b.ordem);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let l = respostas.filter((r) => !termo || `${r.atalho} ${r.titulo} ${r.texto}`.toLowerCase().includes(termo));
    if (filtro === 'mais') return l.filter((r) => r.usos > 0).sort((a, b) => b.usos - a.usos).slice(0, 15);
    if (filtro === 'sem') l = l.filter((r) => !r.categoriaId || !catPorId.has(r.categoriaId));
    else if (filtro !== 'todas') l = l.filter((r) => r.categoriaId === filtro);
    return l.sort((a, b) => a.ordem - b.ordem);
  }, [respostas, busca, filtro, catPorId]);

  const acao = async (r: RespostaRapida, modo: 'enviar' | 'inserir') => {
    if (!destino) return avisar('Abra uma conversa primeiro', true);
    setEnviando(r.id);
    try {
      if (modo === 'enviar') await enviarResposta(destino, r);
      else await inserirResposta(destino, r);
      fechar();
    } catch (e) {
      avisar(`Falhou: ${(e as Error).message}`, true);
    } finally {
      setEnviando(null);
    }
  };

  const mover = (r: RespostaRapida, d: -1 | 1) => {
    const ordenadas = [...respostas].sort((a, b) => a.ordem - b.ordem);
    const i = ordenadas.findIndex((x) => x.id === r.id);
    const j = i + d;
    if (j < 0 || j >= ordenadas.length) return;
    [ordenadas[i], ordenadas[j]] = [ordenadas[j], ordenadas[i]];
    gravar('respostas', ordenadas.map((x, k) => ({ ...x, ordem: k })));
  };

  if (editando) return <Editor inicial={editando} voltar={() => setEditando(null)} />;
  if (vendoCategorias) return <Categorias voltar={() => setVendoCategorias(false)} />;

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="modal">
        <div className="modal__topo">
          <h2>Respostas rápidas</h2>
          <p>{destino ? `Enviar para ${destino.nome || destino.numero}` : 'Abra uma conversa para enviar'}</p>
          <button className="icone-btn modal__fechar" onClick={fechar} title="Fechar (Esc)">
            <IconFechar />
          </button>
          {respostas.length > 0 && (
            <div className="abas">
              <button className="aba" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>
                Todas
              </button>
              <button className="aba" aria-pressed={filtro === 'mais'} onClick={() => setFiltro('mais')}>
                Mais usadas
              </button>
              {cats.map((c) => (
                <button key={c.id} className="aba aba--cor" style={{ ['--cor' as string]: c.cor }} aria-pressed={filtro === c.id} onClick={() => setFiltro(c.id)}>
                  {c.nome}
                </button>
              ))}
              {cats.length > 0 && (
                <button className="aba" aria-pressed={filtro === 'sem'} onClick={() => setFiltro('sem')}>
                  Sem categoria
                </button>
              )}
            </div>
          )}
        </div>
        <div className="modal__corpo">
          {respostas.length > 0 && <input className="entrada" placeholder="Buscar resposta" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus style={{ marginBottom: 10 }} />}
          {respostas.length === 0 ? (
            <div className="vazio">
              <strong>Nenhuma resposta cadastrada</strong>
              Crie mensagens prontas e use digitando / seguido do atalho no campo de mensagem.
            </div>
          ) : lista.length === 0 ? (
            <div className="vazio">Nenhuma resposta neste filtro.</div>
          ) : (
            <div className="lista-respostas">
              {lista.map((r) => {
                const Icone = ICONE_TIPO[r.tipo];
                const cat = r.categoriaId ? catPorId.get(r.categoriaId) : undefined;
                return (
                  <div key={r.id} className="resposta" style={cat ? { ['--cor' as string]: cat.cor, borderLeft: `3px solid ${cat.cor}` } : undefined}>
                    <div className="resposta__tipo">
                      <Icone tam={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="resposta__titulo">
                        {r.titulo}
                        <span className="resposta__atalho">/{r.atalho}</span>
                        {r.usos > 0 && <span className="resposta__usos">{r.usos}x</span>}
                      </div>
                      <div className="resposta__previa">{previa(r)}</div>
                    </div>
                    <div className="resposta__acoes">
                      {filtro === 'todas' && !busca && (
                        <>
                          <button className="icone-btn" title="Subir" onClick={() => mover(r, -1)}>
                            <IconSubir tam={14} />
                          </button>
                          <button className="icone-btn" title="Descer" onClick={() => mover(r, 1)}>
                            <IconBaixar tam={14} />
                          </button>
                        </>
                      )}
                      {r.tipo === 'texto' && (
                        <button className="icone-btn" title="Colocar no campo sem enviar" disabled={!destino} onClick={() => acao(r, 'inserir')}>
                          <IconInserir tam={16} />
                        </button>
                      )}
                      <button className="icone-btn" title="Enviar agora" disabled={!destino || enviando === r.id} onClick={() => acao(r, 'enviar')}>
                        <IconEnviar tam={16} />
                      </button>
                      <button className="icone-btn" title="Editar" onClick={() => setEditando(r)}>
                        <IconLapis tam={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal__rodape">
          <button className="btn" onClick={() => setVendoCategorias(true)}>
            Categorias
          </button>
          <button className="btn btn--primario" onClick={() => setEditando(normResposta({ id: '', ordem: respostas.length, categoriaId: filtro !== 'todas' && filtro !== 'mais' && filtro !== 'sem' ? filtro : null }))}>
            <IconMais tam={16} />
            Nova resposta
          </button>
        </div>
      </div>
    </div>
  );
}

function previa(r: RespostaRapida) {
  if (r.tipo === 'script') {
    const n = r.passos?.length ?? 0;
    return n ? `Fluxo com ${n} ${n === 1 ? 'etapa' : 'etapas'}` : 'Fluxo vazio';
  }
  return r.texto || r.nomeArquivo || NOME_TIPO[r.tipo];
}

function Editor({ inicial, voltar }: { inicial: RespostaRapida; voltar: () => void }) {
  const { avisar, funis, business, etiquetasWA } = useCRM();
  const respostas = useColecao('respostas') ?? [];
  const categorias = useColecao('categorias') ?? [];
  const [r, setR] = useState(inicial);
  const set = (p: Partial<RespostaRapida>) => setR((x) => ({ ...x, ...p }));
  const setAcoes = (p: Partial<RespostaRapida['acoes']>) => setR((x) => ({ ...x, acoes: { ...x.acoes, ...p } }));
  const fluxo = r.tipo === 'script';
  const passos = r.passos ?? [];
  const setPasso = (i: number, p: Partial<PassoFluxo>) => set({ passos: passos.map((x, k) => (k === i ? { ...x, ...p } : x)) });

  const salvar = async () => {
    const atalho = r.atalho.trim().replace(/^\//, '').replace(/\s+/g, '-').toLowerCase();
    if (!r.titulo.trim() || !atalho) return avisar('Preencha título e atalho', true);
    if (respostas.some((x) => x.atalho === atalho && x.id !== r.id)) return avisar(`Já existe uma resposta com o atalho /${atalho}`, true);
    if (fluxo) {
      if (!passos.length) return avisar('Adicione pelo menos uma etapa ao fluxo', true);
      if (passos.some((p) => (p.tipo === 'texto' ? !p.texto.trim() : !p.arquivo))) return avisar('Há uma etapa sem conteúdo', true);
    } else {
      if (r.tipo === 'texto' && !r.texto.trim()) return avisar('Escreva o texto da resposta', true);
      if (r.tipo !== 'texto' && !r.arquivo) return avisar('Escolha o arquivo', true);
    }
    await alterar('respostas', (lista) => {
      const final: RespostaRapida = { ...r, atalho, titulo: r.titulo.trim(), id: r.id || novoId() };
      if (r.tipo === 'texto' || fluxo) {
        delete final.arquivo;
        delete final.nomeArquivo;
      }
      if (!fluxo) delete final.passos;
      const i = lista.findIndex((x) => x.id === final.id);
      if (i >= 0) lista[i] = final;
      else lista.push(final);
    });
    voltar();
  };

  const apagar = async () => {
    await alterar('respostas', (lista) => lista.filter((x) => x.id !== r.id));
    voltar();
  };

  const funilMover = r.acoes.mover ? funis.find((f) => f.id === r.acoes.mover!.funilId) : undefined;

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && voltar()}>
      <div className="modal">
        <div className="modal__topo">
          <h2>{r.id ? 'Editar resposta' : 'Nova resposta'}</h2>
          <p>Escolha o tipo, escreva a mensagem e o atalho para usar com /</p>
          <button className="icone-btn modal__fechar" onClick={voltar} title="Voltar (Esc)">
            <IconFechar />
          </button>
        </div>
        <div className="modal__corpo">
          <div className="seletor-tipo" style={{ marginBottom: 14 }}>
            {(Object.keys(NOME_TIPO) as TipoResposta[]).map((t) => {
              const Icone = ICONE_TIPO[t];
              return (
                <button key={t} type="button" aria-pressed={r.tipo === t} onClick={() => set({ tipo: t })}>
                  <Icone />
                  {NOME_TIPO[t]}
                </button>
              );
            })}
          </div>
          <div className="campos">
            <label className="campo">
              <span>Título</span>
              <input className="entrada" value={r.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Boas-vindas" autoFocus />
            </label>
            <label className="campo">
              <span>Atalho (digite /atalho na conversa)</span>
              <input className="entrada" value={r.atalho} onChange={(e) => set({ atalho: e.target.value })} placeholder="ola" />
            </label>
            <label className="campo">
              <span>Categoria</span>
              <select className="entrada" value={r.categoriaId ?? ''} onChange={(e) => set({ categoriaId: e.target.value || null })}>
                <option value="">Sem categoria</option>
                {[...categorias]
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </label>
            <label className="campo campo--linha" style={{ alignSelf: 'end' }}>
              <input type="checkbox" checked={!!r.botao} onChange={(e) => set({ botao: e.target.checked })} />
              Mostrar como botão acima do campo de mensagem
            </label>

            {fluxo ? (
              <div className="campo campo--largo">
                <span>Etapas do fluxo (enviadas em sequência)</span>
                {passos.map((p, i) => (
                  <PassoEditor
                    key={p.id}
                    passo={p}
                    indice={i}
                    total={passos.length}
                    aoMudar={(d) => setPasso(i, d)}
                    aoSubir={() => set({ passos: troca(passos, i, i - 1) })}
                    aoDescer={() => set({ passos: troca(passos, i, i + 1) })}
                    aoApagar={() => set({ passos: passos.filter((_, k) => k !== i) })}
                  />
                ))}
                <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => set({ passos: [...passos, passoVazio('texto')] })}>
                  <IconMais tam={16} />
                  Adicionar etapa
                </button>
              </div>
            ) : (
              <div className="campo campo--largo">
                <ConteudoPasso valor={r as ConteudoEditavel} aoMudar={(p) => set(p)} />
              </div>
            )}

            <div className="campo campo--largo">
              <span>Depois de enviar</span>
              <label className="campo--linha">
                <input type="checkbox" checked={r.acoes.arquivar} onChange={(e) => setAcoes({ arquivar: e.target.checked })} />
                Arquivar a conversa
              </label>
              <div className="campos">
                <select
                  className="entrada"
                  value={r.acoes.mover?.funilId ?? ''}
                  onChange={(e) => {
                    const f = funis.find((x) => x.id === e.target.value);
                    setAcoes({ mover: f ? { funilId: f.id, etapaId: [...f.etapas].sort((a, b) => a.ordem - b.ordem)[0]?.id ?? '' } : null });
                  }}
                >
                  <option value="">Não mover de etapa</option>
                  {funis.map((f) => (
                    <option key={f.id} value={f.id}>
                      Mover no funil {f.nome}
                    </option>
                  ))}
                </select>
                {funilMover && (
                  <select className="entrada" value={r.acoes.mover?.etapaId ?? ''} onChange={(e) => setAcoes({ mover: { funilId: funilMover.id, etapaId: e.target.value } })}>
                    {[...funilMover.etapas]
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((et) => (
                        <option key={et.id} value={et.id}>
                          para {et.nome}
                        </option>
                      ))}
                  </select>
                )}
                {business && etiquetasWA.length > 0 && (
                  <select className="entrada campo--largo" value={r.acoes.etiquetaWA ?? ''} onChange={(e) => setAcoes({ etiquetaWA: e.target.value || null })}>
                    <option value="">Não aplicar etiqueta do WhatsApp</option>
                    {etiquetasWA.map((et) => (
                      <option key={et.id} value={et.id}>
                        Aplicar etiqueta {et.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal__rodape">
          {r.id && (
            <button className="btn btn--perigo" onClick={apagar}>
              <IconLixo tam={16} />
              Apagar
            </button>
          )}
          <button className="btn" onClick={voltar}>
            Cancelar
          </button>
          <button className="btn btn--primario" onClick={salvar}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

const NOME_PASSO: Record<PassoFluxo['tipo'], string> = { texto: 'Texto', image: 'Imagem', video: 'Vídeo', audio: 'Áudio', document: 'Arquivo' };

function PassoEditor({ passo, indice, total, aoMudar, aoSubir, aoDescer, aoApagar }: { passo: PassoFluxo; indice: number; total: number; aoMudar: (p: Partial<PassoFluxo>) => void; aoSubir: () => void; aoDescer: () => void; aoApagar: () => void }) {
  const [aberto, setAberto] = useState(true);
  return (
    <div className="passo">
      <div className="passo__cabecalho">
        <strong className="passo__num">{indice + 1}</strong>
        <button type="button" className="passo__titulo" onClick={() => setAberto((v) => !v)}>
          {NOME_PASSO[passo.tipo]}
          {passo.texto ? ` · ${passo.texto.slice(0, 40)}` : passo.nomeArquivo ? ` · ${passo.nomeArquivo}` : ''}
        </button>
        <button type="button" className="icone-btn" title="Subir" disabled={indice === 0} onClick={aoSubir}>
          <IconSubir tam={14} />
        </button>
        <button type="button" className="icone-btn" title="Descer" disabled={indice === total - 1} onClick={aoDescer}>
          <IconBaixar tam={14} />
        </button>
        <button type="button" className="icone-btn" title="Tirar etapa" onClick={aoApagar}>
          <IconLixo tam={14} />
        </button>
      </div>
      {aberto && (
        <div className="passo__corpo">
          {indice > 0 && (
            <label className="campo campo--largo">
              <span>Esperar antes desta etapa (segundos)</span>
              <input className="entrada" type="number" min={0} max={120} value={passo.esperaSeg} onChange={(e) => aoMudar({ esperaSeg: Number(e.target.value) || 0 })} />
            </label>
          )}
          <ConteudoPasso valor={passo} aoMudar={aoMudar} />
        </div>
      )}
    </div>
  );
}

function troca<T>(l: T[], i: number, j: number) {
  const c = [...l];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

function Categorias({ voltar }: { voltar: () => void }) {
  const categorias = useColecao('categorias') ?? [];
  const ordenadas = [...categorias].sort((a, b) => a.ordem - b.ordem);
  const salvar = (l: Categoria[]) => gravar('categorias', l.map((c, i) => ({ ...c, ordem: i })));
  const mudar = (id: string, p: Partial<Categoria>) => salvar(ordenadas.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const apagar = async (id: string) => {
    await salvar(ordenadas.filter((c) => c.id !== id));
    await alterar('respostas', (l) => l.map((r) => (r.categoriaId === id ? { ...r, categoriaId: null } : r)));
  };

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && voltar()}>
      <div className="modal">
        <div className="modal__topo">
          <h2>Categorias</h2>
          <p>Agrupe as respostas rápidas por assunto.</p>
          <button className="icone-btn modal__fechar" onClick={voltar} title="Voltar (Esc)">
            <IconFechar />
          </button>
        </div>
        <div className="modal__corpo">
          {ordenadas.length === 0 && <div className="vazio">Nenhuma categoria ainda.</div>}
          {ordenadas.map((c, i) => (
            <div key={c.id} className="item-linha">
              <input type="color" className="cor-campo" value={c.cor} onChange={(e) => mudar(c.id, { cor: e.target.value })} title="Cor" />
              <input className="entrada" defaultValue={c.nome} onBlur={(e) => e.target.value.trim() && mudar(c.id, { nome: e.target.value.trim() })} />
              <button className="icone-btn" title="Subir" disabled={i === 0} onClick={() => salvar(troca(ordenadas, i, i - 1))}>
                <IconSubir tam={16} />
              </button>
              <button className="icone-btn" title="Descer" disabled={i === ordenadas.length - 1} onClick={() => salvar(troca(ordenadas, i, i + 1))}>
                <IconBaixar tam={16} />
              </button>
              <button className="icone-btn" title="Apagar categoria" onClick={() => apagar(c.id)}>
                <IconLixo tam={16} />
              </button>
            </div>
          ))}
          <div className="ajuda">Apagar uma categoria não apaga as respostas.</div>
        </div>
        <div className="modal__rodape">
          <button className="btn" onClick={voltar}>
            Voltar
          </button>
          <button className="btn btn--primario" onClick={() => salvar([...ordenadas, { id: novoId(), nome: 'Nova categoria', cor: CORES[ordenadas.length % CORES.length], ordem: ordenadas.length }])}>
            <IconMais tam={16} />
            Nova categoria
          </button>
        </div>
      </div>
    </div>
  );
}
