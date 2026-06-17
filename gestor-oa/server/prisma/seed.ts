/**
 * Seed de demonstracao - GestorOA
 *
 * Cria dados realistas para explorar o sistema. Sera expandido a cada
 * modulo (empresas, regimes, obrigacoes, prazos do mes corrente, etc.).
 *
 * Modulo 0: 1 escritorio + 3 usuarios (admin, fiscal, pessoal).
 * Modulo 1: departamentos, tags, 10 empresas com identificadores/contatos.
 *
 * Uso: npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Gera um CNPJ valido (14 digitos) a partir de uma base de 8 digitos.
function gerarCnpj(base8: string): string {
  const raiz = base8.padStart(8, '0') + '0001';
  const calc = (nums: string) => {
    let soma = 0;
    let pos = nums.length - 7;
    for (let i = 0; i < nums.length; i++) {
      soma += Number(nums[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(raiz);
  const d2 = calc(raiz + d1);
  return raiz + String(d1) + String(d2);
}

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

  const usuariosCriados: Record<string, string> = {};
  for (const u of usuarios) {
    const criado = await prisma.usuario.create({
      data: {
        escritorioId: escritorio.id,
        nome: u.nome,
        email: u.email,
        senhaHash,
        permissao: { create: u.permissoes },
      },
    });
    usuariosCriados[u.email] = criado.id;
  }

  // ---------- Modulo 1: Departamentos ----------
  const depsDados = [
    { nome: 'Fiscal', cor: '#0f5c5e' },
    { nome: 'Pessoal', cor: '#b45309' },
    { nome: 'Contabil', cor: '#1d4ed8' },
    { nome: 'Societario', cor: '#7c3aed' },
    { nome: 'Administrativo', cor: '#475569' },
  ];
  const deps: Record<string, string> = {};
  for (const d of depsDados) {
    const dep = await prisma.departamento.create({
      data: { escritorioId: escritorio.id, nome: d.nome, cor: d.cor },
    });
    deps[d.nome] = dep.id;
  }

  // ---------- Modulo 1: Tags ----------
  const tagsDados = [
    { nome: 'VIP', cor: '#ca8a04' },
    { nome: 'Atencao', cor: '#dc2626' },
    { nome: 'Novo cliente', cor: '#16a34a' },
  ];
  const tags: Record<string, string> = {};
  for (const t of tagsDados) {
    const tag = await prisma.tag.create({
      data: { escritorioId: escritorio.id, nome: t.nome, cor: t.cor },
    });
    tags[t.nome] = tag.id;
  }

  // ---------- Modulo 1: 10 Empresas ----------
  const nomes = [
    'Comercio de Alimentos Sao Jorge LTDA',
    'Tech Solucoes em TI ME',
    'Construtora Horizonte LTDA',
    'Padaria Pao Quente EIRELI',
    'Transportes Rapido Norte LTDA',
    'Clinica Vida Saudavel LTDA',
    'Auto Pecas Veloz LTDA',
    'Restaurante Sabor Caseiro ME',
    'Consultoria Financeira Prisma LTDA',
    'Loja de Roupas Estilo Urbano ME',
  ];
  const fiscalId = usuariosCriados['fiscal@demo.com.br'];
  const pessoalId = usuariosCriados['pessoal@demo.com.br'];

  for (let i = 0; i < nomes.length; i++) {
    const cnpj = gerarCnpj(String(10000000 + i * 137));
    const empresa = await prisma.empresa.create({
      data: {
        escritorioId: escritorio.id,
        razaoSocial: nomes[i],
        nomeFantasia: nomes[i].split(' ').slice(0, 2).join(' '),
        emailPrincipal: `contato${i + 1}@cliente.com.br`,
        telefone: `1133${String(330000 + i).slice(-6)}`,
        ativo: true,
        dataEntrada: new Date(),
        identificadores: {
          create: [
            { escritorioId: escritorio.id, tipo: 'CNPJ', valor: cnpj },
          ],
        },
        tags:
          i % 3 === 0
            ? { create: [{ tagId: tags['VIP'] }] }
            : i % 4 === 0
              ? { create: [{ tagId: tags['Atencao'] }] }
              : undefined,
        responsaveis: {
          create: [
            { escritorioId: escritorio.id, departamentoId: deps['Fiscal'], usuarioId: fiscalId },
            { escritorioId: escritorio.id, departamentoId: deps['Pessoal'], usuarioId: pessoalId },
          ],
        },
        contatos: {
          create: [
            {
              escritorioId: escritorio.id,
              nome: `Responsavel ${i + 1}`,
              email: `responsavel${i + 1}@cliente.com.br`,
              cargo: 'Socio',
              departamentoIds: [deps['Fiscal'], deps['Pessoal']],
            },
          ],
        },
      },
    });
    void empresa;
  }

  console.log('\nSeed concluido!');
  console.log(`  Departamentos: ${depsDados.length} | Tags: ${tagsDados.length} | Empresas: ${nomes.length}`);
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
