/**
 * Seed de demonstracao - GestorOA
 *
 * Cria dados realistas para explorar o sistema. Sera expandido a cada
 * modulo (empresas, regimes, obrigacoes, prazos do mes corrente, etc.).
 *
 * Modulo 0: 1 escritorio + 3 usuarios (admin, fiscal, pessoal).
 *
 * Uso: npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSION_FLAGS = [
  'empresas_ver', 'empresas_criar', 'empresas_editar', 'empresas_excluir', 'empresas_importar',
  'obrigacoes_ver', 'obrigacoes_gerenciar',
  'entregas_ver', 'entregas_baixar', 'entregas_editar_prazos', 'entregas_acoes_massa', 'entregas_desfazer_robo', 'entregas_dispensar',
  'processos_ver', 'processos_gerenciar_matrizes', 'processos_operar',
  'documentos_ver', 'documentos_upload', 'documentos_excluir',
  'relatorios_ver',
  'apla_ver', 'apla_configurar',
  'portal_comunicados', 'portal_solicitacoes', 'portal_configurar',
  'admin_usuarios', 'admin_permissoes', 'admin_auditoria', 'admin_escritorio',
] as const;

function perms(value: boolean): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_FLAGS.map((f) => [f, value]));
}

// Permissoes operacionais (sem administracao do escritorio)
function permsOperacional(): Record<string, boolean> {
  const p = perms(true);
  p.admin_usuarios = false;
  p.admin_permissoes = false;
  p.admin_escritorio = false;
  p.empresas_excluir = false;
  return p;
}

async function main() {
  console.log('Limpando dados antigos do escritorio demo...');
  const existente = await prisma.escritorio.findFirst({
    where: { nome: 'Escritorio Demo Contabilidade' },
  });
  if (existente) {
    await prisma.escritorio.delete({ where: { id: existente.id } }).catch(async () => {
      // se houver FKs sem cascade, limpa manualmente
      await prisma.sessao.deleteMany({ where: { escritorioId: existente.id } });
      await prisma.passwordResetToken.deleteMany({ where: { escritorioId: existente.id } });
      await prisma.logAuditoria.deleteMany({ where: { escritorioId: existente.id } });
      await prisma.usuario.deleteMany({ where: { escritorioId: existente.id } });
      await prisma.escritorio.delete({ where: { id: existente.id } });
    });
  }

  const senhaHash = await bcrypt.hash('senha123', 10);

  const escritorio = await prisma.escritorio.create({
    data: {
      nome: 'Escritorio Demo Contabilidade',
      cnpj: '12345678000199',
      config: { mailFromName: 'Escritorio Demo', sabadoEhUtil: false },
    },
  });

  const usuarios = [
    { nome: 'Ana Admin', email: 'admin@demo.com.br', permissoes: perms(true) },
    { nome: 'Bruno Fiscal', email: 'fiscal@demo.com.br', permissoes: permsOperacional() },
    { nome: 'Carla Pessoal', email: 'pessoal@demo.com.br', permissoes: permsOperacional() },
  ];

  for (const u of usuarios) {
    await prisma.usuario.create({
      data: {
        escritorioId: escritorio.id,
        nome: u.nome,
        email: u.email,
        senhaHash,
        permissao: { create: u.permissoes },
      },
    });
  }

  console.log('\nSeed concluido!');
  console.log('  Escritorio: Escritorio Demo Contabilidade');
  console.log('  Login admin:   admin@demo.com.br   / senha123');
  console.log('  Login fiscal:  fiscal@demo.com.br  / senha123');
  console.log('  Login pessoal: pessoal@demo.com.br / senha123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
