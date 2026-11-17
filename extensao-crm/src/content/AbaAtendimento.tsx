// Configuração do atendimento automático: saudação (primeiro contato / quem volta) e IA que responde até alguém assumir.
import { useEffect, useState } from 'react';
import { alterar, gravar, type ConfigAtendimento, type PassoFluxo } from '../shared/dados';
import { dataHora, telefone } from '../ui/formato';
import { useColecao } from '../ui/hooks';
import { mudarEstado } from './atendimento';
import { useCRM } from './contexto';
import { EditorEtapas } from './Respostas';

const MOTIVO: Record<string, string> = {
  equipe: 'alguém da equipe respondeu',
  ia: 'a IA pediu ajuda',
  limite: 'limite de respostas da IA',
  botao: 'assumida pela ficha',
};

function semConteudo(passos: PassoFluxo[]) {
  return passos.some((p) => (p.tipo === 'texto' ? !p.texto.trim() : !p.arquivo));
}

export function AbaAtendimento() {
  const { avisar, chatPorId, contatos } = useCRM();
  const cfg = useColecao('atendimento');
  const estados = useColecao('atendimentoChats') ?? {};
  const registro = useColecao('registroAtendimento') ?? [];
  const [primeiro, setPrimeiro] = useState<PassoFluxo[] | null>(null);
  const [retorno, setRetorno] = useState<PassoFluxo[] | null>(null);

  useEffect(() => {
    if (cfg && primeiro === null) {
      setPrimeiro(cfg.primeiroContato);
      setRetorno(cfg.retorno);
    }
  }, [cfg]);

  if (!cfg || primeiro === null || retorno === null) return null;
  const salvar = (p: Partial<ConfigAtendimento>) => alterar('atendimento', (atual) => ({ ...atual, ...p }));
  const mudouSaudacao = JSON.stringify(primeiro) !== JSON.stringify(cfg.primeiroContato) || JSON.stringify(retorno) !== JSON.stringify(cfg.retorno);

  const salvarSaudacoes = async () => {
    if (semConteudo(primeiro) || semConteudo(retorno)) return avisar('Há uma etapa sem conteúdo', true);
    await salvar({ primeiroContato: primeiro, retorno });
    avisar('Saudações salvas');
  };

  const comHumano = Object.entries(estados)
    .filter(([, e]) => e.humanoEm || e.saiu || e.iaDesligada)
    .sort((a, b) => (b[1].humanoEm ?? 0) - (a[1].humanoEm ?? 0));
  const nomeDe = (id: string) => contatos[id]?.nome || chatPorId.get(id)?.nome || telefone(id.split('@')[0]);

  return (
    <div className="campos">
      <div className="ajuda campo--largo">
        Só responde quem mandou mensagem primeiro, em conversas individuais (grupos, listas e status ficam de fora). Funciona com esta aba do WhatsApp Web aberta. Deixe a WaSpeed
        desligada, senão o cliente recebe resposta em dobro.
      </div>

      <h3 className="secao-titulo campo--largo">Saudação</h3>
      <label className="campo--linha campo--largo">
        <input type="checkbox" checked={cfg.saudacaoAtiva} onChange={(e) => salvar({ saudacaoAtiva: e.target.checked })} />
        Mandar saudação quando um cliente começa uma conversa
      </label>
      <label className="campo">
        <span>Conta como conversa nova depois de (horas sem mensagem)</span>
        <input className="entrada" type="number" min={1} max={720} defaultValue={cfg.novaConversaHoras} onBlur={(e) => salvar({ novaConversaHoras: Math.max(1, Number(e.target.value) || 12) })} />
      </label>
      <div className="campo campo--largo">
        <span>Primeiro contato (número que nunca falou com você)</span>
        <EditorEtapas passos={primeiro} aoMudar={setPrimeiro} />
      </div>
      <div className="campo campo--largo">
        <span>Cliente que já conversou antes e voltou</span>
        <EditorEtapas passos={retorno} aoMudar={setRetorno} />
        <small className="ajuda" style={{ textAlign: 'left' }}>
          Conta como "já conversou" quem tem mensagens antigas na conversa, ficha no CRM ou está salvo na agenda do celular. Variáveis como {'{{primeiro_nome}}'} e {'{{saudacao}}'} funcionam aqui.
        </small>
      </div>
      <div className="linha-botoes campo--largo">
        <button className="btn btn--primario" disabled={!mudouSaudacao} onClick={salvarSaudacoes}>
          Salvar saudações
        </button>
      </div>

      <h3 className="secao-titulo campo--largo">IA atendendo</h3>
      <label className="campo--linha campo--largo">
        <input type="checkbox" checked={cfg.iaAtiva} onChange={(e) => salvar({ iaAtiva: e.target.checked })} />
        IA responde os clientes sozinha (também liga e desliga pelo botão do robô na barra)
      </label>
      <label className="campo campo--largo">
        <span>Instruções para a IA: como se apresenta, o que pode responder, quando chamar alguém</span>
        <textarea
          className="entrada"
          rows={6}
          defaultValue={cfg.instrucoes}
          onBlur={(e) => salvar({ instrucoes: e.target.value })}
          placeholder={'Ex.: Você é a assistente da Loja X. Responda dúvidas sobre horário, endereço e produtos da lista abaixo.\nPreços: camiseta R$ 59, calça R$ 129.\nPara trocas, orçamentos e pagamentos, chame a equipe.'}
        />
        <small className="ajuda" style={{ textAlign: 'left' }}>
          Ela também usa o "Sobre o seu negócio" e o tom de voz da aba IA. Ela nunca inventa preço ou prazo: quando não sabe, avisa o cliente e chama a equipe (você recebe uma notificação).
        </small>
      </label>
      <label className="campo">
        <span>Assinatura das mensagens automáticas</span>
        <input className="entrada" placeholder="Ex.: Assistente virtual (vazio = sem assinatura)" defaultValue={cfg.nomeAssinatura} onBlur={(e) => salvar({ nomeAssinatura: e.target.value.trim() })} />
      </label>
      <label className="campo">
        <span>Quando alguém da equipe assume, a IA volta</span>
        <select className="entrada" value={cfg.voltaIA} onChange={(e) => salvar({ voltaIA: e.target.value as ConfigAtendimento['voltaIA'] })}>
          <option value="novaConversa">Na próxima conversa do cliente</option>
          <option value="manual">Só quando eu devolver pela ficha</option>
        </select>
      </label>
      <label className="campo">
        <span>Máximo de respostas seguidas da IA</span>
        <input className="entrada" type="number" min={1} max={50} defaultValue={cfg.limiteSeguidas} onBlur={(e) => salvar({ limiteSeguidas: Math.max(1, Number(e.target.value) || 8) })} />
      </label>
      <div className="campo">
        <span>Espera antes de responder (segundos, de / até)</span>
        <div className="campos" style={{ marginTop: 0 }}>
          <input className="entrada" type="number" min={1} max={120} defaultValue={cfg.esperaMin} onBlur={(e) => salvar({ esperaMin: Math.max(1, Number(e.target.value) || 5) })} />
          <input className="entrada" type="number" min={1} max={180} defaultValue={cfg.esperaMax} onBlur={(e) => salvar({ esperaMax: Math.max(1, Number(e.target.value) || 12) })} />
        </div>
      </div>
      <div className="ajuda campo--largo">
        A IA para sozinha na conversa assim que alguém da equipe manda qualquer mensagem (pelo celular ou pelo computador). Se o cliente escrever "sair" ou "parar", ninguém responde mais
        automaticamente para ele.
      </div>

      {comHumano.length > 0 && (
        <>
          <h3 className="secao-titulo campo--largo">Conversas fora do automático</h3>
          <div className="lista-simples campo--largo">
            {comHumano.map(([id, e]) => (
              <div key={id} className="lista-simples__item">
                <div>
                  <strong>{nomeDe(id)}</strong>
                  <small>{e.saiu ? 'pediu para não receber mensagens automáticas' : e.iaDesligada ? 'IA desligada nesta conversa' : `com a equipe: ${MOTIVO[e.motivoHumano ?? 'equipe']}`}</small>
                </div>
                <button
                  className="btn"
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
        </>
      )}

      <h3 className="secao-titulo campo--largo">Registro (o que o atendimento fez com cada mensagem)</h3>
      {registro.length === 0 ? (
        <div className="ajuda campo--largo">Nada registrado ainda. Se um cliente mandar mensagem e nada aparecer aqui, a extensão não está recebendo as mensagens: atualize a extensão (↻) e o WhatsApp (F5).</div>
      ) : (
        <>
          <div className="lista-simples campo--largo">
            {registro.map((r, i) => (
              <div key={i} className={`lista-simples__item${r.erro ? ' lista-simples__item--erro' : ''}`}>
                <div>
                  <strong>{contatos[r.chatId]?.nome || chatPorId.get(r.chatId)?.nome || telefone(r.nome)}</strong>
                  <small>{r.texto}</small>
                </div>
                <small>{dataHora(r.em)}</small>
              </div>
            ))}
          </div>
          <div className="linha-botoes campo--largo">
            <button className="btn" onClick={() => gravar('registroAtendimento', [])}>
              Limpar registro
            </button>
          </div>
        </>
      )}
    </div>
  );
}
