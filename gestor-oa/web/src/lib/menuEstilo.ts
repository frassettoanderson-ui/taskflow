// Estilo (skin) do menu lateral. Cicla a cada clique em "Trocar estilo".
// Persistido em localStorage e aplicado via atributo data-menu no <html> (ver index.css).
export type MenuEstilo = 'claro' | 'escuro' | 'azul';

export const MENU_ESTILOS: { id: MenuEstilo; nome: string }[] = [
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
  { id: 'azul', nome: 'Azul' },
];

const CHAVE = 'goa_menu_estilo';

export function getMenuEstilo(): MenuEstilo {
  const e = localStorage.getItem(CHAVE) as MenuEstilo | null;
  return e && MENU_ESTILOS.some((x) => x.id === e) ? e : 'claro';
}

export function aplicarMenuEstilo(e: MenuEstilo): void {
  if (e === 'claro') document.documentElement.removeAttribute('data-menu');
  else document.documentElement.setAttribute('data-menu', e);
}

export function ciclarMenuEstilo(): MenuEstilo {
  const ids = MENU_ESTILOS.map((x) => x.id);
  const prox = ids[(ids.indexOf(getMenuEstilo()) + 1) % ids.length];
  localStorage.setItem(CHAVE, prox);
  aplicarMenuEstilo(prox);
  return prox;
}

export function initMenuEstilo(): void {
  aplicarMenuEstilo(getMenuEstilo());
}
