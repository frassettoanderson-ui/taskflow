/**
 * Dados de exemplo (seed).
 *
 * Roda sozinho toda vez que o "docker compose up" sobe o backend.
 * É IDEMPOTENTE: rodar de novo não duplica nada (usa "upsert").
 *
 * Cria:
 *   1) Tenant "Grupo Sabor"  -> com o usuário DONO e a marca "Cantina da Nona"
 *   2) Tenant "Pizzaria Rival" -> ESCONDIDO, existe só para PROVAR o isolamento
 *      (o dono do Grupo Sabor não pode enxergar nada dele)
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// IDs fixos de propósito: assim o passo a passo de teste pode citá-los.
const IDS = {
  tenantDemo: 'tnt_demo_grupo_sabor',
  userDono: 'usr_demo_dono',
  userGerente: 'usr_demo_gerente',
  userOperador: 'usr_demo_operador',
  brandDemo: 'brd_demo_cantina',

  tenantRival: 'tnt_rival_pizzaria',
  userRival: 'usr_rival_dono',
  brandRival: 'brd_rival_forno',
};

async function main() {
  // A senha de todos os usuários de exemplo é "123456".
  const senha = await bcrypt.hash('123456', 10);

  // ---------------------------------------------------------------
  // 1) Tenant de exemplo — este é o "seu"
  // ---------------------------------------------------------------
  const grupoSabor = await prisma.tenant.upsert({
    where: { id: IDS.tenantDemo },
    update: { name: 'Grupo Sabor' },
    create: { id: IDS.tenantDemo, name: 'Grupo Sabor', slug: 'grupo-sabor' },
  });

  await prisma.user.upsert({
    where: { id: IDS.userDono },
    update: { name: 'Anderson (Dono)', role: Role.OWNER, passwordHash: senha },
    create: {
      id: IDS.userDono,
      tenantId: grupoSabor.id,
      name: 'Anderson (Dono)',
      email: 'dono@exemplo.com',
      passwordHash: senha,
      role: Role.OWNER,
    },
  });

  // Um de cada papel, para dar o que testar no controle de permissões.
  await prisma.user.upsert({
    where: { id: IDS.userGerente },
    update: { role: Role.MANAGER, passwordHash: senha },
    create: {
      id: IDS.userGerente,
      tenantId: grupoSabor.id,
      name: 'Marta (Gerente)',
      email: 'gerente@exemplo.com',
      passwordHash: senha,
      role: Role.MANAGER,
    },
  });

  await prisma.user.upsert({
    where: { id: IDS.userOperador },
    update: { role: Role.OPERATOR, passwordHash: senha },
    create: {
      id: IDS.userOperador,
      tenantId: grupoSabor.id,
      name: 'Bruno (Operador)',
      email: 'operador@exemplo.com',
      passwordHash: senha,
      role: Role.OPERATOR,
    },
  });

  const cantina = await prisma.brand.upsert({
    where: { id: IDS.brandDemo },
    update: {
      name: 'Cantina da Nona',
      description: 'Massas e pizzas de família, feitas na hora.',
    },
    create: {
      id: IDS.brandDemo,
      tenantId: grupoSabor.id,
      name: 'Cantina da Nona',
      slug: 'cantina-da-nona',
      primaryColor: '#C2410C',
      description: 'Massas e pizzas de família, feitas na hora.',
    },
  });

  // Cardápio de delivery da Cantina da Nona
  await seedCardapio(grupoSabor.id, cantina.id);

  // ---------------------------------------------------------------
  // 2) Tenant "rival" — serve APENAS para provar o isolamento.
  //    O dono do Grupo Sabor nunca deve conseguir ler nada daqui.
  // ---------------------------------------------------------------
  const rival = await prisma.tenant.upsert({
    where: { id: IDS.tenantRival },
    update: {},
    create: { id: IDS.tenantRival, name: 'Pizzaria Rival', slug: 'pizzaria-rival' },
  });

  await prisma.user.upsert({
    where: { id: IDS.userRival },
    update: { passwordHash: senha },
    create: {
      id: IDS.userRival,
      tenantId: rival.id,
      name: 'Dono Rival',
      email: 'rival@exemplo.com',
      passwordHash: senha,
      role: Role.OWNER,
    },
  });

  await prisma.brand.upsert({
    where: { id: IDS.brandRival },
    update: {},
    create: {
      id: IDS.brandRival,
      tenantId: rival.id,
      name: 'Forno do Rival',
      slug: 'forno-do-rival',
      primaryColor: '#1D4ED8',
    },
  });

  console.log('');
  console.log('  ✅ Dados de exemplo prontos');
  console.log('  ------------------------------------------------------');
  console.log('  Login (senha de todos: 123456)');
  console.log('    dono@exemplo.com      -> Dono      (OWNER)');
  console.log('    gerente@exemplo.com   -> Gerente   (MANAGER)');
  console.log('    operador@exemplo.com  -> Operador  (OPERATOR)');
  console.log('');
  console.log('  Cardápio público:');
  console.log('    http://localhost:3010/m/cantina-da-nona');
  console.log('');
  console.log('  Marca do "outro" restaurante, para testar o isolamento:');
  console.log(`    ${IDS.brandRival}`);
  console.log('  ------------------------------------------------------');
  console.log('');
}

// ===========================================================================
//  Cardápio de exemplo
// ===========================================================================

type SeedModifier = { id: string; name: string; priceDeltaCents?: number };
type SeedGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: SeedModifier[];
};
type SeedItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  groups?: SeedGroup[];
};
type SeedCategory = { id: string; name: string; items: SeedItem[] };

/** Monta a URL de uma imagem de exemplo (serviço público de placeholder). */
function fotoDe(nome: string) {
  return `https://placehold.co/600x400/C2410C/FFFFFF/png?text=${encodeURIComponent(nome)}`;
}

const CARDAPIO: SeedCategory[] = [
  {
    id: 'cat_entradas',
    name: 'Entradas',
    items: [
      {
        id: 'itm_bruschetta',
        name: 'Bruschetta da Nona',
        description: 'Pão italiano, tomate, alho e manjericão fresco. 4 unidades.',
        priceCents: 2490,
      },
      {
        id: 'itm_polenta',
        name: 'Polenta Frita',
        description: 'Crocante por fora, cremosa por dentro. Serve 2 pessoas.',
        priceCents: 2890,
        groups: [
          {
            id: 'mg_polenta_molho',
            name: 'Molho para acompanhar',
            minSelect: 0,
            maxSelect: 2,
            modifiers: [
              { id: 'mod_molho_gorgonzola', name: 'Gorgonzola', priceDeltaCents: 900 },
              { id: 'mod_molho_pomodoro', name: 'Pomodoro', priceDeltaCents: 500 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cat_massas',
    name: 'Massas',
    items: [
      {
        id: 'itm_bolonhesa',
        name: 'Spaghetti à Bolonhesa',
        description: 'Molho de carne cozido por 4 horas, do jeito da nona.',
        priceCents: 4690,
        groups: [
          {
            id: 'mg_ponto_massa',
            name: 'Ponto da massa',
            minSelect: 1,
            maxSelect: 1,
            modifiers: [
              { id: 'mod_al_dente', name: 'Al dente' },
              { id: 'mod_bem_cozida', name: 'Bem cozida' },
            ],
          },
          {
            id: 'mg_adicionais_massa',
            name: 'Adicionais',
            minSelect: 0,
            maxSelect: 3,
            modifiers: [
              { id: 'mod_queijo_extra', name: 'Queijo parmesão extra', priceDeltaCents: 600 },
              { id: 'mod_bacon', name: 'Bacon', priceDeltaCents: 700 },
              { id: 'mod_manjericao', name: 'Manjericão fresco', priceDeltaCents: 300 },
            ],
          },
        ],
      },
      {
        id: 'itm_alfredo',
        name: 'Fettuccine Alfredo',
        description: 'Massa fresca ao creme de leite, manteiga e parmesão.',
        priceCents: 5290,
        groups: [
          {
            id: 'mg_alfredo_proteina',
            name: 'Adicionar proteína',
            minSelect: 0,
            maxSelect: 1,
            modifiers: [
              { id: 'mod_alfredo_frango', name: 'Frango grelhado', priceDeltaCents: 1200 },
              { id: 'mod_alfredo_camarao', name: 'Camarão', priceDeltaCents: 2400 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cat_pizzas',
    name: 'Pizzas',
    items: [
      {
        id: 'itm_margherita',
        name: 'Pizza Margherita',
        description: 'Molho de tomate San Marzano, muçarela de búfala e manjericão.',
        priceCents: 5990,
        groups: [
          {
            id: 'mg_pizza_tamanho',
            name: 'Tamanho',
            minSelect: 1,
            maxSelect: 1,
            modifiers: [
              { id: 'mod_pizza_media', name: 'Média (6 fatias)' },
              { id: 'mod_pizza_grande', name: 'Grande (8 fatias)', priceDeltaCents: 1800 },
            ],
          },
          {
            id: 'mg_pizza_borda',
            name: 'Borda recheada',
            minSelect: 0,
            maxSelect: 1,
            modifiers: [
              { id: 'mod_borda_catupiry', name: 'Catupiry', priceDeltaCents: 1200 },
              { id: 'mod_borda_cheddar', name: 'Cheddar', priceDeltaCents: 1200 },
            ],
          },
        ],
      },
      {
        id: 'itm_calabresa',
        name: 'Pizza Calabresa',
        description: 'Calabresa artesanal, cebola roxa e azeitona preta.',
        priceCents: 6290,
        groups: [
          {
            id: 'mg_calabresa_tamanho',
            name: 'Tamanho',
            minSelect: 1,
            maxSelect: 1,
            modifiers: [
              { id: 'mod_calabresa_media', name: 'Média (6 fatias)' },
              { id: 'mod_calabresa_grande', name: 'Grande (8 fatias)', priceDeltaCents: 1800 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cat_bebidas',
    name: 'Bebidas',
    items: [
      {
        id: 'itm_refri',
        name: 'Refrigerante Lata 350ml',
        description: 'Gelado.',
        priceCents: 790,
        groups: [
          {
            id: 'mg_refri_sabor',
            name: 'Sabor',
            minSelect: 1,
            maxSelect: 1,
            modifiers: [
              { id: 'mod_refri_cola', name: 'Cola' },
              { id: 'mod_refri_guarana', name: 'Guaraná' },
              { id: 'mod_refri_laranja', name: 'Laranja' },
            ],
          },
        ],
      },
      {
        id: 'itm_agua',
        name: 'Água Mineral 500ml',
        description: 'Com ou sem gás.',
        priceCents: 500,
        groups: [
          {
            id: 'mg_agua_tipo',
            name: 'Tipo',
            minSelect: 1,
            maxSelect: 1,
            modifiers: [
              { id: 'mod_agua_sem_gas', name: 'Sem gás' },
              { id: 'mod_agua_com_gas', name: 'Com gás' },
            ],
          },
        ],
      },
      {
        id: 'itm_suco',
        name: 'Suco Natural 400ml',
        description: 'Feito na hora, sem açúcar.',
        priceCents: 1290,
        groups: [
          {
            id: 'mg_suco_sabor',
            name: 'Sabor',
            minSelect: 1,
            maxSelect: 1,
            modifiers: [
              { id: 'mod_suco_laranja', name: 'Laranja' },
              { id: 'mod_suco_abacaxi', name: 'Abacaxi com hortelã' },
              { id: 'mod_suco_maracuja', name: 'Maracujá' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cat_sobremesas',
    name: 'Sobremesas',
    items: [
      {
        id: 'itm_tiramisu',
        name: 'Tiramisù',
        description: 'Receita da família, com café coado na hora.',
        priceCents: 2890,
      },
      {
        id: 'itm_petit',
        name: 'Petit Gâteau',
        description: 'Bolo quente de chocolate meio amargo com centro cremoso.',
        priceCents: 2690,
        groups: [
          {
            id: 'mg_petit_acompanha',
            name: 'Acompanhamento',
            minSelect: 0,
            maxSelect: 1,
            modifiers: [{ id: 'mod_petit_sorvete', name: 'Sorvete de creme', priceDeltaCents: 800 }],
          },
        ],
      },
    ],
  },
];

async function seedCardapio(tenantId: string, brandId: string) {
  const menu = await prisma.menu.upsert({
    where: { brandId_channel: { brandId, channel: 'DELIVERY' } },
    update: { name: 'Cardápio Delivery' },
    create: {
      id: 'mnu_cantina_delivery',
      tenantId,
      brandId,
      channel: 'DELIVERY',
      name: 'Cardápio Delivery',
    },
  });

  for (const [ci, categoria] of CARDAPIO.entries()) {
    await prisma.category.upsert({
      where: { id: categoria.id },
      update: { name: categoria.name, sortOrder: ci },
      create: {
        id: categoria.id,
        tenantId,
        menuId: menu.id,
        name: categoria.name,
        sortOrder: ci,
      },
    });

    for (const [ii, item] of categoria.items.entries()) {
      await prisma.item.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          imageUrl: fotoDe(item.name),
          sortOrder: ii,
        },
        create: {
          id: item.id,
          tenantId,
          categoryId: categoria.id,
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          imageUrl: fotoDe(item.name),
          sortOrder: ii,
        },
      });

      for (const [gi, grupo] of (item.groups ?? []).entries()) {
        await prisma.modifierGroup.upsert({
          where: { id: grupo.id },
          update: {
            name: grupo.name,
            minSelect: grupo.minSelect,
            maxSelect: grupo.maxSelect,
            sortOrder: gi,
          },
          create: {
            id: grupo.id,
            tenantId,
            itemId: item.id,
            name: grupo.name,
            minSelect: grupo.minSelect,
            maxSelect: grupo.maxSelect,
            sortOrder: gi,
          },
        });

        for (const [mi, mod] of grupo.modifiers.entries()) {
          await prisma.modifier.upsert({
            where: { id: mod.id },
            update: {
              name: mod.name,
              priceDeltaCents: mod.priceDeltaCents ?? 0,
              sortOrder: mi,
            },
            create: {
              id: mod.id,
              tenantId,
              groupId: grupo.id,
              name: mod.name,
              priceDeltaCents: mod.priceDeltaCents ?? 0,
              sortOrder: mi,
            },
          });
        }
      }
    }
  }

  const totalItens = CARDAPIO.reduce((acc, c) => acc + c.items.length, 0);
  console.log(`  🍝 Cardápio: ${CARDAPIO.length} categorias, ${totalItens} itens`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
