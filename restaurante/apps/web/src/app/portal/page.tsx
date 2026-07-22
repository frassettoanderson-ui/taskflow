import type { Metadata } from 'next';
import { Vitrine, type MarcaNaVitrine, type Categoria } from './vitrine';

const API = process.env.API_INTERNAL_URL || 'http://localhost:3011';

export const metadata: Metadata = {
  title: 'Portal — peça dos melhores restaurantes',
  description: 'Descubra restaurantes perto de você e ganhe cashback que vale na rede toda.',
};

async function buscar<T>(caminho: string, padrao: T): Promise<T> {
  try {
    const res = await fetch(`${API}/api${caminho}`, { cache: 'no-store' });
    if (!res.ok) return padrao;
    return (await res.json()) as T;
  } catch {
    return padrao;
  }
}

export default async function PaginaPortal() {
  const [marcas, categorias] = await Promise.all([
    buscar<MarcaNaVitrine[]>('/portal/vitrine', []),
    buscar<Categoria[]>('/portal/categorias', []),
  ]);

  return <Vitrine iniciais={marcas} categorias={categorias} />;
}
