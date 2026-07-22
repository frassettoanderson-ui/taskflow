/**
 * Dados de exemplo (seed).
 *
 * Roda sozinho toda vez que o "docker compose up" sobe o backend.
 * É IDEMPOTENTE: rodar de novo não duplica nada (usa "upsert").
 *
 * O que ele monta:
 *   1) Tenant "Grupo Sabor" com 1 UNIDADE (cozinha) e 4 ESTAÇÕES de produção
 *   2) Duas MARCAS na mesma cozinha (é uma dark kitchen):
 *        - Cantina da Nona -> cardápios de DELIVERY e SALÃO (preços diferentes)
 *        - Burger do Zé    -> cardápios de DELIVERY e BALCÃO (preços diferentes)
 *   3) Regras de operação de cada marca: horários e área de entrega
 *        - Cantina entrega POR BAIRRO
 *        - Burger entrega POR RAIO (faixas de km)
 *   4) Um tenant "rival" ESCONDIDO, que existe só para provar o isolamento
 */
import { PrismaClient, Role, SalesChannel, DeliveryAreaKind } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// IDs fixos de propósito: assim o passo a passo de teste pode citá-los.
const IDS = {
  tenantDemo: 'tnt_demo_grupo_sabor',
  userDono: 'usr_demo_dono',
  userGerente: 'usr_demo_gerente',
  userOperador: 'usr_demo_operador',
  userGarcom: 'usr_demo_garcom',
  userCaixa: 'usr_demo_caixa',

  unidade: 'unt_cozinha_centro',
  stForno: 'stn_forno',
  stChapa: 'stn_chapa',
  stMontagem: 'stn_montagem',
  stBebidas: 'stn_bebidas',

  brandCantina: 'brd_demo_cantina',
  brandBurger: 'brd_demo_burger',

  tenantRival: 'tnt_rival_pizzaria',
  userRival: 'usr_rival_dono',
  brandRival: 'brd_rival_forno',
};

// ===========================================================================
//  Formatos dos dados de exemplo
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
  /** para qual estação da cozinha este item vai */
  stationId?: string;
  groups?: SeedGroup[];
};
type SeedCategory = { id: string; name: string; items: SeedItem[] };
type SeedMenu = {
  id: string;
  channel: SalesChannel;
  name: string;
  categories: SeedCategory[];
};
type SeedArea = {
  id: string;
  kind: DeliveryAreaKind;
  districtName?: string;
  maxDistanceKm?: number;
  feeCents: number;
  minOrderCents?: number;
};
type SeedHorario = { channel: SalesChannel; weekdays: number[]; abre: string; fecha: string };

type SeedBrand = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  description: string;
  corDaFoto: string;
  menus: SeedMenu[];
  areas: SeedArea[];
  horarios: SeedHorario[];
};

/** "11:30" -> 690 minutos desde a meia-noite. */
function minutos(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Monta a URL de uma imagem de exemplo (serviço público de placeholder). */
function fotoDe(nome: string, cor: string) {
  return `https://placehold.co/600x400/${cor}/FFFFFF/png?text=${encodeURIComponent(nome)}`;
}

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];
const SEGUNDA_A_SABADO = [1, 2, 3, 4, 5, 6];

// ===========================================================================
//  MARCA 1 — Cantina da Nona
// ===========================================================================

const CANTINA: SeedBrand = {
  id: IDS.brandCantina,
  name: 'Cantina da Nona',
  slug: 'cantina-da-nona',
  primaryColor: '#C2410C',
  corDaFoto: 'C2410C',
  description: 'Massas e pizzas de família, feitas na hora.',

  menus: [
    {
      id: 'mnu_cantina_delivery',
      channel: SalesChannel.DELIVERY,
      name: 'Cardápio Delivery',
      categories: [
        {
          id: 'cat_entradas',
          name: 'Entradas',
          items: [
            {
              id: 'itm_bruschetta',
              name: 'Bruschetta da Nona',
              description: 'Pão italiano, tomate, alho e manjericão fresco. 4 unidades.',
              priceCents: 2490,
              stationId: IDS.stForno,
            },
            {
              id: 'itm_polenta',
              name: 'Polenta Frita',
              description: 'Crocante por fora, cremosa por dentro. Serve 2 pessoas.',
              priceCents: 2890,
              stationId: IDS.stChapa,
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
              stationId: IDS.stChapa,
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
              stationId: IDS.stChapa,
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
              stationId: IDS.stForno,
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
              stationId: IDS.stForno,
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
              stationId: IDS.stBebidas,
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
              stationId: IDS.stBebidas,
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
              stationId: IDS.stBebidas,
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
              stationId: IDS.stMontagem,
            },
            {
              id: 'itm_petit',
              name: 'Petit Gâteau',
              description: 'Bolo quente de chocolate meio amargo com centro cremoso.',
              priceCents: 2690,
              stationId: IDS.stMontagem,
              groups: [
                {
                  id: 'mg_petit_acompanha',
                  name: 'Acompanhamento',
                  minSelect: 0,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_petit_sorvete', name: 'Sorvete de creme', priceDeltaCents: 800 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ---------------------------------------------------------------------
    // MESMA MARCA, OUTRO CANAL: no salão os preços são maiores e existe um
    // item que só faz sentido na mesa (couvert). É a prova de que cardápio,
    // preço e disponibilidade são independentes por canal.
    // ---------------------------------------------------------------------
    {
      id: 'mnu_cantina_salao',
      channel: SalesChannel.DINE_IN,
      name: 'Cardápio do Salão',
      categories: [
        {
          id: 'cat_salao_entradas',
          name: 'Para começar',
          items: [
            {
              id: 'itm_salao_couvert',
              name: 'Couvert da Casa',
              description: 'Pão da casa, manteiga de ervas e azeitonas. Só no salão.',
              priceCents: 1490,
              stationId: IDS.stMontagem,
            },
            {
              id: 'itm_salao_bruschetta',
              name: 'Bruschetta da Nona',
              description: 'Pão italiano, tomate, alho e manjericão fresco. 4 unidades.',
              priceCents: 2890,
              stationId: IDS.stForno,
            },
          ],
        },
        {
          id: 'cat_salao_massas',
          name: 'Massas',
          items: [
            {
              id: 'itm_salao_bolonhesa',
              name: 'Spaghetti à Bolonhesa',
              description: 'Molho de carne cozido por 4 horas, do jeito da nona.',
              priceCents: 5490,
              stationId: IDS.stChapa,
              groups: [
                {
                  id: 'mg_salao_ponto',
                  name: 'Ponto da massa',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_salao_al_dente', name: 'Al dente' },
                    { id: 'mod_salao_bem_cozida', name: 'Bem cozida' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'cat_salao_pizzas',
          name: 'Pizzas',
          items: [
            {
              id: 'itm_salao_margherita',
              name: 'Pizza Margherita',
              description: 'Molho de tomate San Marzano, muçarela de búfala e manjericão.',
              priceCents: 6990,
              stationId: IDS.stForno,
              groups: [
                {
                  id: 'mg_salao_tamanho',
                  name: 'Tamanho',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_salao_media', name: 'Média (6 fatias)' },
                    { id: 'mod_salao_grande', name: 'Grande (8 fatias)', priceDeltaCents: 2000 },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'cat_salao_bebidas',
          name: 'Bebidas',
          items: [
            {
              id: 'itm_salao_refri',
              name: 'Refrigerante Lata 350ml',
              description: 'Gelado.',
              priceCents: 990,
              stationId: IDS.stBebidas,
              groups: [
                {
                  id: 'mg_salao_refri_sabor',
                  name: 'Sabor',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_salao_cola', name: 'Cola' },
                    { id: 'mod_salao_guarana', name: 'Guaraná' },
                  ],
                },
              ],
            },
            {
              id: 'itm_salao_taca_vinho',
              name: 'Taça de Vinho Tinto',
              description: 'Seleção da casa. Só no salão.',
              priceCents: 2490,
              stationId: IDS.stBebidas,
            },
          ],
        },
      ],
    },
  ],

  // Cantina entrega POR BAIRRO.
  areas: [
    { id: 'da_cantina_centro', kind: DeliveryAreaKind.DISTRICT, districtName: 'Centro', feeCents: 700 },
    {
      id: 'da_cantina_praia',
      kind: DeliveryAreaKind.DISTRICT,
      districtName: 'Praia da Vila',
      feeCents: 900,
    },
    {
      id: 'da_cantina_vilanova',
      kind: DeliveryAreaKind.DISTRICT,
      districtName: 'Vila Nova',
      feeCents: 1200,
      minOrderCents: 4000,
    },
    { id: 'da_cantina_mirim', kind: DeliveryAreaKind.DISTRICT, districtName: 'Mirim', feeCents: 1500 },
  ],

  horarios: [
    // 24 horas DE PROPÓSITO: esta é a marca que você usa para testar o fluxo
    // do pedido a qualquer hora do dia. As outras têm horário realista, para
    // você ver a regra de "fechado agora" funcionando.
    { channel: SalesChannel.DELIVERY, weekdays: TODOS_OS_DIAS, abre: '00:00', fecha: '23:59' },
    { channel: SalesChannel.DINE_IN, weekdays: TODOS_OS_DIAS, abre: '11:00', fecha: '23:00' },
  ],
};

// ===========================================================================
//  MARCA 2 — Burger do Zé (mesma cozinha, outra marca)
// ===========================================================================

const BURGER: SeedBrand = {
  id: IDS.brandBurger,
  name: 'Burger do Zé',
  slug: 'burger-do-ze',
  primaryColor: '#16A34A',
  corDaFoto: '16A34A',
  description: 'Hambúrguer artesanal, pão brioche e batata rústica.',

  menus: [
    {
      id: 'mnu_burger_delivery',
      channel: SalesChannel.DELIVERY,
      name: 'Cardápio Delivery',
      categories: [
        {
          id: 'cat_burger_lanches',
          name: 'Lanches',
          items: [
            {
              id: 'itm_burger_classico',
              name: 'Zé Clássico',
              description: 'Blend 160g, queijo prato, alface, tomate e molho da casa.',
              priceCents: 3290,
              stationId: IDS.stChapa,
              groups: [
                {
                  id: 'mg_burger_ponto',
                  name: 'Ponto da carne',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_burger_mal', name: 'Mal passado' },
                    { id: 'mod_burger_ponto', name: 'Ao ponto' },
                    { id: 'mod_burger_bem', name: 'Bem passado' },
                  ],
                },
                {
                  id: 'mg_burger_add',
                  name: 'Adicionais',
                  minSelect: 0,
                  maxSelect: 4,
                  modifiers: [
                    { id: 'mod_burger_bacon', name: 'Bacon', priceDeltaCents: 600 },
                    { id: 'mod_burger_cheddar', name: 'Cheddar extra', priceDeltaCents: 500 },
                    { id: 'mod_burger_ovo', name: 'Ovo', priceDeltaCents: 400 },
                    { id: 'mod_burger_cebola', name: 'Cebola caramelizada', priceDeltaCents: 400 },
                  ],
                },
              ],
            },
            {
              id: 'itm_burger_duplo',
              name: 'Duplo do Zé',
              description: 'Dois blends de 160g, cheddar duplo e bacon.',
              priceCents: 4290,
              stationId: IDS.stChapa,
              groups: [
                {
                  id: 'mg_burger_duplo_ponto',
                  name: 'Ponto da carne',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_duplo_ponto', name: 'Ao ponto' },
                    { id: 'mod_duplo_bem', name: 'Bem passado' },
                  ],
                },
              ],
            },
            {
              id: 'itm_burger_veggie',
              name: 'Veggie do Zé',
              description: 'Hambúrguer de grão-de-bico, queijo vegetal e rúcula.',
              priceCents: 3490,
              stationId: IDS.stChapa,
            },
          ],
        },
        {
          id: 'cat_burger_acomp',
          name: 'Acompanhamentos',
          items: [
            {
              id: 'itm_burger_fritas',
              name: 'Batata Rústica',
              description: 'Com alecrim e sal grosso. Serve 2.',
              priceCents: 1890,
              stationId: IDS.stChapa,
              groups: [
                {
                  id: 'mg_fritas_molho',
                  name: 'Molho',
                  minSelect: 0,
                  maxSelect: 2,
                  modifiers: [
                    { id: 'mod_fritas_cheddar', name: 'Cheddar', priceDeltaCents: 600 },
                    { id: 'mod_fritas_barbecue', name: 'Barbecue', priceDeltaCents: 400 },
                  ],
                },
              ],
            },
            {
              id: 'itm_burger_onion',
              name: 'Onion Rings',
              description: 'Anéis de cebola empanados na hora. 8 unidades.',
              priceCents: 1990,
              stationId: IDS.stChapa,
            },
          ],
        },
        {
          id: 'cat_burger_bebidas',
          name: 'Bebidas',
          items: [
            {
              id: 'itm_burger_refri',
              name: 'Refrigerante Lata 350ml',
              description: 'Gelado.',
              priceCents: 790,
              stationId: IDS.stBebidas,
              groups: [
                {
                  id: 'mg_burger_refri_sabor',
                  name: 'Sabor',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_bref_cola', name: 'Cola' },
                    { id: 'mod_bref_guarana', name: 'Guaraná' },
                  ],
                },
              ],
            },
            {
              id: 'itm_burger_milk',
              name: 'Milkshake 400ml',
              description: 'Feito com sorvete de verdade.',
              priceCents: 1890,
              stationId: IDS.stBebidas,
              groups: [
                {
                  id: 'mg_milk_sabor',
                  name: 'Sabor',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_milk_choc', name: 'Chocolate' },
                    { id: 'mod_milk_morango', name: 'Morango' },
                    { id: 'mod_milk_ovomaltine', name: 'Ovomaltine', priceDeltaCents: 300 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // No balcão sai mais barato: não tem entrega nem embalagem.
    {
      id: 'mnu_burger_balcao',
      channel: SalesChannel.COUNTER,
      name: 'Cardápio do Balcão',
      categories: [
        {
          id: 'cat_bbalcao_lanches',
          name: 'Lanches',
          items: [
            {
              id: 'itm_bbalcao_classico',
              name: 'Zé Clássico',
              description: 'Blend 160g, queijo prato, alface, tomate e molho da casa.',
              priceCents: 2990,
              stationId: IDS.stChapa,
              groups: [
                {
                  id: 'mg_bbalcao_ponto',
                  name: 'Ponto da carne',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_bbalcao_ponto', name: 'Ao ponto' },
                    { id: 'mod_bbalcao_bem', name: 'Bem passado' },
                  ],
                },
              ],
            },
            {
              id: 'itm_bbalcao_fritas',
              name: 'Batata Rústica',
              description: 'Com alecrim e sal grosso.',
              priceCents: 1590,
              stationId: IDS.stChapa,
            },
          ],
        },
        {
          id: 'cat_bbalcao_bebidas',
          name: 'Bebidas',
          items: [
            {
              id: 'itm_bbalcao_refri',
              name: 'Refrigerante Lata 350ml',
              description: 'Gelado.',
              priceCents: 690,
              stationId: IDS.stBebidas,
              groups: [
                {
                  id: 'mg_bbalcao_sabor',
                  name: 'Sabor',
                  minSelect: 1,
                  maxSelect: 1,
                  modifiers: [
                    { id: 'mod_bbal_cola', name: 'Cola' },
                    { id: 'mod_bbal_guarana', name: 'Guaraná' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],

  // Burger entrega POR RAIO: quanto mais longe, mais caro.
  areas: [
    { id: 'da_burger_3km', kind: DeliveryAreaKind.RADIUS, maxDistanceKm: 3, feeCents: 600 },
    { id: 'da_burger_6km', kind: DeliveryAreaKind.RADIUS, maxDistanceKm: 6, feeCents: 1000 },
    {
      id: 'da_burger_10km',
      kind: DeliveryAreaKind.RADIUS,
      maxDistanceKm: 10,
      feeCents: 1500,
      minOrderCents: 5000,
    },
  ],

  // O delivery fica sempre aberto (para você testar a qualquer hora), mas
  // FECHA AOS DOMINGOS — é um exemplo real de regra por dia da semana.
  // Já o balcão tem horário de loja (10:00 às 22:00): fora disso, você vê a
  // marca aparecer como "fechada" na prática.
  horarios: [
    { channel: SalesChannel.DELIVERY, weekdays: SEGUNDA_A_SABADO, abre: '00:00', fecha: '23:59' },
    { channel: SalesChannel.COUNTER, weekdays: TODOS_OS_DIAS, abre: '10:00', fecha: '22:00' },
  ],
};

const MARCAS = [CANTINA, BURGER];

// ===========================================================================
//  Execução
// ===========================================================================

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

  await prisma.user.upsert({
    where: { id: IDS.userGarcom },
    update: { role: Role.WAITER, passwordHash: senha },
    create: {
      id: IDS.userGarcom,
      tenantId: grupoSabor.id,
      name: 'Tiago (Garçom)',
      email: 'garcom@exemplo.com',
      passwordHash: senha,
      role: Role.WAITER,
    },
  });

  await prisma.user.upsert({
    where: { id: IDS.userCaixa },
    update: { role: Role.CASHIER, passwordHash: senha },
    create: {
      id: IDS.userCaixa,
      tenantId: grupoSabor.id,
      name: 'Carla (Caixa)',
      email: 'caixa@exemplo.com',
      passwordHash: senha,
      role: Role.CASHIER,
    },
  });

  // ---------------------------------------------------------------
  // 2) A cozinha (unidade) e suas estações de produção
  // ---------------------------------------------------------------
  await prisma.unit.upsert({
    where: { id: IDS.unidade },
    update: { name: 'Cozinha Centro' },
    create: {
      id: IDS.unidade,
      tenantId: grupoSabor.id,
      name: 'Cozinha Centro',
      cnpj: '12.345.678/0001-90',
      addressStreet: 'Rua Ernani Cotrin',
      addressNumber: '100',
      addressDistrict: 'Centro',
      addressCity: 'Imbituba',
      // ponto de partida das contas de distância
      latitude: -28.24,
      longitude: -48.67,
    },
  });

  const estacoes = [
    { id: IDS.stForno, name: 'Forno', ordem: 0 },
    { id: IDS.stChapa, name: 'Chapa', ordem: 1 },
    { id: IDS.stMontagem, name: 'Montagem', ordem: 2 },
    { id: IDS.stBebidas, name: 'Bebidas', ordem: 3 },
  ];

  for (const e of estacoes) {
    await prisma.station.upsert({
      where: { id: e.id },
      update: { name: e.name, sortOrder: e.ordem },
      create: {
        id: e.id,
        tenantId: grupoSabor.id,
        unitId: IDS.unidade,
        name: e.name,
        sortOrder: e.ordem,
      },
    });
  }

  // ---------------------------------------------------------------
  // 3) As marcas, com seus cardápios e regras
  // ---------------------------------------------------------------
  for (const marca of MARCAS) {
    await prisma.brand.upsert({
      where: { id: marca.id },
      update: {
        name: marca.name,
        description: marca.description,
        primaryColor: marca.primaryColor,
      },
      create: {
        id: marca.id,
        tenantId: grupoSabor.id,
        name: marca.name,
        slug: marca.slug,
        primaryColor: marca.primaryColor,
        description: marca.description,
      },
    });

    // a marca opera nesta cozinha
    await prisma.brandUnit.upsert({
      where: { brandId_unitId: { brandId: marca.id, unitId: IDS.unidade } },
      update: { active: true },
      create: { tenantId: grupoSabor.id, brandId: marca.id, unitId: IDS.unidade },
    });

    await seedCardapios(grupoSabor.id, marca);
    await seedAreasDeEntrega(grupoSabor.id, marca);
    await seedHorarios(grupoSabor.id, marca);
  }

  // O salão é da Cantina — é ela que tem cardápio de mesa.
  await seedSalao(grupoSabor.id, IDS.unidade, IDS.brandCantina);

  // ---------------------------------------------------------------
  // 4) Tenant "rival" — serve APENAS para provar o isolamento.
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

  resumo();
}

// ===========================================================================
//  Blocos do seed
// ===========================================================================

async function seedCardapios(tenantId: string, marca: SeedBrand) {
  for (const menu of marca.menus) {
    await prisma.menu.upsert({
      where: { brandId_channel: { brandId: marca.id, channel: menu.channel } },
      update: { name: menu.name },
      create: {
        id: menu.id,
        tenantId,
        brandId: marca.id,
        channel: menu.channel,
        name: menu.name,
      },
    });

    for (const [ci, categoria] of menu.categories.entries()) {
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
        const dados = {
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          imageUrl: fotoDe(item.name, marca.corDaFoto),
          sortOrder: ii,
          stationId: item.stationId ?? null,
        };

        await prisma.item.upsert({
          where: { id: item.id },
          update: dados,
          create: { id: item.id, tenantId, categoryId: categoria.id, ...dados },
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
              update: { name: mod.name, priceDeltaCents: mod.priceDeltaCents ?? 0, sortOrder: mi },
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
  }
}

async function seedAreasDeEntrega(tenantId: string, marca: SeedBrand) {
  for (const [i, area] of marca.areas.entries()) {
    const dados = {
      kind: area.kind,
      districtName: area.districtName ?? null,
      maxDistanceKm: area.maxDistanceKm ?? null,
      feeCents: area.feeCents,
      minOrderCents: area.minOrderCents ?? 0,
      sortOrder: i,
      active: true,
    };

    await prisma.deliveryArea.upsert({
      where: { id: area.id },
      update: dados,
      create: {
        id: area.id,
        tenantId,
        brandId: marca.id,
        channel: SalesChannel.DELIVERY,
        ...dados,
      },
    });
  }
}

async function seedHorarios(tenantId: string, marca: SeedBrand) {
  // Horário é uma tabela pequena e sem id estável: apagamos e regravamos.
  await prisma.openingHour.deleteMany({ where: { brandId: marca.id } });

  for (const h of marca.horarios) {
    for (const dia of h.weekdays) {
      await prisma.openingHour.create({
        data: {
          tenantId,
          brandId: marca.id,
          channel: h.channel,
          weekday: dia,
          opensAtMinutes: minutos(h.abre),
          closesAtMinutes: minutos(h.fecha),
        },
      });
    }
  }
}

/**
 * Mesas do salão.
 *
 * O `qrToken` é o que vai dentro do QR Code colado na mesa. Aqui eles são
 * legíveis de propósito ("mesa-01") para o passo a passo de teste poder citá-los;
 * num restaurante de verdade seriam códigos sorteados.
 */
async function seedSalao(tenantId: string, unitId: string, brandId: string) {
  const mesas: Array<{ numero: string; area: string; lugares: number; x: number; y: number }> = [
    // Salão interno — grade de 4 colunas
    { numero: '1', area: 'Interno', lugares: 2, x: 0, y: 0 },
    { numero: '2', area: 'Interno', lugares: 2, x: 1, y: 0 },
    { numero: '3', area: 'Interno', lugares: 4, x: 2, y: 0 },
    { numero: '4', area: 'Interno', lugares: 4, x: 3, y: 0 },
    { numero: '5', area: 'Interno', lugares: 4, x: 0, y: 1 },
    { numero: '6', area: 'Interno', lugares: 4, x: 1, y: 1 },
    { numero: '7', area: 'Interno', lugares: 6, x: 2, y: 1 },
    { numero: '8', area: 'Interno', lugares: 6, x: 3, y: 1 },
    // Varanda
    { numero: 'V1', area: 'Varanda', lugares: 2, x: 0, y: 0 },
    { numero: 'V2', area: 'Varanda', lugares: 2, x: 1, y: 0 },
    { numero: 'V3', area: 'Varanda', lugares: 4, x: 2, y: 0 },
    { numero: 'V4', area: 'Varanda', lugares: 8, x: 3, y: 0 },
  ];

  for (const m of mesas) {
    const id = `tbl_${m.numero.toLowerCase()}`;
    const token = `mesa-${m.numero.toLowerCase()}`;

    await prisma.table.upsert({
      where: { id },
      update: { area: m.area, seats: m.lugares, posX: m.x, posY: m.y, brandId },
      create: {
        id,
        tenantId,
        unitId,
        brandId,
        number: m.numero,
        area: m.area,
        seats: m.lugares,
        posX: m.x,
        posY: m.y,
        qrToken: token,
      },
    });
  }

  console.log(`  🍽️  Salão: ${mesas.length} mesas (Interno e Varanda)`);
}

function resumo() {
  const totalItens = MARCAS.reduce(
    (acc, m) =>
      acc + m.menus.reduce((a, menu) => a + menu.categories.reduce((x, c) => x + c.items.length, 0), 0),
    0,
  );

  console.log('');
  console.log('  ✅ Dados de exemplo prontos');
  console.log('  ------------------------------------------------------');
  console.log('  Login (senha de todos: 123456)');
  console.log('    dono@exemplo.com      -> Dono      (OWNER)');
  console.log('    gerente@exemplo.com   -> Gerente   (MANAGER)');
  console.log('    caixa@exemplo.com     -> Caixa     (CASHIER)');
  console.log('    garcom@exemplo.com    -> Garçom    (WAITER)');
  console.log('    operador@exemplo.com  -> Operador  (OPERATOR)');
  console.log('');
  console.log('  Salão (o que o QR Code da mesa abre):');
  console.log('    http://localhost:3010/mesa/mesa-5');
  console.log('    http://localhost:3010/mesa/mesa-5?modo=totem');
  console.log('    http://localhost:3010/salao   (mapa de mesas, precisa login)');
  console.log('');
  console.log('  Unidade: Cozinha Centro  |  Estações: Forno, Chapa, Montagem, Bebidas');
  console.log(`  ${MARCAS.length} marcas, ${totalItens} itens no total:`);
  for (const m of MARCAS) {
    const canais = m.menus.map((x) => x.channel).join(', ');
    console.log(`    ${m.name.padEnd(18)} /m/${m.slug.padEnd(18)} canais: ${canais}`);
  }
  console.log('');
  console.log('  Cardápios públicos:');
  console.log('    http://localhost:3010/m/cantina-da-nona');
  console.log('    http://localhost:3010/m/cantina-da-nona?canal=salao');
  console.log('    http://localhost:3010/m/burger-do-ze');
  console.log('    http://localhost:3010/m/burger-do-ze?canal=balcao');
  console.log('');
  console.log('  Marca do "outro" restaurante, para testar o isolamento:');
  console.log(`    ${IDS.brandRival}`);
  console.log('  ------------------------------------------------------');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
