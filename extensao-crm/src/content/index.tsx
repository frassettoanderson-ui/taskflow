// Content script (mundo isolado): monta a interface num Shadow DOM por cima do WhatsApp Web.
import { createRoot } from 'react-dom/client';
import css from '../ui/estilo.css';
import fonte from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2';
import { App } from './App';
import { esperarPronto } from './wa';

// @font-face não funciona dentro do Shadow DOM: a fonte é registrada no documento com nome próprio.
const estiloDoc = document.createElement('style');
estiloDoc.textContent = `
@font-face { font-family: 'CRMW Archivo'; src: url(${fonte}) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; font-display: swap; }
html.crmw-barra #app { position: fixed !important; top: 40px !important; left: 0 !important; bottom: 0 !important; height: auto !important; width: auto !important; right: 0 !important; }
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
sombra.appendChild(montagem);

// Segue o tema do WhatsApp (claro/escuro) lendo a cor de fundo real da página.
function detectarTema() {
  const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  const luz = (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000;
  host.dataset.tema = document.body.classList.contains('dark') || luz < 100 ? 'escuro' : 'claro';
}
detectarTema();
new MutationObserver(detectarTema).observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });

esperarPronto().then(() => {
  detectarTema();
  createRoot(montagem).render(<App />);
});
