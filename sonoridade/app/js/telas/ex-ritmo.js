// Exercício "Batida no tempo" (#/exercicios/ritmo).
// O aluno escolhe a batida e o BPM pedido, aperta Começar e toca. O microfone acha cada golpe da mão:
//  - o app mede o BPM em que o aluno está tocando e diz se está acima, abaixo ou no tempo;
//  - confere, compasso a compasso, se a batida está certa (bateu onde devia, passou sem tocar onde devia,
//    e — quando dá para ouvir — se a mão desceu/subiu no lugar certo).
// Dois jeitos: sozinho (só a contagem antes) ou ouvindo a batida no fone para acompanhar.
import { BATIDAS, contagem } from '../dados/batidas.js';
import { acorde } from '../dados/acordes.js';
import { barraTopo, esc, guardar, ler, ICONES, ehDedilhado } from '../ui/comum.js';
import { passosHtml } from './batidas.js';
import * as som from '../audio/som.js';
import { microfonePossivel, ouvirGolpes } from '../audio/microfone.js';

const DE_MAO = BATIDAS.filter((b) => ![...b.passos].some(ehDedilhado));   // dedilhado fica de fora
const SENSIB = { baixa: 0.7, normal: 1, alta: 1.45 };
const mediana = (l) => { const o = [...l].sort((x, y) => x - y); return o.length ? o[Math.floor(o.length / 2)] : 0; };

export function montar(el, ex) {
  const pref = ler('exercicios.ritmo', {});
  const st = {
    id: DE_MAO.some((b) => b.id === pref.id) ? pref.id : 'colcheias',
    bpm: {},                                   // bpm escolhido por batida
    modo: pref.modo === 'fone' ? 'fone' : 'sozinho',
    sensib: SENSIB[pref.sensib] ? pref.sensib : 'normal',
    tocando: false, ouvindo: false, vivo: true, vez: 0,
    mic: null, timer: 0, raf: 0,
  };
  Object.assign(st.bpm, pref.bpm || {});
  const bat = () => DE_MAO.find((b) => b.id === st.id);
  const alvo = () => st.bpm[st.id] || bat().bpm;
  const salvar = () => guardar('exercicios.ritmo', { id: st.id, modo: st.modo, sensib: st.sensib, bpm: st.bpm });
  const tolerancia = () => Math.max(3, Math.round(alvo() * 0.04));

  el.innerHTML = `
    ${barraTopo(esc(ex.nome), '#/exercicios')}
    <p class="intro">Escolha a batida, aperte Começar e toque com o violão perto do celular. O app escuta, mede o seu tempo e confere a batida, compasso por compasso.</p>
    <div class="opcoes-linha" id="lista"></div>

    <section class="rt-batida">
      <div class="passos" id="passos"></div>
      <p class="rt-dica" id="dica"></p>
      <button class="botao" id="exemplo">${ICONES.som}<span>Ouvir como é</span></button>
    </section>

    <div class="ex-ajustes rt-ajustes">
      <div class="cf-controle">
        <span class="cf-rotulo">Tocar a</span>
        <div class="cf-passo">
          <button class="redondo" data-acao="bpm-" aria-label="Mais devagar">${ICONES.menos}</button>
          <output id="alvo"></output>
          <button class="redondo" data-acao="bpm+" aria-label="Mais rápido">${ICONES.mais}</button>
        </div>
        <span class="cf-volta">batidas por minuto</span>
      </div>
      <div class="cf-controle">
        <span class="cf-rotulo">Microfone</span>
        <div class="rt-sensib" id="sensib">
          <button data-sensib="baixa">Menos</button><button data-sensib="normal">Normal</button><button data-sensib="alta">Mais</button>
        </div>
        <span class="cf-volta">sensibilidade</span>
      </div>
    </div>

    <div class="segmentado" id="modo">
      <button data-modo="sozinho">Tocar sozinho</button>
      <button data-modo="fone">Ouvindo a batida no fone</button>
    </div>
    <p class="rt-aviso-fone" id="avisoFone" hidden>Use fone de ouvido: sem fone, o microfone ouve o violão do app e confunde com o seu.</p>

    <button class="botao principal largo" id="play">${ICONES.play}<span>Começar</span></button>

    <section class="rt-painel" id="painel" aria-live="polite">
      <div class="rt-contagem" id="contagem" hidden></div>
      <div class="rt-tempo">
        <div class="rt-numero"><b id="seuBpm">–</b><span>seu tempo</span></div>
        <div class="rt-recado" id="recado">Aperte Começar. Depois da contagem, toque a batida.</div>
      </div>
      <div class="rt-regua" aria-hidden="true">
        <span class="rt-faixa" id="faixa"></span>
        <i class="rt-ponteiro" id="ponteiro" hidden></i>
        <small class="rt-esq">mais devagar</small><small class="rt-meio" id="reguaAlvo"></small><small class="rt-dir">mais rápido</small>
      </div>
      <div class="passos rt-conferencia" id="conferencia"></div>
      <p class="rt-veredito" id="veredito"></p>
      <div class="rt-nivel" aria-hidden="true"><i id="nivel"></i></div>
    </section>

    <div class="ex-placar">
      <div><span class="rotulo">Compassos certos</span><b id="limpos">0</b></div>
      <div><span class="rotulo">Seguidos</span><b id="seguidos">0</b></div>
      <div><span class="rotulo">Recorde</span><b id="rec">–</b></div>
    </div>
    <p class="ex-resultado" id="resultado" hidden></p>
    <p class="af-aviso" id="aviso" hidden></p>
  `;
  const $ = (s) => el.querySelector(s);

  // ---------- desenho das opções ----------
  function desenhar() {
    const b = bat();
    $('#lista').innerHTML = DE_MAO.map((x) => `<button class="opcao-linha${x.id === st.id ? ' ativo' : ''}" data-batida="${x.id}">${esc(x.nome)}</button>`).join('');
    $('#passos').innerHTML = passosHtml(b);
    $('#conferencia').innerHTML = passosHtml(b);
    $('#dica').textContent = b.dica;
    $('#alvo').textContent = `${alvo()} bpm`;
    $('#reguaAlvo').textContent = `${alvo()} bpm`;
    el.querySelectorAll('#modo button').forEach((x) => x.classList.toggle('ativo', x.dataset.modo === st.modo));
    el.querySelectorAll('#sensib button').forEach((x) => x.classList.toggle('ativo', x.dataset.sensib === st.sensib));
    $('#avisoFone').hidden = st.modo !== 'fone';
    const r = ler('exercicios.recordes', {}).ritmo?.[st.id];
    $('#rec').textContent = r || '–';
    // faixa verde (no tempo) na régua de ±20 bpm
    const tol = tolerancia();
    $('#faixa').style.left = `${50 - (tol / 20) * 50}%`;
    $('#faixa').style.width = `${(tol / 20) * 100}%`;
  }

  // ---------- som de exemplo / guia ----------
  const SOL = acorde('G');
  som.preparar([SOL]);
  function tocarPasso(b, i, t, comClick = true) {
    if (comClick && i % b.porTempo === 0) som.click(t, i === 0, 0.42);
    const p = b.passos[i];
    if (p === 'B' || p === 'C') som.batida(SOL, { direcao: p === 'B' ? 'baixo' : 'cima', quando: t, forca: p === 'B' ? 1 : 0.85 });
    else if (p === 'X') som.abafada(t, SOL);
  }
  let exemploAte = 0;
  async function exemplo() {
    if (st.tocando) return;
    const b = bat();
    await som.preparar([SOL]);
    const c = som.contexto();
    const dp = 60 / alvo() / b.porTempo;
    const t0 = c.currentTime + 0.1;
    for (let k = 0; k < b.passos.length * 2; k++) tocarPasso(b, k % b.passos.length, t0 + k * dp);
    exemploAte = t0 + b.passos.length * 2 * dp;
  }

  // ---------- motor: grade do aluno, golpes e conferência ----------
  // A grade é t = a + passo * k (k = índice do passo, 0 = primeiro passo do 1º compasso).
  // Começa na grade da contagem e vai se ajustando ao tempo real do aluno (mínimos quadrados).
  let r = null;
  function novaRodada(inicio, lat) {
    const b = bat();
    const passo = 60 / alvo() / b.porTempo;
    r = {
      b, n: b.passos.length, passo0: passo, a: inicio, passo, lat, inicio,
      golpes: [], avaliado: -1, limpos: 0, avaliados: 0, seguidos: 0, melhor: 0,
      bpms: [], sentB: [], sentC: [],
    };
    if (window.__ritmoFonte) window.__ritmoRodada = r;   // só no teste (som do app no lugar do microfone)
  }

  function aoGolpe(g) {
    if (!r || !st.tocando) return;
    const t = g.t - r.lat;
    if (t < r.a - r.passo * 0.5) return;               // som da contagem / antes de começar
    // em que passo caiu: o 1º pela grade da contagem; os outros contando os passos desde o golpe anterior
    // (assim, mesmo tocando bem mais devagar ou mais rápido que o pedido, cada golpe cai no passo certo)
    const ult = r.golpes[r.golpes.length - 1];
    const k = ult ? ult.k + Math.max(1, Math.round((t - ult.t) / r.passo)) : Math.round((t - r.a) / r.passo);
    if (k < 0) return;
    r.golpes.push({ t, k, sentido: g.sentido });
    ajustarGrade();
  }

  function ajustarGrade() {
    const g = r.golpes;
    const kMax = g[g.length - 1].k;
    const usados = g.filter((x) => x.k >= kMax - 2 * r.n).slice(-16);
    if (usados.length < 4 || kMax - usados[0].k < r.b.porTempo * 2) return;
    let sk = 0, st2 = 0, skk = 0, skt = 0;
    for (const x of usados) { sk += x.k; st2 += x.t; skk += x.k * x.k; skt += x.k * x.t; }
    const m = usados.length;
    const den = m * skk - sk * sk;
    if (!den) return;
    let passo = (m * skt - sk * st2) / den;
    passo = Math.max(r.passo0 * 0.6, Math.min(r.passo0 * 1.6, passo));
    const a = (st2 - passo * sk) / m;
    r.passo = passo; r.a = a;
    r.bpms.push(60 / (passo * r.b.porTempo));
    if (r.bpms.length > 400) r.bpms.shift();
  }

  // leitura do sentido da mão: compara cada golpe com os golpes do próprio aluno (desce × sobe).
  // Só acusa quando o golpe soa pelo menos tão "descida" quanto as descidas típicas dele (ou tão "subida"
  // quanto as subidas típicas) — na dúvida, não acusa.
  function leituraSentido() {
    if (r.sentB.length < 6 || r.sentC.length < 6) return null;   // espera conhecer a mão do aluno
    const desce = mediana(r.sentB.slice(-24)), sobe = mediana(r.sentC.slice(-24));
    if (desce - sobe < 6) return null;                  // menos de 6 ms de diferença: não dá para separar com segurança
    return { desce, sobe };
  }

  function conferir(m) {
    const { b, n } = r;
    const doCompasso = r.golpes.filter((x) => Math.floor(x.k / n) === m);
    if (!doCompasso.length) {
      if (r.golpes.length) { r.seguidos = 0; }
      return r.golpes.length ? { vazio: true } : null;
    }
    const leitura = leituraSentido();
    const estados = [];
    const erros = [];
    for (let i = 0; i < n; i++) {
      const p = b.passos[i];
      const golpe = doCompasso.find((x) => x.k - m * n === i);
      const devia = p !== '-';
      if (devia && golpe) {
        const sentido = (p === 'B' || p === 'C') ? golpe.sentido : null;
        if (leitura && sentido != null && (p === 'B' ? sentido < leitura.sobe : sentido > leitura.desce)) {
          estados.push('trocado');
          erros.push(`no ${rotulo(i)} a mão ${p === 'B' ? 'subiu; era para descer' : 'desceu; era para subir'}`);
          continue;
        }
        if (sentido != null) (p === 'B' ? r.sentB : r.sentC).push(sentido);
        estados.push('ok');
      } else if (devia) { estados.push('falta'); erros.push(`faltou bater no ${rotulo(i)}`); }
      else if (golpe) { estados.push('sobra'); erros.push(`no ${rotulo(i)} é para a mão passar sem tocar`); }
      else estados.push('');
    }
    const bpm = r.bpms.length ? r.bpms[r.bpms.length - 1] : null;
    const tempoOk = bpm != null && Math.abs(bpm - alvo()) <= tolerancia();
    const certo = !erros.length;
    r.avaliados++;
    if (certo && tempoOk) { r.limpos++; r.seguidos++; r.melhor = Math.max(r.melhor, r.seguidos); } else r.seguidos = 0;
    return { estados, erros, certo, tempoOk };
  }
  // nome do passo para o aluno: 2, "e" do 2, "a" do 3
  function rotulo(i) {
    const b = r.b, c = contagem(b)[i];
    const tempo = Math.floor(i / b.porTempo) + 1;
    if (b.contagem && b.contagem.every((x) => /^\d+$/.test(x))) return c;   // 6/8: conta 1 a 6
    if (i % b.porTempo === 0) return c || String(tempo);
    return `"${c || (i % b.porTempo === 1 ? 'e' : 'a')}" do ${tempo}`;
  }

  // firmeza: quanto os golpes fogem da grade (ms), nos últimos 2 compassos
  function firmeza() {
    const g = r.golpes.filter((x) => x.k >= (r.golpes.at(-1)?.k ?? 0) - 2 * r.n);
    if (g.length < 4) return null;
    const desvios = g.map((x) => (x.t - (r.a + r.passo * x.k)) * 1000);
    return Math.sqrt(desvios.reduce((s, d) => s + d * d, 0) / desvios.length);
  }

  // ---------- tela ao vivo ----------
  const passosConf = () => [...el.querySelectorAll('#conferencia .passo')];
  function acompanhar() {
    if (!st.tocando) return;
    const c = som.contexto();
    const agora = c.currentTime - r.lat;               // mesmo relógio dos golpes
    const ouvido = som.tempoAudio();                  // o que o aluno está ouvindo agora

    // contagem
    const falta = r.inicio - ouvido;
    const cont = $('#contagem');
    if (falta > 0) {
      const tempo = 60 / alvo();
      cont.hidden = false;
      cont.textContent = String(Math.max(1, r.b.tempos - Math.floor(falta / tempo)));
    } else cont.hidden = true;

    // passo atual na fileira (pela grade do aluno)
    const kAgora = (ouvido - r.a) / r.passo;
    const atual = falta <= 0 ? ((Math.round(kAgora) % r.n) + r.n) % r.n : -1;
    passosConf().forEach((p, i) => p.classList.toggle('agora', i === atual));

    // confere cada compasso que já terminou (com folga para o último golpe chegar)
    for (;;) {
      const m = r.avaliado + 1;
      const fim = r.a + r.passo * ((m + 1) * r.n - 0.5);   // meio passo depois do último passo do compasso
      if (agora - 0.07 < fim) break;                      // o palpite do golpe chega ~50 ms depois
      r.avaliado = m;
      const res = conferir(m);
      if (res) mostrarCompasso(res);
    }

    // tempo do aluno
    const bpm = r.bpms.length ? mediana(r.bpms.slice(-3)) : null;
    if (bpm != null) {
      const dif = bpm - alvo();
      const tol = tolerancia();
      $('#seuBpm').textContent = Math.round(bpm);
      const p = $('#ponteiro');
      p.hidden = false;
      p.style.left = `${Math.max(0, Math.min(100, 50 + (dif / 20) * 50))}%`;
      p.className = `rt-ponteiro ${Math.abs(dif) <= tol ? 'certo' : 'fora'}`;
      const fz = firmeza();
      const firme = fz == null ? '' : fz < 25 ? ' Mão firme.' : fz < 45 ? ' Segure a mão mais igual.' : ' A mão está variando muito.';
      $('#recado').innerHTML = Math.abs(dif) <= tol
        ? `<b class="ok">No tempo.</b>${firme}`
        : dif > 0 ? `<b>${Math.round(dif)} bpm acima.</b> Vá mais devagar.` : `<b>${Math.round(-dif)} bpm abaixo.</b> Vá mais rápido.`;
    } else if (falta <= 0) {
      $('#recado').textContent = r.golpes.length ? 'Continue tocando, estou medindo…' : 'Pode tocar! Estou ouvindo.';
    }
  }

  function mostrarCompasso(res) {
    const ps = passosConf();
    ps.forEach((p) => p.classList.remove('r-ok', 'r-falta', 'r-sobra', 'r-trocado'));
    if (res.vazio) { $('#veredito').textContent = 'Não ouvi nada nesse compasso.'; return; }
    res.estados.forEach((e, i) => { if (e) ps[i].classList.add(`r-${e}`); });
    $('#veredito').innerHTML = res.certo
      ? (res.tempoOk ? '<b class="ok">Batida certa e no tempo!</b>' : '<b class="ok">Batida certa.</b> Agora acerte o tempo.')
      : `<b>Quase:</b> ${esc(res.erros.slice(0, 2).join('; '))}.`;
    $('#limpos').textContent = r.limpos;
    $('#seguidos').textContent = r.seguidos;
  }

  // ---------- começar / parar ----------
  async function comecar() {
    if (!microfonePossivel()) {
      $('#aviso').innerHTML = 'O microfone só funciona em endereço seguro (https). Abra por <a href="https://sonoridade.89-117-79-163.sslip.io/app/#/exercicios/ritmo">sonoridade.89-117-79-163.sslip.io</a>.';
      $('#aviso').hidden = false;
      return;
    }
    const vez = ++st.vez;
    st.tocando = true;
    $('#play').innerHTML = `${ICONES.pausa}<span>Parar</span>`;
    $('#resultado').hidden = true;
    $('#aviso').hidden = true;
    $('#veredito').textContent = '';
    $('#limpos').textContent = '0';
    $('#seguidos').textContent = '0';
    $('#seuBpm').textContent = '–';
    $('#ponteiro').hidden = true;
    passosConf().forEach((p) => p.classList.remove('r-ok', 'r-falta', 'r-sobra', 'r-trocado'));
    try {
      if (!st.mic) st.mic = await (window.__ritmoFonte ? ouvirGolpes({ aoGolpe, aoNivel, fonte: window.__ritmoFonte() }) : ouvirGolpes({ aoGolpe, aoNivel }));
      st.mic.sensibilidade(SENSIB[st.sensib]);
    } catch {
      if (vez !== st.vez) return;
      st.tocando = false;
      $('#play').innerHTML = `${ICONES.play}<span>Começar</span>`;
      $('#aviso').textContent = 'Não deu para ligar o microfone. Libere a permissão do site e tente de novo.';
      $('#aviso').hidden = false;
      return;
    }
    if (!st.vivo || vez !== st.vez || !st.tocando) { desligarMic(); return; }
    if (st.modo === 'fone') await som.preparar([SOL]);
    const c = som.contexto();
    const b = bat();
    const tempo = 60 / alvo();
    const t0 = Math.max(c.currentTime + 0.15, exemploAte);
    const inicio = t0 + b.tempos * tempo;               // 1 compasso de contagem
    for (let k = 0; k < b.tempos; k++) som.click(t0 + k * tempo, k === 0, 0.5);
    const lat = (c.outputLatency || c.baseLatency || 0) + (st.mic.atrasoEntrada || 0);
    novaRodada(inicio, lat);
    st.mic.intervalo(Math.max(0.06, r.passo0 * 0.45));
    if (st.modo === 'fone') {
      let prox = 0;
      const dp = tempo / b.porTempo;
      const agendar = () => {
        while (inicio + prox * dp < c.currentTime + 0.12) { tocarPasso(b, prox % b.passos.length, inicio + prox * dp); prox++; }
      };
      agendar();
      st.timer = setInterval(agendar, 25);
    }
    st.raf = setInterval(acompanhar, 33);      // ~30 vezes por segundo basta (e segue rodando com a tela em segundo plano)
  }

  function parar() {
    if (!st.tocando) return;
    st.tocando = false;
    st.vez++;
    clearInterval(st.timer);
    clearInterval(st.raf);
    som.silenciar();
    $('#play').innerHTML = `${ICONES.play}<span>Começar</span>`;
    $('#contagem').hidden = true;
    passosConf().forEach((p) => p.classList.remove('agora'));
    if (r && r.avaliados) {
      const rec = ler('exercicios.recordes', {});
      rec.ritmo = rec.ritmo || {};
      const antes = rec.ritmo[st.id] || 0;
      if (r.melhor > antes) { rec.ritmo[st.id] = r.melhor; guardar('exercicios.recordes', rec); }
      const media = r.bpms.length ? Math.round(mediana(r.bpms)) : null;
      $('#resultado').hidden = false;
      $('#resultado').innerHTML = `<b>${r.limpos} de ${r.avaliados}</b> compassos certos e no tempo.`
        + (media ? ` Seu tempo ficou em <b>${media} bpm</b> (pedido: ${alvo()}).` : '')
        + (r.melhor > antes ? ` <b>Recorde novo: ${r.melhor} ${r.melhor > 1 ? 'compassos seguidos' : 'compasso'}!</b>` : '')
        + (r.limpos === r.avaliados && r.avaliados >= 8 ? ' Pode subir 5 bpm.' : '');
      desenhar();
    }
    r = null;
    desligarMic();
    $('#nivel').style.width = '0%';
  }

  function aoNivel(v) { $('#nivel').style.width = `${Math.round(v * 100)}%`; }
  function desligarMic() { st.mic?.desligar(); st.mic = null; }

  el.addEventListener('click', (e) => {
    const x = e.target.closest('button');
    if (!x) return;
    if (x.id === 'play') { st.tocando ? parar() : comecar(); return; }
    if (x.id === 'exemplo') { exemplo(); return; }
    if (st.tocando && !x.dataset.sensib) return;      // durante o exercício só a sensibilidade muda
    if (x.dataset.batida) st.id = x.dataset.batida;
    else if (x.dataset.acao === 'bpm-' || x.dataset.acao === 'bpm+') st.bpm[st.id] = Math.max(40, Math.min(160, alvo() + (x.dataset.acao === 'bpm+' ? 5 : -5)));
    else if (x.dataset.modo) st.modo = x.dataset.modo;
    else if (x.dataset.sensib) { st.sensib = x.dataset.sensib; st.mic?.sensibilidade(SENSIB[st.sensib]); }
    else return;
    salvar();
    desenhar();
  });
  const tecla = (e) => { if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); st.tocando ? parar() : comecar(); } };
  document.addEventListener('keydown', tecla);
  desenhar();
  return () => { st.vivo = false; parar(); desligarMic(); document.removeEventListener('keydown', tecla); };
}
