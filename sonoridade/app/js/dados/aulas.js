// Aulas em vídeo, organizadas em trilhas (cada trilha vira uma fileira na tela).
// PROVISÓRIO: vídeos públicos do canal Cifra Club no YouTube, só para montar a tela.
// Depois entram as aulas gravadas pelo Evaldo (trocar `yt` pelo vídeo dele e `fonte` por 'Evaldo').
//
// instrumento: 'violao' | 'guitarra' | 'baixo' | 'todos' (teoria que serve para qualquer um)
// nivel: 1 começando, 2 já toca, 3 avançando · dur em segundos

const CC = 'Cifra Club';

export const INSTRUMENTOS = [
  { id: 'todos', nome: 'Todos' },
  { id: 'violao', nome: 'Violão' },
  { id: 'guitarra', nome: 'Guitarra' },
  { id: 'baixo', nome: 'Baixo' },
];

export const NIVEIS = { 1: 'Começando', 2: 'Já toco', 3: 'Avançando' };

export const TRILHAS = [
  {
    id: 'primeiros-passos',
    nome: 'Primeiros passos no violão',
    aulas: [
      { yt: '2Rsz3JEbw0Y', titulo: 'Tocando sua primeira música', dur: 1078, nivel: 1, instrumento: 'violao', resumo: 'Do zero até a primeira música inteira: postura, os primeiros acordes e uma batida simples.' },
      { yt: 'z05FR41ffJQ', titulo: 'Como fazer pestana', dur: 850, nivel: 1, instrumento: 'violao', resumo: 'Posição do dedo, do polegar e do punho para a pestana soar limpa sem machucar.' },
      { yt: 'KxccnRoY5Ms', titulo: 'Quando começar a treinar pestana', dur: 169, nivel: 1, instrumento: 'violao', resumo: 'O momento certo de encarar a pestana e como encaixar no seu treino.' },
      { yt: '30UHVjYNZ-4', titulo: 'Dor no punho na pestana: o que fazer', dur: 228, nivel: 1, instrumento: 'violao', resumo: 'Por que dói, o que ajustar na postura e quando parar para descansar.' },
      { yt: 'u5zSZ4TJk4Y', titulo: 'Tocar sem ficar preso na cifra', dur: 210, nivel: 2, instrumento: 'violao', resumo: 'Como sair da dependência da cifra e começar a tocar de ouvido.' },
      { yt: 'GMhpxB4ccEg', titulo: 'Como descobrir o tom de uma música', dur: 125, nivel: 2, instrumento: 'todos', resumo: 'Um jeito prático de achar o tom ouvindo a música.' },
    ],
  },
  {
    id: 'louvores',
    nome: 'Louvores para tocar no violão',
    aulas: [
      { yt: 'l13CUCWPYYI', titulo: 'Só Tu És Santo (Morada)', dur: 387, nivel: 1, instrumento: 'violao', resumo: 'Versão simplificada, com poucos acordes e batida de adoração.' },
      { yt: 'FAjKrynKKgQ', titulo: 'Vim Para Adorar-Te', dur: 347, nivel: 1, instrumento: 'violao', resumo: 'Versão simplificada de um clássico de adoração.' },
      { yt: 'GczKgAda1FU', titulo: 'Consagração (Aline Barros)', dur: 346, nivel: 1, instrumento: 'violao', resumo: 'Versão simplificada, ótima para quem está começando.' },
      { yt: '_wZHzuua6u4', titulo: 'A Ele a Glória (Diante do Trono)', dur: 348, nivel: 1, instrumento: 'violao', resumo: 'Versão simplificada com acordes do começo.' },
      { yt: 'ylQ17ZDjm1g', titulo: 'Porque Ele Vive (Harpa Cristã)', dur: 489, nivel: 1, instrumento: 'violao', resumo: 'Hino da Harpa em versão simplificada.' },
      { yt: 'DFgXeTk2hwU', titulo: 'Todavia Me Alegrarei (Leandro Soares)', dur: 489, nivel: 1, instrumento: 'violao', resumo: 'Versão simplificada.' },
      { yt: 'AxpcyNccaJw', titulo: "Aquieta Minh'alma (Ministério Zoe)", dur: 615, nivel: 2, instrumento: 'violao', resumo: 'Versão simplificada, com dedilhado.' },
      { yt: 'Hg5Tn8UHYYU', titulo: 'Pode Morar Aqui (Theo Rubia)', dur: 568, nivel: 2, instrumento: 'violao', resumo: 'Versão simplificada.' },
      { yt: '1FxzFMQ_gJ0', titulo: 'Para Onde Eu Irei? (Morada)', dur: 468, nivel: 2, instrumento: 'violao', resumo: 'Versão simplificada.' },
      { yt: 'K2PKvxXIjDY', titulo: 'Jó (Midian Lima)', dur: 740, nivel: 2, instrumento: 'violao', resumo: 'Versão simplificada.' },
      { yt: 'RCx2rFoj92g', titulo: 'Queima de Novo (Colo de Deus)', dur: 922, nivel: 2, instrumento: 'violao', resumo: 'Versão simplificada.' },
      { yt: 'vyXENUUlpIc', titulo: 'Quem É Esse (Julliany Souza)', dur: 1013, nivel: 2, instrumento: 'violao', resumo: 'Versão simplificada.' },
    ],
  },
  {
    id: 'ritmo',
    nome: 'Ritmo e dedilhado',
    aulas: [
      { yt: 'zjCNEsDlrhM', titulo: '4 ritmos que servem para muitas músicas', dur: 1322, nivel: 1, instrumento: 'violao', resumo: 'Quatro batidas básicas e em que tipo de música usar cada uma.' },
      { yt: '2A-LqrUE4tM', titulo: 'Um dedilhado para várias músicas', dur: 90, nivel: 1, instrumento: 'violao', resumo: 'Um padrão de dedilhado curto que encaixa em muita coisa.' },
      { yt: 'fjQPREpPdac', titulo: 'Isso vai melhorar o seu dedilhado', dur: 75, nivel: 2, instrumento: 'violao', resumo: 'Um exercício rápido para a mão direita.' },
      { yt: '-ZEP-WGgeLg', titulo: 'Quando começar a treinar dedilhado', dur: 158, nivel: 1, instrumento: 'violao', resumo: 'Em que ponto do estudo vale começar o dedilhado.' },
      { yt: 'IoYJqdESfps', titulo: '5 dicas e exercícios de fingerstyle', dur: 870, nivel: 3, instrumento: 'violao', resumo: 'Independência dos dedos e exercícios para tocar melodia e acompanhamento juntos.' },
      { yt: 't8Xs6XYsV2w', titulo: 'Deixe seus acordes mais bonitos', dur: 911, nivel: 2, instrumento: 'violao', resumo: 'Truques simples para fugir dos acordes de sempre.' },
    ],
  },
  {
    id: 'teoria',
    nome: 'Entendendo a música',
    aulas: [
      { yt: 'w0icVkAsQrg', titulo: 'O que é campo harmônico', dur: 152, nivel: 1, instrumento: 'todos', resumo: 'A família de acordes de cada tom, explicada em poucos minutos.' },
      { yt: 'Qh3CRTcPSg4', titulo: 'Intervalos musicais em 10 minutos', dur: 668, nivel: 2, instrumento: 'todos', resumo: 'A distância entre as notas, base para entender acordes e escalas.' },
      { yt: 'ZW7V4tma8J4', titulo: 'Formação de acordes: tríades', dur: 1945, nivel: 2, instrumento: 'todos', resumo: 'De onde vêm os acordes maiores, menores e diminutos.' },
      { yt: '3uwc8U2i4NY', titulo: 'Campo harmônico maior: tríades', dur: 1455, nivel: 2, instrumento: 'todos', resumo: 'Os acordes de cada grau da escala maior.' },
      { yt: '4oeq0q55MMM', titulo: 'Campo harmônico maior: tétrades', dur: 949, nivel: 3, instrumento: 'todos', resumo: 'Os acordes com sétima de cada grau.' },
      { yt: '_b4fLPOJNik', titulo: 'Funções harmônicas', dur: 1302, nivel: 3, instrumento: 'todos', resumo: 'Por que alguns acordes "pedem" para voltar para casa.' },
      { yt: 'nWAm88PSCHw', titulo: 'Como praticar escalas: 3 dicas', dur: 927, nivel: 2, instrumento: 'todos', resumo: 'Um jeito de estudar escala que não vira só decoreba.' },
      { yt: 'lGU-L0EKKCA', titulo: 'Escala maior natural', dur: 3690, nivel: 2, instrumento: 'todos', resumo: 'Aula longa e completa sobre a escala maior.' },
      { yt: 'eUrzhh_dHzU', titulo: 'Escala menor natural', dur: 3012, nivel: 2, instrumento: 'todos', resumo: 'Aula longa e completa sobre a escala menor.' },
    ],
  },
  {
    id: 'guitarra',
    nome: 'Guitarra',
    aulas: [
      { yt: 'XgghfgvAXMs', titulo: '5 riffs fáceis para começar', dur: 599, nivel: 1, instrumento: 'guitarra', resumo: 'Riffs curtos para soltar a mão na guitarra.' },
      { yt: 'LAcueHJkulE', titulo: 'Guitarra para iniciantes: Zombie', dur: 617, nivel: 1, instrumento: 'guitarra', resumo: 'Uma música inteira com acordes de força.' },
      { yt: 'EamGcaY-ipk', titulo: 'Aprenda as notas no braço', dur: 1083, nivel: 2, instrumento: 'guitarra', resumo: 'Um método para achar qualquer nota no braço.' },
      { yt: 'wN8tY790lxU', titulo: 'Tudo sobre a escala pentatônica', dur: 920, nivel: 2, instrumento: 'guitarra', resumo: 'Os desenhos da pentatônica e como usar em solo.' },
      { yt: 'q5SXyNsMXd0', titulo: 'Escala pentatônica na prática', dur: 1072, nivel: 2, instrumento: 'guitarra', resumo: 'Pentatônica aplicada em frases.' },
      { yt: '3wShkC4YGbk', titulo: 'CAGED em 3 níveis', dur: 1275, nivel: 3, instrumento: 'guitarra', resumo: 'O sistema CAGED para dominar o braço inteiro.' },
    ],
  },
  {
    id: 'baixo',
    nome: 'Baixo',
    aulas: [
      { yt: 'KJhmNHcl7-8', titulo: 'Tocando sua primeira música no baixo', dur: 813, nivel: 1, instrumento: 'baixo', resumo: 'Postura, mão direita e a primeira linha de baixo.' },
      { yt: 'f5ZZK-jt9mA', titulo: 'Tempo Perdido no baixo', dur: 310, nivel: 1, instrumento: 'baixo', resumo: 'Uma linha simples e marcante para treinar.' },
      { yt: 'H-LhYzMnDi0', titulo: 'Quando estudar escalas no baixo', dur: 116, nivel: 1, instrumento: 'baixo', resumo: 'Em que momento as escalas entram no estudo do baixista.' },
      { yt: 'aw6WZG3HxdA', titulo: 'Pentatônica no baixo', dur: 409, nivel: 2, instrumento: 'baixo', resumo: 'Como a pentatônica ajuda a criar linhas de baixo.' },
      { yt: 'wE_b-SeNJ2A', titulo: '7 slaps para qualquer música', dur: 955, nivel: 3, instrumento: 'baixo', resumo: 'Levadas de slap para ir além do básico.' },
    ],
  },
];

// destaque do topo
export const DESTAQUE = '2Rsz3JEbw0Y';

const TODAS = TRILHAS.flatMap((t) => t.aulas.map((a) => ({ ...a, trilha: t.id, fonte: a.fonte || CC })));
export const todasAulas = () => TODAS;
export const aula = (yt) => TODAS.find((a) => a.yt === yt) || null;
export const trilhaDe = (a) => TRILHAS.find((t) => t.id === a.trilha);

export function duracao(seg) {
  const m = Math.floor(seg / 60);
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return m ? `${m} min` : `${seg} s`;
}

export const capa = (yt) => `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
export const capaGrande = (yt) => `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`;
