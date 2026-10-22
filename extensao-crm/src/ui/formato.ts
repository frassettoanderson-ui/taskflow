export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function dataHora(ms: number) {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "2026-10-22" → "22/10/2026" */
export function dataCurta(iso: string) {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
}

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

/** "5548999998888" → "+55 (48) 99999-8888" */
export function telefone(numero: string) {
  const d = numero.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith('55')) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return d ? `+${d}` : '';
}

/** Máscara de telefone para campo: "(48) 99999-8888" (ajusta 8/9 dígitos; aceita +55 na frente). */
export function mascaraTelefone(texto: string) {
  let d = texto.replace(/\D/g, '');
  const ddi = d.length > 11 && d.startsWith('55');
  if (ddi) d = d.slice(2);
  d = d.slice(0, 11);
  let r = d;
  if (d.length > 2) r = `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 6) r = d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return ddi ? `+55 ${r}` : r;
}

/** Máscara de moeda para campo: aceita só dígitos e devolve "R$ 1.234,56" + o valor numérico. */
export function mascaraMoeda(texto: string): { texto: string; valor: number | null } {
  const d = texto.replace(/\D/g, '');
  if (!d) return { texto: '', valor: null };
  const valor = Number(d) / 100;
  return { texto: moeda.format(valor), valor };
}

/** Valor para <input type="datetime-local"> no fuso local. */
export function paraCampoDataHora(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function lerArquivoComoDataUrl(f: File): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => falha(r.error);
    r.readAsDataURL(f);
  });
}
