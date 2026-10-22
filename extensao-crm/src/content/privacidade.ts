// Modo privacidade: desfoca partes do WhatsApp Web (útil em tela compartilhada ou atendimento em público).
// Passar o mouse por cima mostra o item. Os seletores seguem o HTML atual do WhatsApp e podem precisar de ajuste.
import type { Privacidade } from '../shared/dados';

const DESFOQUE = 'filter: blur(6px) !important; transition: filter .15s ease;';
const MOSTRAR = 'filter: none !important;';

const REGRAS: Record<Exclude<keyof Privacidade, 'ativa'>, string[]> = {
  fotos: ['#pane-side img', '#main header img', '[data-crmw-foto]'],
  nomes: ['#pane-side span[title][dir="auto"]', '#main header span[dir="auto"]'],
  ultimaMsg: ['#pane-side span[title]:not([dir="auto"])', '#pane-side span[dir="ltr"]'],
  mensagens: ['#main [data-pre-plain-text]', '#main .copyable-text'],
  midia: ['#main [role="row"] img', '#main [role="row"] video'],
};

let estilo: HTMLStyleElement | null = null;

export function aplicarPrivacidade(p: Privacidade) {
  estilo ??= Object.assign(document.createElement('style'), { id: 'crmw-privacidade' });
  if (!estilo.isConnected) document.documentElement.appendChild(estilo);
  if (!p.ativa) {
    estilo.textContent = '';
    return;
  }
  const seletores = (Object.keys(REGRAS) as (keyof typeof REGRAS)[]).filter((k) => p[k]).flatMap((k) => REGRAS[k]);
  estilo.textContent = seletores.length ? `${seletores.join(',')} { ${DESFOQUE} }\n${seletores.map((s) => `${s}:hover`).join(',')} { ${MOSTRAR} }` : '';
}

export const NOMES_PRIVACIDADE: Record<keyof typeof REGRAS, string> = {
  fotos: 'Fotos de perfil',
  nomes: 'Nomes das conversas',
  ultimaMsg: 'Última mensagem na lista',
  mensagens: 'Mensagens da conversa aberta',
  midia: 'Fotos e vídeos da conversa',
};
