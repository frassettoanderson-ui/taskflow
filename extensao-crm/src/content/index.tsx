// Content script (mundo isolado): monta a interface num Shadow DOM por cima do WhatsApp Web.
import { createRoot } from 'react-dom/client';
import css from '../ui/estilo.css';
import { App } from './App';
import { esperarPronto } from './wa';

// Abre espaço para a barra (44px) e, com uma conversa aberta e a ficha ligada, para a ficha (340px).
const estiloDoc = document.createElement('style');
estiloDoc.textContent = `
html.crmw-barra #app { position: fixed !important; top: 44px !important; left: 0 !important; bottom: 0 !important; height: auto !important; width: auto !important; right: 0 !important; }
html.crmw-ficha #app { right: 340px !important; }
`;
document.documentElement.appendChild(estiloDoc);

const host = document.createElement('div');
host.id = 'crmw-raiz';
document.documentElement.appendChild(host);
const sombra = host.attachShadow({ mode: 'open' });
const folha = document.createElement('style');
folha.textContent = css;
sombra.appendChild(folha);
const montagem = document.createElement('div');
montagem.className = 'raiz-crm';
sombra.appendChild(montagem);

// Segue o tema do WhatsApp (claro/escuro) lendo a cor de fundo real da página.
function detectarTema() {
  const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  const luz = (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000;
  host.dataset.tema = document.body.classList.contains('dark') || document.documentElement.classList.contains('dark') || luz < 100 ? 'escuro' : 'claro';
}
detectarTema();
new MutationObserver(detectarTema).observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
new MutationObserver(detectarTema).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

esperarPronto().then(() => {
  detectarTema();
  createRoot(montagem).render(<App />);
});
