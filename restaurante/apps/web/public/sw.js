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

const VERSAO = 'v1';
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

  // Arquivos do próprio site (JS, CSS, ícones): usa o guardado se houver, e
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
