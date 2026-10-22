// Mensagens agendadas: criar para a conversa aberta (ou outra), repetir, ver no calendário e acompanhar o que saiu.
import { useMemo, useState } from 'react';
import { alterar, NOME_RECORRENCIA, novoId, type Agendamento, type Recorrencia, type TipoRecorrencia } from '../shared/dados';
import type { ChatResumo } from '../shared/protocolo';
import { dataHora, paraCampoDataHora, telefone } from '../ui/formato';
import { useColecao, useEsc } from '../ui/hooks';
import { IconFechar, IconLixo, IconMais, IconSeta } from '../ui/icones';
import { BotoesIA } from './BotoesIA';
import { useCRM } from './contexto';
import { StatusProgramados } from './StatusProgramados';

const ROTULO: Record<Agendamento['status'], string> = { pendente: 'Aguardando', enviando: 'Enviando', enviado: 'Enviada', falhou: 'Falhou', cancelado: 'Cancelada' };
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

type Form = { chat: ChatResumo | null; texto: string; respostaId: string; quando: string; recorrencia: Recorrencia };

export function Agendamentos({ fechar }: { fechar: () => void }) {
  const { ativo, chats, contatos, avisar } = useCRM();
  const agendamentos = useColecao('agendamentos') ?? [];
  const respostas = useColecao('respostas') ?? [];
  const [aba, setAba] = useState<'proximas' | 'calendario' | 'historico' | 'status'>('proximas');
  const [form, setForm] = useState<Form | null>(null);
  const [busca, setBusca] = useState('');
  useEsc(form ? () => setForm(null) : fechar);

  const lista = useMemo(() => {
    const prox = aba === 'proximas';
    return agendamentos.filter((a) => (prox ? a.status === 'pendente' || a.status === 'enviando' : a.status !== 'pendente' && a.status !== 'enviando')).sort((a, b) => (prox ? a.quando - b.quando : b.quando - a.quando));
  }, [agendamentos, aba]);

  const opcoesChat = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return [];
    return chats.filter((c) => (contatos[c.id]?.nome || c.nome).toLowerCase().includes(t) || c.numero.includes(t)).slice(0, 6);
  }, [busca, chats, contatos]);

  const nomeDe = (c: ChatResumo) => contatos[c.id]?.nome || c.nome || telefone(c.numero);

  const novo = (quando = Date.now() + 3600_000) => {
    setBusca('');
    setForm({ chat: ativo, texto: '', respostaId: '', quando: paraCampoDataHora(quando), recorrencia: { tipo: 'nenhuma' } });
  };

  const salvar = async () => {
    if (!form?.chat) return avisar('Escolha a conversa', true);
    if (!form.texto.trim() && !form.respostaId) return avisar('Escreva a mensagem ou escolha uma resposta rápida', true);
    const quando = new Date(form.quando).getTime();
    if (!quando || quando < Date.now() - 60_000) return avisar('Escolha uma data e hora no futuro', true);
    const chat = form.chat;
    await alterar('agendamentos', (l) => {
      l.push({ id: novoId(), chatId: chat.id, nomeContato: nomeDe(chat), texto: form.texto.trim(), respostaId: form.respostaId || undefined, quando, recorrencia: form.recorrencia, status: 'pendente' });
    });
    setForm(null);
    setAba('proximas');
    avisar(`Agendada para ${dataHora(quando)}`);
  };

  const cancelar = (id: string) => alterar('agendamentos', (l) => l.map((a) => (a.id === id ? { ...a, status: 'cancelado' as const } : a)));
  const apagar = (id: string) => alterar('agendamentos', (l) => l.filter((a) => a.id !== id));
  const descricao = (a: Agendamento) => (a.respostaId ? `Resposta: ${respostas.find((r) => r.id === a.respostaId)?.titulo ?? 'apagada'}` : a.texto);

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && (form ? setForm(null) : fechar())}>
      <div className="modal modal--largo">
        <div className="modal__topo">
          <h2>{form ? 'Agendar mensagem' : 'Mensagens agendadas'}</h2>
          <p>{form ? 'O WhatsApp Web precisa estar aberto neste computador no horário.' : 'Saem sozinhas no horário, com o WhatsApp Web aberto.'}</p>
          <button className="icone-btn modal__fechar" onClick={form ? () => setForm(null) : fechar} title="Fechar (Esc)">
            <IconFechar />
          </button>
          {!form && (
            <div className="abas">
              <button className="aba" aria-pressed={aba === 'proximas'} onClick={() => setAba('proximas')}>
                Próximas
              </button>
              <button className="aba" aria-pressed={aba === 'calendario'} onClick={() => setAba('calendario')}>
                Calendário
              </button>
              <button className="aba" aria-pressed={aba === 'historico'} onClick={() => setAba('historico')}>
                Histórico
              </button>
              <button className="aba" aria-pressed={aba === 'status'} onClick={() => setAba('status')}>
                Status programado
              </button>
            </div>
          )}
        </div>

        {form ? (
          <div className="modal__corpo">
            <div className="campos">
              <div className="campo campo--largo">
                <span>Conversa</span>
                {form.chat ? (
                  <div className="item-linha" style={{ marginTop: 0 }}>
                    <div className="item-linha__txt">
                      <div>{nomeDe(form.chat)}</div>
                      <small>{form.chat.grupo ? 'Grupo' : telefone(form.chat.numero)}</small>
                    </div>
                    <button className="btn btn--pequeno" onClick={() => setForm({ ...form, chat: null })}>
                      Trocar
                    </button>
                  </div>
                ) : (
                  <>
                    <input className="entrada" placeholder="Buscar conversa por nome ou número" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
                    {opcoesChat.map((c) => (
                      <button key={c.id} className="item-linha" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setForm({ ...form, chat: c })}>
                        <div className="item-linha__txt">
                          <div>{nomeDe(c)}</div>
                          <small>{c.grupo ? 'Grupo' : telefone(c.numero)}</small>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
              <label className="campo">
                <span>Data e hora</span>
                <input className="entrada" type="datetime-local" value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })} />
              </label>
              <label className="campo">
                <span>Repetir</span>
                <select className="entrada" value={form.recorrencia.tipo} onChange={(e) => setForm({ ...form, recorrencia: { tipo: e.target.value as TipoRecorrencia, cada: form.recorrencia.cada ?? 2 } })}>
                  {(Object.keys(NOME_RECORRENCIA) as TipoRecorrencia[]).map((t) => (
                    <option key={t} value={t}>
                      {NOME_RECORRENCIA[t]}
                    </option>
                  ))}
                </select>
              </label>
              {form.recorrencia.tipo === 'dias' && (
                <label className="campo">
                  <span>A cada quantos dias</span>
                  <input className="entrada" type="number" min={1} max={365} value={form.recorrencia.cada ?? 2} onChange={(e) => setForm({ ...form, recorrencia: { tipo: 'dias', cada: Math.max(1, Number(e.target.value)) } })} />
                </label>
              )}
              <label className="campo campo--largo">
                <span>Usar resposta rápida (opcional)</span>
                <select className="entrada" value={form.respostaId} onChange={(e) => setForm({ ...form, respostaId: e.target.value })}>
                  <option value="">Nenhuma, escrever abaixo</option>
                  {respostas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.titulo} (/{r.atalho})
                    </option>
                  ))}
                </select>
              </label>
              {!form.respostaId && (
                <label className="campo campo--largo">
                  <span>Mensagem</span>
                  <textarea className="entrada" rows={5} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} placeholder="{{saudacao}}, {{primeiro_nome}}! Passando para lembrar..." />
                  <BotoesIA texto={form.texto} aoResultado={(t) => setForm({ ...form, texto: t })} />
                </label>
              )}
            </div>
          </div>
        ) : aba === 'status' ? (
          <div className="modal__corpo">
            <StatusProgramados />
          </div>
        ) : aba === 'calendario' ? (
          <div className="modal__corpo">
            <Calendario agendamentos={agendamentos.filter((a) => a.status !== 'cancelado')} aoEscolherDia={(d) => novo(d)} descricao={descricao} />
          </div>
        ) : (
          <div className="modal__corpo">
            {lista.length === 0 ? (
              <div className="vazio">
                <strong>{aba === 'proximas' ? 'Nada agendado' : 'Sem histórico ainda'}</strong>
                {aba === 'proximas' ? 'Agende uma mensagem para sair sozinha no dia e hora certos.' : 'As mensagens enviadas, canceladas ou com falha aparecem aqui.'}
              </div>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Para</th>
                    <th>Mensagem</th>
                    <th>Repete</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dataHora(a.quando)}</td>
                      <td>{a.nomeContato}</td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.erro || a.texto}>
                        {descricao(a)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--tinta-2)' }}>{a.recorrencia.tipo === 'dias' ? `A cada ${a.recorrencia.cada} dias` : NOME_RECORRENCIA[a.recorrencia.tipo]}</td>
                      <td>
                        <span className={`situacao situacao--${a.status === 'enviando' ? 'pendente' : a.status}`} title={a.erro}>
                          {ROTULO[a.status]}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {a.status === 'pendente' ? (
                          <button className="btn btn--pequeno" onClick={() => cancelar(a.id)} title={a.recorrencia.tipo !== 'nenhuma' ? 'Cancela esta e as próximas repetições' : undefined}>
                            Cancelar
                          </button>
                        ) : (
                          <button className="icone-btn" title="Apagar do histórico" onClick={() => apagar(a.id)}>
                            <IconLixo tam={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="modal__rodape">
          {form ? (
            <>
              <button className="btn" onClick={() => setForm(null)}>
                Voltar
              </button>
              <button className="btn btn--primario" onClick={salvar}>
                Agendar
              </button>
            </>
          ) : aba === 'status' ? (
            <button className="btn" onClick={fechar}>
              Fechar
            </button>
          ) : (
            <button className="btn btn--primario" onClick={() => novo()}>
              <IconMais tam={16} />
              Agendar mensagem
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Calendario({ agendamentos, aoEscolherDia, descricao }: { agendamentos: Agendamento[]; aoEscolherDia: (ms: number) => void; descricao: (a: Agendamento) => string }) {
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const dias = useMemo(() => {
    const inicio = new Date(mes);
    inicio.setDate(1 - inicio.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
  }, [mes]);
  const porDia = useMemo(() => {
    const m = new Map<string, Agendamento[]>();
    for (const a of agendamentos) {
      const k = new Date(a.quando).toDateString();
      m.set(k, [...(m.get(k) ?? []), a].sort((x, y) => x.quando - y.quando));
    }
    return m;
  }, [agendamentos]);
  const hoje = new Date().toDateString();
  const andar = (d: number) => setMes(new Date(mes.getFullYear(), mes.getMonth() + d, 1));

  return (
    <div className="calendario">
      <div className="calendario__topo">
        <button className="icone-btn" title="Mês anterior" onClick={() => andar(-1)}>
          <IconSeta tam={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <strong>{mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
        <button className="icone-btn" title="Próximo mês" onClick={() => andar(1)}>
          <IconSeta tam={16} />
        </button>
      </div>
      <div className="calendario__grade">
        {SEMANA.map((s) => (
          <div key={s} className="calendario__semana">
            {s}
          </div>
        ))}
        {dias.map((d) => {
          const itens = porDia.get(d.toDateString()) ?? [];
          const fora = d.getMonth() !== mes.getMonth();
          const passado = d.getTime() < new Date().setHours(0, 0, 0, 0);
          return (
            <div
              key={d.toISOString()}
              className={`calendario__dia${fora ? ' calendario__dia--fora' : ''}${d.toDateString() === hoje ? ' calendario__dia--hoje' : ''}`}
              onDoubleClick={() => !passado && aoEscolherDia(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9).getTime())}
              title={passado ? undefined : 'Clique duas vezes para agendar neste dia'}
            >
              <span className="calendario__num">{d.getDate()}</span>
              {itens.slice(0, 3).map((a) => (
                <div key={a.id} className={`calendario__item calendario__item--${a.status === 'enviando' ? 'pendente' : a.status}`} title={`${hora(a.quando)} ${a.nomeContato}: ${descricao(a)}`}>
                  {hora(a.quando)} {a.nomeContato}
                </div>
              ))}
              {itens.length > 3 && <div className="calendario__mais">+{itens.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
