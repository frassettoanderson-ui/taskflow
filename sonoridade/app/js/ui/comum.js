export const ICONES = {
  fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  avancar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pausa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>',
  som: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  cordas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4v16M10 4v16M14 4v16M18 4v16"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  menos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  visto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  salvar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
};

// setas de batida desenhadas (nada de caractere de seta no texto)
export const BATIDA_SVG = {
  B: '<svg viewBox="0 0 24 24" class="s-batida s-baixo"><path d="M10 3h4v11h4.5L12 21l-6.5-7H10z"/></svg>',
  C: '<svg viewBox="0 0 24 24" class="s-batida s-cima"><path d="M10 21h4V10h4.5L12 3 5.5 10H10z"/></svg>',
  X: '<svg viewBox="0 0 24 24" class="s-batida s-abafa"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>',
  '-': '<svg viewBox="0 0 24 24" class="s-batida s-vazio"><rect x="10.5" y="10.5" width="3" height="3" rx="1"/></svg>',
};
// dedilhado: P = polegar no baixo, números = corda
for (const d of ['P', '1', '2', '3', '4']) {
  BATIDA_SVG[d] = `<svg viewBox="0 0 24 24" class="s-batida s-dedo${d === 'P' ? ' s-polegar' : ''}"><circle cx="12" cy="12" r="10"/><text x="12" y="16.6" text-anchor="middle">${d}</text></svg>`;
}
export const ehDedilhado = (passo) => /^[P1-4]$/.test(passo);

export function barraTopo(titulo, voltarPara = '#/') {
  return `<header class="barra-topo">
    <a class="voltar" href="${voltarPara}" aria-label="Voltar">${ICONES.voltar}</a>
    <h1>${titulo}</h1>
    <span></span>
  </header>`;
}

export function lerQuery(q) {
  return Object.fromEntries(new URLSearchParams(q || ''));
}

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function guardar(chave, valor) {
  try { localStorage.setItem(`sonoridade.${chave}`, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
}
export function ler(chave, padrao) {
  try { const v = localStorage.getItem(`sonoridade.${chave}`); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
}
