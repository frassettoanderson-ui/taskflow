// Troca de estilo (cor de destaque). Persistido em localStorage e aplicado
// via atributo data-tema no <html> (ver index.css).
export type TemaId = 'azul' | 'verde' | 'roxo' | 'grafite';

export const TEMAS: { id: TemaId; nome: string; cor: string }[] = [
  { id: 'azul', nome: 'Azul', cor: '#3f8cba' },
  { id: 'verde', nome: 'Verde petroleo', cor: '#1f7376' },
  { id: 'roxo', nome: 'Roxo', cor: '#8b5cf6' },
  { id: 'grafite', nome: 'Grafite', cor: '#475569' },
];

const CHAVE = 'goa_tema';

export function getTema(): TemaId {
  const t = localStorage.getItem(CHAVE) as TemaId | null;
  return t && TEMAS.some((x) => x.id === t) ? t : 'azul';
}

export function aplicarTema(t: TemaId): void {
  if (t === 'azul') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', t);
}

export function setTema(t: TemaId): void {
  localStorage.setItem(CHAVE, t);
  aplicarTema(t);
}

// Aplica o tema salvo no boot do app.
export function initTema(): void {
  aplicarTema(getTema());
}
