import { redirect } from 'next/navigation';

/** A raiz do site manda direto para o Painel (que exige login). */
export default function Home() {
  redirect('/painel');
}
