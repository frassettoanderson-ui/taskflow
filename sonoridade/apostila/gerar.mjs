// Gera apostila.html (Método Sonoridade · Volume 1). O PDF sai do Chrome: ver gerar-pdf.ps1 / README.
// Rodar: node apostila/gerar.mjs   (de dentro de sonoridade/)
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './diagramas.mjs';
import { TREINOS, ficha } from './treinos.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
// páginas de cada tema (preenchido na 2ª passada por gerar-pdf.py)
const PAGINAS = existsSync(join(AQUI, 'paginas.json')) ? JSON.parse(readFileSync(join(AQUI, 'paginas.json'), 'utf8')) : {};

// ---------- acordes usados ----------
const A = {
  C: { casas: ['x', 3, 2, 0, 1, 0], dedos: ['', 3, 2, '', 1, ''] },
  D: { casas: ['x', 'x', 0, 2, 3, 2], dedos: ['', '', '', 1, 3, 2] },
  E: { casas: [0, 2, 2, 1, 0, 0], dedos: ['', 2, 3, 1, '', ''] },
  F: { casas: [1, 3, 3, 2, 1, 1], dedos: ['', 3, 4, 2, '', ''], pestana: { casa: 1, de: 6, ate: 1, dedo: 1 } },
  G: { casas: [3, 2, 0, 0, 0, 3], dedos: [2, 1, '', '', '', 3] },
  A: { casas: ['x', 0, 2, 2, 2, 0], dedos: ['', '', 1, 2, 3, ''] },
  B: { casas: ['x', 2, 4, 4, 4, 2], dedos: ['', '', 2, 3, 4, ''], pestana: { casa: 2, de: 5, ate: 1, dedo: 1 }, inicio: 2 },
  Cm: { casas: ['x', 3, 5, 5, 4, 3], dedos: ['', '', 3, 4, 2, ''], pestana: { casa: 3, de: 5, ate: 1, dedo: 1 }, inicio: 3 },
  Dm: { casas: ['x', 'x', 0, 2, 3, 1], dedos: ['', '', '', 2, 3, 1] },
  Em: { casas: [0, 2, 2, 0, 0, 0], dedos: ['', 2, 3, '', '', ''] },
  Fm: { casas: [1, 3, 3, 1, 1, 1], dedos: ['', 3, 4, '', '', ''], pestana: { casa: 1, de: 6, ate: 1, dedo: 1 } },
  Gm: { casas: [3, 5, 5, 3, 3, 3], dedos: ['', 3, 4, '', '', ''], pestana: { casa: 3, de: 6, ate: 1, dedo: 1 }, inicio: 3 },
  Am: { casas: ['x', 0, 2, 2, 1, 0], dedos: ['', '', 2, 3, 1, ''] },
  Bm: { casas: ['x', 2, 4, 4, 3, 2], dedos: ['', '', 3, 4, 2, ''], pestana: { casa: 2, de: 5, ate: 1, dedo: 1 }, inicio: 2 },
  'F#': { casas: [2, 4, 4, 3, 2, 2], dedos: ['', 3, 4, 2, '', ''], pestana: { casa: 2, de: 6, ate: 1, dedo: 1 }, inicio: 2 },
  'F#m': { casas: [2, 4, 4, 2, 2, 2], dedos: ['', 3, 4, '', '', ''], pestana: { casa: 2, de: 6, ate: 1, dedo: 1 }, inicio: 2 },
  'C#m': { casas: ['x', 4, 6, 6, 5, 4], dedos: ['', '', 3, 4, 2, ''], pestana: { casa: 4, de: 5, ate: 1, dedo: 1 }, inicio: 4 },
  'G#m': { casas: [4, 6, 6, 4, 4, 4], dedos: ['', 3, 4, '', '', ''], pestana: { casa: 4, de: 6, ate: 1, dedo: 1 }, inicio: 4 },
  'A#': { casas: ['x', 1, 3, 3, 3, 1], dedos: ['', '', 2, 3, 4, ''], pestana: { casa: 1, de: 5, ate: 1, dedo: 1 } },
  'G·pestana3': { casas: [3, 5, 5, 4, 3, 3], dedos: ['', 3, 4, 2, '', ''], pestana: { casa: 3, de: 6, ate: 1, dedo: 1 }, inicio: 3 },
  'G·pestana10': { casas: ['x', 10, 12, 12, 12, 10], dedos: ['', '', 2, 3, 4, ''], pestana: { casa: 10, de: 5, ate: 1, dedo: 1 }, inicio: 10 },
  'C·pestana3': { casas: ['x', 3, 5, 5, 5, 3], dedos: ['', '', 2, 3, 4, ''], pestana: { casa: 3, de: 5, ate: 1, dedo: 1 }, inicio: 3 },
  'C·pestana8': { casas: [8, 10, 10, 9, 8, 8], dedos: ['', 3, 4, 2, '', ''], pestana: { casa: 8, de: 6, ate: 1, dedo: 1 }, inicio: 8 },
};
const ac = (nome, rotulo, extra = {}) => `
  <figure class="acorde">
    <figcaption><b>${rotulo ?? nome.split('·')[0]}</b></figcaption>
    ${D.acorde({ ...A[nome], ...extra })}
  </figure>`;
const grade = (lista, cls = '') => `<div class="grade-acordes ${cls}">${lista.join('')}</div>`;

// ---------- blocos ----------
const fig = (svg, legenda, cls = '') => `<figure class="fig ${cls}">${svg}${legenda ? `<figcaption>${legenda}</figcaption>` : ''}</figure>`;
const caixa = (tipo, titulo, html) => `<aside class="caixa ${tipo}"><p class="caixa-tit">${titulo}</p>${html}</aside>`;
const ROTULO = { dica: 'Dica', atencao: 'Atenção', pratica: 'Na prática', app: 'No app Sonoridade' };
const dica = (h, tit = ROTULO.dica) => caixa('dica', tit, h);
const atencao = (h, tit = ROTULO.atencao) => caixa('atencao', tit, h);
const pratica = (h, tit = ROTULO.pratica) => caixa('pratica', tit, h);
const app = (h) => caixa('app', ROTULO.app, h);
const linhas = (n) => `<div class="linhas">${'<i></i>'.repeat(n)}</div>`;
const tabela = (cab, linhasT, cls = '') => `<table class="tab ${cls}"><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhasT.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;


// foto do violão com os nomes das partes (coordenadas em pixels da foto 1024x1536)
function violaoFoto() {
  const OX = 338, W = 1700, H = 1536;
  const P = [
    ['Mão (cabeça)', 505, 70, 'e', 60], ['Pestana (nut)', 510, 266, 'e', 240], ['Casa', 510, 301, 'e', 320], ['Braço / escala', 500, 620, 'e', 620],
    ['Boca', 432, 960, 'e', 960], ['Rastilho', 480, 1192, 'e', 1150], ['Tampo', 330, 1320, 'e', 1320],
    ['Tarraxas', 602, 78, 'd', 78], ['Trastes', 538, 352, 'd', 340], ['Marcações', 512, 401, 'd', 410], ['Cordas', 524, 800, 'd', 800],
    ['Escudo', 620, 1060, 'd', 1040], ['Cavalete', 610, 1205, 'd', 1210], ['Corpo (caixa)', 860, 1420, 'd', 1420],
  ];
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg"><image href="fotos/violao.jpg" x="${OX}" y="0" width="1024" height="1536"/>`;
  for (const [txt, x, y, lado, ly] of P) {
    const px = x + OX, tx = lado === 'e' ? 300 : 1400;
    const cot = lado === 'e' ? tx + 14 : tx - 14;
    svg += `<polyline points="${px},${y} ${lado === 'e' ? px - 40 : px + 40},${ly} ${cot},${ly}" fill="none" stroke="#b07d22" stroke-width="3"/>`;
    svg += `<circle cx="${px}" cy="${y}" r="9" fill="#b07d22" stroke="#fff" stroke-width="4"/>`;
    svg += `<text x="${lado === 'e' ? tx : tx}" y="${ly}" font-family="Archivo, sans-serif" font-weight="700" font-size="40" fill="#1d1a15" text-anchor="${lado === 'e' ? 'end' : 'start'}" dominant-baseline="middle">${txt}</text>`;
  }
  return svg + '</svg>';
}


// mão esquerda (foto espelhada) com o número de cada dedo
function maoFoto() {
  const N = [[657, 103, '1'], [810, 26, '2'], [939, 77, '3'], [1087, 205, '4'], [374, 487, 'P']];
  let svg = `<svg viewBox="150 0 1236 1024" width="100%" xmlns="http://www.w3.org/2000/svg"><image href="fotos/mao.jpg" x="0" y="0" width="1536" height="1024"/>`;
  for (const [x, y, n] of N) {
    const cy = Math.max(y - 20, 48);
    svg += `<circle cx="${x}" cy="${cy}" r="44" fill="${n === 'P' ? '#7d7464' : '#1d1a15'}" stroke="#fff" stroke-width="8"/>`;
    svg += `<text x="${x}" y="${cy + 2}" font-family="Archivo, sans-serif" font-weight="800" font-size="50" fill="${n === 'P' ? '#fff' : '#e3ad45'}" text-anchor="middle" dominant-baseline="middle">${n}</text>`;
  }
  return svg + '</svg>';
}
const foto = (nome, leg = '', cls = 'media') => `<img class="foto ${cls}" src="fotos/${nome}.jpg" alt="">${leg ? `<p class="foto-leg">${leg}</p>` : ''}`;
const duasFotos = (a, la, b, lb) => `<div class="duas-fotos"><figure><img class="foto" src="fotos/${a}.jpg" alt=""><figcaption>${la}</figcaption></figure><figure><img class="foto" src="fotos/${b}.jpg" alt=""><figcaption>${lb}</figcaption></figure></div>`;

const TEMAS = [];
function tema(num, titulo, foto, aprender, corpo, resumo) {
  TEMAS.push({ num, titulo, aprender });
  const n = String(num).padStart(2, '0');
  return `
  <section class="abertura" id="tema-${num}">
    <div class="ab-foto" style="background-image:url('${foto}')"></div>
    <div class="ab-conteudo">
      <p class="ab-rotulo">Tema</p>
      <p class="ab-num">${n}</p>
      <h1>${titulo}</h1>
      <div class="ab-fio"></div>
      <p class="ab-sub">Neste tema você vai aprender</p>
      <ul>${aprender.map((a) => `<li>${a}</li>`).join('')}</ul>
    </div>
  </section>
  <section class="tema">
    ${corpo}
    <div class="exercicios">
      <div class="ex-topo"><h2 class="ex-tit"><span>Treinos</span> Tema ${n} · ${titulo}</h2>
      <div class="resumo"><p class="caixa-tit">Antes de tocar, revise</p><ul>${resumo.map((r) => `<li>${r}</li>`).join('')}</ul></div>
      ${(TREINOS[num] || [])[0] || ''}</div>
      ${(TREINOS[num] || []).slice(1).join('')}
    </div>
  </section>`;
}

const IMG = '../app/img/inicio/';

// =====================================================================
// TEMA 1
// =====================================================================
const t1 = tema(1, 'Conhecendo o violão', IMG + 'acordes.webp',
  ['As partes do violão e para que serve cada uma', 'O nome e o número das seis cordas', 'O que são as casas e como contá-las', 'A numeração dos dedos usada em toda cifra', 'A postura certa para tocar sem dor'],
  `
  <h2>1.1 As partes do violão</h2>
  <p>Antes de tocar a primeira nota, vale conhecer o instrumento pelo nome. Nas aulas, nas cifras e nos vídeos você vai ouvir esses termos o tempo todo, e saber onde fica cada parte evita confusão.</p>
  ${fig(violaoFoto(), 'As partes do violão. Cada modelo muda um pouco o formato (e alguns não têm escudo), mas as partes são sempre as mesmas.', 'violao-foto')}
  ${tabela(['Parte', 'Para que serve'], [
    ['<b>Mão (cabeça)</b>', 'Ponta do braço onde ficam as tarraxas.'],
    ['<b>Tarraxas</b>', 'Esticam ou afrouxam cada corda. É por elas que se <b>afina</b> o violão.'],
    ['<b>Pestana (nut)</b>', 'Pecinha branca entre a mão e o braço. Apoia as cordas e marca o começo das casas.'],
    ['<b>Braço e escala</b>', 'O braço é a parte comprida; a escala é a madeira por cima dele, onde os dedos apertam as cordas.'],
    ['<b>Trastes</b>', 'As barrinhas de metal que atravessam a escala. Elas dividem o braço em casas.'],
    ['<b>Casa</b>', 'O espaço entre dois trastes. É onde o dedo aperta.'],
    ['<b>Marcações</b>', 'As bolinhas na escala (casas 3, 5, 7, 9 e 12). Servem de referência para achar as casas rápido.'],
    ['<b>Escudo</b>', 'Placa que protege o tampo das batidas da mão ou da palheta. Nem todo violão tem.'],
    ['<b>Corpo, tampo e boca</b>', 'A caixa de madeira que amplifica o som. O tampo é a madeira da frente; a boca é o furo redondo.'],
    ['<b>Cavalete e rastilho</b>', 'O cavalete prende as cordas no corpo; o rastilho é a pecinha branca em cima dele, onde as cordas apoiam.'],
  ])}
  ${atencao('<p>A palavra <b>pestana</b> tem dois sentidos no violão: é a peça do instrumento (o <i>nut</i>) e também a técnica de deitar o dedo 1 sobre várias cordas ao mesmo tempo, como no acorde de F. Pelo contexto você sempre descobre qual é. Vamos ver a técnica no Tema 5.</p>')}

  <h2>1.2 As seis cordas</h2>
  <p>O violão tem <b>seis cordas</b>. Elas são <b>numeradas de baixo para cima</b>, olhando o violão no colo: a <b>1ª corda</b> é a mais fina (som mais agudo) e fica embaixo, perto do seu joelho; a <b>6ª corda</b> é a mais grossa (som mais grave) e fica em cima, perto do seu rosto.</p>
  <p>Cada corda solta (tocada sem apertar nenhuma casa) tem o nome de uma nota. Na afinação normal, chamada de <b>afinação padrão</b>, elas são:</p>
  ${tabela(['Corda', 'Nota', 'Cifra', 'Como é'], [
    ['<b>6ª</b>', 'Mi', 'E', 'a mais grossa, grave'],
    ['<b>5ª</b>', 'Lá', 'A', ''],
    ['<b>4ª</b>', 'Ré', 'D', ''],
    ['<b>3ª</b>', 'Sol', 'G', ''],
    ['<b>2ª</b>', 'Si', 'B', ''],
    ['<b>1ª</b>', 'Mi', 'E', 'a mais fina, aguda'],
  ], 'estreita')}
  ${dica('<p>Para decorar a ordem da 6ª para a 1ª: <b>"Meu Lá Ré Sol Si Mi"</b> (Mi, Lá, Ré, Sol, Si, Mi). Repare que as duas pontas são Mi: a 6ª é um Mi grave e a 1ª é um Mi duas oitavas acima.</p>')}

  <h2>1.3 As casas</h2>
  <p>As casas são contadas <b>a partir da mão do violão</b>: a primeira casa é a que fica logo depois da pestana (nut), a segunda vem em seguida, e assim por diante, em direção ao corpo.</p>
  ${fig(D.braco({ ate: 12, marcas: [{ corda: 6, casa: 1, txt: '1' }, { corda: 5, casa: 3, txt: '3', cor: 'ouro' }, { corda: 1, casa: 5, txt: '5' }, { corda: 3, casa: 7, txt: '7', cor: 'ouro' }, { corda: 4, casa: 12, txt: '12' }] }), 'O braço deitado, visto de quem está tocando: a 6ª corda em cima e a casa 1 à esquerda, junto da pestana. As bolinhas da madeira (3, 5, 7, 9 e a dupla do 12) ajudam a se localizar.')}
  <ul class="pontos">
    <li><b>Corda solta = casa 0.</b> Tocar a corda sem apertar nada.</li>
    <li><b>Cada casa sobe meio tom.</b> Quanto mais perto do corpo, mais aguda a nota.</li>
    <li><b>Na casa 12 a nota se repete,</b> uma oitava acima da corda solta. A casa 12 fica exatamente no meio da corda e por isso tem marcação dupla.</li>
  </ul>
  ${foto('dedo-traste', 'O dedo aperta logo atrás do traste, quase encostado nele.')}
  ${pratica('<p>O dedo deve apertar <b>logo atrás do traste</b>, quase encostado nele, e não no meio da casa. Assim a nota sai limpa com menos força e sem chiado.</p>')}

  <h2>1.4 Os dedos têm número</h2>
  <div class="duas">
    <div>${fig(maoFoto(), 'Mão esquerda')}</div>
    <div>
      <p>Em toda cifra, tablatura e diagrama de acorde, os dedos da <b>mão esquerda</b> (a que aperta as cordas) aparecem como números:</p>
      ${tabela(['Nº', 'Dedo'], [['<b>1</b>', 'indicador'], ['<b>2</b>', 'médio'], ['<b>3</b>', 'anelar'], ['<b>4</b>', 'mínimo'], ['<b>P</b>', 'polegar (fica atrás do braço)']], 'estreita')}
      <p>A <b>mão direita</b> é a que toca as cordas: com os dedos, com o polegar ou com a palheta. Quem é canhoto e usa violão invertido troca as mãos, mas a numeração é a mesma.</p>
    </div>
  </div>

  <h2>1.5 Postura</h2>
  ${duasFotos('postura', 'Sentado, costas retas, violão na perna direita.', 'polegar', 'O polegar fica atrás do braço, relaxado.')}
  <ul class="pontos">
    <li>Sente na ponta da cadeira, costas retas, ombros soltos.</li>
    <li>O violão apoia na perna direita, com o braço levemente apontado para cima.</li>
    <li>O <b>polegar esquerdo fica atrás do braço</b>, mais ou menos atrás do dedo 2, e não agarrando o braço por cima.</li>
    <li>O pulso esquerdo fica reto ou levemente curvado, nunca dobrado em ângulo forte.</li>
    <li>Os dedos apertam com a <b>ponta</b>, em pé, para não encostar nas cordas vizinhas.</li>
  </ul>
  ${atencao('<p>Dor nas pontas dos dedos nas primeiras semanas é normal: a pele vai engrossar. Já dor no pulso, no antebraço ou no ombro <b>não é normal</b>: pare, solte a mão e revise a postura.</p>')}
  ${app('<p>Use o <b>Afinador</b> (Ferramentas) sempre antes de estudar: ele mostra qual corda você está tocando e se ela está acima ou abaixo da nota certa.</p>')}
  `,
  ['O violão tem mão, braço, corpo e as peças que seguram as cordas (pestana, cavalete e rastilho).', 'As cordas são numeradas da mais fina (1ª, embaixo) para a mais grossa (6ª, em cima): <b>Mi Lá Ré Sol Si Mi</b> da 6ª para a 1ª.', 'Casas são os espaços entre os trastes, contados a partir da mão. Corda solta = casa 0; cada casa sobe meio tom.', 'Dedos da mão esquerda: 1 indicador, 2 médio, 3 anelar, 4 mínimo.']);

// =====================================================================
// TEMA 2
// =====================================================================
const t2 = tema(2, 'Ritmo, batida e BPM', IMG + 'batidas.webp',
  ['O que é pulso, tempo e compasso', 'O que significa BPM e como usar o metrônomo', 'Como ler uma batida com setas', 'Três batidas básicas usadas em louvor', 'Um método para ganhar velocidade sem perder o tempo'],
  `
  <h2>2.1 Pulso e tempo</h2>
  <p>Toda música tem um <b>pulso</b>: uma batida constante que fica por baixo de tudo, como o coração da música. É o que você faz sem perceber quando bate o pé acompanhando uma canção. Cada uma dessas batidas do pé é um <b>tempo</b>.</p>
  <p>Tocar com bom ritmo é, antes de tudo, <b>não sair do pulso</b>: nem correr, nem atrasar. Um violonista que troca acordes devagar mas mantém o tempo soa muito melhor do que um que toca rápido e "tropeça".</p>

  <h2>2.2 BPM e metrônomo</h2>
  <div class="duas meio">
    <div>
      <p><b>BPM</b> quer dizer <b>batidas por minuto</b>. É a velocidade do pulso:</p>
      <ul class="pontos">
        <li><b>60 BPM</b> = uma batida por segundo.</li>
        <li><b>120 BPM</b> = duas batidas por segundo (o dobro da velocidade).</li>
        <li>Quanto <b>maior</b> o número, mais <b>rápida</b> a música.</li>
      </ul>
      <p>O <b>metrônomo</b> é o aparelho (ou app) que faz um clique em cada tempo, na velocidade escolhida. Ele é o professor de ritmo mais honesto que existe: não deixa você correr nas partes fáceis nem atrasar nas difíceis.</p>
    </div>
    <div class="centro"><img class="foto" src="fotos/metronomo.jpg" alt="" style="margin:0"></div>
  </div>
  ${fig(D.pulsos({ bpm: 60, segundos: 4 }), '60 BPM: um clique por segundo. Em dourado, o tempo 1 de cada compasso (o clique mais forte do metrônomo).')}
  ${fig(D.pulsos({ bpm: 120, segundos: 4 }), '120 BPM: dois cliques por segundo, no mesmo intervalo de tempo.')}
  ${tabela(['Faixa', 'BPM aproximado', 'Onde aparece'], [
    ['Lento', '50 a 80', 'A maioria dos louvores de adoração. Os louvores do app medidos na gravação original ficam entre 51 e 80 BPM.'],
    ['Moderado', '80 a 110', 'Louvores mais animados, baladas pop.'],
    ['Rápido', '110 em diante', 'Celebração, músicas de abertura de culto.'],
  ])}

  <h2>2.3 Compasso: contando até 4</h2>
  <p>Os tempos se agrupam em <b>compassos</b>. Na grande maioria dos louvores, cada compasso tem <b>4 tempos</b> e a gente conta <b>1, 2, 3, 4, 1, 2, 3, 4…</b> O tempo 1 é o mais forte: é onde normalmente o acorde muda.</p>
  <p>Para tocar batidas, dividimos cada tempo em duas metades. A contagem fica <b>"1 e 2 e 3 e 4 e"</b>. O número é a metade de baixo; o "e" é a metade de cima.</p>

  <h2>2.4 Como ler uma batida</h2>
  ${foto('batida', 'A mão direita desce e sobe sobre a boca do violão, como um pêndulo.')}
  <p>Nesta apostila as batidas aparecem em 8 espaços, um para cada parte da contagem:</p>
  ${fig(D.batida('BCBCBCBC'), 'Seta cheia para baixo = a mão desce tocando as cordas. Seta cheia para cima = a mão sobe tocando.')}
  ${pratica('<p>A regra de ouro: <b>a mão direita nunca para.</b> Ela desce em todo número e sobe em todo "e", como um pêndulo, o tempo todo. A batida muda só quando a mão <b>encosta ou não</b> nas cordas. Quando não deve tocar, ela passa no ar, sem encostar. Nos desenhos, esse movimento no ar aparece como seta pontilhada clarinha.</p>')}

  <h2>2.5 Três batidas para começar</h2>
  <h3>Batida 1 · Quatro para baixo</h3>
  ${fig(D.batida('BcBcBcBc'), 'Uma batida para baixo em cada tempo. A mão sobe no ar entre elas. É a base de tudo e já serve para acompanhar muitos louvores lentos.')}
  <h3>Batida 2 · Baixo, baixo-cima</h3>
  ${fig(D.batida('BcBCBcBC'), 'Conta-se "1, 2 e, 3, 4 e". Começa a dar movimento à música.')}
  <h3>Batida 3 · A batida "pop" (baixo, baixo-cima, cima-baixo-cima)</h3>
  ${fig(D.batida('BcBCbCBC'), 'Conta-se "1, 2 e, (3) e 4 e". No tempo 3 a mão desce no ar sem tocar. É a batida mais usada em louvor e em música pop no violão.')}
  ${atencao('<p>Na batida 3, o erro mais comum é parar a mão no tempo 3. Ela <b>tem que descer</b> no ar, senão a subida do "e" seguinte sai atrasada. Treine falando em voz alta: "baixo, baixo-cima, <i>(ar)</i>-cima-baixo-cima".</p>')}

  <h2>2.6 Como estudar com o metrônomo</h2>
  <ol class="passos">
    <li>Comece <b>devagar</b>: 60 ou 70 BPM. Devagar mesmo, a ponto de ficar fácil.</li>
    <li>Toque a batida com <b>um acorde só</b> (ex.: Em) até ficar firme, quatro compassos seguidos sem errar.</li>
    <li>Só então suba <b>5 BPM</b>. Errou? Volte 5.</li>
    <li>Quando estiver firme, troque entre dois acordes (ex.: Em e C) mantendo a batida.</li>
    <li>Anote o BPM que você alcançou em cada dia. Ver o número subir motiva.</li>
  </ol>
  ${app('<p>A tela <b>Batidas</b> mostra a batida como setas andando na tela, com contagem e metrônomo. Em <b>Ferramentas › Metrônomo</b> você escolhe o BPM ou descobre o BPM de uma música batendo no tempo.</p>')}
  `,
  ['Pulso é a batida constante da música; cada batida é um tempo.', 'BPM = batidas por minuto. 60 BPM = 1 por segundo. Louvores lentos ficam entre 50 e 80 BPM.', 'Compasso de 4 tempos: conta-se "1 e 2 e 3 e 4 e".', 'A mão direita nunca para: desce nos números e sobe nos "e". A batida muda pelo que toca e pelo que passa no ar.', 'Estude devagar e suba de 5 em 5 BPM.']);

// =====================================================================
// TEMA 3
// =====================================================================
const t3 = tema(3, 'As notas musicais', IMG + 'cifras.webp',
  ['As 7 notas naturais e as letras da cifra', 'O que são tom e semitom', 'Os sustenidos (#) e os bemóis (b)', 'As 12 notas da música', 'Por que não existe Mi# nem Si#'],
  `
  <h2>3.1 As 7 notas naturais</h2>
  <p>A música ocidental usa <b>sete notas naturais</b>, que se repetem em ciclo, do grave para o agudo:</p>
  <p class="destaque-linha">Dó · Ré · Mi · Fá · Sol · Lá · Si · <span>Dó…</span></p>
  <p>Depois do Si vem de novo o Dó, só que mais agudo. A distância de um Dó até o próximo Dó se chama <b>oitava</b>.</p>
  <h3>As letras da cifra</h3>
  <p>Na cifra, cada nota é escrita com uma <b>letra</b>. O sistema começa no Lá (A), por isso o Dó é C:</p>
  ${tabela(['Nota', 'Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'], [['<b>Cifra</b>', '<b>C</b>', '<b>D</b>', '<b>E</b>', '<b>F</b>', '<b>G</b>', '<b>A</b>', '<b>B</b>']], 'cifras')}
  ${dica('<p>Para decorar, lembre que <b>A é Lá</b> e siga o alfabeto: A Lá, B Si, C Dó, D Ré, E Mi, F Fá, G Sol.</p>')}

  <h2>3.2 Tom e semitom</h2>
  <p>A distância entre duas notas se mede em <b>tons</b> e <b>semitons</b> (meio tom):</p>
  <ul class="pontos">
    <li><b>Semitom (meio tom)</b> = a menor distância entre duas notas. No violão, é <b>uma casa</b>.</li>
    <li><b>Tom</b> = dois semitons. No violão, são <b>duas casas</b>.</li>
  </ul>
  ${fig(D.braco({ ate: 7, w: 560, marcas: [{ corda: 5, casa: 0, txt: 'A', cor: 'ouro' }, { corda: 5, casa: 1, txt: 'A#' }, { corda: 5, casa: 2, txt: 'B', cor: 'ouro' }, { corda: 5, casa: 3, txt: 'C', cor: 'ouro' }], notasSoltas: true }), 'Na 5ª corda: de Lá (solta) para Si (casa 2) é um tom (duas casas). De Si (casa 2) para Dó (casa 3) é um semitom (uma casa).')}

  <h2>3.3 Sustenido e bemol</h2>
  <p>Entre a maioria das notas naturais existe uma nota "do meio". Ela recebe o nome da vizinha com um símbolo:</p>
  <ul class="pontos">
    <li><b>Sustenido (#)</b> = a nota <b>sobe</b> meio tom. Dó# (C#) é meio tom acima de Dó.</li>
    <li><b>Bemol (b)</b> = a nota <b>desce</b> meio tom. Réb (Db) é meio tom abaixo de Ré.</li>
  </ul>
  <p>Repare que <b>Dó# e Réb são a mesma nota</b>, com dois nomes. No violão é a mesma casa. O nome muda conforme o tom da música, mas o som é igual. Isso se chama <b>enarmonia</b>.</p>
  ${tabela(['Sustenido', 'C#', 'D#', 'F#', 'G#', 'A#'], [['<b>Mesmo som que</b>', 'Db', 'Eb', 'Gb', 'Ab', 'Bb']], 'cifras')}

  <h2>3.4 As 12 notas</h2>
  <p>Juntando as naturais com os sustenidos, a música tem <b>12 notas diferentes</b>. Depois delas, o ciclo recomeça:</p>
  <p class="destaque-linha doze">C · C# · D · D# · E · F · F# · G · G# · A · A# · B · <span>C…</span></p>
  ${fig(D.braco({ ate: 12, w: 680, marcas: Array.from({ length: 13 }, (_, c) => ({ corda: 5, casa: c, txt: D.nota(5, c), cor: D.nota(5, c).includes('#') ? 'claro' : 'tinta' })), notasSoltas: true }), 'As 12 notas na 5ª corda, da solta (Lá) até a casa 12 (Lá de novo). As escuras são as naturais; as brancas, os sustenidos. Repare que entre Si (casa 2) e Dó (casa 3) não sobra casa para um sustenido.')}

  <h2>3.5 A pegadinha: Mi–Fá e Si–Dó</h2>
  <p>Entre <b>Mi e Fá</b> e entre <b>Si e Dó</b> a distância já é de <b>meio tom</b>. Não sobra espaço para uma nota no meio. Por isso, na prática, <b>não se usa Mi# nem Si#</b> (seriam o próprio Fá e o próprio Dó).</p>
  ${atencao('<p>Esse é o detalhe que mais confunde no começo. Grave assim: <b>"Mi-Fá e Si-Dó são grudados"</b>. Todas as outras notas naturais vizinhas têm um sustenido entre elas.</p>')}
  ${fig(D.braco({ ate: 12, w: 680, marcas: Array.from({ length: 13 }, (_, c) => ({ corda: 6, casa: c, txt: D.nota(6, c), cor: D.nota(6, c).includes('#') ? 'claro' : (['E', 'F', 'B', 'C'].includes(D.nota(6, c)) ? 'ouro' : 'tinta') })), notasSoltas: true }), 'As 12 notas na 6ª corda, da solta (Mi) até a casa 12 (Mi de novo). Em dourado, os pares grudados Mi–Fá e Si–Dó: uma casa só de distância.')}
  ${app('<p>Em <b>Exercícios › Notas no braço</b> o app sorteia uma nota e você acha a casa. É o melhor jeito de decorar onde fica cada nota.</p>')}
  `,
  ['Notas naturais: Dó Ré Mi Fá Sol Lá Si (C D E F G A B na cifra; A = Lá).', 'Semitom = 1 casa. Tom = 2 casas.', 'Sustenido (#) sobe meio tom; bemol (b) desce meio tom. C# e Db são a mesma nota.', 'A música tem 12 notas: C C# D D# E F F# G G# A A# B.', 'Mi–Fá e Si–Dó são grudados: não existe nota entre eles.']);

// =====================================================================
// TEMA 4
// =====================================================================
const aranha = [];
for (let corda = 6; corda >= 1; corda--) for (let c = 1; c <= 4; c++) aranha.push({ corda, casa: c, txt: c, cor: c === 1 ? 'ouro' : 'tinta' });
const t4 = tema(4, 'Escala cromática', IMG + 'exercicios.webp',
  ['O que é a escala cromática', 'O mapa das notas no braço inteiro', 'O exercício 1-2-3-4 ("aranha")', 'Como achar qualquer nota em qualquer corda'],
  `
  <h2>4.1 O que é</h2>
  <p>A <b>escala cromática</b> é a escala com <b>todas as 12 notas</b>, uma depois da outra, sempre de meio em meio tom. No violão, isso é simples: é tocar <b>casa por casa</b>, sem pular nenhuma.</p>
  <p class="destaque-linha doze">C · C# · D · D# · E · F · F# · G · G# · A · A# · B · <span>C</span></p>
  <p>Ela não é uma "música". É uma ferramenta de estudo com duas funções:</p>
  <ul class="pontos">
    <li><b>Teoria:</b> conhecer onde está cada nota no braço.</li>
    <li><b>Técnica:</b> dar força, independência e precisão para os quatro dedos da mão esquerda.</li>
  </ul>

  <h2>4.2 O mapa do braço</h2>
  <p>Este é o mapa de todas as notas da casa 0 à casa 12, em todas as cordas. As notas naturais estão em escuro; os sustenidos, em branco.</p>
  ${fig(D.mapaNotas(), 'Mapa completo das notas do braço, casa 0 (solta) à casa 12. Da casa 12 em diante, tudo se repete igual.', 'mapa')}
  ${dica('<p>Não tente decorar o mapa inteiro de uma vez. Comece pelas <b>notas naturais da 6ª e da 5ª corda</b>: são elas que dão o nome dos acordes com pestana (Tema 5). Depois, use as bolinhas das casas 3, 5, 7, 9 e 12 como pontos de apoio.</p>')}
  <h3>Atalho: a mesma nota em outra corda</h3>
  <p>A casa <b>5</b> de uma corda tem a mesma nota da corda <b>solta de baixo</b> (a próxima mais fina). Exemplo: casa 5 da 6ª corda = Lá = 5ª corda solta. A única exceção é a <b>3ª corda</b>: a nota da 2ª corda solta (Si) está na <b>casa 4</b> dela. Esse é o mesmo truque usado para afinar o violão de ouvido.</p>

  <h2>4.3 O exercício 1-2-3-4 ("aranha")</h2>
  ${foto('aranha', 'Um dedo em cada casa, todos arqueados, apertando com a ponta.')}
  <p>É o exercício cromático mais famoso. A regra é <b>um dedo para cada casa</b>: dedo 1 na casa 1, dedo 2 na casa 2, dedo 3 na casa 3, dedo 4 na casa 4.</p>
  ${fig(D.braco({ ate: 5, w: 520, marcas: aranha }), 'Toque 1-2-3-4 na 6ª corda, depois 1-2-3-4 na 5ª, e assim até a 1ª corda. Depois volte, 4-3-2-1, da 1ª até a 6ª.')}
  <ol class="passos">
    <li>Coloque o metrônomo em <b>60 BPM</b> e toque <b>uma nota por clique</b>.</li>
    <li>Ao subir para o dedo seguinte, <b>deixe o anterior apertado</b> (na subida). Isso força a independência dos dedos.</li>
    <li>Os dedos ficam <b>perto das cordas</b>, sem levantar demais quando soltam.</li>
    <li>Quando estiver limpo, toque <b>duas notas por clique</b> (1 e 2 e…) na mesma velocidade.</li>
    <li>Depois, mude de lugar: faça na casa 5 a 8 (dedo 1 na casa 5), onde as casas são menores, e vá descendo até a casa 1.</li>
  </ol>
  ${atencao('<p>Devagar e limpo vale mais do que rápido e sujo. Se alguma nota chiar ou morrer, diminua o BPM. Dor no pulso significa parar e soltar a mão.</p>')}
  <h3>Variações (quando o 1-2-3-4 estiver fácil)</h3>
  ${tabela(['Variação', 'Ordem dos dedos', 'O que treina'], [['A', '1-3-2-4', 'independência do 2 e do 3'], ['B', '1-2-4-3', 'controle do dedo 4'], ['C', '1-4-2-3', 'abertura da mão'], ['D', '4-3-2-1 na subida', 'mesma coisa ao contrário']])}
  ${app('<p>Em <b>Exercícios › Aranha</b> o app conduz o 1-2-3-4 com o metrônomo, marcando a casa e o dedo de cada nota.</p>')}
  `,
  ['Escala cromática = as 12 notas em sequência, de meio em meio tom (casa por casa).', 'Serve para conhecer as notas no braço e para dar técnica aos dedos.', 'Casa 5 de uma corda = próxima corda solta (na 3ª corda, é a casa 4).', 'Aranha 1-2-3-4: um dedo por casa, devagar, com metrônomo.']);

// =====================================================================
// TEMA 5
// =====================================================================
const mol = (nota, casa) => `<td>${nota}</td>`;
const pestE = ['F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'];
const pestA = ['A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A'];
const t5 = tema(5, 'Acordes', IMG + 'banda.webp',
  ['O que é um acorde e como ler o diagrama', 'Os 7 acordes maiores e os 7 menores naturais', 'A diferença entre maior e menor', 'Acordes com sustenido e a técnica da pestana', 'Por que o mesmo acorde tem vários desenhos'],
  `
  <h2>5.1 O que é um acorde</h2>
  <p><b>Acorde</b> é um conjunto de <b>três ou mais notas tocadas ao mesmo tempo</b>. É o que fazemos no violão para acompanhar uma música. Na cifra, o acorde aparece escrito em cima da letra da música, no ponto em que deve ser tocado.</p>
  <p>O nome do acorde vem da sua nota principal, chamada <b>tônica</b> (ou fundamental): o acorde de <b>C</b> (Dó) é construído a partir da nota Dó.</p>

  ${foto('acorde', 'Num acorde, os dedos ficam em pé (arqueados) para não abafar as cordas vizinhas.')}
  <h2>5.2 Como ler um diagrama de acorde</h2>
  <div class="duas">
    <div class="centro">${fig(D.acorde({ ...A.C, l: 170 }), 'Acorde de C (Dó maior)')}</div>
    <div>
      <p>O diagrama é o braço <b>em pé</b>, de frente para você, como se o violão estivesse pendurado na parede:</p>
      <ul class="pontos">
        <li><b>Linhas em pé</b> = as cordas. A da esquerda é a <b>6ª</b> (grossa); a da direita é a <b>1ª</b> (fina).</li>
        <li><b>Linhas deitadas</b> = os trastes. A grossa em cima é a pestana (nut).</li>
        <li><b>Bolinha com número</b> = onde apertar e com qual dedo.</li>
        <li><b>○ em cima</b> = corda solta, toca sem apertar.</li>
        <li><b>× em cima</b> = essa corda <b>não</b> deve soar.</li>
        <li><b>Número ao lado</b> (ex.: 3ª) = o desenho começa naquela casa, e não na primeira.</li>
      </ul>
    </div>
  </div>

  <h2>5.3 Os 7 acordes maiores</h2>
  <p>Os <b>acordes maiores</b> têm som aberto, "alegre", resolvido. Na cifra, são escritos <b>só com a letra</b>: C, D, E, F, G, A, B.</p>
  ${grade(['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((n) => ac(n)))}
  ${dica('<p>Comece por <b>E, A, D, G e C</b>: são feitos sem pestana e aparecem em quase todo louvor. F e B usam pestana e vêm depois, com calma.</p>')}

  <h2>5.4 Os 7 acordes menores</h2>
  <p>Os <b>acordes menores</b> têm som mais fechado, "triste" ou introspectivo. Na cifra, levam um <b>m minúsculo</b> depois da letra: Cm, Dm, Em, Fm, Gm, Am, Bm.</p>
  ${grade(['Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'].map((n) => ac(n)))}
  ${atencao('<p>Cuidado com a letra: <b>m minúsculo</b> = menor (Am, Lá menor). <b>M maiúsculo</b> ou nada = maior (A, Lá maior). Já "7M" é outro tipo de acorde, que veremos em outro volume.</p>')}

  <h2>5.5 Maior × menor: um dedo de diferença</h2>
  <p>A diferença entre um acorde maior e o menor da mesma nota é <b>uma única nota</b> (a terça) que desce <b>meio tom</b>. Em vários desenhos isso é visível: muda um dedo só.</p>
  <div class="pares">
    ${['E|Em|3', 'A|Am|2', 'D|Dm|1'].map((p) => {
      const [m, n, c] = p.split('|');
      return `<div class="par">${ac(m, m, { destaque: [+c] })}<span class="seta">→</span>${ac(n, n, { destaque: [+c] })}</div>`;
    }).join('')}
  </div>
  <p class="legenda">Em dourado, a nota que muda. De E para Em, o dedo 1 sai da 3ª corda (que passa a soar solta). De A para Am, a nota da 2ª corda desce uma casa. De D para Dm, a nota da 1ª corda desce uma casa.</p>
  ${pratica('<p>Toque E e depois Em, várias vezes, prestando atenção no som. Faça o mesmo com A/Am e D/Dm. Treinar o ouvido para perceber a diferença entre maior e menor é tão importante quanto saber o desenho.</p>')}

  <h2>5.6 Acordes com sustenido e a pestana</h2>
  <p>Como existem 12 notas, existem <b>12 acordes maiores e 12 menores</b>, 24 ao todo. Os acordes com sustenido (C#, D#, F#, G#, A# e seus menores) quase sempre são feitos com <b>pestana</b>: o dedo 1 deitado, apertando várias cordas na mesma casa.</p>
  ${grade(['F#', 'F#m', 'C#m', 'G#m', 'A#'].map((n) => ac(n)))}
  ${tabela(['Maiores', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], [['<b>Menores</b>', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']], 'cifras pequena')}
  <p class="legenda">Os 24 acordes básicos. Pela regra do Tema 3, não existem acordes de E# nem de B#.</p>
  ${pratica('<p>Para a pestana sair limpa: deite o dedo 1 <b>bem perto do traste</b>, use o lado do dedo (um pouco virado para a mão) e puxe o braço do violão contra o corpo com o braço inteiro, não só apertando com o polegar. Toque corda por corda para descobrir qual não está soando.</p>')}

  <h2>5.7 O mesmo acorde, vários desenhos</h2>
  <p>Um acorde é um <b>conjunto de notas</b>, não um desenho. Como cada nota aparece em vários lugares do braço (Tema 4), <b>o mesmo acorde pode ser montado em várias regiões</b>. O som é o mesmo acorde; muda a altura e o "colorido".</p>
  <h3>Três desenhos de G (Sol maior)</h3>
  ${grade([ac('G', 'G · aberto'), ac('G·pestana3', 'G · pestana na 3ª'), ac('G·pestana10', 'G · pestana na 10ª')])}
  <h3>Três desenhos de C (Dó maior)</h3>
  ${grade([ac('C', 'C · aberto'), ac('C·pestana3', 'C · pestana na 3ª'), ac('C·pestana8', 'C · pestana na 8ª')])}
  <h3>Os moldes que andam</h3>
  <p>Repare que o desenho de <b>F</b> (pestana na casa 1) é o desenho de <b>E</b> empurrado uma casa para frente, com a pestana fazendo o papel da pestana do violão. Esse molde pode ser levado para <b>qualquer casa</b>: o nome do acorde é a nota da <b>6ª corda</b> onde está a pestana. O mesmo vale para o molde de <b>A</b>, com o nome dado pela <b>5ª corda</b>.</p>
  <table class="tab cifras pequena moldes"><thead><tr><th>Casa da pestana</th>${Array.from({ length: 12 }, (_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>
    <tr><td><b>Molde de E</b> (6ª corda)</td>${pestE.map((n) => `<td>${n}</td>`).join('')}</tr>
    <tr><td><b>Molde de A</b> (5ª corda)</td>${pestA.map((n) => `<td>${n}</td>`).join('')}</tr>
  </tbody></table>
  <p class="legenda">Com só dois desenhos de pestana (e a versão menor de cada um: Fm e Bm), você toca os 24 acordes. É por isso que vale a pena saber as notas da 6ª e da 5ª corda.</p>
  ${app('<p>A tela <b>Acordes</b> mostra cada acorde no braço e toca o som. Em "Procurar qualquer acorde" você digita o nome (ex.: C#m) e o app calcula o desenho.</p>')}
  `,
  ['Acorde = 3 ou mais notas juntas. O nome vem da tônica.', 'Maior: só a letra (C). Menor: letra + m (Cm). Diferença: uma nota meio tom abaixo.', 'Existem 24 acordes básicos: 12 maiores e 12 menores.', 'Sustenidos quase sempre usam pestana (dedo 1 deitado).', 'O mesmo acorde tem vários desenhos no braço; os moldes de E e A com pestana andam por todas as casas.']);

// =====================================================================
// TEMA 6
// =====================================================================
const ESC = { C: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'], G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#', 'G'], D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#', 'D'], A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#', 'A'], E: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#', 'E'] };
const t6 = tema(6, 'Graus', IMG + 'aulas.webp',
  ['O que é tom (tonalidade) de uma música', 'A receita da escala maior: T T S T T T S', 'O que é grau e por que ele muda com o tom', 'Como descobrir o tom de uma música', 'Como trocar uma música de tom usando graus'],
  `
  <h2>6.1 O tom da música</h2>
  <p>Quando dizemos que um louvor está "<b>em Sol</b>", estamos dizendo que o <b>centro</b> dele é a nota Sol. É a nota (e o acorde) onde a música "chega em casa", a sensação de repouso. Isso é a <b>tonalidade</b>, ou simplesmente o <b>tom</b> da música.</p>
  ${atencao('<p>A palavra <b>tom</b> tem dois sentidos: a <b>distância</b> de duas casas (Tema 3) e a <b>tonalidade</b> da música ("está em tom de Sol"). Pelo contexto você sabe qual é.</p>')}

  <h2>6.2 A escala maior: a receita</h2>
  <p>Todo tom maior usa <b>7 notas</b>, escolhidas das 12 com uma receita fixa de distâncias:</p>
  <p class="destaque-linha receita">T · T · S · T · T · T · S</p>
  <p class="centro">(T = tom, duas casas · S = semitom, uma casa)</p>
  <p>Partindo de Dó e aplicando a receita, saem as 7 notas naturais, sem nenhum sustenido. Por isso <b>Dó maior é o tom mais simples</b> e é por ele que se começa a estudar teoria.</p>
  ${fig(D.escada(ESC.C, { titulo: 'Escala de Dó maior' }), 'Os degraus da escala de Dó. Os números são os graus. Os semitons caem entre o 3 e o 4 (Mi–Fá) e entre o 7 e o 8 (Si–Dó).', 'escada')}
  <p>Aplicando a <b>mesma receita</b> a partir de Sol, a 7ª nota precisa de um sustenido (F#) para a conta fechar:</p>
  ${fig(D.escada(ESC.G, { titulo: 'Escala de Sol maior' }), 'Mesma receita, outro ponto de partida. O Fá vira Fá# para manter o semitom entre os graus 7 e 8.', 'escada')}

  <h2>6.3 O que é grau</h2>
  <p><b>Grau é a posição de uma nota (ou acorde) dentro do tom.</b> O grau 1 é sempre a nota que dá nome ao tom; os outros são contados a partir dele. Por isso <b>o grau de uma nota depende do tom</b>:</p>
  ${tabela(['Grau', '1', '2', '3', '4', '5', '6', '7'], [
    ['<b>Tom de C</b>', '<b>C</b>', 'D', 'E', 'F', '<b>G</b>', 'A', 'B'],
    ['<b>Tom de G</b>', '<b>G</b>', 'A', 'B', '<b>C</b>', 'D', 'E', 'F#'],
    ['<b>Tom de D</b>', 'D', 'E', 'F#', '<b>G</b>', 'A', 'B', 'C#'],
    ['<b>Tom de A</b>', 'A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
    ['<b>Tom de E</b>', 'E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
  ], 'cifras graus')}
  <p>Veja a nota Sol (G): <b>no tom de C ela é o grau 5</b>; <b>no tom de G ela é o grau 1</b>; no tom de D ela é o grau 4. É a mesma nota, ocupando "cargos" diferentes em cada tom.</p>
  ${caixa('dica', 'Esclarecendo a dúvida da aula', `
    <p>Duas frases parecidas, mas só uma está certa:</p>
    <ul class="pontos">
      <li>✓ "<b>Em Dó, o Sol é o grau 5.</b>" Correto: contando a partir de Dó (1), Sol é o quinto.</li>
      <li>✗ "Em Sol, o grau 1 é Dó." Não: <b>em Sol, o grau 1 é o próprio Sol</b>. O Dó, no tom de Sol, é o <b>grau 4</b>.</li>
    </ul>
    <p>E o "supor que é Dó"? Quer dizer que <b>a teoria se aprende primeiro em Dó</b>, porque é o tom sem sustenidos e tudo fica mais fácil de visualizar. Mas uma música desconhecida pode estar em qualquer tom: o tom se descobre (6.4), não se supõe.</p>`)}

  <h2>6.4 Como descobrir o tom de uma música</h2>
  <ol class="passos">
    <li>Escute (ou toque) até o <b>final</b>. O acorde em que a música termina e "repousa" quase sempre é o <b>grau 1</b>. Muitas vezes é também o primeiro acorde.</li>
    <li>Confira os outros acordes: eles devem caber no <b>campo harmônico</b> desse tom (Tema 7).</li>
    <li>Se houver dúvida entre dois tons, cante a nota que parece "casa". Ela é a tônica.</li>
  </ol>
  ${pratica('<p>Exemplo: uma música com os acordes <b>G – D – Em – C</b> que termina em <b>G</b>. As notas G, D, E e C estão todas na escala de Sol e ela repousa em G: o tom é <b>Sol maior</b>.</p>')}

  <h2>6.5 Para que servem os graus: trocar de tom</h2>
  <p>Quem pensa em graus enxerga a "forma" da música, não só as letras. Isso permite <b>tocar a mesma música em qualquer tom</b>, para ajustar à voz de quem canta.</p>
  ${tabela(['Graus', '1', '5', '6m', '4'], [['<b>Tom de C</b>', 'C', 'G', 'Am', 'F'], ['<b>Tom de G</b>', 'G', 'D', 'Em', 'C'], ['<b>Tom de D</b>', 'D', 'A', 'Bm', 'G'], ['<b>Tom de A</b>', 'A', 'E', 'F#m', 'D']], 'cifras graus')}
  <p class="legenda">A sequência 1 – 5 – 6m – 4 é a mesma "música" nos quatro tons; só mudam as letras.</p>
  ${dica('<p>Os graus também podem ser escritos em <b>algarismos romanos</b>: I, II, III, IV, V, VI, VII. Ex.: I – V – VIm – IV. É a mesma coisa que 1 – 5 – 6m – 4.</p>')}
  ${app('<p>Em <b>Tocar cifra</b>, os botões de tom (+ e −) trocam a música de tom na hora. E em <b>Acordes › Por tom</b> você vê os graus de cada tom e ouve a sequência I V vi IV.</p>')}
  `,
  ['Tom (tonalidade) é o centro da música, onde ela repousa.', 'Escala maior = receita T T S T T T S a partir da tônica. Dó maior não tem sustenidos.', 'Grau = posição da nota no tom. O grau 1 é sempre a tônica. A mesma nota muda de grau quando muda o tom.', 'Em Dó, Sol é o grau 5. Em Sol, Sol é o grau 1 e Dó é o grau 4.', 'Para descobrir o tom: veja onde a música termina e confira se os acordes cabem no campo harmônico.']);

// =====================================================================
// TEMA 7
// =====================================================================
const CAMPOS = [
  ['C', 'C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bm7(b5)'],
  ['D', 'D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#m7(b5)'],
  ['E', 'E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#m7(b5)'],
  ['F', 'F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Em7(b5)'],
  ['G', 'G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#m7(b5)'],
  ['A', 'A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#m7(b5)'],
];
const t7 = tema(7, 'Campo harmônico', IMG + 'ferramentas.webp',
  ['O que é campo harmônico', 'A receita dos 7 acordes de um tom maior', 'O campo harmônico dos tons mais usados no violão', 'A relativa menor', 'As sequências de acordes mais comuns em louvor'],
  `
  <h2>7.1 O que é</h2>
  <p>No Tema 6 vimos que cada tom tem 7 notas. Se montarmos <b>um acorde sobre cada uma dessas notas</b>, usando só notas do próprio tom, obtemos os <b>7 acordes "da família"</b> daquele tom. Esse conjunto é o <b>campo harmônico</b>.</p>
  <p>Na prática: <b>quase todos os acordes de uma música saem do campo harmônico do tom dela</b>. Conhecer o campo é saber, de antemão, quais acordes provavelmente vão aparecer.</p>

  <h2>7.2 A receita do tom maior</h2>
  <p>Em qualquer tom maior, os tipos de acorde em cada grau são <b>sempre os mesmos</b>:</p>
  ${tabela(['Grau', '1', '2', '3', '4', '5', '6', '7'], [
    ['<b>Tipo</b>', 'Maior', 'menor', 'menor', 'Maior', 'Maior', 'menor', 'meio-dim.'],
    ['<b>Romano</b>', 'I', 'IIm', 'IIIm', 'IV', 'V', 'VIm', 'VIIm7(b5)'],
  ], 'cifras graus')}
  ${dica('<p>Decore assim: <b>"Maior, menor, menor, Maior, Maior, menor, meio-diminuto"</b>. Os graus 1, 4 e 5 são maiores; 2, 3 e 6 são menores; o 7 é o diferente. O acorde do 7º grau (meio-diminuto, escrito m7(b5)) é pouco usado no violão popular e pode ficar para depois.</p>')}

  <h2>7.3 Os campos mais usados</h2>
  ${tabela(['Tom', '1', '2m', '3m', '4', '5', '6m', '7m7(b5)'], CAMPOS.map((c) => c.map((x, i) => (i === 0 ? `<b>${x}</b>` : x))), 'cifras graus campos')}
  <p class="legenda">Tons que soam bem e são confortáveis no violão: C, D, E, G e A. F também aparece bastante em louvores.</p>
  <h3>O campo de G no braço</h3>
  ${grade([ac('G', 'G · 1'), ac('Am', 'Am · 2m'), ac('Bm', 'Bm · 3m'), ac('C', 'C · 4'), ac('D', 'D · 5'), ac('Em', 'Em · 6m')], 'seis')}
  <p class="legenda">Os seis acordes mais usados do tom de Sol. Com eles se toca uma quantidade enorme de louvores.</p>

  <h2>7.4 A relativa menor</h2>
  <p>O <b>grau 6m</b> tem um papel especial: ele é a <b>relativa menor</b> do tom. Am é a relativa de C; Em é a relativa de G. Os dois tons usam <b>exatamente as mesmas notas e os mesmos acordes</b>, só que o centro (a "casa") muda.</p>
  ${tabela(['Campo de Lá menor (Am)', 'Am', 'Bm7(b5)', 'C', 'Dm', 'Em', 'F', 'G'], [['<b>Grau no tom menor</b>', '1m', '2m7(b5)', '3', '4m', '5m', '6', '7']], 'cifras pequena')}
  <p class="legenda">Os mesmos acordes do campo de C, começando do Am. Uma música que repousa em Am está em Lá menor; se repousa em C, está em Dó maior.</p>

  <h2>7.5 Sequências que mais aparecem</h2>
  ${tabela(['Sequência', 'Em C', 'Em G', 'Em D'], [
    ['<b>1 – 5 – 6m – 4</b>', 'C G Am F', 'G D Em C', 'D A Bm G'],
    ['<b>1 – 4 – 5</b>', 'C F G', 'G C D', 'D G A'],
    ['<b>6m – 4 – 1 – 5</b>', 'Am F C G', 'Em C G D', 'Bm G D A'],
    ['<b>1 – 6m – 4 – 5</b>', 'C Am F G', 'G Em C D', 'D Bm G A'],
    ['<b>4 – 5 – 6m</b>', 'F G Am', 'C D Em', 'G A Bm'],
  ], 'cifras')}
  ${pratica('<p>Os graus <b>1, 4, 5 e 6m</b> sozinhos dão conta de uma enorme parte dos louvores. Treine as sequências acima nos tons de G e D com a batida 3 (Tema 2), a 70 BPM, com 1 acorde por compasso.</p>')}
  ${atencao('<p>Às vezes aparece um acorde que <b>não está</b> no campo (ex.: um E maior numa música em C). São os acordes "de empréstimo" ou de passagem, que dão cor à música. Eles existem, mas são exceção; a base continua sendo o campo harmônico.</p>')}
  ${app('<p>Em <b>Exercícios › Sequências</b> você escolhe o tom (maior ou menor), monta uma sequência pelos graus e treina com batida e metrônomo.</p>')}
  `,
  ['Campo harmônico = os 7 acordes formados com as notas de um tom.', 'Receita do tom maior: 1 Maior, 2m, 3m, 4 Maior, 5 Maior, 6m, 7m7(b5).', 'O 6m é a relativa menor: mesmas notas e acordes, centro diferente.', 'Os graus 1, 4, 5 e 6m são a base da maioria dos louvores.', 'Acordes de fora do campo existem, mas são exceção.']);

// ---------- páginas fixas ----------
const capa = `
<section class="capa">
  <div class="capa-foto"></div>
  <div class="capa-conteudo">
    <img class="capa-logo" src="../marca/logo-sonoridade.png" alt="Sonoridade">
    <p class="capa-rotulo">Apostila do Método Sonoridade</p>
    <h1 class="capa-tit">Fundamentos<br>do violão</h1>
    <div class="capa-fio"></div>
    <p class="capa-vol">Volume 1 · 7 temas · teoria, exemplos e treinos</p>
  </div>
</section>`;

const pg = (n) => (PAGINAS[n] ? `<span class="pg">${PAGINAS[n]}</span>` : '<span class="pg"></span>');
const sumario = () => `
<section class="pagina sumario">
  <p class="sum-rotulo">Sumário</p>
  <ol class="sum">
    <li class="sum-intro"><span class="sum-n"></span><span class="sum-t">Como usar esta apostila</span><i></i>${pg('como')}</li>
    ${TEMAS.map((t) => `<li><span class="sum-n">${String(t.num).padStart(2, '0')}</span><span class="sum-t">${t.titulo}<small>${t.aprender.slice(0, 4).join(' · ')}</small></span><i></i>${pg(t.num)}</li>`).join('')}
    <li class="sum-intro"><span class="sum-n"></span><span class="sum-t">Meu progresso</span><i></i>${pg('progresso')}</li>
  </ol>
</section>`;

const comoUsar = `
<section class="pagina como" id="como">
  <h2 class="pag-tit">Como usar esta apostila</h2>
  <p>Esta apostila reúne os fundamentos do violão em <b>7 temas</b>. Cada tema traz a teoria explicada passo a passo, desenhos do braço e dos acordes, exemplos e, no final, <b>treinos para tocar</b>: cada um diz para que serve, como fazer, em que velocidade começar e aonde chegar. Na última página, a ficha <b>Meu progresso</b> junta todos os treinos.</p>
  <p>A ordem dos temas é a ordem de estudo sugerida: cada um usa o que foi visto antes.</p>
  <div class="trilha">
    ${TEMAS.map((t) => `<div><b>${String(t.num).padStart(2, '0')}</b><span>${t.titulo}</span></div>`).join('')}
  </div>
  <h3>Os quadros</h3>
  <div class="legenda-caixas">
    ${dica('<p>Atalhos para decorar e jeitos mais fáceis de fazer.</p>')}
    ${atencao('<p>Erros comuns e pontos que costumam confundir.</p>')}
    ${pratica('<p>Como levar a teoria para o violão.</p>')}
    ${app('<p>Onde treinar aquilo no app.</p>')}
  </div>
  <h3>Como estudar</h3>
  <ul class="pontos">
    <li><b>Pouco todo dia vale mais do que muito de vez em quando.</b> 20 minutos por dia rendem mais do que 2 horas no sábado.</li>
    <li>Divida o tempo: 5 min de afinação e aquecimento (aranha), 10 min do tema da semana, 5 min tocando uma música de que você gosta.</li>
    <li>Use sempre o <b>metrônomo</b>, começando devagar.</li>
    <li>Marque nos quadrinhos de cada treino os dias em que treinou ou o BPM que alcançou. Ver o número subir é o melhor incentivo.</li>
  </ul>
</section>`;

const progresso = () => `
<section class="pagina progresso" id="progresso">
  <h2 class="pag-tit">Meu progresso</h2>
  <p class="centro apagado">Marque cada treino quando chegar no "está certo quando". Os de metrônomo mostram a meta de BPM.</p>
  <table class="tab prog"><thead><tr><th>Tema</th><th>Treino</th><th>Meta</th><th>Cheguei lá</th></tr></thead><tbody>
  ${ficha.map((t) => `<tr><td>${String(t.tema).padStart(2, '0')}</td><td>${t.n}. ${t.titulo}</td><td>${t.bpm ? t.bpm[1] + ' BPM' : '—'}</td><td><i class="caixinha"></i></td></tr>`).join('')}
  </tbody></table>
</section>`;

const contracapa = `
<section class="contracapa">
  <img src="../marca/logo-sonoridade.png" alt="Sonoridade">
  <p>Método Sonoridade · Volume 1</p>
</section>`;

const corpo = [t1, t2, t3, t4, t5, t6, t7].join('');
const css = readFileSync(join(AQUI, 'apostila.css'), 'utf8');
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Apostila do Método Sonoridade · Volume 1</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Atkinson+Hyperlegible+Next:ital,wght@0,400..800;1,400&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=block" rel="stylesheet">
<style>${css}</style></head>
<body>
${capa}
${sumario()}
${comoUsar}
${corpo}
${progresso()}
${contracapa}
</body></html>`;
writeFileSync(join(AQUI, 'apostila.html'), html);
console.log('apostila.html ok', Math.round(html.length / 1024) + ' KB');
