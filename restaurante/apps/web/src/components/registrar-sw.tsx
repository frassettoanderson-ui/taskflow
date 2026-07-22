'use client';

import { useEffect } from 'react';

/**
 * Liga o service worker (o programinha que guarda as telas e deixa o sistema
 * ser instalado). Não desenha nada — só liga e sai de cena.
 *
 * Fora do `localhost` os navegadores só aceitam service worker em HTTPS. Por
 * isso, em desenvolvimento, ele funciona; num servidor sem certificado, não —
 * e é bom que seja assim.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* sem service worker o sistema continua funcionando — só não offline */
      });
    };

    // Depois do carregamento, para não disputar banda com a primeira tela.
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar);

    return () => window.removeEventListener('load', registrar);
  }, []);

  return null;
}
