// Webhooks: avisa um sistema seu (n8n, Make, planilha, servidor) quando algo acontece no CRM.
import { useState } from 'react';
import { alterar, gravar, NOME_EVENTO_WEBHOOK, novoId, type EventoWebhook, type Webhook } from '../shared/dados';
import { dataHora } from '../ui/formato';
import { useColecao } from '../ui/hooks';
import { IconLixo, IconMais } from '../ui/icones';
import { useCRM } from './contexto';

const EVENTOS = Object.keys(NOME_EVENTO_WEBHOOK) as EventoWebhook[];

export function AbaWebhooks() {
  const { avisar } = useCRM();
  const webhooks = useColecao('webhooks') ?? [];
  const registros = useColecao('registrosWebhook') ?? [];
  const [vendoRegistros, setVendoRegistros] = useState(false);

  const mudar = (id: string, p: Partial<Webhook>) => gravar('webhooks', webhooks.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const testar = (w: Webhook) => {
    if (!/^https?:\/\//.test(w.url)) return avisar('A URL precisa começar com https://', true);
    chrome.runtime.sendMessage({ tipo: 'webhook-teste', id: w.id }).catch(() => {});
    avisar('Teste enviado. Veja o resultado em Últimos envios.');
  };

  if (vendoRegistros)
    return (
      <>
        {registros.length === 0 ? (
          <div className="vazio">Nenhum envio ainda.</div>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Webhook</th>
                <th>Evento</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dataHora(r.em)}</td>
                  <td>{webhooks.find((w) => w.id === r.webhookId)?.nome ?? 'Apagado'}</td>
                  <td>{NOME_EVENTO_WEBHOOK[r.evento] ?? r.evento}</td>
                  <td>
                    <span className={`situacao situacao--${r.ok ? 'enviado' : 'falhou'}`} title={r.erro}>
                      {r.ok ? (r.codigo ? `OK ${r.codigo}` : 'Enviado') : r.codigo ? `Erro ${r.codigo}` : 'Falhou'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="linha-botoes" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setVendoRegistros(false)}>
            Voltar
          </button>
        </div>
      </>
    );

  return (
    <>
      {webhooks.length === 0 && (
        <div className="vazio">
          <strong>Nenhum webhook</strong>
          Cadastre uma URL para receber um POST com os dados sempre que um evento acontecer.
        </div>
      )}
      {webhooks.map((w) => (
        <div key={w.id} className="cartao-config">
          <div className="campos">
            <label className="campo">
              <span>Nome</span>
              <input className="entrada" defaultValue={w.nome} onBlur={(e) => mudar(w.id, { nome: e.target.value.trim() || 'Webhook' })} />
            </label>
            <label className="campo campo--linha" style={{ alignSelf: 'end' }}>
              <input type="checkbox" checked={w.ativo} onChange={(e) => mudar(w.id, { ativo: e.target.checked })} />
              Ativo
            </label>
            <label className="campo campo--largo">
              <span>URL (recebe POST em JSON)</span>
              <input className="entrada" type="url" placeholder="https://..." defaultValue={w.url} onBlur={(e) => mudar(w.id, { url: e.target.value.trim() })} />
            </label>
            <div className="campo campo--largo">
              <span>Eventos</span>
              {EVENTOS.map((ev) => (
                <label key={ev} className="campo--linha">
                  <input type="checkbox" checked={w.eventos.includes(ev)} onChange={(e) => mudar(w.id, { eventos: e.target.checked ? [...w.eventos, ev] : w.eventos.filter((x) => x !== ev) })} />
                  {NOME_EVENTO_WEBHOOK[ev]}
                </label>
              ))}
            </div>
          </div>
          <div className="linha-botoes" style={{ marginTop: 8 }}>
            <button className="btn btn--pequeno" onClick={() => testar(w)}>
              Enviar teste
            </button>
            <button className="btn btn--pequeno btn--perigo" onClick={() => alterar('webhooks', (l) => l.filter((x) => x.id !== w.id))}>
              <IconLixo tam={14} />
              Apagar
            </button>
          </div>
        </div>
      ))}
      <div className="linha-botoes" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => setVendoRegistros(true)}>
          Últimos envios ({registros.length})
        </button>
        <button className="btn btn--primario" onClick={() => gravar('webhooks', [...webhooks, { id: novoId(), nome: 'Meu sistema', url: '', eventos: ['etapa'], ativo: true }])}>
          <IconMais tam={16} />
          Novo webhook
        </button>
      </div>
      <div className="ajuda">Os dados do contato vão só para as URLs que você cadastrar aqui.</div>
    </>
  );
}
