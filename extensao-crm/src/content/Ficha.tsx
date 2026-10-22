// Painel lateral com a ficha do contato da conversa aberta.
import { useEffect, useMemo, useState } from 'react';
import { alterar, novoId, ORIGENS, totalNegocios, type Contato, type Nota } from '../shared/dados';
import { dataCurta, dataHora, iniciais, lerArquivoComoDataUrl, mascaraMoeda, moeda, paraCampoDataHora, telefone, UFS } from '../ui/formato';
import { useColecao } from '../ui/hooks';
import { IconCheck, IconFechar, IconLixo, IconMais, IconRelogio, IconSino } from '../ui/icones';
import { useCRM, useFunilAtivo } from './contexto';
import { wa } from './wa';

/** Abre o Google Agenda já com o evento preenchido (30 min), sem usar API. */
function linkAgenda(texto: string, contato: string, quando: number) {
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `${texto} (${contato})`, dates: `${fmt(quando)}/${fmt(quando + 30 * 60_000)}`, details: `Contato: ${contato}` });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function Ficha() {
  const { ativo, contatos, salvarContato, avisar, funis, business, etiquetasWA, atualizarChats } = useCRM();
  const funilAtivo = useFunilAtivo();
  const lembretes = useColecao('lembretes') ?? [];
  const agendamentos = useColecao('agendamentos') ?? [];
  const [foto, setFoto] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [anexo, setAnexo] = useState<NonNullable<Nota['midia']> | null>(null);
  const [tag, setTag] = useState('');
  const [todosCampos, setTodosCampos] = useState(false);
  const [novoNegocio, setNovoNegocio] = useState<{ descricao: string; data: string; valor: string } | null>(null);
  const [novoLembrete, setNovoLembrete] = useState<{ texto: string; quando: string } | null>(null);

  const contato = ativo ? contatos[ativo.id] : undefined;

  useEffect(() => {
    setFoto(null);
    setNota('');
    setNovoLembrete(null);
    setNovoNegocio(null);
    if (ativo) wa('foto', ativo.id).then(setFoto).catch(() => {});
  }, [ativo?.id]);

  const meusLembretes = useMemo(() => lembretes.filter((l) => l.chatId === ativo?.id && !l.feito).sort((a, b) => a.quando - b.quando), [lembretes, ativo?.id]);
  const meusAgendamentos = useMemo(() => agendamentos.filter((a) => a.chatId === ativo?.id && a.status === 'pendente'), [agendamentos, ativo?.id]);

  if (!ativo) {
    return (
      <aside className="ficha">
        <div className="ficha__vazia">
          <strong>Nenhuma conversa aberta</strong>
          Abra uma conversa para ver e preencher a ficha do contato.
        </div>
      </aside>
    );
  }

  const nome = contato?.nome || ativo.nome || telefone(ativo.numero);
  const salvar = (fn: (c: Contato) => void) => salvarContato(ativo, fn);
  const campo = <K extends keyof Contato>(k: K) => (valor: Contato[K]) => salvar((c) => void (c[k] = valor));
  const funisOrdenados = [...funis].sort((a, b) => a.ordem - b.ordem);
  const principal = funilAtivo && funis.some((f) => f.id === funilAtivo.id) ? funilAtivo : funisOrdenados[0];
  const outros = funisOrdenados.filter((f) => f.id !== principal?.id);

  const addTag = () => {
    const t = tag.trim();
    if (!t) return;
    salvar((c) => {
      if (!c.tags.includes(t)) c.tags.push(t);
    });
    setTag('');
  };

  const addNota = () => {
    const t = nota.trim();
    if (!t && !anexo) return;
    salvar((c) => {
      c.notas.unshift({ id: novoId(), texto: t, em: Date.now(), midia: anexo ?? undefined });
    });
    setNota('');
    setAnexo(null);
  };

  const anexar = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return avisar('Anexo acima de 10 MB', true);
    setAnexo({ arquivo: await lerArquivoComoDataUrl(f), nome: f.name, tipo: f.type });
  };

  const salvarNegocio = () => {
    if (!novoNegocio) return;
    const valor = mascaraMoeda(novoNegocio.valor).valor;
    if (!valor) return avisar('Informe o valor', true);
    salvar((c) => {
      c.negocios.push({ id: novoId(), descricao: novoNegocio.descricao.trim() || 'Negócio', data: novoNegocio.data, valor });
    });
    setNovoNegocio(null);
  };

  const salvarLembrete = async () => {
    if (!novoLembrete?.texto.trim() || !novoLembrete.quando) return;
    await alterar('lembretes', (ls) => {
      ls.push({ id: novoId(), chatId: ativo.id, nomeContato: nome, texto: novoLembrete.texto.trim(), quando: new Date(novoLembrete.quando).getTime(), feito: false });
    });
    setNovoLembrete(null);
    avisar('Lembrete criado');
  };

  const alternarEtiquetaWA = async (id: string) => {
    const tem = ativo.etiquetas.includes(id);
    try {
      await wa('etiquetarChat', [ativo.id], [{ id, tipo: tem ? 'remove' : 'add' }]);
      atualizarChats();
    } catch (e) {
      avisar(`Não foi possível mudar a etiqueta: ${(e as Error).message}`, true);
    }
  };

  const texto = (k: 'nome' | 'email' | 'empresa' | 'cargo' | 'cidade' | 'produtos', rotulo: string, largo = false, tipo = 'text') => (
    <label className={`campo${largo ? ' campo--largo' : ''}`}>
      <span>{rotulo}</span>
      <input className="entrada" type={tipo} defaultValue={contato?.[k] ?? (k === 'nome' ? ativo.nome : '')} key={`${k}${ativo.id}`} onBlur={(e) => campo(k)(e.target.value.trim())} />
    </label>
  );

  return (
    <aside className="ficha">
      <div className="ficha__topo">
        {foto ? <img className="ficha__foto" src={foto} alt="" /> : <div className="ficha__foto">{iniciais(nome)}</div>}
        <div className="ficha__nome">{nome}</div>
        <div className="ficha__numero">{ativo.grupo ? 'Grupo' : telefone(ativo.numero)}</div>
        {(contato?.negocios.length ?? 0) > 0 && <div className="ficha__total">{moeda.format(totalNegocios(contato))}</div>}
      </div>

      <div className="ficha__corpo">
        {principal && (
          <section className="bloco">
            <div className="bloco__titulo">{principal.nome}</div>
            <div className="trilha">
              {[...principal.etapas]
                .sort((a, b) => a.ordem - b.ordem)
                .map((e) => (
                  <button
                    key={e.id}
                    className="trilha__item"
                    style={{ ['--cor' as string]: e.cor }}
                    aria-pressed={contato?.posicoes[principal.id] === e.id}
                    onClick={() =>
                      salvar((c) => {
                        if (c.posicoes[principal.id] === e.id) delete c.posicoes[principal.id];
                        else c.posicoes[principal.id] = e.id;
                      })
                    }
                  >
                    <span className="trilha__cor" />
                    {e.nome}
                  </button>
                ))}
            </div>
            {outros.length > 0 && (
              <div className="campos" style={{ marginTop: 10 }}>
                {outros.map((f) => (
                  <label key={f.id} className="campo campo--largo">
                    <span>{f.nome}</span>
                    <select
                      className="entrada"
                      value={contato?.posicoes[f.id] ?? ''}
                      onChange={(ev) =>
                        salvar((c) => {
                          if (ev.target.value) c.posicoes[f.id] = ev.target.value;
                          else delete c.posicoes[f.id];
                        })
                      }
                    >
                      <option value="">Fora deste funil</option>
                      {[...f.etapas]
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </section>
        )}

        {business && etiquetasWA.length > 0 && (
          <section className="bloco">
            <div className="bloco__titulo">Etiquetas do WhatsApp</div>
            <div className="tags">
              {etiquetasWA.map((e) => (
                <button key={e.id} className="etiqueta-wa" style={{ ['--cor' as string]: e.cor }} aria-pressed={ativo.etiquetas.includes(e.id)} onClick={() => alternarEtiquetaWA(e.id)}>
                  {e.nome}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="bloco">
          <div className="bloco__titulo">
            Negócios
            <button className="icone-btn" title="Adicionar negócio" onClick={() => setNovoNegocio({ descricao: '', data: new Date().toLocaleDateString('sv-SE'), valor: '' })}>
              <IconMais tam={16} />
            </button>
          </div>
          {novoNegocio && (
            <div className="campos">
              <input className="entrada campo--largo" placeholder="Descrição (ex.: plano anual)" value={novoNegocio.descricao} onChange={(e) => setNovoNegocio({ ...novoNegocio, descricao: e.target.value })} autoFocus />
              <input className="entrada" type="date" value={novoNegocio.data} onChange={(e) => setNovoNegocio({ ...novoNegocio, data: e.target.value })} />
              <input className="entrada" inputMode="numeric" placeholder="R$ 0,00" value={novoNegocio.valor} onChange={(e) => setNovoNegocio({ ...novoNegocio, valor: mascaraMoeda(e.target.value).texto })} onKeyDown={(e) => e.key === 'Enter' && salvarNegocio()} />
              <div className="linha-botoes campo--largo">
                <button className="btn btn--pequeno" onClick={() => setNovoNegocio(null)}>
                  Cancelar
                </button>
                <button className="btn btn--pequeno btn--primario" onClick={salvarNegocio}>
                  Salvar negócio
                </button>
              </div>
            </div>
          )}
          {contato?.negocios.map((n) => (
            <div key={n.id} className="item-linha">
              <div className="item-linha__txt">
                <div>{n.descricao}</div>
                <small>{dataCurta(n.data)}</small>
              </div>
              <strong className="valor">{moeda.format(n.valor)}</strong>
              <button className="icone-btn" title="Apagar negócio" onClick={() => salvar((c) => void (c.negocios = c.negocios.filter((x) => x.id !== n.id)))}>
                <IconLixo tam={14} />
              </button>
            </div>
          ))}
          {!novoNegocio && !contato?.negocios.length && <div className="ajuda">Nenhum negócio registrado.</div>}
        </section>

        <section className="bloco">
          <div className="bloco__titulo">
            Dados
            <button className="btn btn--pequeno" onClick={() => setTodosCampos((v) => !v)}>
              {todosCampos ? 'Menos campos' : 'Todos os campos'}
            </button>
          </div>
          <div className="campos">
            {texto('nome', 'Nome no CRM', true)}
            {texto('email', 'E-mail', true, 'email')}
            {texto('empresa', 'Empresa')}
            {texto('cargo', 'Cargo')}
            {todosCampos && (
              <>
                {texto('cidade', 'Cidade')}
                <label className="campo">
                  <span>Estado</span>
                  <select className="entrada" value={contato?.estado ?? ''} onChange={(e) => campo('estado')(e.target.value)}>
                    <option value="" />
                    {UFS.map((uf) => (
                      <option key={uf}>{uf}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Nascimento</span>
                  <input className="entrada" type="date" value={contato?.nascimento ?? ''} onChange={(e) => campo('nascimento')(e.target.value)} />
                </label>
                <label className="campo">
                  <span>Sexo</span>
                  <select className="entrada" value={contato?.sexo ?? ''} onChange={(e) => campo('sexo')(e.target.value as Contato['sexo'])}>
                    <option value="" />
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                    <option value="O">Outro</option>
                  </select>
                </label>
                <label className="campo campo--largo">
                  <span>Origem do contato</span>
                  <select className="entrada" value={contato?.origem ?? ''} onChange={(e) => campo('origem')(e.target.value)}>
                    <option value="" />
                    {ORIGENS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
                {texto('produtos', 'Produtos de interesse', true)}
                <label className="campo campo--largo">
                  <span>Observações</span>
                  <textarea className="entrada" rows={3} defaultValue={contato?.observacoes ?? ''} key={`obs${ativo.id}`} onBlur={(e) => campo('observacoes')(e.target.value.trim())} />
                </label>
              </>
            )}
          </div>
        </section>

        <section className="bloco">
          <div className="bloco__titulo">Etiquetas do CRM</div>
          <div className="tags">
            {contato?.tags.map((t) => (
              <span key={t} className="tag">
                {t}
                <button aria-label={`Remover ${t}`} onClick={() => salvar((c) => void (c.tags = c.tags.filter((x) => x !== t)))}>
                  <IconFechar tam={12} />
                </button>
              </span>
            ))}
            <input className="tag-entrada" placeholder="Nova etiqueta" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} onBlur={addTag} />
          </div>
        </section>

        <section className="bloco">
          <div className="bloco__titulo">
            Lembretes
            <button className="icone-btn" title="Novo lembrete" onClick={() => setNovoLembrete({ texto: '', quando: paraCampoDataHora(Date.now() + 3600_000) })}>
              <IconMais tam={16} />
            </button>
          </div>
          {novoLembrete && (
            <div className="campos">
              <input className="entrada campo--largo" placeholder="O que fazer (ex.: ligar para fechar proposta)" value={novoLembrete.texto} onChange={(e) => setNovoLembrete({ ...novoLembrete, texto: e.target.value })} autoFocus />
              <input className="entrada campo--largo" type="datetime-local" value={novoLembrete.quando} onChange={(e) => setNovoLembrete({ ...novoLembrete, quando: e.target.value })} />
              <div className="linha-botoes campo--largo">
                <button className="btn btn--pequeno" onClick={() => setNovoLembrete(null)}>
                  Cancelar
                </button>
                <button className="btn btn--pequeno btn--primario" onClick={salvarLembrete}>
                  Salvar lembrete
                </button>
              </div>
            </div>
          )}
          {meusLembretes.map((l) => (
            <div key={l.id} className="item-linha">
              <IconSino tam={16} />
              <div className="item-linha__txt">
                <div title={l.texto}>{l.texto}</div>
                <small>{dataHora(l.quando)}</small>
              </div>
              <a className="icone-btn" title="Adicionar ao Google Agenda" href={linkAgenda(l.texto, nome, l.quando)} target="_blank" rel="noreferrer">
                <IconRelogio tam={16} />
              </a>
              <button className="icone-btn" title="Marcar como feito" onClick={() => alterar('lembretes', (ls) => ls.map((x) => (x.id === l.id ? { ...x, feito: true } : x)))}>
                <IconCheck tam={16} />
              </button>
            </div>
          ))}
          {!novoLembrete && meusLembretes.length === 0 && <div className="ajuda">Nenhum lembrete para este contato.</div>}
          {meusAgendamentos.length > 0 && <div className="ajuda">{meusAgendamentos.length} mensagem(ns) agendada(s) para esta conversa.</div>}
        </section>

        <section className="bloco">
          <div className="bloco__titulo">Anotações</div>
          <textarea className="entrada" placeholder="Escreva uma anotação. Ctrl+Enter salva." value={nota} onChange={(e) => setNota(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && addNota()} />
          {anexo && (
            <div className="item-linha">
              <div className="item-linha__txt">
                <div>{anexo.nome}</div>
                <small>Anexo</small>
              </div>
              <button className="icone-btn" title="Tirar anexo" onClick={() => setAnexo(null)}>
                <IconFechar tam={14} />
              </button>
            </div>
          )}
          <div className="linha-botoes" style={{ marginTop: 8 }}>
            <label className="btn btn--pequeno">
              Anexar
              <input type="file" hidden onChange={(e) => anexar(e.target.files?.[0])} />
            </label>
            <button className="btn btn--pequeno btn--primario" onClick={addNota} disabled={!nota.trim() && !anexo}>
              Salvar anotação
            </button>
          </div>
          {contato?.notas.map((n) => (
            <div key={n.id} className="nota">
              <div className="nota__meta">
                {dataHora(n.em)}
                <button title="Apagar anotação" onClick={() => salvar((c) => void (c.notas = c.notas.filter((x) => x.id !== n.id)))}>
                  <IconLixo tam={14} />
                </button>
              </div>
              {n.texto && <p>{n.texto}</p>}
              {n.midia &&
                (n.midia.tipo.startsWith('image/') ? (
                  <a href={n.midia.arquivo} download={n.midia.nome} title="Baixar">
                    <img className="nota__imagem" src={n.midia.arquivo} alt={n.midia.nome} />
                  </a>
                ) : (
                  <a className="nota__arquivo" href={n.midia.arquivo} download={n.midia.nome}>
                    {n.midia.nome}
                  </a>
                ))}
            </div>
          ))}
        </section>
      </div>
    </aside>
  );
}
