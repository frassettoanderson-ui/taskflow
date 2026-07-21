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

  await prisma.brand.upsert({
    where: { id: IDS.brandDemo },
    update: { name: 'Cantina da Nona' },
    create: {
      id: IDS.brandDemo,
      tenantId: grupoSabor.id,
      name: 'Cantina da Nona',
      slug: 'cantina-da-nona',
      primaryColor: '#C2410C',
    },
  });

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
