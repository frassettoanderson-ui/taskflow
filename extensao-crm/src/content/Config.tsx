// Configurações: funis e etapas, etiquetas do WhatsApp Business, backup e planilhas.
import { useEffect, useState } from 'react';
import { alterar, exportarTudo, gravar, importarTudo, novoId, type Config, type Etapa, type Funil } from '../shared/dados';
import { AbaIA } from './AbaIA';
import { AbaWebhooks } from './AbaWebhooks';
import { NOMES_PRIVACIDADE } from './privacidade';
import type { EtiquetaWA } from '../shared/protocolo';
import { useEsc } from '../ui/hooks';
import { IconBaixar, IconFechar, IconLapis, IconLixo, IconMais, IconSubir } from '../ui/icones';
import { useCRM } from './contexto';
import { exportarContatos } from './exportar';
import { wa } from './wa';

const CORES = ['#5B8DEF', '#E0A030', '#B96AD9', '#3FA66B', '#8A8F98', '#D9534F', '#2BB3B1', '#C8551F', '#6C7A3D', '#E26FA5'];

function troca<T>(l: T[], i: number, j: number) {
  const c = [...l];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export function Config({ fechar }: { fechar: () => void }) {
  const { business } = useCRM();
  const [aba, setAba] = useState<'funis' | 'etiquetas' | 'preferencias' | 'ia' | 'integracoes' | 'dados'>('funis');
  useEsc(fechar);

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="modal">
        <div className="modal__topo">
          <h2>Configurações</h2>
          <p>Os dados do CRM ficam guardados só neste navegador.</p>
          <button className="icone-btn modal__fechar" onClick={fechar} title="Fechar (Esc)">
            <IconFechar />
          </button>
          <div className="abas">
            <button className="aba" aria-pressed={aba === 'funis'} onClick={() => setAba('funis')}>
              Funis e etapas
            </button>
            {business && (
              <button className="aba" aria-pressed={aba === 'etiquetas'} onClick={() => setAba('etiquetas')}>
                Etiquetas do WhatsApp
              </button>
            )}
            <button className="aba" aria-pressed={aba === 'preferencias'} onClick={() => setAba('preferencias')}>
              Preferências
            </button>
            <button className="aba" aria-pressed={aba === 'ia'} onClick={() => setAba('ia')}>
              IA
            </button>
            <button className="aba" aria-pressed={aba === 'integracoes'} onClick={() => setAba('integracoes')}>
              Integrações
            </button>
            <button className="aba" aria-pressed={aba === 'dados'} onClick={() => setAba('dados')}>
              Backup e planilhas
            </button>
          </div>
        </div>
        <div className="modal__corpo">
          {aba === 'funis' && <AbaFunis />}
          {aba === 'etiquetas' && business && <AbaEtiquetas />}
          {aba === 'preferencias' && <AbaPreferencias />}
          {aba === 'ia' && <AbaIA />}
          {aba === 'integracoes' && <AbaWebhooks />}
          {aba === 'dados' && <AbaDados />}
        </div>
      </div>
    </div>
  );
}

function AbaFunis() {
  const { funis, contatos, config } = useCRM();
  const ordenados = [...funis].sort((a, b) => a.ordem - b.ordem);
  const [selId, setSelId] = useState<string | undefined>(config?.funilAtivo && funis.some((f) => f.id === config.funilAtivo) ? config.funilAtivo : ordenados[0]?.id);
  const [confirma, setConfirma] = useState<string | null>(null);
  const sel = ordenados.find((f) => f.id === selId) ?? ordenados[0];

  const salvarFunis = (l: Funil[]) => gravar('funis', l.map((f, i) => ({ ...f, ordem: i })));
  const mudarFunil = (id: string, p: Partial<Funil>) => salvarFunis(ordenados.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const etapas = sel ? [...sel.etapas].sort((a, b) => a.ordem - b.ordem) : [];
  const salvarEtapas = (l: Etapa[]) => sel && mudarFunil(sel.id, { etapas: l.map((e, i) => ({ ...e, ordem: i })) });
  const qtd = (etapaId: string) => (sel ? Object.values(contatos).filter((c) => c.posicoes[sel.id] === etapaId).length : 0);

  const novoFunil = () => {
    const f: Funil = { id: novoId(), nome: 'Novo funil', ordem: ordenados.length, etapas: [{ id: novoId(), nome: 'Primeira etapa', cor: CORES[0], ordem: 0 }] };
    salvarFunis([...ordenados, f]);
    setSelId(f.id);
  };

  const apagarFunil = async (id: string) => {
    if (ordenados.length <= 1) return;
    await salvarFunis(ordenados.filter((f) => f.id !== id));
    await alterar('contatos', (todos) => {
      for (const c of Object.values(todos)) delete c.posicoes[id];
    });
    setConfirma(null);
    setSelId(ordenados.find((f) => f.id !== id)?.id);
  };

  const apagarEtapa = async (id: string) => {
    if (!sel) return;
    await salvarEtapas(etapas.filter((e) => e.id !== id));
    await alterar('contatos', (todos) => {
      for (const c of Object.values(todos)) if (c.posicoes[sel.id] === id) delete c.posicoes[sel.id];
    });
    setConfirma(null);
  };

  return (
    <>
      <div className="abas" style={{ paddingTop: 0, marginBottom: 12 }}>
        {ordenados.map((f) => (
          <button key={f.id} className="aba" aria-pressed={f.id === sel?.id} onClick={() => setSelId(f.id)}>
            {f.nome}
          </button>
        ))}
        <button className="aba" onClick={novoFunil}>
          <IconMais tam={14} /> Novo funil
        </button>
      </div>
      {sel && (
        <>
          <div className="item-linha" style={{ marginTop: 0, marginBottom: 12 }}>
            <IconLapis tam={16} />
            <input className="entrada" key={sel.id} defaultValue={sel.nome} onBlur={(e) => e.target.value.trim() && mudarFunil(sel.id, { nome: e.target.value.trim() })} title="Nome do funil" />
            {ordenados.length > 1 &&
              (confirma === sel.id ? (
                <button className="btn btn--pequeno btn--perigo" onClick={() => apagarFunil(sel.id)}>
                  Confirmar
                </button>
              ) : (
                <button className="btn btn--pequeno btn--perigo" onClick={() => setConfirma(sel.id)}>
                  Apagar funil
                </button>
              ))}
          </div>
          {etapas.map((e, i) => (
            <div key={e.id} className="item-linha">
              <input type="color" className="cor-campo" value={e.cor} onChange={(ev) => salvarEtapas(etapas.map((x) => (x.id === e.id ? { ...x, cor: ev.target.value } : x)))} title="Cor" />
              <input className="entrada" defaultValue={e.nome} onBlur={(ev) => ev.target.value.trim() && salvarEtapas(etapas.map((x) => (x.id === e.id ? { ...x, nome: ev.target.value.trim() } : x)))} />
              <small style={{ color: 'var(--tinta-3)', whiteSpace: 'nowrap' }}>{qtd(e.id)} contatos</small>
              <button className="icone-btn" title="Subir" onClick={() => salvarEtapas(troca(etapas, i, i - 1))} disabled={i === 0}>
                <IconSubir tam={16} />
              </button>
              <button className="icone-btn" title="Descer" onClick={() => salvarEtapas(troca(etapas, i, i + 1))} disabled={i === etapas.length - 1}>
                <IconBaixar tam={16} />
              </button>
              {confirma === e.id ? (
                <button className="btn btn--pequeno btn--perigo" onClick={() => apagarEtapa(e.id)}>
                  Confirmar
                </button>
              ) : (
                <button className="icone-btn" title="Apagar etapa" onClick={() => setConfirma(e.id)}>
                  <IconLixo tam={16} />
                </button>
              )}
            </div>
          ))}
          <div className="linha-botoes" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => salvarEtapas([...etapas, { id: novoId(), nome: 'Nova etapa', cor: CORES[etapas.length % CORES.length], ordem: etapas.length }])}>
              <IconMais tam={16} />
              Adicionar etapa
            </button>
          </div>
          <div className="ajuda">Apagar uma etapa ou um funil não apaga os contatos: eles só saem daquele funil.</div>
        </>
      )}
    </>
  );
}

function AbaEtiquetas() {
  const { etiquetasWA, config, avisar, atualizarEtiquetas } = useCRM();
  const [paleta, setPaleta] = useState<string[]>([]);
  const [editando, setEditando] = useState<{ id: string | null; nome: string; cor: string } | null>(null);
  const [confirma, setConfirma] = useState<string | null>(null);

  useEffect(() => {
    wa('paletaEtiquetas').then(setPaleta).catch(() => {});
  }, []);

  const salvarOrdem = (l: EtiquetaWA[]) => config && gravar('config', { ...config, ordemEtiquetas: l.map((e) => e.id) });

  const salvar = async () => {
    if (!editando?.nome.trim()) return avisar('Dê um nome para a etiqueta', true);
    try {
      if (editando.id) await wa('editarEtiqueta', editando.id, editando.nome.trim(), editando.cor);
      else await wa('criarEtiqueta', editando.nome.trim(), editando.cor);
      avisar(editando.id ? 'Etiqueta editada' : 'Etiqueta criada');
      setEditando(null);
      atualizarEtiquetas();
    } catch (e) {
      avisar(`O WhatsApp recusou: ${(e as Error).message}`, true);
    }
  };

  const apagar = async (id: string) => {
    try {
      await wa('apagarEtiqueta', id);
      setConfirma(null);
      atualizarEtiquetas();
    } catch (e) {
      avisar(`O WhatsApp recusou: ${(e as Error).message}`, true);
    }
  };

  if (editando)
    return (
      <div className="campos">
        <label className="campo campo--largo">
          <span>Nome da etiqueta</span>
          <input className="entrada" value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} autoFocus onKeyDown={(e) => e.key === 'Enter' && salvar()} />
        </label>
        <div className="campo campo--largo">
          <span>Cor (paleta do WhatsApp)</span>
          <div className="paleta">
            {paleta.map((c) => (
              <button key={c} className="paleta__cor" style={{ background: c }} aria-pressed={editando.cor === c} title={c} onClick={() => setEditando({ ...editando, cor: c })} />
            ))}
          </div>
        </div>
        <div className="linha-botoes campo--largo">
          <button className="btn" onClick={() => setEditando(null)}>
            Cancelar
          </button>
          <button className="btn btn--primario" onClick={salvar}>
            {editando.id ? 'Salvar etiqueta' : 'Criar etiqueta'}
          </button>
        </div>
      </div>
    );

  return (
    <>
      {etiquetasWA.length === 0 && <div className="vazio">Nenhuma etiqueta nesta conta.</div>}
      {etiquetasWA.map((e, i) => (
        <div key={e.id} className="item-linha">
          <span className="trilha__cor" style={{ ['--cor' as string]: e.cor, width: 14, height: 14 }} />
          <div className="item-linha__txt">
            <div>{e.nome}</div>
            <small>{e.qtd} conversas</small>
          </div>
          <button className="icone-btn" title="Subir" disabled={i === 0} onClick={() => salvarOrdem(troca(etiquetasWA, i, i - 1))}>
            <IconSubir tam={16} />
          </button>
          <button className="icone-btn" title="Descer" disabled={i === etiquetasWA.length - 1} onClick={() => salvarOrdem(troca(etiquetasWA, i, i + 1))}>
            <IconBaixar tam={16} />
          </button>
          <button className="icone-btn" title="Editar" onClick={() => setEditando({ id: e.id, nome: e.nome, cor: e.cor })}>
            <IconLapis tam={16} />
          </button>
          {confirma === e.id ? (
            <button className="btn btn--pequeno btn--perigo" onClick={() => apagar(e.id)}>
              Confirmar
            </button>
          ) : (
            <button className="icone-btn" title="Apagar etiqueta do WhatsApp" onClick={() => setConfirma(e.id)}>
              <IconLixo tam={16} />
            </button>
          )}
        </div>
      ))}
      <div className="linha-botoes" style={{ marginTop: 12 }}>
        <button className="btn btn--primario" onClick={() => setEditando({ id: null, nome: '', cor: paleta[etiquetasWA.length % Math.max(1, paleta.length)] ?? '#8a8f98' })}>
          <IconMais tam={16} />
          Nova etiqueta
        </button>
      </div>
      <div className="ajuda">Estas etiquetas são do próprio WhatsApp Business: mudanças aparecem também no celular. A ordem vale para a barra e o quadro.</div>
    </>
  );
}

function AbaPreferencias() {
  const { config, avisar } = useCRM();
  if (!config) return null;
  const salvar = (p: Partial<Config>) => gravar('config', { ...config, ...p });
  const priv = config.privacidade;

  return (
    <div className="campos">
      <div className="campo campo--largo">
        <span>Modo privacidade (botão do olho na barra). Escolha o que fica desfocado:</span>
        {(Object.keys(NOMES_PRIVACIDADE) as (keyof typeof NOMES_PRIVACIDADE)[]).map((k) => (
          <label key={k} className="campo--linha">
            <input type="checkbox" checked={priv[k]} onChange={(e) => salvar({ privacidade: { ...priv, [k]: e.target.checked } })} />
            {NOMES_PRIVACIDADE[k]}
          </label>
        ))}
        <small className="ajuda" style={{ textAlign: 'left' }}>Passe o mouse por cima de um item para ver sem desligar o modo.</small>
      </div>

      <div className="campo campo--largo" style={{ marginTop: 10 }}>
        <span>Assinatura do atendente</span>
        <label className="campo--linha">
          <input type="checkbox" checked={config.assinatura.ativa} onChange={(e) => salvar({ assinatura: { ...config.assinatura, ativa: e.target.checked } })} />
          Colocar meu nome em negrito no início das mensagens enviadas pela extensão
        </label>
        <input className="entrada" placeholder="Seu nome (ex.: Anderson)" defaultValue={config.assinatura.nome} onBlur={(e) => salvar({ assinatura: { ...config.assinatura, nome: e.target.value.trim() } })} />
        <small className="ajuda" style={{ textAlign: 'left' }}>Vale para respostas rápidas e mensagens agendadas. O que você digita direto no WhatsApp não muda.</small>
      </div>

      <div className="campo campo--largo" style={{ marginTop: 10 }}>
        <span>Backup automático</span>
        <label className="campo--linha">
          <input type="checkbox" checked={config.backupAuto.ativo} onChange={(e) => salvar({ backupAuto: { ...config.backupAuto, ativo: e.target.checked } })} />
          Salvar uma cópia por dia na pasta Downloads, em "CRM WhatsApp" (guarda os últimos 7 dias)
        </label>
        <div className="campos">
          <label className="campo">
            <span>Horário</span>
            <input className="entrada" type="time" value={config.backupAuto.hora} onChange={(e) => salvar({ backupAuto: { ...config.backupAuto, hora: e.target.value || '18:00' } })} />
          </label>
          <div className="campo" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn"
              onClick={() => {
                chrome.runtime.sendMessage({ tipo: 'backup-agora' });
                avisar('Backup salvo em Downloads/CRM WhatsApp');
              }}
            >
              <IconBaixar tam={16} />
              Salvar agora
            </button>
          </div>
        </div>
        {config.backupAuto.ultimo && <small className="ajuda" style={{ textAlign: 'left' }}>Último backup automático: {config.backupAuto.ultimo.split('-').reverse().join('/')}</small>}
      </div>
    </div>
  );
}

function AbaDados() {
  const { contatos, avisar } = useCRM();

  const exportar = async () => {
    const dados = await exportarTudo();
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-whatsapp-backup-${new Date().toLocaleDateString('sv-SE')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const importar = async (f: File | undefined) => {
    if (!f) return;
    try {
      const dados = JSON.parse(await f.text());
      if (!dados || typeof dados !== 'object' || !(Array.isArray(dados.funis) || Array.isArray(dados.etapas))) throw new Error('arquivo não é um backup desta extensão');
      if (!confirm('Importar este backup vai substituir os dados atuais do CRM. Continuar?')) return;
      await importarTudo(dados);
      avisar('Backup importado');
    } catch (e) {
      avisar(`Não deu para importar: ${(e as Error).message}`, true);
    }
  };

  return (
    <div className="vazio">
      <strong>Cópia de segurança</strong>
      Exporte tudo (contatos, funis, respostas, agendamentos e lembretes) num arquivo, para guardar ou levar para outro computador.
      <div className="linha-botoes" style={{ marginTop: 16 }}>
        <button className="btn btn--primario" onClick={exportar}>
          <IconBaixar tam={16} />
          Exportar backup
        </button>
        <label className="btn">
          <IconSubir tam={16} />
          Importar backup
          <input type="file" accept="application/json,.json" hidden onChange={(e) => importar(e.target.files?.[0])} />
        </label>
      </div>
      <strong style={{ marginTop: 28 }}>Planilha de contatos</strong>
      Todas as fichas preenchidas ({Object.keys(contatos).length}) numa planilha do Excel. A planilha de cada funil fica no botão Planilha do quadro.
      <div className="linha-botoes" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => exportarContatos(Object.values(contatos)).catch((e) => avisar(`Não deu para exportar: ${e.message}`, true))} disabled={!Object.keys(contatos).length}>
          <IconBaixar tam={16} />
          Baixar planilha de contatos
        </button>
      </div>
    </div>
  );
}
