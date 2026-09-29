// Seed idempotente: NUNCA apaga nada. Cria admin/categorias se faltarem e produtos de exemplo só em dev com banco vazio.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Condicao } from "@prisma/client";
import bcrypt from "bcryptjs";
import { salvarFoto } from "../src/lib/uploads";

const db = new PrismaClient();
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Demo = {
  titulo: string;
  cat: string;
  condicao: Condicao;
  preco: number;
  mercado: number;
  estoque: number;
  dias: number;
  fotos: string[];
  marca?: string;
  sku?: string;
  aplicacao?: string[];
  descricao: string;
};

const DEMO: Demo[] = [
  {
    titulo: "Comutador de Ignição Facobras – Linha Renault", cat: "Autopeças", condicao: "NOVO_LACRADO", preco: 24_40, mercado: 59_90, estoque: 3, dias: 1,
    fotos: ["comutador"], marca: "Facobras", sku: "940.1161",
    aplicacao: ["Renault Clio até 1999", "Renault 19", "Renault Furgão Master"],
    descricao: "Peça para reposição do sistema de ignição. Aplicação conforme indicado na embalagem.",
  },
  {
    titulo: "Air Fryer Philips Walita 4,1L Preta", cat: "Eletroportáteis", condicao: "CAIXA_ABERTA", preco: 389_90, mercado: 699_00, estoque: 1, dias: 2,
    fotos: ["air-fryer"], marca: "Philips Walita",
    descricao: "Fritadeira sem óleo com cesto de 4,1 litros, controle de tempo e temperatura. Produto novo, embalagem aberta — testado e funcionando. Acompanha manual.",
  },
  {
    titulo: "Caixa de Som Bluetooth JBL à Prova d'Água", cat: "Eletrônicos", condicao: "CAIXA_ABERTA", preco: 459_00, mercado: 799_00, estoque: 2, dias: 4,
    fotos: ["caixa-som"], marca: "JBL",
    descricao: "Caixa de som portátil com Bluetooth, bateria recarregável e resistência à água. Acompanha cabo de carregamento.",
  },
  {
    titulo: "Parafusadeira e Furadeira DeWalt 20V com Bateria", cat: "Ferramentas", condicao: "AVARIA_ESTETICA", preco: 549_00, mercado: 999_00, estoque: 1, dias: 12,
    fotos: ["parafusadeira"], marca: "DeWalt",
    descricao: "Parafusadeira/furadeira a bateria 20V com mandril de 13 mm. Pequeno risco na carcaça, sem efeito no funcionamento.",
  },
  {
    titulo: "Fone de Ouvido Bluetooth Over-ear", cat: "Eletrônicos", condicao: "CAIXA_ABERTA", preco: 149_90, mercado: 329_00, estoque: 4, dias: 6,
    fotos: ["fone", "fone2"],
    descricao: "Fone sem fio com almofadas acolchoadas, microfone embutido e até 30 horas de bateria.",
  },
  {
    titulo: "Batedeira Planetária 600W 5L", cat: "Eletroportáteis", condicao: "AVARIA_ESTETICA", preco: 329_00, mercado: 649_00, estoque: 1, dias: 26,
    fotos: ["batedeira"],
    descricao: "Batedeira planetária com tigela de inox de 5 litros e 3 batedores. Marca leve na base.",
  },
  {
    titulo: "Garrafa Térmica Inox 1L", cat: "Casa e Cozinha", condicao: "NOVO_LACRADO", preco: 15_00, mercado: 49_90, estoque: 12, dias: 3,
    fotos: ["garrafa"],
    descricao: "Mantém a temperatura por até 12 horas. Tampa com trava.",
  },
  {
    titulo: 'Notebook 14" Core i5 8GB SSD 256GB', cat: "Informática", condicao: "USADO_REVISADO", preco: 1890_00, mercado: 3299_00, estoque: 1, dias: 9,
    fotos: ["notebook"],
    descricao: "Notebook revisado pela nossa equipe, com Windows ativado e bateria em bom estado. Acompanha carregador.",
  },
  {
    titulo: "Smartwatch com Monitor Cardíaco e GPS", cat: "Eletrônicos", condicao: "CAIXA_ABERTA", preco: 699_00, mercado: 1299_00, estoque: 1, dias: 33,
    fotos: ["smartwatch"],
    descricao: "Relógio inteligente com notificações, monitor de frequência cardíaca, GPS e resistência à água.",
  },
  {
    titulo: "Cafeteira Expresso 15 Bar", cat: "Eletroportáteis", condicao: "CAIXA_ABERTA", preco: 479_00, mercado: 899_00, estoque: 1, dias: 15,
    fotos: ["cafeteira"],
    descricao: "Cafeteira expresso com bomba de 15 bar e vaporizador de leite. Testada.",
  },
  {
    titulo: "Secador de Cabelo Profissional 2000W", cat: "Beleza", condicao: "NOVO_LACRADO", preco: 79_90, mercado: 159_90, estoque: 5, dias: 5,
    fotos: ["secador"],
    descricao: "2 velocidades, 3 temperaturas e jato de ar frio. Bivolt.",
  },
  {
    titulo: "Jogo de Panelas Antiaderente 5 Peças", cat: "Casa e Cozinha", condicao: "SEM_CAIXA", preco: 139_00, mercado: 289_00, estoque: 2, dias: 22,
    fotos: ["panelas"],
    descricao: "Conjunto com revestimento antiaderente e tampas de vidro. Sem a caixa original.",
  },
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@versatil.local";
  if (!(await db.usuario.findUnique({ where: { email } }))) {
    await db.usuario.create({ data: { nome: "Administrador", email, senhaHash: await bcrypt.hash(process.env.SEED_ADMIN_SENHA || "versatil123", 10) } });
    console.log("[seed] admin criado:", email);
  }

  const cats = ["Autopeças", "Eletroportáteis", "Eletrônicos", "Casa e Cozinha", "Ferramentas", "Brinquedos", "Informática", "Beleza", "Infantil", "Esporte"];
  for (const [i, nome] of cats.entries())
    await db.categoria.upsert({ where: { slug: slug(nome) }, create: { nome, slug: slug(nome), ordem: i }, update: { ordem: i } });

  // operador de caixa de demonstração (só em desenvolvimento)
  if (process.env.NODE_ENV !== "production" && !(await db.usuario.findUnique({ where: { email: "caixa@versatil.local" } })))
    await db.usuario.create({ data: { nome: "Operador Caixa", email: "caixa@versatil.local", papel: "OPERADOR", senhaHash: await bcrypt.hash("caixa123", 10) } });

  if (process.env.NODE_ENV === "production" || (await db.produto.count()) > 0) return;
  const c = Object.fromEntries((await db.categoria.findMany()).map((x) => [x.nome, x.id]));
  for (const d of DEMO) {
    const quando = new Date(Date.now() - d.dias * 86400000);
    const p = await db.produto.create({
      data: {
        titulo: d.titulo, slug: slug(d.titulo), condicao: d.condicao, categoriaId: c[d.cat],
        precoCents: d.preco, precoMercadoCents: d.mercado, estoqueDisponivel: d.estoque,
        marca: d.marca, sku: d.sku, aplicacao: (d.aplicacao ?? []).join("\n"), descricao: d.descricao,
        publicadoEm: quando, criadoEm: quando,
      },
    });
    for (const [ordem, f] of d.fotos.entries()) {
      try {
        const arquivo = await salvarFoto(await readFile(path.join(__dirname, "demo", `${f}.jpg`)));
        await db.foto.create({ data: { produtoId: p.id, arquivo, ordem } });
      } catch (e) {
        console.warn("[seed] foto não encontrada:", f, (e as Error).message);
      }
    }
  }
  console.log("[seed] produtos de exemplo criados");
}
main().finally(() => db.$disconnect());
