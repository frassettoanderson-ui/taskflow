// Campo harmônico: os acordes "da casa" de cada tom, numerados por grau.
// Deixamos de fora o acorde diminuto (vii° no maior, ii° no menor): quase não aparece em louvor.

export const TONS_MAIORES = [
  { id: 'G', nome: 'Sol maior', acordes: ['G', 'Am', 'Bm', 'C', 'D', 'Em'] },
  { id: 'D', nome: 'Ré maior',  acordes: ['D', 'Em', 'F#m', 'G', 'A', 'Bm'] },
  { id: 'C', nome: 'Dó maior',  acordes: ['C', 'Dm', 'Em', 'F', 'G', 'Am'] },
  { id: 'A', nome: 'Lá maior',  acordes: ['A', 'Bm', 'C#m', 'D', 'E', 'F#m'] },
  { id: 'E', nome: 'Mi maior',  acordes: ['E', 'F#m', 'G#m', 'A', 'B', 'C#m'] },
  { id: 'F', nome: 'Fá maior',  acordes: ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm'] },
];
export const GRAUS_MAIOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi'];
export const FUNCOES_MAIOR = ['Casa', 'Caminho', 'Caminho', 'Afasta', 'Tensão', 'Casa menor'];

export const TONS_MENORES = [
  { id: 'Em', nome: 'Mi menor', acordes: ['Em', 'G', 'Am', 'Bm', 'C', 'D'] },
  { id: 'Am', nome: 'Lá menor', acordes: ['Am', 'C', 'Dm', 'Em', 'F', 'G'] },
  { id: 'Bm', nome: 'Si menor', acordes: ['Bm', 'D', 'Em', 'F#m', 'G', 'A'] },
  { id: 'Dm', nome: 'Ré menor', acordes: ['Dm', 'F', 'Gm', 'Am', 'Bb', 'C'] },
];
export const GRAUS_MENOR = ['i', 'III', 'iv', 'v', 'VI', 'VII'];
export const FUNCOES_MENOR = ['Casa', 'Maior relativo', 'Afasta', 'Tensão leve', 'Abre', 'Prepara'];

// Sequências que aparecem o tempo todo em louvor (índices dos graus acima)
export const SEQUENCIAS_MAIOR = [
  { graus: [0, 4, 5, 3], nome: 'A mais usada', dica: 'I V vi IV. Metade dos louvores atuais cabe aqui.' },
  { graus: [5, 3, 0, 4], nome: 'Começando no menor', dica: 'vi IV I V. Mesma sequência, começando pelo acorde triste.' },
  { graus: [0, 3, 5, 4], nome: 'Refrão que cresce', dica: 'I IV vi V. Boa para refrão.' },
  { graus: [0, 5, 3, 4], nome: 'Clássica', dica: 'I vi IV V. Hinos e louvores mais antigos.' },
  { graus: [3, 4, 2, 5], nome: 'Subindo', dica: 'IV V iii vi. Muito usada em ponte, dá sensação de subida.' },
  { graus: [0, 3, 0, 4], nome: 'Simples', dica: 'I IV I V. Três acordes, ótima para começar.' },
  { graus: [3, 0, 4, 5], nome: 'Começando fora de casa', dica: 'IV I V vi.' },
  { graus: [1, 4, 0], nome: 'Fechamento', dica: 'ii V I. O jeito mais comum de terminar uma música.' },
];
export const SEQUENCIAS_MENOR = [
  { graus: [0, 4, 1, 5], nome: 'A mais usada no menor', dica: 'i VI III VII.' },
  { graus: [0, 5, 4, 5], nome: 'Vai e volta', dica: 'i VII VI VII.' },
  { graus: [0, 2, 5, 1], nome: 'Andando pelo ciclo', dica: 'i iv VII III.' },
  { graus: [0, 2, 3, 0], nome: 'Menor clássico', dica: 'i iv v i.' },
];

export function tonsDo(modo) { return modo === 'menor' ? TONS_MENORES : TONS_MAIORES; }
export function grausDo(modo) { return modo === 'menor' ? GRAUS_MENOR : GRAUS_MAIOR; }
export function funcoesDo(modo) { return modo === 'menor' ? FUNCOES_MENOR : FUNCOES_MAIOR; }
export function sequenciasDo(modo) { return modo === 'menor' ? SEQUENCIAS_MENOR : SEQUENCIAS_MAIOR; }
export function tom(modo, id) { return tonsDo(modo).find((t) => t.id === id) || tonsDo(modo)[0]; }
