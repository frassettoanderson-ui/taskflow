import { useEffect, useMemo, useRef, useState } from 'react';
import { FUNIL_ETIQUETAS, gravar } from '../shared/dados';
import type { FiltroNativo } from '../shared/protocolo';
import { useColecao } from '../ui/hooks';
import { IconEngrenagem, IconFaisca, IconFicha, IconFunil, IconMais, IconOlho, IconQuadro, IconRaio, IconRelogio, IconSeta, IconSino } from '../ui/icones';
import { Assistente } from './Assistente';
import { NovaConversa } from './NovaConversa';
import { Notificacoes, useNotificacoes } from './Notificacoes';
import { aplicarPrivacidade } from './privacidade';
import { Agendamentos } from './Agendamentos';
import { iniciarAgendador } from './agendador';
import { iniciarAssinador } from './assinador';
import { BotoesRapidos } from './BotoesRapidos';
import { Config } from './Config';
import { ProvedorCRM, useCRM, useFunilAtivo } from './contexto';
import { Ficha } from './Ficha';
import { Kanban } from './Kanban';
import { Respostas } from './Respostas';
import { SugestoesBarra } from './SugestoesBarra';
import { wa } from './wa';

type Painel = 'kanban' | 'respostas' | 'agendamentos' | 'config' | 'nova' | 'assistente' | null;

type Filtro =
  | { tipo: 'todas' }
  | { tipo: 'nativo'; valor: FiltroNativo }
  | { tipo: 'etapa'; etapaId: string }
  | { tipo: 'sem' }
  | { tipo: 'etiqueta'; id: string };

export function App() {
  return (
    <ProvedorCRM>
      <Interface />
    </ProvedorCRM>
  );
}

function Interface() {
  const { contatos, chats, avisar, funis, config, business, etiquetasWA, ativo } = useCRM();
  const funil = useFunilAtivo();
  const agendamentos = useColecao('agendamentos') ?? [];
  const [filtro, setFiltro] = useState<Filtro>({ tipo: 'todas' });
  const [painel, setPainel] = useState<Painel>(null);
  const [fichaAberta, setFichaAberta] = useState(true);
  const [menuFunil, setMenuFunil] = useState(false);
  const modoEtiquetas = config?.funilAtivo === FUNIL_ETIQUETAS && business;
  const [notifAberta, setNotifAberta] = useState(false);
  const notif = useNotificacoes();

  useEffect(() => iniciarAgendador(avisar), [avisar]);
  useEffect(() => iniciarAssinador(), []);

  useEffect(() => {
    if (config) aplicarPrivacidade(config.privacidade);
  }, [config?.privacidade]);

  // atalho do assistente de IA
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setPainel((p) => (p === 'assistente' ? null : 'assistente'));
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('crmw-barra');
    return () => document.documentElement.classList.remove('crmw-barra');
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('crmw-ficha', fichaAberta && !!ativo);
  }, [fichaAberta, ativo]);

  // Pedido vindo do background (ex.: clique na notificação de lembrete)
  useEffect(() => {
    const h = (msg: any) => {
      if (msg?.tipo === 'abrir-chat' && msg.chatId) wa('abrirChat', msg.chatId);
    };
    chrome.runtime.onMessage.addListener(h);
    return () => chrome.runtime.onMessage.removeListener(h);
  }, []);

  // trocar de funil limpa o filtro de etapa
  useEffect(() => {
    setFiltro((f) => (f.tipo === 'etapa' || f.tipo === 'sem' || f.tipo === 'etiqueta' ? { tipo: 'todas' } : f));
  }, [config?.funilAtivo]);

  const etapas = useMemo(() => [...(funil?.etapas ?? [])].sort((a, b) => a.ordem - b.ordem), [funil]);

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    if (modoEtiquetas) {
      for (const c of chats) for (const e of c.etiquetas) m.set(e, (m.get(e) ?? 0) + 1);
    } else if (funil) {
      for (const c of Object.values(contatos)) {
        const e = c.posicoes[funil.id];
        if (e) m.set(e, (m.get(e) ?? 0) + 1);
      }
    }
    return m;
  }, [contatos, chats, funil, modoEtiquetas]);

  const semEtapa = useMemo(() => (funil ? chats.filter((c) => !c.grupo && !contatos[c.id]?.posicoes[funil.id]).length : 0), [chats, contatos, funil]);

  // Aplica o filtro na própria lista de conversas do WhatsApp
  useEffect(() => {
    if (filtro.tipo === 'todas') {
      wa('filtrarLista', null).catch(() => {});
      return;
    }
    if (filtro.tipo === 'nativo') {
      wa('filtrarNativo', filtro.valor).catch((e) => avisar(`Não foi possível filtrar: ${e.message}`, true));
      return;
    }
    let ids: string[] = [];
    if (filtro.tipo === 'etiqueta') ids = chats.filter((c) => c.etiquetas.includes(filtro.id)).map((c) => c.id);
    else if (funil && filtro.tipo === 'sem') ids = chats.filter((c) => !c.grupo && !contatos[c.id]?.posicoes[funil.id]).map((c) => c.id);
    else if (funil && filtro.tipo === 'etapa')
      ids = Object.values(contatos)
        .filter((c) => c.posicoes[funil.id] === filtro.etapaId)
        .map((c) => c.id);
    wa('filtrarLista', ids).catch((e) => avisar(`Não foi possível filtrar: ${e.message}`, true));
  }, [filtro, contatos, chats, funil, avisar]);

  const pendentes = agendamentos.filter((a) => a.status === 'pendente').length;
  const alternar = (p: Painel) => setPainel((atual) => (atual === p ? null : p));
  const ativoIgual = (f: Filtro) => JSON.stringify(f) === JSON.stringify(filtro);
  const clicar = (f: Filtro) => setFiltro(ativoIgual(f) ? { tipo: 'todas' } : f);
  const escolherFunil = (id: string) => {
    setMenuFunil(false);
    if (config) gravar('config', { ...config, funilAtivo: id });
  };

  return (
    <>
      <div className="barra">
        <div className="marca" title="CRM WhatsApp">
          <span className="marca__selo">
            <IconQuadro tam={15} />
          </span>
        </div>
        <div className="seletor-funil">
          <button className="seletor-funil__botao" onClick={() => setMenuFunil((v) => !v)} aria-expanded={menuFunil} title="Trocar de funil">
            <IconFunil tam={16} />
            <span>{modoEtiquetas ? 'Etiquetas do WhatsApp' : funil?.nome ?? 'Sem funil'}</span>
            <IconSeta tam={12} style={{ transform: 'rotate(90deg)' }} />
          </button>
          {menuFunil && (
            <MenuSuspenso fechar={() => setMenuFunil(false)}>
              {[...funis]
                .sort((a, b) => a.ordem - b.ordem)
                .map((f) => (
                  <button key={f.id} className="menu-suspenso__item" aria-pressed={!modoEtiquetas && f.id === funil?.id} onClick={() => escolherFunil(f.id)}>
                    {f.nome}
                    <small>{f.etapas.length} etapas</small>
                  </button>
                ))}
              {business && (
                <button className="menu-suspenso__item" aria-pressed={modoEtiquetas} onClick={() => escolherFunil(FUNIL_ETIQUETAS)}>
                  Etiquetas do WhatsApp
                  <small>{etiquetasWA.length} etiquetas</small>
                </button>
              )}
              <button
                className="menu-suspenso__item menu-suspenso__item--acao"
                onClick={() => {
                  setMenuFunil(false);
                  setPainel('config');
                }}
              >
                Gerenciar funis
              </button>
            </MenuSuspenso>
          )}
        </div>
        <nav className="etapas" aria-label="Filtrar conversas">
          <button className="etapa" aria-pressed={filtro.tipo === 'todas'} onClick={() => setFiltro({ tipo: 'todas' })}>
            Todas
          </button>
          {modoEtiquetas
            ? etiquetasWA.map((e) => (
                <button key={e.id} className="etapa" style={{ ['--cor' as string]: e.cor }} aria-pressed={ativoIgual({ tipo: 'etiqueta', id: e.id })} onClick={() => clicar({ tipo: 'etiqueta', id: e.id })}>
                  <span className="etapa__marca" />
                  {e.nome}
                  <Qtd n={contagem.get(e.id) ?? 0} />
                </button>
              ))
            : etapas.map((e) => (
                <button key={e.id} className="etapa" style={{ ['--cor' as string]: e.cor }} aria-pressed={ativoIgual({ tipo: 'etapa', etapaId: e.id })} onClick={() => clicar({ tipo: 'etapa', etapaId: e.id })}>
                  <span className="etapa__marca" />
                  {e.nome}
                  <Qtd n={contagem.get(e.id) ?? 0} />
                </button>
              ))}
          {!modoEtiquetas && funil && (
            <button className="etapa" aria-pressed={filtro.tipo === 'sem'} onClick={() => clicar({ tipo: 'sem' })}>
              Sem etapa
              <Qtd n={semEtapa} />
            </button>
          )}
        </nav>
        <div className="acoes">
          <button className="acao" aria-pressed={painel === 'nova'} onClick={() => alternar('nova')} title="Conversar com um número que não está salvo">
            <IconMais />
            <span className="acao__rotulo">Nova</span>
          </button>
          <button className="acao" aria-pressed={painel === 'kanban'} onClick={() => alternar('kanban')} title="Funil em quadro">
            <IconQuadro />
            <span className="acao__rotulo">Quadro</span>
          </button>
          <button className="acao" aria-pressed={painel === 'respostas'} onClick={() => alternar('respostas')} title="Respostas rápidas">
            <IconRaio />
            <span className="acao__rotulo">Respostas</span>
          </button>
          <button className="acao" aria-pressed={painel === 'assistente'} onClick={() => alternar('assistente')} title="Assistente de IA (Ctrl+Shift+I)">
            <IconFaisca />
            <span className="acao__rotulo">IA</span>
          </button>
          <button className="acao" aria-pressed={painel === 'agendamentos'} onClick={() => alternar('agendamentos')} title="Mensagens agendadas">
            <IconRelogio />
            <span className="acao__rotulo">Agendadas</span>
            {pendentes > 0 && <span className="acao__badge">{pendentes}</span>}
          </button>
          <button className="acao" aria-pressed={fichaAberta} onClick={() => setFichaAberta((v) => !v)} title="Ficha do contato">
            <IconFicha />
            <span className="acao__rotulo">Ficha</span>
          </button>
          <span className="acoes__divisa" />
          <button
            className="acao"
            aria-pressed={!!config?.privacidade.ativa}
            onClick={() => config && gravar('config', { ...config, privacidade: { ...config.privacidade, ativa: !config.privacidade.ativa } })}
            title="Modo privacidade (desfoca nomes, fotos e mensagens)"
          >
            <IconOlho fechado={!!config?.privacidade.ativa} />
          </button>
          <div className="sino">
            <button className="acao" aria-pressed={notifAberta} onClick={() => setNotifAberta((v) => !v)} title="Notificações">
              <IconSino />
              {notif.vencidos > 0 && <span className="acao__badge">{notif.vencidos}</span>}
            </button>
            {notifAberta && <Notificacoes fechar={() => setNotifAberta(false)} />}
          </div>
          <button className="acao" aria-pressed={painel === 'config'} onClick={() => alternar('config')} title="Configurações">
            <IconEngrenagem />
          </button>
        </div>
      </div>

      {fichaAberta && ativo && <Ficha />}
      {painel === 'kanban' && <Kanban fechar={() => setPainel(null)} />}
      {painel === 'respostas' && <Respostas fechar={() => setPainel(null)} />}
      {painel === 'agendamentos' && <Agendamentos fechar={() => setPainel(null)} />}
      {painel === 'config' && <Config fechar={() => setPainel(null)} />}
      {painel === 'nova' && <NovaConversa fechar={() => setPainel(null)} />}
      {painel === 'assistente' && <Assistente fechar={() => setPainel(null)} />}
      <SugestoesBarra />
      <BotoesRapidos />
    </>
  );
}

function Qtd({ n }: { n: number }) {
  return <span className={`etapa__qtd${n ? '' : ' etapa__qtd--zero'}`}>{n}</span>;
}

export function MenuSuspenso({ fechar, children }: { fechar: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !e.composedPath().includes(ref.current)) fechar();
    };
    const t = setTimeout(() => window.addEventListener('mousedown', fora, true));
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', fora, true);
    };
  }, [fechar]);
  return (
    <div className="menu-suspenso" ref={ref}>
      {children}
    </div>
  );
}
