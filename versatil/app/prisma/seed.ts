// Seed idempotente: NUNCA apaga nada. Cria admin/categorias se faltarem e produtos de exemplo só em dev com banco vazio.
import { PrismaClient, type Condicao } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@versatil.local";
  if (!(await db.usuario.findUnique({ where: { email } }))) {
    await db.usuario.create({ data: { nome: "Administrador", email, senhaHash: await bcrypt.hash(process.env.SEED_ADMIN_SENHA || "versatil123", 10) } });
    console.log("[seed] admin criado:", email);
  }

  const cats = ["Eletrodomésticos", "Eletrônicos", "Casa e Cozinha", "Ferramentas", "Beleza", "Infantil", "Esporte", "Informática"];
  for (const [i, nome] of cats.entries())
    await db.categoria.upsert({ where: { slug: slug(nome) }, create: { nome, slug: slug(nome), ordem: i }, update: {} });

  if (process.env.NODE_ENV === "production" || (await db.produto.count()) > 0) return;
  const c = Object.fromEntries((await db.categoria.findMany()).map((x) => [x.nome, x.id]));
  const demo: [string, string, Condicao, number, number, number, number][] = [
    // título, categoria, condição, preço, mercado, estoque, dias atrás
    ["Air Fryer Mondial 4L Family", "Eletrodomésticos", "CAIXA_ABERTA", 189_90, 349_90, 1, 2],
    ["Smart TV 43\" Full HD", "Eletrônicos", "AVARIA_ESTETICA", 1290_00, 2199_00, 1, 25],
    ["Jogo de Panelas Antiaderente 5 peças", "Casa e Cozinha", "SEM_CAIXA", 139_00, 289_00, 3, 10],
    ["Parafusadeira 12V com Maleta", "Ferramentas", "CAIXA_ABERTA", 149_90, 259_00, 2, 1],
    ["Secador de Cabelo 2000W", "Beleza", "NOVO_LACRADO", 79_90, 159_90, 4, 5],
    ["Fone Bluetooth com Cancelamento de Ruído", "Eletrônicos", "CAIXA_ABERTA", 219_00, 499_00, 1, 32],
    ["Cadeirinha de Carro 0-25kg", "Infantil", "CAIXA_ABERTA", 329_00, 599_00, 1, 14],
    ["Garrafa Térmica 1L Inox", "Casa e Cozinha", "NOVO_LACRADO", 15_00, 49_90, 12, 3],
    ["Notebook 15.6\" i5 8GB SSD 256GB", "Informática", "USADO_REVISADO", 1890_00, 3299_00, 1, 8],
    ["Bicicleta Ergométrica Compacta", "Esporte", "AVARIA_ESTETICA", 590_00, 1099_00, 1, 40],
  ];
  for (const [titulo, cat, condicao, preco, mercado, estoque, dias] of demo) {
    const quando = new Date(Date.now() - dias * 86400000);
    await db.produto.create({
      data: {
        titulo, slug: slug(titulo), condicao, categoriaId: c[cat], precoCents: preco, precoMercadoCents: mercado,
        estoqueDisponivel: estoque, publicadoEm: quando, criadoEm: quando,
        descricao: "Produto de logística reversa, conferido e testado pela nossa equipe. Fotos reais do item.",
      },
    });
  }
  console.log("[seed] produtos de exemplo criados");
}
main().finally(() => db.$disconnect());
