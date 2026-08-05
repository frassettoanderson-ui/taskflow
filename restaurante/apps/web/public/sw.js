/*
 * O "service worker": um programinha que o navegador guarda e roda mesmo com o
 * site fechado. É ele que faz duas coisas que só existem por causa dele:
 *
 *   1. o sistema abrir SEM INTERNET (as telas ficam guardadas aqui);
 *   2. o sistema poder ser instalado como aplicativo.
 *
 * REGRA DE OURO deste arquivo: nunca guardar resposta de /api.
 * Cardápio, pedido e caixa mudam a todo momento — mostrar uma resposta velha
 * seria pior do que dizer "estou sem internet". O que guardamos são as TELAS
 * (o desenho), não os DADOS.
 */

/**
 * Subir esta versão joga fora tudo o que estava guardado e obriga o navegador
 * a buscar de novo. Mexeu na estratégia de cache? Sobe a versão.
 */
const VERSAO = 'v2';
const CACHE_CASCA = `casca-${VERSAO}`;

/** As telas que o caixa precisa conseguir abrir mesmo sem internet. */
const TELAS = ['/pdv', '/painel', '/offline'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_CASCA)
      // addAll falha inteiro se UMA falhar; por isso pedimos uma a uma.
      .then((cache) => Promise.allSettled(TELAS.map((t) => cache.add(t))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(nomes.filter((n) => n !== CACHE_CASCA).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;

  // Só cuidamos de navegação e de arquivos nossos. O resto passa direto.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // NUNCA guardar API nem fotos: são dados vivos.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;

  // Abrir uma tela: tenta a internet primeiro (para vir sempre atualizada) e,
  // falhando, entrega a versão guardada. É o que faz o caixa continuar de pé.
  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_CASCA).then((c) => c.put(req, copia));
          return res;
        })
        .catch(async () => {
          const guardada = await caches.match(req);
          return guardada || (await caches.match('/offline')) || Response.error();
        }),
    );
    return;
  }

  /**
   * O CÓDIGO DO SISTEMA (`/_next/`) vem SEMPRE da internet, com o guardado só
   * como reserva para quando ela cair.
   *
   * Por que não guardar primeiro, como fazemos com o resto: em
   * desenvolvimento o endereço do arquivo NÃO muda quando o código muda
   * (`page.js` continua `page.js`). Servindo o guardado primeiro, a tela fica
   * mostrando código velho mesmo depois de uma correção — foi exatamente o que
   * aconteceu com o interruptor: o servidor já mandava o novo e o navegador
   * insistia no antigo.
   *
   * Offline continua funcionando: se a rede falhar, cai no guardado.
   */
  if (url.pathname.startsWith('/_next/')) {
    evento.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_CASCA).then((c) => c.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then((g) => g || Response.error())),
    );
    return;
  }

  // Os demais arquivos nossos (ícones, manifesto): usa o guardado se houver, e
  // atualiza por baixo dos panos para a próxima vez.
  evento.respondWith(
    caches.match(req).then((guardado) => {
      const daRede = fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_CASCA).then((c) => c.put(req, copia));
          return res;
        })
        .catch(() => guardado);
      return guardado || daRede;
    }),
  );
});

/**
 * A tela avisa "voltei a ter internet" e o service worker repassa para todas as
 * abas abertas — assim a fila de vendas sobe mesmo que o caixa esteja em outra
 * aba naquele momento.
 */
self.addEventListener('message', (evento) => {
  if (evento.data === 'sincronizar') {
    self.clients.matchAll().then((abas) => abas.forEach((a) => a.postMessage('sincronizar')));
  }
});
