import { api } from './api';

// Baixa o instalador do agente e-Continuo "carimbado": injeta a chave API do
// escritorio no NOME do arquivo (depois de "__"). O instalador le essa chave
// sozinho e se configura sem o usuario digitar nada. Se nao houver chave ainda,
// baixa o instalador generico (o assistente pedira a chave manualmente).
const INSTALADOR_URL = '/GestorOA-eContinuo-Setup.exe';

export async function baixarAgente(): Promise<{ comChave: boolean }> {
  let apiKey: string | null = null;
  try {
    const r = await api.get<{ apiKey: string | null }>('/robo/api-key');
    apiKey = r.apiKey;
  } catch {
    // sem permissao p/ ver a chave -> baixa generico
  }

  const resp = await fetch(INSTALADOR_URL);
  if (!resp.ok) throw new Error('Instalador indisponivel no servidor.');
  const blob = await resp.blob();

  const nome = apiKey
    ? `GestorOA-eContinuo-Setup__${apiKey}.exe`
    : 'GestorOA-eContinuo-Setup.exe';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { comChave: !!apiKey };
}
