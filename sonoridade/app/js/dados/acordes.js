// Acordes de violão (afinação padrão: Mi Lá Ré Sol Si Mi).
// casas: da 6ª corda (Mi grave) até a 1ª (Mi agudo). -1 = não tocar, 0 = corda solta.
// dedos: 1 indicador, 2 médio, 3 anelar, 4 mínimo (0 = nenhum).
// pestana: dedo 1 deitado na casa indicada, cobrindo da corda "de" até a corda "ate" (números das cordas).

export const ACORDES = {
  // ---------- primeiros acordes ----------
  C:   { nome: 'Dó maior',  casas: [-1, 3, 2, 0, 1, 0],  dedos: [0, 3, 2, 0, 1, 0] },
  D:   { nome: 'Ré maior',  casas: [-1, -1, 0, 2, 3, 2], dedos: [0, 0, 0, 1, 3, 2] },
  E:   { nome: 'Mi maior',  casas: [0, 2, 2, 1, 0, 0],   dedos: [0, 2, 3, 1, 0, 0] },
  G:   { nome: 'Sol maior', casas: [3, 2, 0, 0, 0, 3],   dedos: [2, 1, 0, 0, 0, 3] },
  A:   { nome: 'Lá maior',  casas: [-1, 0, 2, 2, 2, 0],  dedos: [0, 0, 1, 2, 3, 0] },
  Am:  { nome: 'Lá menor',  casas: [-1, 0, 2, 2, 1, 0],  dedos: [0, 0, 2, 3, 1, 0] },
  Em:  { nome: 'Mi menor',  casas: [0, 2, 2, 0, 0, 0],   dedos: [0, 2, 3, 0, 0, 0] },
  Dm:  { nome: 'Ré menor',  casas: [-1, -1, 0, 2, 3, 1], dedos: [0, 0, 0, 2, 3, 1] },

  // ---------- com sétima ----------
  A7:  { nome: 'Lá com sétima',  casas: [-1, 0, 2, 0, 2, 0],  dedos: [0, 0, 2, 0, 3, 0] },
  B7:  { nome: 'Si com sétima',  casas: [-1, 2, 1, 2, 0, 2],  dedos: [0, 2, 1, 3, 0, 4] },
  C7:  { nome: 'Dó com sétima',  casas: [-1, 3, 2, 3, 1, 0],  dedos: [0, 3, 2, 4, 1, 0] },
  D7:  { nome: 'Ré com sétima',  casas: [-1, -1, 0, 2, 1, 2], dedos: [0, 0, 0, 2, 1, 3] },
  E7:  { nome: 'Mi com sétima',  casas: [0, 2, 0, 1, 0, 0],   dedos: [0, 2, 0, 1, 0, 0] },
  G7:  { nome: 'Sol com sétima', casas: [3, 2, 0, 0, 0, 1],   dedos: [3, 2, 0, 0, 0, 1] },
  Am7: { nome: 'Lá menor com sétima', casas: [-1, 0, 2, 0, 1, 0], dedos: [0, 0, 2, 0, 1, 0] },
  Em7: { nome: 'Mi menor com sétima', casas: [0, 2, 0, 0, 0, 0],  dedos: [0, 2, 0, 0, 0, 0] },
  Dm7: { nome: 'Ré menor com sétima', casas: [-1, -1, 0, 2, 1, 1], dedos: [0, 0, 0, 2, 1, 1], pestana: { casa: 1, de: 2, ate: 1 } },
  Bm7: { nome: 'Si menor com sétima', casas: [-1, 2, 0, 2, 0, 2], dedos: [0, 1, 0, 2, 0, 3] },
  C7M: { nome: 'Dó com sétima maior', casas: [-1, 3, 2, 0, 0, 0], dedos: [0, 3, 2, 0, 0, 0] },
  F7M: { nome: 'Fá com sétima maior', casas: [-1, -1, 3, 2, 1, 0], dedos: [0, 0, 3, 2, 1, 0] },

  // ---------- com pestana ----------
  F:     { nome: 'Fá maior',        casas: [1, 3, 3, 2, 1, 1],  dedos: [1, 3, 4, 2, 1, 1], pestana: { casa: 1, de: 6, ate: 1 } },
  Bm:    { nome: 'Si menor',        casas: [-1, 2, 4, 4, 3, 2], dedos: [0, 1, 3, 4, 2, 1], pestana: { casa: 2, de: 5, ate: 1 } },
  'F#m': { nome: 'Fá sustenido menor', casas: [2, 4, 4, 2, 2, 2], dedos: [1, 3, 4, 1, 1, 1], pestana: { casa: 2, de: 6, ate: 1 } },
  'C#m': { nome: 'Dó sustenido menor', casas: [-1, 4, 6, 6, 5, 4], dedos: [0, 1, 3, 4, 2, 1], pestana: { casa: 4, de: 5, ate: 1 } },
  'G#m': { nome: 'Sol sustenido menor', casas: [4, 6, 6, 4, 4, 4], dedos: [1, 3, 4, 1, 1, 1], pestana: { casa: 4, de: 6, ate: 1 } },
  B:     { nome: 'Si maior',        casas: [-1, 2, 4, 4, 4, 2], dedos: [0, 1, 2, 3, 4, 1], pestana: { casa: 2, de: 5, ate: 1 } },
  Bb:    { nome: 'Si bemol maior',  casas: [-1, 1, 3, 3, 3, 1], dedos: [0, 1, 2, 3, 4, 1], pestana: { casa: 1, de: 5, ate: 1 } },
  Gm:    { nome: 'Sol menor',       casas: [3, 5, 5, 3, 3, 3],  dedos: [1, 3, 4, 1, 1, 1], pestana: { casa: 3, de: 6, ate: 1 } },
  Cm:    { nome: 'Dó menor',        casas: [-1, 3, 5, 5, 4, 3], dedos: [0, 1, 3, 4, 2, 1], pestana: { casa: 3, de: 5, ate: 1 } },

  // ---------- suspensos e com nona ----------
  A9: { nome: 'Lá com nona',  apelidos: 'também escrito A2 ou Asus2', casas: [-1, 0, 2, 2, 0, 0],  dedos: [0, 0, 1, 2, 0, 0] },
  D9: { nome: 'Ré com nona',  apelidos: 'também escrito D2 ou Dsus2', casas: [-1, -1, 0, 2, 3, 0], dedos: [0, 0, 0, 1, 3, 0] },
  C9: { nome: 'Dó com nona',  apelidos: 'também escrito Cadd9',       casas: [-1, 3, 2, 0, 3, 3],  dedos: [0, 2, 1, 0, 3, 4] },
  A4: { nome: 'Lá com quarta', apelidos: 'também escrito Asus4',      casas: [-1, 0, 2, 2, 3, 0],  dedos: [0, 0, 1, 2, 3, 0] },
  D4: { nome: 'Ré com quarta', apelidos: 'também escrito Dsus4',      casas: [-1, -1, 0, 2, 3, 3], dedos: [0, 0, 0, 1, 3, 4] },
  E4: { nome: 'Mi com quarta', apelidos: 'também escrito Esus4',      casas: [0, 2, 2, 2, 0, 0],   dedos: [0, 2, 3, 4, 0, 0] },

  // ---------- com baixo trocado (inversões) ----------
  'D/F#': { nome: 'Ré com baixo em Fá sustenido', casas: [2, -1, 0, 2, 3, 2], dedos: [1, 0, 0, 2, 4, 3] },
  'C/E':  { nome: 'Dó com baixo em Mi',  casas: [0, 3, 2, 0, 1, 0],  dedos: [0, 3, 2, 0, 1, 0] },
  'G/B':  { nome: 'Sol com baixo em Si', casas: [-1, 2, 0, 0, 0, 3], dedos: [0, 1, 0, 0, 0, 3] },
  'E/G#': { nome: 'Mi com baixo em Sol sustenido', casas: [4, -1, 2, 1, 0, 0], dedos: [4, 0, 2, 1, 0, 0] },
};

export const GRUPOS = [
  { id: 'primeiros', nome: 'Primeiros acordes', dica: 'Os oito acordes que abrem a maioria dos louvores.', acordes: ['C', 'D', 'E', 'G', 'A', 'Am', 'Em', 'Dm'] },
  { id: 'setima', nome: 'Com sétima', dica: 'Dão tensão e "puxam" para o próximo acorde.', acordes: ['A7', 'B7', 'C7', 'D7', 'E7', 'G7', 'Am7', 'Em7', 'Dm7', 'Bm7', 'C7M', 'F7M'] },
  { id: 'pestana', nome: 'Com pestana', dica: 'O dedo 1 deita e prende várias cordas. Pede força: vá com calma.', acordes: ['F', 'Bm', 'F#m', 'C#m', 'G#m', 'B', 'Bb', 'Gm', 'Cm'] },
  { id: 'suspensos', nome: 'Com nona e quarta', dica: 'Muito usados em louvor para dar aquele som "aberto".', acordes: ['A9', 'D9', 'C9', 'A4', 'D4', 'E4'] },
  { id: 'baixo', nome: 'Com baixo trocado', dica: 'O acorde é o mesmo, só a nota mais grave muda.', acordes: ['D/F#', 'C/E', 'G/B', 'E/G#'] },
];

// Campo harmônico maior: os 6 acordes que mais aparecem em cada tom
export const TONS = [
  { id: 'G', nome: 'Sol', acordes: ['G', 'Am', 'Bm', 'C', 'D', 'Em'] },
  { id: 'D', nome: 'Ré',  acordes: ['D', 'Em', 'F#m', 'G', 'A', 'Bm'] },
  { id: 'C', nome: 'Dó',  acordes: ['C', 'Dm', 'Em', 'F', 'G', 'Am'] },
  { id: 'A', nome: 'Lá',  acordes: ['A', 'Bm', 'C#m', 'D', 'E', 'F#m'] },
  { id: 'E', nome: 'Mi',  acordes: ['E', 'F#m', 'G#m', 'A', 'B', 'C#m'] },
  { id: 'F', nome: 'Fá',  acordes: ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm'] },
];
export const GRAUS = ['I', 'ii', 'iii', 'IV', 'V', 'vi'];
export const FUNCAO_GRAU = ['casa (tônica)', 'menor', 'menor', 'prepara', 'tensão, volta pra casa', 'menor relativo'];

export const NOMES_CORDAS = ['Mi', 'Lá', 'Ré', 'Sol', 'Si', 'Mi']; // da 6ª para a 1ª

export function acorde(simbolo) {
  const a = ACORDES[simbolo];
  return a ? { simbolo, ...a } : null;
}

// Dicas automáticas a partir do desenho
export function dicas(a) {
  const lista = [];
  const caladas = a.casas.map((c, i) => (c < 0 ? 6 - i : null)).filter(Boolean);
  const soltas = a.casas.map((c, i) => (c === 0 ? 6 - i : null)).filter(Boolean);
  if (a.pestana) {
    const { casa, de, ate } = a.pestana;
    lista.push(de - ate >= 5
      ? `Pestana: dedo 1 deitado na ${casa}ª casa, prendendo todas as cordas.`
      : `Pestana: dedo 1 deitado na ${casa}ª casa, da ${de}ª até a ${ate}ª corda.`);
  }
  if (caladas.length) {
    lista.push(caladas.length === 1
      ? `Não toque a ${caladas[0]}ª corda.`
      : `Não toque as cordas ${juntar(caladas.sort((x, y) => y - x).map((c) => `${c}ª`))}.`);
  }
  if (soltas.length) {
    lista.push(soltas.length === 1
      ? `A ${soltas[0]}ª corda soa solta: nenhum dedo encostando nela.`
      : `As cordas ${juntar(soltas.sort((x, y) => y - x).map((c) => `${c}ª`))} soam soltas: nenhum dedo encostando nelas.`);
  }
  const baixo = a.casas.findIndex((c) => c >= 0);
  if (baixo > 0) lista.push(`Comece a batida pela ${6 - baixo}ª corda.`);
  return lista;
}

function juntar(itens) {
  return itens.length < 2 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
}
