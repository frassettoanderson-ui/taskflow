export const soDigitos = (s: string) => (s || "").replace(/\D/g, "");

export function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "1.234,56" | "1234,56" | "1234.56" -> centavos */
export function parseReais(v: string): number | null {
  const s = (v || "").trim().replace(/[R$\s]/g, "");
  if (!s) return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function mascaraTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraCpf(v: string) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function mascaraMoeda(v: string) {
  const d = soDigitos(v);
  if (!d) return "";
  return (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function cpfValido(v: string) {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export function descontoPct(preco: number, mercado?: number | null) {
  if (!mercado || mercado <= preco) return 0;
  return Math.round((1 - preco / mercado) * 100);
}

export function diasDesde(d: Date | null | undefined) {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

export const CONDICOES: Record<string, { rotulo: string; dica: string }> = {
  NOVO_LACRADO: { rotulo: "Novo lacrado", dica: "Embalagem original fechada" },
  CAIXA_ABERTA: { rotulo: "Caixa aberta", dica: "Produto novo, embalagem já aberta" },
  AVARIA_ESTETICA: { rotulo: "Avaria estética", dica: "Marca ou risco que não afeta o uso" },
  SEM_CAIXA: { rotulo: "Sem caixa", dica: "Produto sem a embalagem original" },
  USADO_REVISADO: { rotulo: "Usado revisado", dica: "Testado e funcionando" },
};

export const STATUS_PEDIDO: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  SEPARANDO: "Separando",
  PRONTO: "Pronto p/ retirada",
  RETIRADO: "Retirado",
  EXPIRADO: "Expirado",
  CANCELADO: "Cancelado",
  ESTORNADO: "Estornado",
};
