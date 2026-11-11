// Afinador pelo microfone: mostra a corda mais perto do que está soando e quanto falta
// (em cents: 100 cents = meio tom). Tocar numa corda toca a nota de referência e trava nela.
import { microfonePossivel, ligarMicrofone, midiDe, nomeMidi, letraMidi } from '../audio/microfone.js';
import * as som from '../audio/som.js';
import { barraTopo, esc, guardar, ler, ICONES } from '../ui/comum.js';

const INSTRUMENTOS = {
  violao: { nome: 'Violão', cordas: [40, 45, 50, 55, 59, 64] },
  guitarra: { nome: 'Guitarra', cordas: [40, 45, 50, 55, 59, 64] },
  baixo: { nome: 'Baixo', cordas: [28, 33, 38, 43], baixo: true },
};
const AFINACOES = [
  { id: 'padrao', nome: 'Padrão', mudar: (c) => c },
  { id: 'meio', nome: '½ tom abaixo', mudar: (c) => c.map((m) => m - 1) },
  { id: 'dropd', nome: 'Drop D', mudar: (c) => c.map((m, i) => (i === 0 ? m - 2 : m)) },
];
const AFINADO = 5;          // ± cents que contam como afinado
const SEGURAR = 600;        // ms afinado para marcar a corda

export function montar(el) {
  const pref = ler('afinador', {});
  const st = {
    inst: INSTRUMENTOS[pref.inst] ? pref.inst : 'violao',
    afin: AFINACOES.some((a) => a.id === pref.afin) ? pref.afin : 'padrao',
    travada: null,        // índice da corda escolhida (null = automático)
    vivo: true,
    ligando: false,
    mic: null,
    raf: 0,
    ultimo: 0,
    hist: [],
    certas: new Set(),
    desde: 0,
    corda: null,
  };
  const cordas = () => AFINACOES.find((a) => a.id === st.afin).mudar(INSTRUMENTOS[st.inst].cordas);
  const salvar = () => guardar('afinador', { inst: st.inst, afin: st.afin });

  // marcas do mostrador: −50 a +50 cents em 180°
  const ang = (c) => (Math.max(-50, Math.min(50, c)) / 50) * 80;
  const marcas = [];
  for (let c = -50; c <= 50; c += 5) {
    const grande = c % 25 === 0;
    const r1 = grande ? 128 : 134, r2 = 146;
    const a = (ang(c) - 90) * Math.PI / 180;
    marcas.push(`<line class="${grande ? 'm-grande' : ''}${c === 0 ? ' m-zero' : ''}" x1="${160 + r1 * Math.cos(a)}" y1="${170 + r1 * Math.sin(a)}" x2="${160 + r2 * Math.cos(a)}" y2="${170 + r2 * Math.sin(a)}"/>`);
  }
  const arco = (c1, c2, r) => {
    const p = (c) => { const a = (ang(c) - 90) * Math.PI / 180; return `${160 + r * Math.cos(a)} ${170 + r * Math.sin(a)}`; };
    return `M ${p(c1)} A ${r} ${r} 0 0 1 ${p(c2)}`;
  };

  el.innerHTML = `
    ${barraTopo('Afinador', '#/ferramentas')}
    <div class="segmentado" id="inst">
      ${Object.entries(INSTRUMENTOS).map(([k, i]) => `<button data-inst="${k}">${i.nome}</button>`).join('')}
    </div>
    <div class="opcoes-linha" id="afins">
      ${AFINACOES.map((a) => `<button class="opcao-linha" data-afin="${a.id}">${a.nome}</button>`).join('')}
    </div>

    <section class="af-mostrador" id="mostrador">
      <svg viewBox="0 0 320 190" class="af-dial" aria-hidden="true">
        <path class="af-zona" d="${arco(-AFINADO, AFINADO, 150)}"/>
        <path class="af-trilho" d="${arco(-50, 50, 150)}"/>
        ${marcas.join('')}
        <text x="${160 + 112 * Math.cos((ang(-50) - 90) * Math.PI / 180) + 8}" y="${170 + 112 * Math.sin((ang(-50) - 90) * Math.PI / 180)}" class="af-sinal">baixa</text>
        <text x="${160 + 112 * Math.cos((ang(50) - 90) * Math.PI / 180) - 8}" y="${170 + 112 * Math.sin((ang(50) - 90) * Math.PI / 180)}" class="af-sinal" text-anchor="end">alta</text>
        <g class="af-agulha" id="agulha"><line x1="160" y1="170" x2="160" y2="34"/><circle cx="160" cy="170" r="7"/></g>
      </svg>
      <div class="af-nota"><b id="nota">–</b><small id="letra"></small></div>
      <p class="af-dica" id="dica" aria-live="polite">Ligue o microfone e toque uma corda solta.</p>
    </section>

    <div class="af-cordas" id="cordas"></div>
    <p class="af-legenda" id="legenda"></p>

    <div class="acoes af-acoes">
      <button class="botao principal largo" id="ligar">${ICONES.som}<span>Ligar o microfone</span></button>
    </div>
    <p class="af-aviso" id="aviso" hidden></p>
  `;
  const $ = (s) => el.querySelector(s);

  function desenharCordas() {
    const lista = cordas();
    const n = lista.length;
    $('#cordas').innerHTML = lista.map((m, i) => `
      <button class="af-corda${st.travada === i ? ' travada' : ''}${st.corda === i ? ' agora' : ''}${st.certas.has(i) ? ' certa' : ''}" data-corda="${i}"
        aria-label="Corda ${n - i}, ${nomeMidi(m)}: tocar a nota de referência">
        <b>${letraMidi(m).replace(/\d+$/, '')}</b><small>${n - i}ª</small>
      </button>`).join('');
    $('#legenda').textContent = st.travada === null
      ? 'Automático: o afinador acha a corda sozinho. Toque numa corda para ouvir a nota certa e travar nela.'
      : `Travado na ${n - st.travada}ª corda (${nomeMidi(lista[st.travada])}). Toque nela de novo para voltar ao automático.`;
    el.querySelectorAll('#inst button').forEach((b) => b.classList.toggle('ativo', b.dataset.inst === st.inst));
    el.querySelectorAll('#afins button').forEach((b) => b.classList.toggle('ativo', b.dataset.afin === st.afin));
  }

  function mostrar(cents, alvo, f) {
    const agulha = $('#agulha');
    const fora = Math.abs(cents) > 50;
    agulha.style.transform = `rotate(${ang(cents)}deg)`;
    const certo = Math.abs(cents) <= AFINADO;
    $('#mostrador').classList.toggle('afinado', certo);
    $('#mostrador').classList.toggle('fora', fora);
    $('#nota').textContent = nomeMidi(alvo);
    $('#letra').textContent = `${letraMidi(alvo)} · ${f.toFixed(1)} Hz`;
    let dica;
    if (certo) dica = 'Afinada';
    else if (cents < -50) dica = 'Muito baixa: aperte a tarraxa';
    else if (cents > 50) dica = 'Muito alta: afrouxe a tarraxa';
    else if (cents < 0) dica = `Baixa ${Math.round(-cents)} cents: aperte um pouco`;
    else dica = `Alta ${Math.round(cents)} cents: afrouxe um pouco`;
    $('#dica').textContent = dica;
  }

  function lerMic(t) {
    if (!st.mic) return;
    st.raf = requestAnimationFrame(lerMic);
    if (t - st.ultimo < 70) return;
    st.ultimo = t;
    const { f } = st.mic.ler();
    if (!f) { st.hist = []; return; }
    // mediana das últimas leituras: tira os saltos de oitava e o ruído do ataque
    st.hist.push(f);
    if (st.hist.length > 5) st.hist.shift();
    if (st.hist.length < 3) return;
    const fm = [...st.hist].sort((a, b) => a - b)[st.hist.length >> 1];
    const m = midiDe(fm);
    const lista = cordas();
    const i = st.travada ?? lista.reduce((melhor, alvo, k) => (Math.abs(m - alvo) < Math.abs(m - lista[melhor]) ? k : melhor), 0);
    const cents = (m - lista[i]) * 100;
    if (st.corda !== i) { st.corda = i; st.desde = 0; desenharCordas(); }
    mostrar(cents, lista[i], fm);
    if (Math.abs(cents) <= AFINADO) {
      if (!st.desde) st.desde = t;
      else if (t - st.desde > SEGURAR && !st.certas.has(i)) { st.certas.add(i); desenharCordas(); }
    } else st.desde = 0;
  }

  async function ligar() {
    if (st.ligando) return;
    if (st.mic) { desligar(); return; }
    if (!microfonePossivel()) {
      const https = 'https://sonoridade.89-117-79-163.sslip.io/app/#/afinador';
      $('#aviso').innerHTML = `O navegador só libera o microfone em endereço seguro (https).<br>Abra por <a href="${https}">${esc(https.replace('https://', ''))}</a>.`;
      $('#aviso').hidden = false;
      return;
    }
    st.ligando = true;
    try {
      const mic = await ligarMicrofone();
      st.ligando = false;
      // saiu da tela enquanto o navegador pedia a permissão: desliga na hora
      if (!st.vivo) { mic.desligar(); return; }
      st.mic = mic;
      $('#ligar').innerHTML = `${ICONES.pausa}<span>Desligar o microfone</span>`;
      $('#ligar').classList.remove('principal');
      $('#dica').textContent = 'Toque uma corda solta';
      $('#aviso').hidden = true;
      st.raf = requestAnimationFrame(lerMic);
    } catch (e) {
      st.ligando = false;
      if (!st.vivo) return;
      $('#aviso').textContent = e.name === 'NotAllowedError'
        ? 'O microfone foi bloqueado. Libere nas permissões do site e tente de novo.'
        : `Não deu para ligar o microfone (${e.message}).`;
      $('#aviso').hidden = false;
    }
  }
  function desligar() {
    cancelAnimationFrame(st.raf);
    st.mic?.desligar();
    st.mic = null;
    st.corda = null;
    $('#ligar').innerHTML = `${ICONES.som}<span>Ligar o microfone</span>`;
    $('#ligar').classList.add('principal');
    $('#mostrador').classList.remove('afinado', 'fora');
    $('#agulha').style.transform = 'rotate(0deg)';
    $('#nota').textContent = '–';
    $('#letra').textContent = '';
    $('#dica').textContent = 'Ligue o microfone e toque uma corda solta.';
    desenharCordas();
  }

  el.addEventListener('click', (e) => {
    const x = e.target.closest('button');
    if (!x) return;
    if (x.id === 'ligar') { ligar(); return; }
    if (x.dataset.corda) {
      const i = Number(x.dataset.corda);
      st.travada = st.travada === i ? null : i;
      if (st.travada !== null) som.tocarMidi(cordas()[i], { baixo: !!INSTRUMENTOS[st.inst].baixo });
      st.hist = [];
      desenharCordas();
      return;
    }
    if (x.dataset.inst) { st.inst = x.dataset.inst; st.travada = null; st.certas.clear(); salvar(); desenharCordas(); som.prepararMidi(cordas(), { baixo: !!INSTRUMENTOS[st.inst].baixo }); return; }
    if (x.dataset.afin) { st.afin = x.dataset.afin; st.travada = null; st.certas.clear(); salvar(); desenharCordas(); }
  });

  desenharCordas();
  som.prepararMidi(cordas(), { baixo: !!INSTRUMENTOS[st.inst].baixo });
  return () => { st.vivo = false; desligar(); };
}
