// Ritmo de cada música: velocidade, batida de cada parte e quanto dura cada acorde.
//
// bpm: MEDIDO na gravação oficial (análise do áudio, 11/11/2026). Em todas, o acorde troca a cada
//      ~1 compasso de 4 tempos nessa velocidade, por isso "cpa: 1" (compassos por acorde).
// batidas: SUGESTÃO para violão, por tipo de parte. Falta o Evaldo (ou quem toca) conferir.
// conferido: vira true quando alguém que toca a música confirmar.
// yt: vídeo da gravação original (o mesmo da medição); refrao: segundo em que o refrão começa
//     nesse vídeo (achado casando a letra cantada com a cifra). O mapa de cada acorde fica em
//     dados-teste/sincronia.json, junto das cifras.
//
// Tipos de parte (o nome vem da cifra): intro, estrofe, pre, refrao, ponte, solo, final.

const LENTO = { intro: 'dedilhado', estrofe: 'adoracao', pre: 'balada', refrao: 'balada', ponte: 'balada', solo: 'adoracao', final: 'balada' };

export const RITMOS = {
  'felipe-rodrigues--tudo-e-perda': {
    bpm: 63, cpa: 1, batidas: { ...LENTO, intro: 'adoracao' },
    gravacao: 'Felipe Rodrigues, Tudo É Perda (Ao Vivo)',
    refrao: 76.4,
    yt: 'qxzQR5uwWsk',
  },
  'florianopolis-house-of-prayer--sublime': {
    bpm: 63, cpa: 1, batidas: LENTO,
    gravacao: 'fhop music, Sublime (Ao Vivo)',
    refrao: 55.4,
    yt: '7GWZwO0MdsY',
  },
  'diante-do-trono--me-ama-': {
    bpm: 51, cpa: 1, batidas: { ...LENTO, estrofe: 'dedilhado' },   // a cifra pede dedilhado na intro e na primeira parte
    gravacao: 'Diante do Trono, Me Ama (DVD Sol da Justiça)',
    refrao: 154.0,
    yt: 'lSwiHA8gymg',
  },
  'harpa-crista--porque-ele-vive': {
    bpm: 80, cpa: 1, batidas: { intro: 'dedilhado-simples', estrofe: 'balada', pre: 'balada', refrao: 'balada', ponte: 'balada', solo: 'dedilhado-simples', final: 'balada' },
    gravacao: 'Levi, Porque Ele Vive (Harpa Cristã 545)',
    refrao: 70.5,
    yt: '1hMOMBjTysE',
    aviso: 'Hino: o compasso e a troca de acorde podem variar entre as gravações.',
  },
  'ministerio-morada--e-tudo-sobre-voce': {
    bpm: 69, cpa: 1, batidas: { ...LENTO, estrofe: 'dedilhado' },   // a cifra pede dedilhado
    gravacao: 'MORADA, É Tudo Sobre Você (clipe oficial)',
    refrao: 96.5,
    yt: 'ePdRgBWhvog',
  },
  'adhemar-de-campos--grande-o-senhor': {
    bpm: 58, cpa: 1, batidas: { ...LENTO, estrofe: 'balada' },
    gravacao: 'Adhemar de Campos, Grande É o Senhor (Igreja na Rua, Ato 3)',
    refrao: 105.1,
    yt: '4_rv9Jmgc78',
    aviso: 'A medição ficou entre 58 e 117: se soar arrastado, dobre a velocidade.',
  },
  'isaias-saad--bondade-de-deus': {
    bpm: 64, cpa: 1, batidas: { intro: 'dedilhado-tres', estrofe: 'dedilhado-tres', pre: 'embalo', refrao: 'embalo', ponte: 'embalo', solo: 'dedilhado-tres', final: 'embalo' },
    gravacao: 'Isaías Saad, Bondade de Deus (Acústico)',
    refrao: 47.7,
    yt: 'b5DN9mPxMEI',
  },
  'ministerio-morada--so-tu-s-santo': {
    bpm: 62, cpa: 1, batidas: LENTO,
    gravacao: 'MORADA, Só Tu És Santo (álbum Uma Coisa)',
    refrao: 186.1,
    yt: 'REJGnZQIFnA',
  },
  'diante-do-trono--a-ele-gloria': {
    bpm: 53, cpa: 1, batidas: LENTO,
    gravacao: 'Diante do Trono, A Ele a Glória (DVD Ainda Existe Uma Cruz)',
    refrao: 28.7,
    yt: 'Ysab1-YjXu8',
    aviso: 'A medição ficou entre 53 e 105: se soar arrastado, dobre a velocidade.',
  },
};

export const ritmoDe = (id) => RITMOS[id] || null;

// "Refrão Final" → refrao; "Pré-Refrão" → pre; "Primeira Parte" → estrofe ...
export function tipoParte(nome = '') {
  const n = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/intro/.test(n)) return 'intro';
  if (/pre-?\s?refr/.test(n)) return 'pre';
  if (/refr/.test(n)) return 'refrao';
  if (/ponte/.test(n)) return 'ponte';
  if (/solo/.test(n)) return 'solo';
  if (/final/.test(n)) return 'final';
  return 'estrofe';
}
