// Treinos práticos de cada tema (pedido do usuário: exercício é para TOCAR, não para escrever teoria).
// Cada treino: objetivo, como fazer, metrônomo (começo → meta) e uma grade de 7 dias para marcar.
import * as D from './diagramas.mjs';

const DIAS = ['1º dia', '2º', '3º', '4º', '5º', '6º', '7º'];
export const ficha = []; // para a página "Meu progresso"

function treino({ tema, n, titulo, tempo, objetivo, fig = '', passos, bpm = null, marcar = 'check', certo }) {
  ficha.push({ tema, n, titulo, bpm });
  const grade = marcar === 'bpm' || marcar === 'num'
    ? `<div class="tr-dias bpm">${DIAS.map((d) => `<span><small>${d}</small><i></i></span>`).join('')}<em>${marcar === 'num' ? 'anote quantas trocas limpas fez' : 'anote o BPM em que tocou sem errar'}</em></div>`
    : `<div class="tr-dias">${DIAS.map((d) => `<span><small>${d}</small><i></i></span>`).join('')}<em>marque cada dia que treinou</em></div>`;
  return `
  <div class="treino">
    <div class="tr-cab">
      <span class="tr-n">Treino ${n}</span>
      <h4>${titulo}</h4>
      <span class="tr-tempo">${tempo}</span>
    </div>
    <p class="tr-obj"><b>Para quê:</b> ${objetivo}</p>
    ${fig}
    <ol class="passos">${passos.map((p) => `<li>${p}</li>`).join('')}</ol>
    ${bpm ? `<p class="tr-bpm"><span>Metrônomo</span> começa em <b>${bpm[0]} BPM</b> · meta <b>${bpm[1]} BPM</b></p>` : ''}
    ${certo ? `<p class="tr-certo"><span>Está certo quando</span> ${certo}</p>` : ''}
    ${grade}
  </div>`;
}
const f = (svg, leg = '', cls = '') => `<figure class="fig ${cls}">${svg}${leg ? `<figcaption>${leg}</figcaption>` : ''}</figure>`;
const ac = (rot, a) => `<figure class="acorde"><figcaption><b>${rot}</b></figcaption>${D.acorde(a)}</figure>`;
const grade = (l) => `<div class="grade-acordes">${l.join('')}</div>`;

// acordes usados nos treinos
const C = { casas: ['x', 3, 2, 0, 1, 0], dedos: ['', 3, 2, '', 1, ''] };
const G = { casas: [3, 2, 0, 0, 0, 3], dedos: [2, 1, '', '', '', 3] };
const Em = { casas: [0, 2, 2, 0, 0, 0], dedos: ['', 2, 3, '', '', ''] };
const Am = { casas: ['x', 0, 2, 2, 1, 0], dedos: ['', '', 2, 3, 1, ''] };
const Dd = { casas: ['x', 'x', 0, 2, 3, 2], dedos: ['', '', '', 1, 3, 2] };

// notas naturais da 6ª e da 5ª corda
const nat6 = [0, 1, 3, 5, 7, 8, 10, 12].map((c) => ({ corda: 6, casa: c, txt: D.nota(6, c), cor: 'tinta' }));
const nat5 = [0, 2, 3, 5, 7, 8, 10, 12].map((c) => ({ corda: 5, casa: c, txt: D.nota(5, c), cor: 'tinta' }));
const sus6 = [2, 4, 6, 9, 11].map((c) => ({ corda: 6, casa: c, txt: D.nota(6, c), cor: 'ouro' }));
const aranha = [];
for (let corda = 6; corda >= 1; corda--) for (let c = 1; c <= 4; c++) aranha.push({ corda, casa: c, txt: c, cor: c === 1 ? 'ouro' : 'tinta' });
const aranha5 = [];
for (let corda = 6; corda >= 1; corda--) for (let c = 5; c <= 8; c++) aranha5.push({ corda, casa: c, txt: c - 4, cor: c === 5 ? 'ouro' : 'tinta' });
// escalas em posição aberta, com o grau em cada nota
const escC = [[5, 3, 1], [4, 0, 2], [4, 2, 3], [4, 3, 4], [3, 0, 5], [3, 2, 6], [2, 0, 7], [2, 1, 1]].map(([corda, casa, g]) => ({ corda, casa, txt: g, cor: g === 1 ? 'ouro' : 'tinta' }));
const escG = [[6, 3, 1], [5, 0, 2], [5, 2, 3], [5, 3, 4], [4, 0, 5], [4, 2, 6], [4, 4, 7], [3, 0, 1]].map(([corda, casa, g]) => ({ corda, casa, txt: g, cor: g === 1 ? 'ouro' : 'tinta' }));

export const TREINOS = {
  1: [
    treino({ tema: 1, n: 1, titulo: 'Afinar e dizer o nome das cordas', tempo: '5 min', objetivo: 'começar todo estudo com o violão afinado e decorar as cordas tocando, não lendo.',
      fig: '<img class="foto media" src="fotos/afinar.jpg" alt="">',
      passos: ['Abra o Afinador do app e afine as 6 cordas, da 6ª para a 1ª.', 'Toque cada corda solta <b>4 vezes</b> dizendo o nome em voz alta: "Mi, Mi, Mi, Mi… Lá, Lá, Lá, Lá…".', 'Agora faça de trás para frente, da 1ª para a 6ª.', 'Desafio: alguém fala um nome ("Sol!") e você toca a corda sem olhar.'],
      certo: 'você toca qualquer corda que alguém pedir sem precisar pensar.' }),
    treino({ tema: 1, n: 2, titulo: 'Cordas soltas no pulso', tempo: '5 min', objetivo: 'acostumar a mão direita a tocar uma corda de cada vez, no tempo do metrônomo.',
      passos: ['Metrônomo em 60 BPM.', 'Toque a <b>6ª corda solta</b> uma vez a cada clique, 4 cliques. Passe para a 5ª, depois 4ª… até a 1ª.', 'Volte da 1ª para a 6ª, sem parar o metrônomo.', 'Quando sair sem errar 2 vezes seguidas, suba 10 BPM.'],
      bpm: [60, 100], marcar: 'bpm', certo: 'você troca de corda exatamente no clique, sem atrasar.' }),
    treino({ tema: 1, n: 3, titulo: 'Caminhada das casas', tempo: '5 min', objetivo: 'apertar a corda no lugar certo (logo atrás do traste) e ouvir a nota limpa.',
      passos: ['Use só o dedo 1. Na <b>1ª corda</b>, toque a casa 0, 1, 2, 3… até a 12, uma por clique, a 60 BPM.', 'Em cada casa, aperte logo atrás do traste. Se chiar, aproxime o dedo do traste antes de apertar mais forte.', 'Volte da 12 até a 0.', 'Repita na 6ª corda.'],
      bpm: [60, 80], marcar: 'bpm', certo: 'nenhuma nota chia e a casa 12 soa igual à corda solta, só que mais aguda.' }),
    treino({ tema: 1, n: 4, titulo: 'Conferir a postura', tempo: '2 min', objetivo: 'evitar dor e vícios desde o primeiro dia.',
      passos: ['Grave um vídeo curto de você tocando (celular apoiado, de frente).', 'Confira: costas retas? violão na perna direita? polegar atrás do braço? pulso sem dobrar forte? dedos apertando com a ponta?', 'Corrija o que estiver diferente da foto da página da postura e grave de novo.'],
      certo: 'o vídeo bate com os cinco pontos da postura.' }),
  ],
  2: [
    treino({ tema: 2, n: 1, titulo: 'Batida 1 contando em voz alta', tempo: '5 min', objetivo: 'sentir o pulso e manter a mão direita no tempo.',
      fig: grade([ac('Em', Em)]) + f(D.batida('BcBcBcBc')),
      passos: ['Monte o acorde de Em (o mais fácil: dois dedos).', 'Metrônomo em 60 BPM. Conte alto "1, 2, 3, 4" junto com os cliques.', 'Toque para baixo em cada número; a mão sobe no ar entre eles.', 'Toque 4 compassos seguidos sem parar. Conseguiu? Suba 5 BPM.'],
      bpm: [60, 90], marcar: 'bpm', certo: 'a batida cai junto com o clique; você não ouve o clique "sozinho".' }),
    treino({ tema: 2, n: 2, titulo: 'Batida 2: baixo, baixo-cima', tempo: '5 min', objetivo: 'começar a usar a subida da mão.',
      fig: f(D.batida('BcBCBcBC')),
      passos: ['Em Em, a 60 BPM, conte "1, 2 e, 3, 4 e".', 'A mão não para: desce em todo número, sobe em todo "e". Só encosta nas cordas onde a seta é cheia.', '4 compassos sem errar → suba 5 BPM.'],
      bpm: [60, 85], marcar: 'bpm', certo: 'a subida soa mais fraquinha que a descida e cai bem no meio entre dois cliques.' }),
    treino({ tema: 2, n: 3, titulo: 'Batida 3, a "pop"', tempo: '8 min', objetivo: 'dominar a batida mais usada em louvor.',
      fig: f(D.batida('BcBCbCBC')),
      passos: ['Primeiro <b>sem violão</b>: bata na perna falando "baixo, baixo-cima, (ar)-cima-baixo-cima", 10 vezes.', 'No violão, só com as cordas abafadas (mão esquerda encostada sem apertar), a 55 BPM.', 'Agora com Em. Cuidado no tempo 3: a mão <b>desce no ar</b>, não para.', '4 compassos limpos → suba 5 BPM.'],
      bpm: [55, 80], marcar: 'bpm', certo: 'você toca 8 compassos seguidos sem pensar na batida.' }),
    treino({ tema: 2, n: 4, titulo: 'Trocar de acorde no tempo 1', tempo: '5 min', objetivo: 'trocar de acorde sem deixar o ritmo cair.',
      fig: grade([ac('Em', Em), ac('C', C), ac('G', G), ac('D', Dd)]),
      passos: ['Batida 1, 60 BPM. Toque <b>Em</b> por 2 compassos e <b>C</b> por 2 compassos, várias vezes.', 'Comece a trocar no "4": a mão esquerda já vai para o acorde seguinte enquanto a direita termina.', 'Quando estiver firme, faça G (2 compassos) → D (2 compassos).', 'Depois troque a cada 1 compasso.'],
      bpm: [60, 80], marcar: 'bpm', certo: 'o primeiro toque do acorde novo cai exatamente no clique do tempo 1.' }),
    treino({ tema: 2, n: 5, titulo: 'Tocar junto com um louvor', tempo: '5 min', objetivo: 'usar o ritmo numa música de verdade.',
      passos: ['No app, abra um louvor da biblioteca (em Cifras) e veja o BPM dele.', 'Coloque o metrônomo nesse BPM e toque só a batida 1 com o primeiro acorde, para sentir a velocidade.', 'Toque a música inteira com a batida 1, mesmo que as trocas saiam atrasadas no começo.'],
      certo: 'você termina a música junto com a gravação.' }),
  ],
  3: [
    treino({ tema: 3, n: 1, titulo: 'Notas naturais na 6ª corda', tempo: '5 min', objetivo: 'achar as notas naturais da corda que dá nome aos acordes com pestana.',
      fig: f(D.braco({ ate: 12, marcas: nat6, notasSoltas: true, rotuloCordas: 'num' })),
      passos: ['Toque as casas marcadas da 6ª corda, da solta até a 12, falando o nome de cada nota.', 'Repare nas casas 0→1 (Mi→Fá): só uma casa de distância.', 'Agora de trás para frente.', 'Depois, alguém fala uma nota e você acha a casa.'],
      bpm: [60, 90], marcar: 'bpm', certo: 'você acha qualquer nota natural da 6ª corda em menos de 3 segundos.' }),
    treino({ tema: 3, n: 2, titulo: 'Notas naturais na 5ª corda', tempo: '5 min', objetivo: 'a outra corda que dá nome aos acordes.',
      fig: f(D.braco({ ate: 12, marcas: nat5, notasSoltas: true, rotuloCordas: 'num' })),
      passos: ['Mesma coisa do treino 1, agora na 5ª corda (começa em Lá).', 'Repare nas casas 2→3 (Si→Dó): uma casa só.', 'Alterne: uma nota na 6ª, a mesma nota na 5ª (ex.: Dó na casa 8 da 6ª e na casa 3 da 5ª).'],
      bpm: [60, 90], marcar: 'bpm', certo: 'você acha cada nota nas duas cordas.' }),
    treino({ tema: 3, n: 3, titulo: 'Tom e semitom no ouvido', tempo: '3 min', objetivo: 'ouvir a diferença entre meio tom e um tom.',
      passos: ['Na 6ª corda toque casa 0 e casa 1 (Mi→Fá): é <b>meio tom</b>, soa "grudado".', 'Agora casa 1 e casa 3 (Fá→Sol): é <b>um tom</b>, soa mais aberto.', 'Feche os olhos e peça para alguém tocar um dos dois. Diga se foi tom ou semitom.'],
      certo: 'você acerta 8 de 10 vezes.' }),
    treino({ tema: 3, n: 4, titulo: 'Caça aos sustenidos', tempo: '3 min', objetivo: 'saber onde ficam as notas com #.',
      fig: f(D.braco({ ate: 12, marcas: sus6, notasSoltas: true, rotuloCordas: 'num' })),
      passos: ['Na 6ª corda, toque só as casas douradas, falando o nome: Fá#, Sol#, Lá#, Dó#, Ré#.', 'Repare que cada # fica entre duas naturais, e que não há nada entre Mi–Fá e Si–Dó.', 'No app: <b>Exercícios › Notas no braço</b>, 2 minutos. Anote quantas acertou.'],
      certo: 'você não precisa contar casas para achar um sustenido.' }),
  ],
  4: [
    treino({ tema: 4, n: 1, titulo: 'Aranha 1-2-3-4 (casas 1 a 4)', tempo: '5 min', objetivo: 'força, precisão e independência dos quatro dedos.',
      fig: f(D.braco({ ate: 5, w: 520, marcas: aranha })),
      passos: ['Um dedo por casa: dedo 1 na casa 1, dedo 2 na 2, dedo 3 na 3, dedo 4 na 4.', 'Comece na 6ª corda: 1-2-3-4. Passe para a 5ª: 1-2-3-4. Até a 1ª corda.', 'Volte: 4-3-2-1 da 1ª até a 6ª.', 'Uma nota por clique. 2 vezes sem errar → suba 5 BPM.'],
      bpm: [60, 100], marcar: 'bpm', certo: 'todas as notas soam do mesmo volume e nenhuma chia.' }),
    treino({ tema: 4, n: 2, titulo: 'Aranha mais à frente (casas 5 a 8)', tempo: '4 min', objetivo: 'o mesmo exercício com casas menores, mais confortável para a mão.',
      fig: f(D.braco({ ate: 9, w: 600, marcas: aranha5 })),
      passos: ['Dedo 1 na casa 5. Faça o 1-2-3-4 em todas as cordas, subindo e descendo.', 'Ao terminar, desça uma casa (dedo 1 na casa 4) e repita. Continue descendo até a casa 1.'],
      bpm: [60, 100], marcar: 'bpm', certo: 'você chega à casa 1 sem cansar a mão.' }),
    treino({ tema: 4, n: 3, titulo: 'Deixar o dedo apertado', tempo: '3 min', objetivo: 'independência: um dedo se mexe e os outros ficam no lugar.',
      passos: ['Na 6ª corda: aperte o dedo 1. Ao tocar o 2, <b>mantenha o 1 apertado</b>. Ao tocar o 3, mantenha 1 e 2. Ao tocar o 4, os quatro estão apertados.', 'Passe para a 5ª corda levantando um dedo de cada vez.', 'Devagar: 50 BPM é suficiente.'],
      bpm: [50, 70], marcar: 'bpm', certo: 'os dedos levantam só o necessário, perto das cordas.' }),
    treino({ tema: 4, n: 4, titulo: 'Variações da aranha', tempo: '4 min', objetivo: 'quebrar o "piloto automático" dos dedos.',
      passos: ['Faça a aranha nas ordens: <b>1-3-2-4</b>, depois <b>1-2-4-3</b>, depois <b>1-4-2-3</b>.', 'Uma ordem por dia, em todas as cordas, subindo e descendo.'],
      bpm: [50, 80], marcar: 'bpm', certo: 'a variação sai no mesmo BPM do 1-2-3-4.' }),
    treino({ tema: 4, n: 5, titulo: 'Duas notas por clique', tempo: '3 min', objetivo: 'ganhar velocidade de verdade sem correr.',
      passos: ['Volte ao 1-2-3-4 nas casas 1 a 4, metrônomo no BPM mais baixo que você usou no treino 1.', 'Agora toque <b>duas notas por clique</b> (conte "1 e 2 e").', 'Só suba o BPM quando estiver tão limpo quanto com uma nota por clique.'],
      bpm: [50, 80], marcar: 'bpm', certo: 'as notas ficam iguaizinhas, como um relógio.' }),
  ],
  5: [
    treino({ tema: 5, n: 1, titulo: 'Montar e conferir cada acorde', tempo: '8 min', objetivo: 'cada acorde soar limpo antes de pensar em ritmo.',
      fig: grade([ac('E', { casas: [0, 2, 2, 1, 0, 0], dedos: ['', 2, 3, 1, '', ''] }), ac('Em', Em), ac('A', { casas: ['x', 0, 2, 2, 2, 0], dedos: ['', '', 1, 2, 3, ''] }), ac('Am', Am), ac('D', Dd), ac('C', C), ac('G', G)]),
      passos: ['Monte o acorde olhando o desenho.', 'Toque <b>corda por corda</b>, da mais grossa para a mais fina. Alguma não soou ou chiou? Ajuste o dedo (mais em pé, mais perto do traste).', 'Solte a mão, sacuda, e monte de novo sem olhar. Repita 5 vezes.', 'Marque na grade o dia em que o acorde saiu limpo de primeira.'],
      certo: 'você monta o acorde sem olhar e todas as cordas soam.' }),
    treino({ tema: 5, n: 2, titulo: 'Troca de 1 minuto', tempo: '5 min', objetivo: 'trocar de acorde rápido, o maior desafio de quem começa.',
      passos: ['Escolha um par: <b>Em↔C</b>, <b>G↔D</b>, <b>Am↔E</b>, <b>C↔G</b> ou <b>D↔A</b>.', 'Marque 1 minuto no celular. Toque um acorde (uma batida para baixo), troque, toque o outro… Conte quantas trocas limpas fez.', 'Anote o número. Amanhã, tente bater o seu recorde.'],
      marcar: 'num', certo: 'você passa de 30 trocas por minuto (meta de quem já toca louvor com tranquilidade).' }),
    treino({ tema: 5, n: 3, titulo: 'Maior e menor, lado a lado', tempo: '3 min', objetivo: 'mover só o dedo que muda e treinar o ouvido.',
      passos: ['Batida 1, 60 BPM: <b>E</b> (1 compasso) → <b>Em</b> (1 compasso), várias vezes. Mexa só o dedo que sai.', 'Faça o mesmo com <b>A → Am</b> e <b>D → Dm</b>.', 'Feche os olhos: peça para alguém tocar um dos dois e diga se é maior ou menor.'],
      bpm: [60, 80], marcar: 'bpm', certo: 'você reconhece maior e menor só pelo som.' }),
    treino({ tema: 5, n: 4, titulo: 'Pestana sem sofrimento', tempo: '5 min', objetivo: 'construir força e jeito para a pestana aos poucos.',
      passos: ['Comece pela <b>casa 5</b> (é mais fácil que a casa 1): deite o dedo 1 sobre as 6 cordas, logo atrás do traste.', 'Toque corda por corda. Gire o dedo um pouquinho para o lado do polegar até todas soarem.', 'Agora monte o molde de E completo na casa 5 (é um <b>A</b>). Toque 4 vezes, solte a mão, descanse.', 'A cada dia, desça uma casa: 5, 4, 3, 2… até chegar ao <b>F</b> na casa 1.'],
      certo: 'o F soa com as 6 cordas sem a mão doer.' }),
    treino({ tema: 5, n: 5, titulo: 'Um acorde, três lugares', tempo: '3 min', objetivo: 'ver na prática que o mesmo acorde mora em várias partes do braço.',
      fig: grade([ac('G aberto', G), ac('G na 3ª', { casas: [3, 5, 5, 4, 3, 3], dedos: ['', 3, 4, 2, '', ''], pestana: { casa: 3, de: 6, ate: 1, dedo: 1 }, inicio: 3 }), ac('G na 10ª', { casas: ['x', 10, 12, 12, 12, 10], dedos: ['', '', 2, 3, 4, ''], pestana: { casa: 10, de: 5, ate: 1, dedo: 1 }, inicio: 10 })]),
      passos: ['Batida 1, 60 BPM: G aberto (1 compasso) → G na 3ª casa (1 compasso) → G na 10ª (1 compasso).', 'Ouça: é o mesmo acorde, cada um com um "brilho" diferente.'],
      certo: 'você troca entre os três sem parar a batida.' }),
  ],
  6: [
    treino({ tema: 6, n: 1, titulo: 'Escala de Dó cantando os graus', tempo: '5 min', objetivo: 'sentir no ouvido e nos dedos o que é grau.',
      fig: f(D.braco({ ate: 4, w: 460, marcas: escC, notasSoltas: true }), 'Escala de Dó maior na região das primeiras casas. O número é o grau; o grau 1 está em dourado.'),
      passos: ['Toque as notas na ordem dos graus, 1 a 8, uma por clique, cantando o número: "um, dois, três…".', 'Desça de 8 até 1.', 'Toque só 1 – 3 – 5 – 8 (os graus do acorde de C) e depois o acorde de C: perceba que são as mesmas notas.'],
      bpm: [60, 90], marcar: 'bpm', certo: 'você canta o grau certo sem olhar o desenho.' }),
    treino({ tema: 6, n: 2, titulo: 'Escala de Sol cantando os graus', tempo: '5 min', objetivo: 'ver que a receita é a mesma em outro tom.',
      fig: f(D.braco({ ate: 4, w: 460, marcas: escG, notasSoltas: true }), 'Escala de Sol maior. O grau 7 é Fá# (casa 4 da 4ª corda).'),
      passos: ['Mesmo exercício do treino 1, agora a partir do Sol (6ª corda, casa 3).', 'Repare que o grau 4 do tom de Sol é o <b>Dó</b>.'],
      bpm: [60, 90], marcar: 'bpm', certo: 'você canta "um" no Sol e "quatro" no Dó sem hesitar.' }),
    treino({ tema: 6, n: 3, titulo: 'A mesma sequência em três tons', tempo: '6 min', objetivo: 'tocar pensando em graus, não em letras.',
      passos: ['Batida 1 ou 3, 70 BPM. Toque <b>1 – 5 – 6m – 4</b> em C: <b>C G Am F</b> (se o F ainda for difícil, use só os dedos nas 4 cordas finas).', 'Agora em G: <b>G D Em C</b>.', 'Agora em D: <b>D A Bm G</b>.', 'Fale os graus em voz alta enquanto toca: "um, cinco, seis menor, quatro".'],
      bpm: [60, 80], marcar: 'bpm', certo: 'você muda de tom sem precisar olhar a tabela.' }),
    treino({ tema: 6, n: 4, titulo: 'Descobrir o tom de um louvor', tempo: '5 min', objetivo: 'usar o ouvido para achar o grau 1.',
      passos: ['Escolha um louvor que você conhece bem e cante o final dele.', 'Procure no violão o acorde que soa como "casa" nesse final (tente G, D, A, E, C).', 'Confira na cifra do app se o tom bate. Anote o louvor e o tom.'],
      certo: 'você acerta o tom de 3 louvores sem olhar a cifra.' }),
  ],
  7: [
    treino({ tema: 7, n: 1, titulo: 'Campo de Sol subindo e descendo', tempo: '5 min', objetivo: 'gravar no ouvido e nos dedos os acordes da família de Sol.',
      fig: grade([ac('G · 1', G), ac('Am · 2m', Am), ac('Bm · 3m', { casas: ['x', 2, 4, 4, 3, 2], dedos: ['', '', 3, 4, 2, ''], pestana: { casa: 2, de: 5, ate: 1, dedo: 1 }, inicio: 2 }), ac('C · 4', C), ac('D · 5', Dd), ac('Em · 6m', Em)]),
      passos: ['Batida 1, 60 BPM, 1 compasso por acorde: G Am Bm C D Em, e de volta.', 'Fale o grau de cada um ao trocar.', 'Bm com pestana ainda difícil? Toque só as 4 cordas finas (x x 4 4 3 2).'],
      bpm: [60, 80], marcar: 'bpm', certo: 'você toca o campo inteiro sem parar a batida.' }),
    treino({ tema: 7, n: 2, titulo: 'Sequências de louvor em Sol', tempo: '8 min', objetivo: 'treinar as combinações que mais aparecem nas músicas.',
      passos: ['Batida 3, 70 BPM, 1 acorde por compasso. Toque cada sequência 4 vezes:', '<b>G D Em C</b> (1–5–6m–4)', '<b>G C D</b> (1–4–5)', '<b>Em C G D</b> (6m–4–1–5)', '<b>G Em C D</b> (1–6m–4–5)'],
      bpm: [60, 90], marcar: 'bpm', certo: 'você reconhece alguma dessas sequências em louvores que já conhece.' }),
    treino({ tema: 7, n: 3, titulo: 'As mesmas sequências em Ré', tempo: '6 min', objetivo: 'levar o campo para outro tom.',
      passos: ['Campo de Ré: D Em F#m G A Bm.', 'Toque <b>D A Bm G</b>, <b>D G A</b>, <b>Bm G D A</b> e <b>D Bm G A</b>, batida 3, 70 BPM.', 'F#m e Bm com pestana: use a versão nas 4 cordas finas enquanto a pestana não estiver firme.'],
      bpm: [60, 85], marcar: 'bpm', certo: 'você troca de tom e as sequências continuam soando "iguais", só mais agudas ou graves.' }),
    treino({ tema: 7, n: 4, titulo: 'Sentir a relativa menor', tempo: '3 min', objetivo: 'ouvir que o mesmo grupo de acordes pode ter outra "casa".',
      passos: ['Toque C F G C várias vezes: a "casa" é C.', 'Agora Am Dm Em Am: a mesma família de acordes (campo de Dó), mas a casa virou Am.', 'Faça o mesmo com G C D G e depois Em Am Bm Em.'],
      certo: 'você sente onde a música repousa em cada caso.' }),
    treino({ tema: 7, n: 5, titulo: 'Tocar um louvor inteiro pelos graus', tempo: '10 min', objetivo: 'juntar tudo numa música de verdade.',
      passos: ['Abra um louvor da biblioteca do app. Descubra o tom (Tema 6).', 'Escreva em cima de cada acorde da cifra o grau (1, 4, 5, 6m…).', 'Toque a música com a batida 3 no BPM da gravação.', 'Desafio: mude o tom no app e toque de novo, lendo pelos graus.'],
      certo: 'você toca a música em dois tons diferentes.' }),
  ],
};
