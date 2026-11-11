// Player do YouTube (IFrame API) para tocar a gravação original.
// O vídeo fica visível (exigência do YouTube); o app só lê o tempo para mover a cifra.

let api = null;
// chamar cedo (ao abrir a tela) deixa o primeiro toque abrir o vídeo sem esperar
export function carregarApi() {
  if (!api) {
    api = new Promise((ok, falhou) => {
      if (window.YT?.Player) { ok(window.YT); return; }
      const antes = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { antes?.(); ok(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { api = null; falhou(new Error('sem YouTube')); };
      document.head.appendChild(s);
    });
  }
  return api;
}

// Cria o player dentro de `caixa`. Devolve { tocar, pausar, ir, tempo, tocando, volume, destruir, pronto }.
// aoErro(motivo): 'rede' (não carregou o YouTube), 'video' (vídeo bloqueado/removido) ou
// 'parado' (pediu para tocar e não começou: o navegador quer um toque no próprio vídeo).
export function criarPlayer(caixa, videoId, { inicio = 0, autoplay = false, aoMudar = () => {}, aoErro = () => {} } = {}) {
  const alvo = document.createElement('div');
  caixa.replaceChildren(alvo);
  let p = null;
  let vivo = true;
  let pedidoTocar = autoplay;
  let vigia = 0;
  let comecou = false;
  // pediu para tocar: se em 2,5 s não estiver tocando, avisa
  const vigiar = () => {
    clearTimeout(vigia);
    vigia = setTimeout(() => { if (vivo && pedidoTocar && !comecou) aoErro('parado'); }, 2500);
  };
  if (autoplay) vigiar();
  const pronto = carregarApi().catch(() => { if (vivo) aoErro('rede'); return new Promise(() => {}); }).then((YT) => new Promise((ok) => {
    if (!vivo) return;
    p = new YT.Player(alvo, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { start: Math.floor(inicio), autoplay: autoplay ? 1 : 0, playsinline: 1, rel: 0, modestbranding: 1, controls: 1 },
      events: {
        onReady: () => { if (pedidoTocar) p.playVideo(); ok(); },
        onStateChange: (e) => { if (e.data === 1) comecou = true; aoMudar(e.data); },
        onError: () => { if (vivo) { clearTimeout(vigia); aoErro('video'); } },
      },
    });
  }));
  return {
    pronto,
    tocar() { pedidoTocar = true; comecou = p?.getPlayerState?.() === 1; p?.playVideo?.(); if (!comecou) vigiar(); },
    pausar() { pedidoTocar = false; p?.pauseVideo?.(); },
    ir(seg) { p?.seekTo?.(Math.max(0, seg), true); },
    tempo() { return p?.getCurrentTime?.() || 0; },
    tocando() { return p?.getPlayerState?.() === 1; },
    volume(v) { p?.setVolume?.(Math.round(v)); },
    destruir() { vivo = false; clearTimeout(vigia); try { p?.destroy?.(); } catch { /* já foi */ } caixa.replaceChildren(); },
  };
}

// estados do player
export const ESTADO = { fim: 0, tocando: 1, pausado: 2, carregando: 3 };
