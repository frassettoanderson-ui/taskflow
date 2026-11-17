// Atendimento automático explicado passo a passo: 1) saudação, 2) IA conversando, 3) equipe assume.
// Tudo fica num rascunho até clicar em "Salvar alterações".
import { useEffect, useState } from 'react';
import { aplicarVariaveis, assinar, gravar, ler, type ConfigAtendimento, type PassoFluxo } from '../shared/dados';
import { dataHora, telefone } from '../ui/formato';
import { useColecao } from '../ui/hooks';
import { IconDocumento, IconImagem, IconMicrofone, IconVideo } from '../ui/icones';
import { Interruptor } from '../ui/Interruptor';
import { mudarEstado } from './atendimento';
import { BarraSalvar } from './BarraSalvar';
import { useCRM } from './contexto';
import { EditorEtapas } from './Respostas';

const MOTIVO: Record<string, string> = {
  equipe: 'alguém da equipe respondeu',
  ia: 'a IA pediu ajuda',
  limite: 'a IA chegou no limite de respostas',
  botao: 'alguém clicou em Assumir na ficha',
};

const EXEMPLO_INSTRUCOES = `Você é a assistente virtual da [nome da empresa].
O que pode responder: horário de atendimento, endereço, serviços que fazemos e como funciona o primeiro atendimento.
Horário: segunda a sexta, das 8h às 18h.
Endereço: [rua, número, cidade].
Serviços: [liste aqui, com preço se quiser que ela informe].
Quando chamar a equipe: pedidos de orçamento, pagamentos, reclamações e qualquer assunto que não está aqui.`;

const HORAS = [3, 6, 12, 24, 48, 72];

function semConteudo(passos: PassoFluxo[]) {
  return passos.some((p) => (p.tipo === 'texto' ? !p.texto.trim() : !p.arquivo));
}

export function AbaAtendimento() {
  const { avisar } = useCRM();
  const salvo = useColecao('atendimento');
  const ia = useColecao('ia');
  const config = useColecao('config');
  const [rascunho, setRascunho] = useState<ConfigAtendimento | null>(null);
  const [vista, setVista] = useState<'configurar' | 'acompanhar'>('configurar');
  const [qualSaudacao, setQualSaudacao] = useState<'primeiro' | 'retorno'>('primeiro');
  const sujo = !!salvo && !!rascunho && JSON.stringify(salvo) !== JSON.stringify(rascunho);

  // sem alteração pendente, acompanha o que mudar fora daqui (ex.: botão do robô na barra)
  useEffect(() => {
    if (salvo && (!rascunho || !sujo)) setRascunho(salvo);
  }, [salvo]);

  if (!salvo || !rascunho || !ia || !config) return null;
  const r = rascunho;
  const set = (p: Partial<ConfigAtendimento>) => setRascunho({ ...r, ...p });
  const temChave = !!ia.chaves[ia.provedor]?.trim();

  const salvar = async () => {
    if (semConteudo(r.primeiroContato) || semConteudo(r.retorno)) return avisar('Uma das mensagens da saudação está sem conteúdo', true);
    if (r.iaAtiva && !temChave) return avisar('Para ligar a IA, cadastre a chave na aba IA', true);
    if (r.iaAtiva && !r.instrucoes.trim() && !ia.sobreNegocio.trim()) return avisar('Escreva as instruções da IA antes de ligar', true);
    // o liga/desliga da barra pode ter mudado enquanto editava: o que vale é o que está na tela
    await gravar('atendimento', { ...(await ler('atendimento')), ...r });
    avisar('Atendimento automático salvo');
  };

  const passosAtuais = qualSaudacao === 'primeiro' ? r.primeiroContato : r.retorno;
  const assinaturaRobo = { ...config.assinatura, ativa: !!r.nomeAssinatura.trim(), nome: r.nomeAssinatura.trim() };

  return (
    <div className="atend">
      <div className="abas abas--sub">
        <button className="aba" aria-pressed={vista === 'configurar'} onClick={() => setVista('configurar')}>
          Configurar
        </button>
        <button className="aba" aria-pressed={vista === 'acompanhar'} onClick={() => setVista('acompanhar')}>
          Acompanhar
        </button>
      </div>

      {vista === 'acompanhar' ? (
        <Acompanhar />
      ) : (
        <>
          <ol className="como-funciona">
            <li>
              <b>1</b>
              <span>O cliente manda mensagem</span>
            </li>
            <li>
              <b>2</b>
              <span>Sai a saudação automática</span>
            </li>
            <li>
              <b>3</b>
              <span>A IA continua a conversa</span>
            </li>
            <li>
              <b>4</b>
              <span>Você responde e ela para</span>
            </li>
          </ol>
          <p className="atend__nota">
            Só responde quem mandou mensagem primeiro, em conversa individual. Grupos e listas ficam de fora. Funciona enquanto o WhatsApp Web estiver aberto neste computador.
          </p>

          {/* ---------- 1. saudação ---------- */}
          <section className="cartao-passo">
            <header className="cartao-passo__topo">
              <span className="cartao-passo__num">1</span>
              <h3>Saudação automática</h3>
              <p>A primeira mensagem que o cliente recebe quando começa uma conversa. Você pode mandar texto, áudio, foto ou vídeo, uma ou várias mensagens em sequência.</p>
            </header>
            <Interruptor ligado={r.saudacaoAtiva} aoMudar={(v) => set({ saudacaoAtiva: v })} rotulo="Mandar saudação" descricao="Quando desligada, ninguém recebe a saudação." />

            {r.saudacaoAtiva && (
              <>
                <div className="segmentado">
                  <button type="button" aria-pressed={qualSaudacao === 'primeiro'} onClick={() => setQualSaudacao('primeiro')}>
                    Para quem nunca falou com você
                    <small>{r.primeiroContato.length ? `${r.primeiroContato.length} mensagem(ns)` : 'vazia'}</small>
                  </button>
                  <button type="button" aria-pressed={qualSaudacao === 'retorno'} onClick={() => setQualSaudacao('retorno')}>
                    Para quem já falou antes
                    <small>{r.retorno.length ? `${r.retorno.length} mensagem(ns)` : 'vazia'}</small>
                  </button>
                </div>
                <p className="atend__dica">
                  {qualSaudacao === 'primeiro'
                    ? 'Vai para números que nunca conversaram com você. Ex.: apresentar a empresa e perguntar como pode ajudar.'
                    : 'Vai para quem já conversou antes (tem mensagens antigas, ficha no CRM ou está salvo na sua agenda) e voltou a chamar.'}
                </p>

                <div className="atend__editor">
                  <div>
                    <EditorEtapas passos={passosAtuais} aoMudar={(p) => set(qualSaudacao === 'primeiro' ? { primeiroContato: p } : { retorno: p })} />
                    {!passosAtuais.length && <p className="atend__dica">Clique em "Adicionar mensagem" para escrever a primeira.</p>}
                  </div>
                  <PreviaConversa passos={passosAtuais} assinatura={assinaturaRobo} />
                </div>

                <label className="campo atend__linha">
                  <span>A saudação sai de novo quando o cliente fica sem conversar por</span>
                  <select className="entrada" value={r.novaConversaHoras} onChange={(e) => set({ novaConversaHoras: Number(e.target.value) })}>
                    {[...new Set([...HORAS, r.novaConversaHoras])]
                      .sort((a, b) => a - b)
                      .map((h) => (
                        <option key={h} value={h}>
                          {h < 24 ? `${h} horas` : `${h / 24} dia${h / 24 > 1 ? 's' : ''}`}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
          </section>

          {/* ---------- 2. IA ---------- */}
          <section className="cartao-passo">
            <header className="cartao-passo__topo">
              <span className="cartao-passo__num">2</span>
              <h3>IA continua a conversa</h3>
              <p>Depois da saudação, a IA lê a conversa e responde dúvidas do cliente usando só o que você escrever aqui. Quando não souber, ela avisa o cliente que vai chamar alguém e você recebe uma notificação.</p>
            </header>
            <Interruptor ligado={r.iaAtiva} aoMudar={(v) => set({ iaAtiva: v })} rotulo="IA respondendo os clientes" descricao="Também dá para ligar e desligar pelo robô na barra de cima." />
            {!temChave && <p className="atend__alerta">A IA ainda não tem chave. Cadastre na aba IA (Gemini, Groq ou OpenAI) antes de ligar.</p>}

            <label className="campo campo--largo">
              <span>O que a IA precisa saber (o que pode responder, preços, horários, quando chamar a equipe)</span>
              <textarea className="entrada" rows={8} value={r.instrucoes} onChange={(e) => set({ instrucoes: e.target.value })} placeholder="Escreva como se estivesse explicando para um atendente novo." />
            </label>
            <div className="linha-botoes">
              <button type="button" className="btn btn--pequeno" onClick={() => set({ instrucoes: r.instrucoes.trim() ? `${r.instrucoes.trim()}\n\n${EXEMPLO_INSTRUCOES}` : EXEMPLO_INSTRUCOES })}>
                Usar um modelo para preencher
              </button>
            </div>

            <label className="campo atend__linha">
              <span>Nome que aparece nas mensagens automáticas</span>
              <input className="entrada" value={r.nomeAssinatura} onChange={(e) => set({ nomeAssinatura: e.target.value })} placeholder="Ex.: Assistente virtual (deixe vazio para não assinar)" />
            </label>

            <details className="avancado">
              <summary>Ajustes avançados</summary>
              <div className="campos">
                <label className="campo">
                  <span>Esperar antes de responder (segundos)</span>
                  <div className="campos" style={{ gap: 6 }}>
                    <input className="entrada" type="number" min={1} max={120} value={r.esperaMin} onChange={(e) => set({ esperaMin: Math.max(1, Number(e.target.value) || 1) })} title="de" />
                    <input className="entrada" type="number" min={1} max={180} value={r.esperaMax} onChange={(e) => set({ esperaMax: Math.max(1, Number(e.target.value) || 1) })} title="até" />
                  </div>
                  <small className="ajuda" style={{ textAlign: 'left', marginTop: 2 }}>Um tempo sorteado entre os dois, para juntar mensagens picadas do cliente.</small>
                </label>
                <label className="campo">
                  <span>Máximo de respostas seguidas da IA</span>
                  <input className="entrada" type="number" min={1} max={50} value={r.limiteSeguidas} onChange={(e) => set({ limiteSeguidas: Math.max(1, Number(e.target.value) || 1) })} />
                  <small className="ajuda" style={{ textAlign: 'left', marginTop: 2 }}>Passou disso sem ninguém da equipe, a conversa vai para vocês e você é avisado.</small>
                </label>
              </div>
            </details>
          </section>

          {/* ---------- 3. equipe ---------- */}
          <section className="cartao-passo">
            <header className="cartao-passo__topo">
              <span className="cartao-passo__num">3</span>
              <h3>Quando a equipe assume</h3>
              <p>
                Assim que alguém da equipe manda qualquer mensagem na conversa, pelo celular ou pelo computador, a IA para de responder naquela conversa. Na ficha do contato tem os botões Assumir e
                Devolver para a IA. Se o cliente escrever "sair" ou "parar", ele não recebe mais nada automático.
              </p>
            </header>
            <label className="campo atend__linha">
              <span>Depois que a equipe assumiu, a IA volta</span>
              <select className="entrada" value={r.voltaIA} onChange={(e) => set({ voltaIA: e.target.value as ConfigAtendimento['voltaIA'] })}>
                <option value="novaConversa">Sozinha, na próxima conversa do cliente</option>
                <option value="manual">Só quando alguém devolver pela ficha</option>
              </select>
            </label>
          </section>

          <BarraSalvar aba="atendimento" sujo={sujo} salvar={salvar} descartar={() => setRascunho(salvo)} />
        </>
      )}
    </div>
  );
}

/** *negrito* e _itálico_ como o WhatsApp mostra. */
function formatoWhats(t: string) {
  return t.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((parte, i) =>
    parte.length > 2 && parte.startsWith('*') && parte.endsWith('*') ? <b key={i}>{parte.slice(1, -1)}</b> : parte.length > 2 && parte.startsWith('_') && parte.endsWith('_') ? <i key={i}>{parte.slice(1, -1)}</i> : parte,
  );
}

/** Como a saudação vai chegar no celular do cliente (com um nome de exemplo). */
function PreviaConversa({ passos, assinatura }: { passos: PassoFluxo[]; assinatura: Parameters<typeof assinar>[1] }) {
  const exemplo = { nome: 'Maria Silva', numero: '5548999990000' };
  return (
    <div className="previa-conversa" aria-label="Prévia">
      <div className="previa-conversa__topo">Como o cliente vê</div>
      <div className="previa-conversa__corpo">
        <div className="bolha bolha--cliente">Oi, boa tarde!</div>
        {passos.map((p, i) => (
          <div key={p.id} className="previa-conversa__item">
            {p.simular !== 'nenhuma' && p.simularSeg > 0 && (
              <div className="previa-conversa__status">
                {p.simular === 'gravando' ? 'gravando áudio' : 'digitando'} por {p.simularSeg}s{i > 0 && p.esperaSeg > 0 ? `, depois de esperar ${p.esperaSeg}s` : ''}
              </div>
            )}
            <div className="bolha bolha--empresa">
              {p.tipo === 'audio' ? (
                <span className="bolha__midia">
                  <IconMicrofone tam={16} /> Mensagem de voz
                </span>
              ) : p.tipo !== 'texto' ? (
                <>
                  <span className="bolha__midia">
                    {p.tipo === 'image' ? <IconImagem tam={16} /> : p.tipo === 'video' ? <IconVideo tam={16} /> : <IconDocumento tam={16} />}
                    {p.nomeArquivo || (p.tipo === 'image' ? 'Imagem' : p.tipo === 'video' ? 'Vídeo' : 'Arquivo')}
                  </span>
                  {p.texto.trim() && <span>{formatoWhats(aplicarVariaveis(p.texto, exemplo))}</span>}
                </>
              ) : (
                <span>{p.texto.trim() ? formatoWhats(assinar(aplicarVariaveis(p.texto, exemplo), assinatura)) : '(mensagem vazia)'}</span>
              )}
            </div>
          </div>
        ))}
        {!passos.length && <div className="previa-conversa__vazio">Nenhuma mensagem ainda</div>}
      </div>
    </div>
  );
}

/** Conversas que saíram do automático + o que o robô fez com cada mensagem. */
function Acompanhar() {
  const { chatPorId, contatos } = useCRM();
  const estados = useColecao('atendimentoChats') ?? {};
  const registro = useColecao('registroAtendimento') ?? [];
  const nomeDe = (id: string) => contatos[id]?.nome || chatPorId.get(id)?.nome || telefone(id.split('@')[0]);
  const fora = Object.entries(estados)
    .filter(([, e]) => e.humanoEm || e.saiu || e.iaDesligada)
    .sort((a, b) => (b[1].humanoEm ?? 0) - (a[1].humanoEm ?? 0));

  return (
    <>
      <section className="cartao-passo">
        <header className="cartao-passo__topo">
          <h3>Conversas com a equipe</h3>
          <p>Nestas conversas a IA não responde. Devolva quando quiser que ela volte.</p>
        </header>
        {fora.length === 0 ? (
          <p className="atend__dica">Nenhuma conversa fora do automático.</p>
        ) : (
          <div className="lista-simples">
            {fora.map(([id, e]) => (
              <div key={id} className="lista-simples__item">
                <div>
                  <strong>{nomeDe(id)}</strong>
                  <small>{e.saiu ? 'pediu para não receber mensagens automáticas' : e.iaDesligada ? 'IA desligada nesta conversa' : `${MOTIVO[e.motivoHumano ?? 'equipe']}${e.humanoEm ? `, ${dataHora(e.humanoEm)}` : ''}`}</small>
                </div>
                <button
                  className="btn btn--pequeno"
                  onClick={() =>
                    mudarEstado(id, (x) => {
                      x.humanoEm = undefined;
                      x.motivoHumano = undefined;
                      x.iaDesligada = false;
                      x.saiu = false;
                      x.seguidas = 0;
                    })
                  }
                >
                  Devolver para a IA
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="cartao-passo">
        <header className="cartao-passo__topo">
          <h3>O que o robô fez</h3>
          <p>Cada mensagem recebida e o que aconteceu com ela. Se algo não respondeu, o motivo aparece aqui.</p>
        </header>
        {registro.length === 0 ? (
          <p className="atend__dica">Nada ainda. Se um cliente mandar mensagem e nada aparecer aqui, atualize a extensão (↻ em chrome://extensions) e o WhatsApp (F5).</p>
        ) : (
          <>
            <div className="lista-simples">
              {registro.map((x, i) => (
                <div key={i} className={`lista-simples__item${x.erro ? ' lista-simples__item--erro' : ''}`}>
                  <div>
                    <strong>{contatos[x.chatId]?.nome || chatPorId.get(x.chatId)?.nome || telefone(x.nome)}</strong>
                    <small>{x.texto}</small>
                  </div>
                  <small>{dataHora(x.em)}</small>
                </div>
              ))}
            </div>
            <div className="linha-botoes" style={{ marginTop: 10 }}>
              <button className="btn btn--pequeno" onClick={() => gravar('registroAtendimento', [])}>
                Limpar
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
