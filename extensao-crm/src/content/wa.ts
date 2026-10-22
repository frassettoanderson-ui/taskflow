// Cliente da ponte: chama métodos do WPP a partir do mundo isolado.
import { EVT, REQ, RES, type Evento, type Metodos, type NomeMetodo, type Resposta } from '../shared/protocolo';

let seq = 0;
const pendentes = new Map<number, { ok: (v: unknown) => void; falha: (e: Error) => void }>();
const ouvintes = new Set<(e: Evento) => void>();

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const d = e.data;
  if (d?.src === RES) {
    const r = d as Resposta;
    const p = pendentes.get(r.id);
    if (!p) return;
    pendentes.delete(r.id);
    r.ok ? p.ok(r.valor) : p.falha(new Error(r.erro));
  } else if (d?.src === EVT) {
    ouvintes.forEach((fn) => fn(d as Evento));
  }
});

export function wa<M extends NomeMetodo>(metodo: M, ...args: Parameters<Metodos[M]>): Promise<Awaited<ReturnType<Metodos[M]>>> {
  const id = ++seq;
  return new Promise((ok, falha) => {
    pendentes.set(id, { ok: ok as (v: unknown) => void, falha });
    window.postMessage({ src: REQ, id, metodo, args }, location.origin);
    setTimeout(() => {
      if (pendentes.delete(id)) falha(new Error(`tempo esgotado: ${metodo}`));
    }, 60_000);
  });
}

export function aoEvento(fn: (e: Evento) => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** Resolve quando o WhatsApp Web terminou de carregar e o WPP está utilizável. */
export function esperarPronto(): Promise<void> {
  return new Promise((ok) => {
    const tenta = () =>
      wa('pronto')
        .then((p) => (p ? ok() : setTimeout(tenta, 1000)))
        .catch(() => setTimeout(tenta, 1000));
    const desliga = aoEvento((e) => {
      if (e.tipo === 'pronto') {
        desliga();
        ok();
      }
    });
    tenta();
  });
}
