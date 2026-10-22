import { useEffect, useState } from 'react';
import { aoMudar, ler, type Banco, type Chave } from '../shared/dados';

/** Lê uma coleção do storage e acompanha mudanças feitas em qualquer parte da extensão. */
export function useColecao<K extends Chave>(chave: K): Banco[K] | undefined {
  const [valor, setValor] = useState<Banco[K]>();
  useEffect(() => {
    let vivo = true;
    ler(chave).then((v) => vivo && setValor(v));
    const desliga = aoMudar(chave, setValor);
    return () => {
      vivo = false;
      desliga();
    };
  }, [chave]);
  return valor;
}

export function useEsc(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && fn();
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [fn]);
}
