// Batidas de violão para louvor.
// passos: B = para baixo, C = para cima, X = abafada (palma da mão abafa as cordas), - = mão passa sem tocar.
//         Dedilhado: P = polegar no baixo do acorde, 1 2 3 4 = a corda (1 = a mais fina).
// tempos = tempos por compasso; porTempo = passos dentro de cada tempo.

export const BATIDAS = [
  {
    id: 'baixo',
    nome: 'Só para baixo',
    nivel: 1,
    tempos: 4, porTempo: 1,
    passos: 'BBBB',
    dica: 'Uma batida por tempo, sempre para baixo. É por aqui que se começa.',
    bpm: 70,
  },
  {
    id: 'adoracao',
    nome: 'Adoração',
    nivel: 1,
    tempos: 4, porTempo: 2,
    passos: 'B---B---',
    dica: 'Bata no 1 e no 3 e deixe o acorde soar. Boa para louvores lentos.',
    bpm: 66,
  },
  {
    id: 'colcheias',
    nome: 'Vai e volta',
    nivel: 1,
    tempos: 4, porTempo: 2,
    passos: 'BCBCBCBC',
    dica: 'A mão desce no número e sobe no "e". Esse movimento é a base de todas as outras.',
    bpm: 70,
  },
  {
    id: 'balada',
    nome: 'Balada',
    nivel: 2,
    tempos: 4, porTempo: 2,
    passos: 'B-BC-CBC',
    dica: 'A batida mais usada em louvor. A mão continua indo e voltando, mesmo onde não toca.',
    bpm: 72,
  },
  {
    id: 'seis-oito',
    nome: '6/8 (ministração)',
    nivel: 2,
    tempos: 2, porTempo: 3,
    passos: 'BBCBBC',
    dica: 'Seis batidas por compasso, contando 1-2-3-4-5-6. Dá aquele balanço de ministração.',
    bpm: 52,
    contagem: ['1', '2', '3', '4', '5', '6'],
  },
  {
    id: 'dedilhado-simples',
    nome: 'Dedilhado simples',
    nivel: 1,
    tempos: 4, porTempo: 2,
    passos: 'P321P321',
    dica: 'Polegar no baixo do acorde e depois as cordas 3, 2 e 1, uma de cada vez. Bom para começo de louvor.',
    bpm: 63,
  },
  {
    id: 'dedilhado',
    nome: 'Dedilhado de louvor',
    nivel: 2,
    tempos: 4, porTempo: 2,
    passos: 'P3231323',
    dica: 'Polegar no baixo e o dedo indo e voltando: 3, 2, 3, 1, 3, 2, 3. O dedilhado clássico das baladas de adoração.',
    bpm: 63,
  },
  {
    id: 'embalo',
    nome: 'Embalo de três (12/8)',
    nivel: 2,
    tempos: 4, porTempo: 3,
    passos: 'B-CB-CB-CB-C',
    dica: 'Cada tempo se divide em três: desce no tempo e sobe no "três". Dá o balanço de louvores como Bondade de Deus.',
    bpm: 64,
    contagem: ['1', '', 'a', '2', '', 'a', '3', '', 'a', '4', '', 'a'],
  },
  {
    id: 'dedilhado-tres',
    nome: 'Dedilhado de três (12/8)',
    nivel: 2,
    tempos: 4, porTempo: 3,
    passos: 'P23123P23123',
    dica: 'Três notas por tempo: polegar, 2, 3, depois 1, 2, 3. O dedilhado do embalo de três.',
    bpm: 64,
    contagem: ['1', '', 'a', '2', '', 'a', '3', '', 'a', '4', '', 'a'],
  },
  {
    id: 'balada-abafada',
    nome: 'Balada com abafada',
    nivel: 3,
    tempos: 4, porTempo: 2,
    passos: 'B-XC-CXC',
    dica: 'No 2 e no 4 a palma da mão bate e abafa as cordas, fazendo o "tchá" da caixa da bateria.',
    bpm: 76,
  },
];

export const PROGRESSOES = [
  { id: 'mi-menor', nome: 'Em  C  G  D', acordes: ['Em', 'C', 'G', 'D'], nota: 'só acordes do começo' },
  { id: 'sol', nome: 'G  D  Em  C', acordes: ['G', 'D', 'Em', 'C'], nota: 'tom de Sol' },
  { id: 'la-menor', nome: 'Am  G  C  E', acordes: ['Am', 'G', 'C', 'E'], nota: 'só acordes do começo' },
  { id: 're', nome: 'D  A  Bm  G', acordes: ['D', 'A', 'Bm', 'G'], nota: 'tom de Ré, tem pestana' },
  { id: 'do', nome: 'C  G  Am  F', acordes: ['C', 'G', 'Am', 'F'], nota: 'tom de Dó, tem pestana' },
];

export function batida(id) {
  return BATIDAS.find((b) => b.id === id) || null;
}

export function contagem(b) {
  if (b.contagem) return b.contagem;
  const nomes = b.porTempo === 1 ? [''] : b.porTempo === 2 ? ['', 'e'] : ['', 'e', 'a'];
  const out = [];
  for (let t = 1; t <= b.tempos; t++) nomes.forEach((n) => out.push(n === '' ? String(t) : n));
  return out;
}

