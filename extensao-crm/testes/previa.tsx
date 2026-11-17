// Prévia visual da interface fora do WhatsApp (dados de exemplo). Gerada por: node testes/previa.mjs
import './chrome-falso';
import { createRoot } from 'react-dom/client';
import css from '../src/ui/estilo.css';
import { App } from '../src/content/App';
import { gravar, passoVazio } from '../src/shared/dados';

const tema = new URLSearchParams(location.search).get('tema') === 'claro' ? 'claro' : 'escuro';
document.body.style.background = tema === 'escuro' ? '#161717' : '#f0f2f5';
const host = document.createElement('div');
host.dataset.tema = tema;
document.body.appendChild(host);
const sombra = host.attachShadow({ mode: 'open' });
const folha = document.createElement('style');
folha.textContent = css;
sombra.appendChild(folha);
const montagem = document.createElement('div');
montagem.className = 'raiz-crm';
sombra.appendChild(montagem);

(async () => {
  await gravar('ia', { provedor: 'gemini', chaves: { gemini: 'chave-de-exemplo' }, modelo: {}, sobreNegocio: '', tom: 'cordial e direto' });
  const p1 = { ...passoVazio('texto'), texto: '{{saudacao}}, {{primeiro_nome}}! Aqui é da Atuan Contabilidade.', simular: 'digitando' as const, simularSeg: 3 };
  const p2 = { ...passoVazio('audio'), nomeArquivo: 'apresentacao.webm', arquivo: 'data:audio/webm;base64,AA', simular: 'gravando' as const, simularSeg: 6, esperaSeg: 2 };
  const p3 = { ...passoVazio('texto'), texto: 'Como posso te ajudar?', esperaSeg: 1 };
  await gravar('atendimento', {
    saudacaoAtiva: true, primeiroContato: [p1, p2, p3], retorno: [], novaConversaHoras: 12, iaAtiva: true, instrucoes: '', nomeAssinatura: 'Assistente virtual',
    voltaIA: 'novaConversa', limiteSeguidas: 8, esperaMin: 5, esperaMax: 12,
  });
  createRoot(montagem).render(<App />);
})();
