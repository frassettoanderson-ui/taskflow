// Central de notificações: lembretes vencidos e de hoje + agendamentos que falharam, agrupados por dia.
import { useMemo, useState } from 'react';
import { alterar } from '../shared/dados';
import { useColecao } from '../ui/hooks';
import { IconBusca, IconCheck, IconRelogio, IconSino } from '../ui/icones';
import { MenuSuspenso } from './App';
import { wa } from './wa';

interface Item {
  id: string;
  tipo: 'lembrete' | 'falha';
  quando: number;
  titulo: string;
  texto: string;
  chatId: string;
}

const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function rotuloDia(ms: number) {
  const d = new Date(ms).setHours(0, 0, 0, 0);
  const hoje = new Date().setHours(0, 0, 0, 0);
  if (d === hoje) return 'Hoje';
  if (d === hoje - 86400_000) return 'Ontem';
  if (d === hoje + 86400_000) return 'Amanhã';
  return new Date(ms).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

/** Itens que pedem atenção agora (vai no contador da barra). */
export function useNotificacoes() {
  const lembretes = useColecao('lembretes') ?? [];
  const agendamentos = useColecao('agendamentos') ?? [];
  return useMemo(() => {
    const fimDeHoje = new Date().setHours(23, 59, 59, 999);
    const itens: Item[] = [
      ...lembretes.filter((l) => !l.feito && l.quando <= fimDeHoje).map((l) => ({ id: l.id, tipo: 'lembrete' as const, quando: l.quando, titulo: l.nomeContato || 'Lembrete', texto: l.texto, chatId: l.chatId })),
      ...agendamentos
        .filter((a) => a.status === 'falhou')
        .map((a) => ({ id: a.id, tipo: 'falha' as const, quando: a.quando, titulo: `Agendamento não enviado: ${a.nomeContato}`, texto: a.erro || a.texto, chatId: a.chatId })),
    ].sort((a, b) => b.quando - a.quando);
    const vencidos = itens.filter((i) => i.quando <= Date.now()).length;
    return { itens, vencidos };
  }, [lembretes, agendamentos]);
}

export function Notificacoes({ fechar }: { fechar: () => void }) {
  const { itens } = useNotificacoes();
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const filtrados = itens.filter((i) => !termo || `${i.titulo} ${i.texto}`.toLowerCase().includes(termo));

  const grupos = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of filtrados) {
      const k = rotuloDia(i.quando);
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return [...m];
  }, [filtrados]);

  const resolver = (i: Item) =>
    i.tipo === 'lembrete'
      ? alterar('lembretes', (l) => l.map((x) => (x.id === i.id ? { ...x, feito: true } : x)))
      : alterar('agendamentos', (l) => l.map((x) => (x.id === i.id ? { ...x, status: 'cancelado' as const } : x)));

  const abrir = (i: Item) => {
    wa('abrirChat', i.chatId);
    fechar();
  };

  return (
    <MenuSuspenso fechar={fechar}>
      <div className="notificacoes">
        <div className="notificacoes__topo">
          <strong>Notificações</strong>
          <label className="notificacoes__busca">
            <IconBusca tam={14} />
            <input className="entrada" placeholder="Pesquisar" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
        </div>
        {grupos.length === 0 ? (
          <div className="vazio" style={{ padding: '24px 12px' }}>
            <strong>Tudo em dia</strong>
            Nenhum lembrete para hoje e nenhum agendamento com falha.
          </div>
        ) : (
          grupos.map(([dia, l]) => (
            <div key={dia}>
              <div className="notificacoes__dia">{dia}</div>
              {l.map((i) => (
                <div key={`${i.tipo}${i.id}`} className={`notificacao${i.quando <= Date.now() ? ' notificacao--vencida' : ''}`}>
                  <span className="notificacao__icone">{i.tipo === 'lembrete' ? <IconSino tam={15} /> : <IconRelogio tam={15} />}</span>
                  <button className="notificacao__txt" onClick={() => abrir(i)} title="Abrir conversa">
                    <span>{i.titulo}</span>
                    <small>
                      {hora(i.quando)} · {i.texto}
                    </small>
                  </button>
                  <button className="icone-btn" title={i.tipo === 'lembrete' ? 'Marcar como feito' : 'Dispensar'} onClick={() => resolver(i)}>
                    <IconCheck tam={15} />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </MenuSuspenso>
  );
}
