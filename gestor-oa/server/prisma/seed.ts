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
import { calcularPrazos, montarFeriados } from '../src/lib/prazos.js';
import { computarStatusPendente } from '../src/modules/entrega/entrega.status.js';
import { instanciar } from '../src/modules/processo/processo.service.js';

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
  'solicitacoes_internas_ver', 'solicitacoes_internas_gerenciar',
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
    const eid = existente.id;
    // Limpeza em ordem de dependencia (FKs com RESTRICT exigem ordem manual).
    await prisma.notificacao.deleteMany({ where: { escritorioId: eid } });
    await prisma.jobExecucao.deleteMany({ where: { escritorioId: eid } });
    await prisma.dashboardConfig.deleteMany({ where: { escritorioId: eid } });
    await prisma.solicitacaoInterna.deleteMany({ where: { escritorioId: eid } }); // cascade nas mensagens
    await prisma.roboJob.deleteMany({ where: { escritorioId: eid } });
    await prisma.assinaturaDocumento.deleteMany({ where: { escritorioId: eid } });
    await prisma.aceiteLGPD.deleteMany({ where: { escritorioId: eid } });
    await prisma.comunicacaoLog.deleteMany({ where: { escritorioId: eid } });
    await prisma.templateEmail.deleteMany({ where: { escritorioId: eid } });
    await prisma.chatbotFluxo.deleteMany({ where: { escritorioId: eid } });
    await prisma.comunicado.deleteMany({ where: { escritorioId: eid } });
    await prisma.processoRecorrente.deleteMany({ where: { escritorioId: eid } });
    await prisma.empresaObrigacao.deleteMany({ where: { escritorioId: eid } });
    // modelos novos (standalone por escritorioId)
    await prisma.npsAvaliacao.deleteMany({ where: { escritorioId: eid } });
    await prisma.formularioSolicitacao.deleteMany({ where: { escritorioId: eid } });
    await prisma.cobrancaDoc.deleteMany({ where: { escritorioId: eid } });
    await prisma.reguaCobranca.deleteMany({ where: { escritorioId: eid } });
    await prisma.custoFixo.deleteMany({ where: { escritorioId: eid } });
    await prisma.painel.deleteMany({ where: { escritorioId: eid } });
    await prisma.indicador.deleteMany({ where: { escritorioId: eid } });
    await prisma.empresa.deleteMany({ where: { escritorioId: eid } }); // cascade nos filhos (entregas, docs, protocolos, processos, tarefas, solicitacoes portal)
    await prisma.grupoEmpresa.deleteMany({ where: { escritorioId: eid } }); // depois das empresas
    await prisma.matrizProcesso.deleteMany({ where: { escritorioId: eid } });
    await prisma.grupoObrigacoes.deleteMany({ where: { escritorioId: eid } }); // cascade grupoObrigacao
    await prisma.regimeTributario.deleteMany({ where: { escritorioId: eid } }); // cascade regimeObrigacao
    await prisma.obrigacao.deleteMany({ where: { escritorioId: eid } });
    await prisma.feriado.deleteMany({ where: { escritorioId: eid } });
    await prisma.departamento.deleteMany({ where: { escritorioId: eid } });
    await prisma.tag.deleteMany({ where: { escritorioId: eid } });
    await prisma.sessao.deleteMany({ where: { escritorioId: eid } });
    await prisma.passwordResetToken.deleteMany({ where: { escritorioId: eid } });
    await prisma.logAuditoria.deleteMany({ where: { escritorioId: eid } });
    await prisma.usuario.deleteMany({ where: { escritorioId: eid } });
    await prisma.escritorio.delete({ where: { id: eid } });
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
    { nome: 'Ana Admin', email: 'admin@demo.com.br', permissoes: perms(true), tipo: 'Contador socio', custoHora: 90, minutosUteisMes: 8800, salario: 12000, encargos: 4000, beneficios: 1500 },
    { nome: 'Bruno Fiscal', email: 'fiscal@demo.com.br', permissoes: permsOperacional(), tipo: 'Auxiliar', custoHora: 45, minutosUteisMes: 8800, salario: 3500, encargos: 1200, beneficios: 600 },
    { nome: 'Carla Pessoal', email: 'pessoal@demo.com.br', permissoes: permsOperacional(), tipo: 'Assistente', custoHora: 50, minutosUteisMes: 8800, salario: 3800, encargos: 1300, beneficios: 650 },
    { nome: 'Diego Contabil', email: 'contabil@demo.com.br', permissoes: permsOperacional(), tipo: 'Contador', custoHora: 60, minutosUteisMes: 8800, salario: 5200, encargos: 1800, beneficios: 800 },
  ];

  const usuariosCriados: Record<string, string> = {};
  for (const u of usuarios) {
    const criado = await prisma.usuario.create({
      data: {
        escritorioId: escritorio.id,
        nome: u.nome,
        email: u.email,
        senhaHash,
        tipo: u.tipo,
        custoHora: u.custoHora,
        minutosUteisMes: u.minutosUteisMes,
        salario: u.salario,
        encargos: u.encargos,
        beneficios: u.beneficios,
        permissao: { create: u.permissoes },
      },
    });
    usuariosCriados[u.email] = criado.id;
  }

  // ---------- Modulo 1: Departamentos ----------
  const adminId = usuariosCriados['admin@demo.com.br'];
  const fiscalRespId = usuariosCriados['fiscal@demo.com.br'];
  const pessoalRespId = usuariosCriados['pessoal@demo.com.br'];
  const depsDados = [
    { nome: 'Fiscal', cor: '#0f5c5e', resp: fiscalRespId },
    { nome: 'Pessoal', cor: '#b45309', resp: pessoalRespId },
    { nome: 'Contabil', cor: '#1d4ed8', resp: adminId },
    { nome: 'Societario', cor: '#7c3aed', resp: adminId },
    { nome: 'Administrativo', cor: '#475569', resp: adminId },
  ];
  const deps: Record<string, string> = {};
  for (const d of depsDados) {
    const dep = await prisma.departamento.create({
      data: { escritorioId: escritorio.id, nome: d.nome, cor: d.cor, responsavelId: d.resp ?? null },
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

  // ---------- Grupos de empresa ----------
  const gruposDados = ['Grupo Sao Jorge', 'Holding Horizonte'];
  const grupoEmpresaIds: Record<string, string> = {};
  for (const g of gruposDados) {
    const grupo = await prisma.grupoEmpresa.create({ data: { escritorioId: escritorio.id, nome: g } });
    grupoEmpresaIds[g] = grupo.id;
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

  const empresaIds: string[] = [];

  for (let i = 0; i < nomes.length; i++) {
    const cnpj = gerarCnpj(String(10000000 + i * 137));
    const ufs = ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'BA', 'GO', 'PE', 'CE'];
    const empresa = await prisma.empresa.create({
      data: {
        escritorioId: escritorio.id,
        razaoSocial: nomes[i],
        nomeFantasia: nomes[i].split(' ').slice(0, 2).join(' '),
        numero: i + 1,
        honorario: 350 + (i % 5) * 220,
        apelidoEcontinuo: nomes[i].split(' ')[0],
        grupoEmpresaId: i === 0 ? grupoEmpresaIds['Grupo Sao Jorge'] : i === 2 ? grupoEmpresaIds['Holding Horizonte'] : null,
        emailPrincipal: `contato${i + 1}@cliente.com.br`,
        telefone: `1133${String(330000 + i).slice(-6)}`,
        cep: `0${1000 + i}-000`,
        logradouro: `Rua das Empresas, ${100 + i * 10}`,
        numeroEndereco: String(100 + i * 10),
        bairro: 'Centro',
        cidade: 'Sao Paulo',
        uf: ufs[i],
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
    empresaIds.push(empresa.id);

    // tarefas agendadas (esporadicas) em algumas empresas
    if (i < 4) {
      await prisma.empresaTarefaAgendada.createMany({
        data: [
          { escritorioId: escritorio.id, empresaId: empresa.id, titulo: 'Renovacao do certificado digital', dataHora: new Date(Date.now() + 1000 * 60 * 60 * 24 * (10 + i)) },
          { escritorioId: escritorio.id, empresaId: empresa.id, titulo: 'Conferir alvara de funcionamento', dataHora: new Date(Date.now() + 1000 * 60 * 60 * 24 * (30 + i)), concluida: i % 2 === 0, concluidaEm: i % 2 === 0 ? new Date() : null },
        ],
      });
    }
  }

  // ---------- Modulo 2: Feriados nacionais (ano corrente + proximo) ----------
  const anoBase = new Date().getFullYear();
  const feriadosFixos = [
    ['01-01', 'Confraternizacao Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independencia do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamacao da Republica'],
    ['11-20', 'Consciencia Negra'],
    ['12-25', 'Natal'],
  ];
  for (const ano of [anoBase, anoBase + 1]) {
    for (const [md, nome] of feriadosFixos) {
      await prisma.feriado.create({
        data: { escritorioId: escritorio.id, data: new Date(`${ano}-${md}T00:00:00`), nome, abrangencia: 'NACIONAL' },
      }).catch(() => undefined);
    }
  }

  // ---------- Modulo 2: Catalogo de obrigacoes (25+) ----------
  type RegraSeed = {
    tipoDia: 'DIA_FIXO' | 'DIA_UTIL';
    dia: number;
    regraNaoUtil?: 'ANTECIPA' | 'POSTERGA' | 'MANTEM';
    diasAntesTecnico?: number;
    tipoDiasAntes?: 'CORRIDOS' | 'UTEIS';
  };
  const r = (o: RegraSeed) => ({
    tipoDia: o.tipoDia,
    dia: o.dia,
    regraNaoUtil: o.regraNaoUtil ?? 'ANTECIPA',
    diasAntesTecnico: o.diasAntesTecnico ?? 2,
    tipoDiasAntes: o.tipoDiasAntes ?? 'UTEIS',
  });
  const F = deps['Fiscal'], P = deps['Pessoal'], C = deps['Contabil'], A = deps['Administrativo'];
  const catalogo: { nome: string; dep: string; per: 'MENSAL' | 'TRIMESTRAL' | 'ANUAL'; regra: RegraSeed; tempo: number; robo?: boolean }[] = [
    { nome: 'DAS - Simples Nacional', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 20 }, tempo: 15, robo: true },
    { nome: 'DAS-MEI', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 20 }, tempo: 10, robo: true },
    { nome: 'DARF PIS', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 25 }, tempo: 15, robo: true },
    { nome: 'DARF COFINS', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 25 }, tempo: 15, robo: true },
    { nome: 'DARF IRPJ', dep: F, per: 'TRIMESTRAL', regra: { tipoDia: 'DIA_FIXO', dia: 30 }, tempo: 20, robo: true },
    { nome: 'DARF CSLL', dep: F, per: 'TRIMESTRAL', regra: { tipoDia: 'DIA_FIXO', dia: 30 }, tempo: 20, robo: true },
    { nome: 'DCTFWeb', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 15 }, tempo: 25 },
    { nome: 'EFD-Reinf', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 15 }, tempo: 25 },
    { nome: 'eSocial - Folha', dep: P, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 15 }, tempo: 30 },
    { nome: 'FGTS Digital', dep: P, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 20 }, tempo: 15, robo: true },
    { nome: 'GPS - Previdencia', dep: P, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 20 }, tempo: 15, robo: true },
    { nome: 'ISS', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 10 }, tempo: 15, robo: true },
    { nome: 'ICMS (DARE/DAE)', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 10 }, tempo: 20, robo: true },
    { nome: 'GIA', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 10 }, tempo: 20 },
    { nome: 'SPED Fiscal', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 20 }, tempo: 40 },
    { nome: 'EFD-Contribuicoes', dep: F, per: 'MENSAL', regra: { tipoDia: 'DIA_UTIL', dia: 10 }, tempo: 40 },
    { nome: 'ECD', dep: C, per: 'ANUAL', regra: { tipoDia: 'DIA_FIXO', dia: 31 }, tempo: 60 },
    { nome: 'ECF', dep: C, per: 'ANUAL', regra: { tipoDia: 'DIA_FIXO', dia: 31 }, tempo: 60 },
    { nome: 'DEFIS', dep: F, per: 'ANUAL', regra: { tipoDia: 'DIA_FIXO', dia: 31 }, tempo: 30 },
    { nome: 'DIRF', dep: P, per: 'ANUAL', regra: { tipoDia: 'DIA_FIXO', dia: 28 }, tempo: 30 },
    { nome: 'RAIS', dep: P, per: 'ANUAL', regra: { tipoDia: 'DIA_FIXO', dia: 31 }, tempo: 25 },
    { nome: 'Folha de Pagamento', dep: P, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 5 }, tempo: 45 },
    { nome: 'Pro-labore', dep: P, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 5 }, tempo: 15 },
    { nome: 'Honorarios', dep: A, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 10 }, tempo: 10 },
    { nome: 'Balancete', dep: C, per: 'MENSAL', regra: { tipoDia: 'DIA_FIXO', dia: 25 }, tempo: 40 },
  ];
  const obrigIds: Record<string, string> = {};
  for (const o of catalogo) {
    const criada = await prisma.obrigacao.create({
      data: {
        escritorioId: escritorio.id,
        nome: o.nome,
        departamentoId: o.dep,
        periodicidade: o.per,
        regraPrazo: r(o.regra),
        tempoPrevistoMin: o.tempo,
        exigeBaixaPeloRobo: o.robo ?? false,
        exigeAnexoNaBaixa: o.robo ?? false,
      },
    });
    obrigIds[o.nome] = criada.id;
  }

  // ---------- Modulo 2: Regimes ----------
  const regimeDefs: Record<string, string[]> = {
    'Simples Nacional': ['DAS - Simples Nacional', 'eSocial - Folha', 'FGTS Digital', 'GPS - Previdencia', 'Folha de Pagamento', 'Honorarios', 'DEFIS'],
    'Lucro Presumido': ['DARF PIS', 'DARF COFINS', 'DARF IRPJ', 'DARF CSLL', 'DCTFWeb', 'EFD-Reinf', 'eSocial - Folha', 'FGTS Digital', 'ISS', 'Folha de Pagamento', 'Balancete', 'ECD', 'ECF', 'Honorarios'],
    'Lucro Real': ['DARF PIS', 'DARF COFINS', 'DARF IRPJ', 'DARF CSLL', 'DCTFWeb', 'EFD-Reinf', 'SPED Fiscal', 'EFD-Contribuicoes', 'eSocial - Folha', 'FGTS Digital', 'ICMS (DARE/DAE)', 'ISS', 'Folha de Pagamento', 'Balancete', 'ECD', 'ECF', 'Honorarios'],
    'MEI': ['DAS-MEI', 'Honorarios'],
    'Domestico': ['eSocial - Folha', 'FGTS Digital', 'GPS - Previdencia', 'Folha de Pagamento'],
  };
  const regimeIds: Record<string, string> = {};
  for (const [nome, lista] of Object.entries(regimeDefs)) {
    const regime = await prisma.regimeTributario.create({
      data: {
        escritorioId: escritorio.id,
        nome,
        obrigacoes: { create: lista.map((n) => ({ obrigacaoId: obrigIds[n] })) },
      },
    });
    regimeIds[nome] = regime.id;
  }

  // ---------- Modulo 2: Grupos ----------
  const grupoDefs: Record<string, string[]> = {
    'Folha Mensal': ['eSocial - Folha', 'FGTS Digital', 'GPS - Previdencia', 'Folha de Pagamento', 'Pro-labore'],
    'Fiscal Basico': ['DAS - Simples Nacional', 'ISS', 'DCTFWeb'],
    'Encerramento Anual': ['ECD', 'ECF', 'DEFIS', 'RAIS', 'DIRF'],
  };
  for (const [nome, lista] of Object.entries(grupoDefs)) {
    await prisma.grupoObrigacoes.create({
      data: { escritorioId: escritorio.id, nome, obrigacoes: { create: lista.map((n) => ({ obrigacaoId: obrigIds[n] })) } },
    });
  }

  // ---------- Modulo 5: Assinaturas de documento (robo) ----------
  const assinaturas: { nome: string; obrig: string; palavras: string[]; regexComp: string }[] = [
    { nome: 'DAS - Simples Nacional', obrig: 'DAS - Simples Nacional', palavras: ['Simples Nacional'], regexComp: '(\\d{2}/\\d{4})' },
    { nome: 'DARF', obrig: 'DARF PIS', palavras: ['DARF'], regexComp: 'apura[cç][aã]o\\s*:?\\s*(\\d{2}/\\d{4})' },
    { nome: 'FGTS Digital', obrig: 'FGTS Digital', palavras: ['FGTS'], regexComp: '(\\d{2}/\\d{4})' },
    { nome: 'GPS - Previdencia', obrig: 'GPS - Previdencia', palavras: ['GPS'], regexComp: '(\\d{2}/\\d{4})' },
    { nome: 'DCTFWeb', obrig: 'DCTFWeb', palavras: ['DCTFWeb'], regexComp: '(\\d{2}/\\d{4})' },
    { nome: 'ICMS (DARE/DAE)', obrig: 'ICMS (DARE/DAE)', palavras: ['ICMS'], regexComp: '(\\d{2}/\\d{4})' },
    { nome: 'ISS', obrig: 'ISS', palavras: ['ISS'], regexComp: '(\\d{2}/\\d{4})' },
    { nome: 'GNRE', obrig: 'ICMS (DARE/DAE)', palavras: ['GNRE'], regexComp: '(\\d{2}/\\d{4})' },
  ];
  for (const a of assinaturas) {
    await prisma.assinaturaDocumento.create({
      data: { escritorioId: escritorio.id, nome: a.nome, obrigacaoNome: a.obrig, palavras: a.palavras, regexCompetencia: a.regexComp },
    });
  }

  // ---------- Aplicar regime nas empresas demo (origem REGIME) ----------
  const metaPorNome = new Map(catalogo.map((o) => [o.nome, o]));
  const feriadosSet = montarFeriados(
    [anoBase, anoBase + 1].flatMap((ano) => feriadosFixos.map(([md]) => new Date(`${ano}-${md}T00:00:00`))),
  );
  const hoje = new Date();
  const compAno = hoje.getFullYear();
  const compMes = hoje.getMonth() + 1; // competencia do mes corrente
  let entregasGeradas = 0;

  const regimePorEmpresa = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Simples Nacional', 'MEI'];
  for (let i = 0; i < empresaIds.length; i++) {
    const regimeNome = regimePorEmpresa[i % regimePorEmpresa.length];
    const regimeId = regimeIds[regimeNome];
    const lista = regimeDefs[regimeNome];
    await prisma.empresa.update({ where: { id: empresaIds[i] }, data: { regimeTributarioId: regimeId } });
    // honorario mensal da empresa (demo p/ Metodo APLA) - aplicado na 1a obrigacao
    const honorarioEmpresa = 350 + (i % 5) * 220; // 350..1230
    let primeira = true;
    for (const n of lista) {
      const eo = await prisma.empresaObrigacao.create({
        data: {
          escritorioId: escritorio.id,
          empresaId: empresaIds[i],
          obrigacaoId: obrigIds[n],
          origens: [{ origem: 'REGIME', refId: regimeId }],
          ativo: true,
          honorario: primeira ? honorarioEmpresa : null,
        },
      });
      primeira = false;

      // gera entregas dos ultimos 6 meses (apenas MENSAL para o demo)
      const meta = metaPorNome.get(n);
      if (!meta || meta.per !== 'MENSAL') continue;
      const responsavel = meta.dep === F ? fiscalId : meta.dep === P ? pessoalId : adminId;
      for (let off = 5; off >= 0; off--) {
        const d = new Date(compAno, compMes - 1 - off, 1);
        const cAno = d.getFullYear();
        const cMesIdx = d.getMonth(); // 0-based
        const { prazoLegal, prazoTecnico } = calcularPrazos(
          { ...meta.regra, regraNaoUtil: meta.regra.regraNaoUtil ?? 'ANTECIPA', diasAntesTecnico: meta.regra.diasAntesTecnico ?? 2, tipoDiasAntes: meta.regra.tipoDiasAntes ?? 'UTEIS' },
          cAno, cMesIdx, feriadosSet, false,
        );
        // variacao deterministica de status para meses passados
        const sorte = (i * 7 + off * 13 + n.length * 3) % 10;
        let status: string;
        let dataEntrega: Date | null = null;
        let numeroProtocolo: string | null = null;
        if (off === 0) {
          status = computarStatusPendente(prazoTecnico, prazoLegal, hoje, 7);
        } else if (sorte < 7) {
          status = 'ENTREGUE';
          dataEntrega = new Date(prazoLegal.getTime() - 1000 * 60 * 60 * 24 * 2);
          numeroProtocolo = `${cAno}${String(cMesIdx + 1).padStart(2, '0')}${String(1000 + i * 31 + n.length)}`;
        } else if (sorte < 9) {
          status = 'ENTREGUE_JUSTIFICADA';
          dataEntrega = new Date(prazoLegal.getTime() + 1000 * 60 * 60 * 24 * 3);
          numeroProtocolo = `${cAno}${String(cMesIdx + 1).padStart(2, '0')}${String(2000 + i * 31 + n.length)}`;
        } else {
          status = 'EM_ATRASO_LEGAL';
        }
        const entrega = await prisma.entrega.create({
          data: {
            escritorioId: escritorio.id,
            empresaId: empresaIds[i],
            empresaObrigacaoId: eo.id,
            obrigacaoId: obrigIds[n],
            competenciaAno: cAno,
            competenciaMes: cMesIdx + 1,
            prazoLegal, prazoTecnico,
            status: status as never,
            dataEntrega,
            origemBaixa: dataEntrega ? 'MANUAL' : undefined,
            numeroProtocolo,
            responsavelPrazoId: responsavel,
            responsavelEntregaId: responsavel,
          },
        });
        // historico de movimentacao para entregas baixadas
        if (dataEntrega) {
          await prisma.entregaEvento.create({
            data: {
              escritorioId: escritorio.id, entregaId: entrega.id, autorId: responsavel,
              texto: status === 'ENTREGUE_JUSTIFICADA' ? `Marcou como Entregue c/ multa (protocolo ${numeroProtocolo})` : `Marcou como Entregue (protocolo ${numeroProtocolo})`,
              createdAt: dataEntrega,
            },
          });
        }
        entregasGeradas++;
      }
    }
  }

  // ---------- Modulo 6: Matrizes de processo ----------
  const matrizes = [
    {
      nome: 'Abertura de Empresa', departamentoId: deps['Societario'],
      passos: [
        { titulo: 'Consulta de viabilidade', prazoDias: 2 },
        { titulo: 'Coleta de documentos dos socios', prazoDias: 3, base: 'PASSO_ANTERIOR' },
        { titulo: 'Registro na Junta Comercial', prazoDias: 5, base: 'PASSO_ANTERIOR' },
        { titulo: 'Obtencao do CNPJ', prazoDias: 3, base: 'PASSO_ANTERIOR' },
        { titulo: 'Inscricao estadual', prazoDias: 5, base: 'PASSO_ANTERIOR' },
        { titulo: 'Inscricao municipal / Alvara', prazoDias: 5, base: 'PASSO_ANTERIOR' },
        { titulo: 'Enquadramento tributario', prazoDias: 2, base: 'PASSO_ANTERIOR' },
        { titulo: 'Entrega ao cliente e onboarding', prazoDias: 1, base: 'PASSO_ANTERIOR' },
      ],
    },
    {
      nome: 'Admissao de Funcionario', departamentoId: deps['Pessoal'],
      passos: [
        { titulo: 'Receber dados do colaborador', prazoDias: 1 },
        { titulo: 'Exame admissional', prazoDias: 2, base: 'PASSO_ANTERIOR' },
        { titulo: 'Registro no eSocial', prazoDias: 1, base: 'PASSO_ANTERIOR' },
        { titulo: 'Elaborar contrato de trabalho', prazoDias: 1, base: 'PASSO_ANTERIOR' },
        { titulo: 'Criar obrigacao Folha de Pagamento', prazoDias: 0, acao: 'CRIAR_OBRIGACAO_NA_EMPRESA', acaoRef: 'Folha de Pagamento' },
        { titulo: 'Comunicar cliente', prazoDias: 1, base: 'PASSO_ANTERIOR' },
      ],
    },
    {
      nome: 'Encerramento de Empresa', departamentoId: deps['Societario'],
      passos: [
        { titulo: 'Solicitar documentos', prazoDias: 2 },
        { titulo: 'Baixar pendencias fiscais', prazoDias: 10, base: 'PASSO_ANTERIOR' },
        { titulo: 'Certidoes negativas emitidas', prazoDias: 10, base: 'PASSO_ANTERIOR', bloqueante: true },
        { titulo: 'Distrato social', prazoDias: 5, base: 'PASSO_ANTERIOR' },
        { titulo: 'Baixa na Junta Comercial', prazoDias: 5, base: 'PASSO_ANTERIOR' },
        { titulo: 'Baixa do CNPJ', prazoDias: 5, base: 'PASSO_ANTERIOR' },
        { titulo: 'Arquivamento final', prazoDias: 2, base: 'PASSO_ANTERIOR' },
      ],
    },
  ];
  for (const m of matrizes) {
    await prisma.matrizProcesso.create({
      data: {
        escritorioId: escritorio.id, nome: m.nome, departamentoId: m.departamentoId,
        passos: {
          create: m.passos.map((p, i) => ({
            ordem: i + 1, titulo: p.titulo, prazoDias: p.prazoDias,
            basePrazo: (p as { base?: string }).base === 'PASSO_ANTERIOR' ? 'PASSO_ANTERIOR' : 'INICIO',
            bloqueante: (p as { bloqueante?: boolean }).bloqueante ?? false,
            acaoAutomatica: ((p as { acao?: string }).acao as never) ?? 'NENHUMA',
            acaoRef: (p as { acaoRef?: string }).acaoRef ?? null,
          })),
        },
      },
    });
  }

  // ---------- Modulo 10: Portal (contato com senha, comunicado, LGPD) ----------
  const senhaContato = await bcrypt.hash('cliente123', 10);
  const contatoDemo = await prisma.empresaContato.findFirst({ where: { empresaId: empresaIds[0] } });
  let emailContatoDemo = '';
  if (contatoDemo) {
    await prisma.empresaContato.update({ where: { id: contatoDemo.id }, data: { senhaHash: senhaContato } });
    emailContatoDemo = contatoDemo.email ?? '';
  }
  await prisma.comunicado.create({
    data: {
      escritorioId: escritorio.id,
      titulo: 'Bem-vindo a Area VIP',
      conteudo: 'Aqui voce acessa suas guias, documentos e abre solicitacoes ao nosso escritorio. Qualquer duvida, estamos a disposicao!',
    },
  });
  await prisma.escritorio.update({
    where: { id: escritorio.id },
    data: {
      config: {
        ...(escritorio.config as object),
        portal: { nome: 'Portal do Cliente - Demo', cor: '#0f5c5e' },
        lgpd: { versao: '1', texto: 'Tratamos seus dados conforme a LGPD. Os documentos e informacoes aqui disponibilizados sao confidenciais e de uso exclusivo da sua empresa.' },
      },
    },
  });

  // ---------- Modulo 8: Templates e chatbot ----------
  await prisma.templateEmail.createMany({
    data: [
      { escritorioId: escritorio.id, tipo: 'ENTREGA', nome: 'Entrega de documento', assunto: 'Documento disponivel: {{obrigacao}} ({{competencia}})', corpo: 'Ola {{contato}},\n\nSegue o documento referente a {{obrigacao}} - competencia {{competencia}}.\nAcesse pelo link: {{link_protocolo}}\n\nAtenciosamente,\n{{empresa}}' },
      { escritorioId: escritorio.id, tipo: 'LEMBRETE', nome: 'Lembrete de guia', assunto: '[Lembrete] {{obrigacao}} - {{competencia}}', corpo: 'Ola {{contato}},\n\nLembramos que ha um documento pendente de visualizacao: {{obrigacao}}.\n{{link_protocolo}}' },
      { escritorioId: escritorio.id, tipo: 'COMUNICADO', nome: 'Comunicado geral', assunto: 'Comunicado do escritorio', corpo: 'Ola {{contato}},\n\n[escreva aqui o comunicado]\n\nAtenciosamente,\n{{empresa}}' },
    ],
  });
  await prisma.chatbotFluxo.create({
    data: {
      escritorioId: escritorio.id, nome: 'Atendimento inicial',
      arvore: {
        pergunta: 'Ola! Como podemos ajudar?',
        opcoes: [
          { texto: 'Segunda via de guia', resposta: 'Acesse a Area VIP > Documentos para baixar suas guias.' },
          { texto: 'Falar com o escritorio', resposta: 'Abra uma Solicitacao na Area VIP que retornaremos em breve.' },
        ],
      },
    },
  });

  // ---------- Modulo 11: Solicitacoes internas (exemplos) ----------
  const solExemplos = [
    {
      titulo: 'Cliente pediu certidao negativa',
      descricao: 'O cliente solicitou a CND federal com urgencia para participar de licitacao.',
      categoria: 'Certidoes', prioridade: 'ALTA' as const, status: 'ABERTA' as const,
      solicitanteId: pessoalId, departamentoDestinoId: deps['Fiscal'], responsavelId: null as string | null,
      empresaId: empresaIds[0],
    },
    {
      titulo: 'Conferir divergencia na folha',
      descricao: 'Valor do INSS da competencia anterior parece divergente. Pessoal favor conferir.',
      categoria: 'Folha', prioridade: 'MEDIA' as const, status: 'EM_ANDAMENTO' as const,
      solicitanteId: fiscalId, departamentoDestinoId: deps['Pessoal'], responsavelId: pessoalId,
      empresaId: empresaIds[1],
    },
    {
      titulo: 'Atualizar contrato social no sistema',
      descricao: 'Recebemos a alteracao contratual; favor anexar no GED e atualizar cadastro.',
      categoria: 'Societario', prioridade: 'BAIXA' as const, status: 'ABERTA' as const,
      solicitanteId: adminId, departamentoDestinoId: deps['Societario'], responsavelId: null,
      empresaId: empresaIds[2],
    },
  ];
  for (const s of solExemplos) {
    const criada = await prisma.solicitacaoInterna.create({ data: { escritorioId: escritorio.id, ...s } });
    await prisma.solicitacaoInternaMensagem.create({
      data: { solicitacaoId: criada.id, autorId: s.solicitanteId, autorNome: 'Sistema', texto: 'Solicitacao aberta.', evento: 'ABERTURA' },
    });
  }

  // ---------- Modulo 6: Processos rodando (instanciados das matrizes) ----------
  const matrizAdmissao = await prisma.matrizProcesso.findFirst({ where: { escritorioId: escritorio.id, nome: 'Admissao de Funcionario' } });
  const matrizAbertura = await prisma.matrizProcesso.findFirst({ where: { escritorioId: escritorio.id, nome: 'Abertura de Empresa' } });
  let processosCriados = 0;
  const planoProc = [
    { matriz: matrizAbertura, empresa: empresaIds[0], gestor: adminId, concluir: 3 },
    { matriz: matrizAdmissao, empresa: empresaIds[1], gestor: pessoalId, concluir: 2 },
    { matriz: matrizAbertura, empresa: empresaIds[2], gestor: adminId, concluir: 5 },
    { matriz: matrizAdmissao, empresa: empresaIds[3], gestor: pessoalId, concluir: 1 },
  ];
  for (const pl of planoProc) {
    if (!pl.matriz) continue;
    const proc = await instanciar(escritorio.id, pl.matriz.id, pl.empresa, { gestorId: pl.gestor });
    const passos = await prisma.processoPasso.findMany({ where: { processoId: proc.id }, orderBy: { ordem: 'asc' } });
    // conclui os N primeiros passos e marca alguns como visiveis ao cliente
    for (let k = 0; k < passos.length; k++) {
      const concluido = k < pl.concluir;
      await prisma.processoPasso.update({
        where: { id: passos[k].id },
        data: {
          status: concluido ? 'CONCLUIDO' : 'PENDENTE',
          concluidoEm: concluido ? new Date(Date.now() - 1000 * 60 * 60 * 24 * (pl.concluir - k)) : null,
          visivelCliente: k < pl.concluir + 2, // compartilha os feitos + os 2 proximos
        },
      });
    }
    processosCriados++;
  }

  // ---------- Metodo APLA: custos fixos ----------
  await prisma.custoFixo.createMany({
    data: [
      { escritorioId: escritorio.id, nome: 'Aluguel do escritorio', escopo: 'GERAL', valor: 4500 },
      { escritorioId: escritorio.id, nome: 'Software / sistemas', escopo: 'GERAL', valor: 1200 },
      { escritorioId: escritorio.id, nome: 'Energia e internet', escopo: 'GERAL', valor: 800 },
      { escritorioId: escritorio.id, nome: 'Consultoria do grupo', escopo: 'GRUPO', grupoId: grupoEmpresaIds['Grupo Sao Jorge'], valor: 600 },
    ],
  });

  // ---------- Dashboard Flexivel: indicadores + 1 painel ----------
  const indDefs = [
    { nome: 'Entregas baixadas (mes)', tipo: 'numerico', metrica: 'entregas_baixadas', prazo: 'mes_atual' },
    { nome: 'Demandas a realizar', tipo: 'numerico', metrica: 'a_realizar', prazo: 'mes_atual' },
    { nome: 'Atrasadas', tipo: 'numerico', metrica: 'atrasadas', prazo: 'mes_atual' },
    { nome: 'Por colaborador', tipo: 'colaborador', metrica: 'entregas_baixadas', prazo: 'mes_atual' },
    { nome: 'Por departamento', tipo: 'departamento', metrica: 'pendentes', prazo: 'mes_atual' },
  ];
  const indIds: string[] = [];
  for (const ind of indDefs) {
    const criado = await prisma.indicador.create({ data: { escritorioId: escritorio.id, criadoPorId: adminId, ...ind } });
    indIds.push(criado.id);
  }
  await prisma.painel.create({
    data: {
      escritorioId: escritorio.id, nome: 'Visao geral do mes', transicaoSeg: 30, criadoPorId: adminId,
      indicadores: { create: indIds.map((indicadorId, ordem) => ({ indicadorId, ordem })) },
    },
  });

  // ---------- ACDOX: regua de cobranca + cobrancas do mes ----------
  const regua = await prisma.reguaCobranca.create({
    data: {
      escritorioId: escritorio.id, nome: 'Documentos contabeis mensais', diaLimite: 10, departamentoId: deps['Contabil'],
      lembreteAntesDias: 5, lembreteDepoisDias: 3,
      itens: { create: [
        { nome: 'Extrato bancario', ordem: 0 },
        { nome: 'Notas fiscais de entrada', ordem: 1 },
        { nome: 'Notas fiscais de saida', ordem: 2 },
        { nome: 'Folha de pagamento', ordem: 3 },
      ] },
      empresas: { create: empresaIds.slice(0, 6).map((empresaId) => ({ empresaId })) },
    },
    include: { itens: true, empresas: true },
  });
  const dataLimite = new Date(Date.UTC(compAno, compMes - 1, regua.diaLimite, 12, 0, 0));
  let cobr = 0;
  for (let idx = 0; idx < regua.empresas.length; idx++) {
    const e = regua.empresas[idx];
    // status geral varia: pendente / recebido / validado / vencido
    const itensStatus = ['PENDENTE', 'RECEBIDO', 'VALIDADO', 'VENCIDO'][idx % 4];
    const cob = await prisma.cobrancaDoc.create({
      data: {
        escritorioId: escritorio.id, reguaId: regua.id, empresaId: e.empresaId,
        competenciaAno: compAno, competenciaMes: compMes, dataLimite,
        status: itensStatus,
        itens: { create: regua.itens.map((it, j) => ({
          nome: it.nome,
          status: itensStatus === 'VALIDADO' ? 'VALIDADO' : itensStatus === 'RECEBIDO' && j < 2 ? 'RECEBIDO' : 'PENDENTE',
        })) },
      },
    });
    void cob; cobr++;
  }

  // ---------- NPS (avaliacoes de clientes) ----------
  await prisma.npsAvaliacao.createMany({
    data: [
      { escritorioId: escritorio.id, empresaId: empresaIds[0], contatoEmail: 'responsavel1@cliente.com.br', contatoNome: 'Responsavel 1', nota: 10, comentario: 'Atendimento excelente!' },
      { escritorioId: escritorio.id, empresaId: empresaIds[1], contatoEmail: 'responsavel2@cliente.com.br', contatoNome: 'Responsavel 2', nota: 9 },
      { escritorioId: escritorio.id, empresaId: empresaIds[2], contatoEmail: 'responsavel3@cliente.com.br', contatoNome: 'Responsavel 3', nota: 7, comentario: 'Bom, mas demora um pouco no retorno.' },
      { escritorioId: escritorio.id, empresaId: empresaIds[3], contatoEmail: 'responsavel4@cliente.com.br', contatoNome: 'Responsavel 4', nota: 5, comentario: 'Precisa melhorar a comunicacao.' },
    ],
  });

  // ---------- Formulario flexivel de solicitacao ----------
  await prisma.formularioSolicitacao.create({
    data: {
      escritorioId: escritorio.id, nome: 'Abertura de empresa', descricao: 'Preencha para iniciarmos a abertura.',
      campos: [
        { id: 'razao', label: 'Razao social pretendida', tipo: 'texto', obrigatorio: true },
        { id: 'atividade', label: 'Atividade principal', tipo: 'textarea', obrigatorio: true },
        { id: 'capital', label: 'Capital social (R$)', tipo: 'numero' },
        { id: 'regime', label: 'Regime pretendido', tipo: 'select', opcoes: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'], obrigatorio: true },
      ],
    },
  });

  // ---------- Solicitacoes externas (clientes na Area VIP) ----------
  await prisma.solicitacaoPortal.create({
    data: {
      escritorioId: escritorio.id, empresaId: empresaIds[0], contatoEmail: emailContatoDemo || 'responsavel1@cliente.com.br', contatoNome: 'Responsavel 1',
      titulo: 'Preciso da guia do DAS', descricao: 'Boa tarde, podem reenviar a guia do DAS deste mes? Obrigado.',
      mensagens: { create: { autorTipo: 'CONTATO', autorNome: 'Responsavel 1', texto: 'Boa tarde, podem reenviar a guia do DAS deste mes?' } },
    },
  });
  await prisma.solicitacaoPortal.create({
    data: {
      escritorioId: escritorio.id, empresaId: empresaIds[0], contatoEmail: emailContatoDemo || 'responsavel1@cliente.com.br', contatoNome: 'Responsavel 1',
      titulo: 'Certidao negativa', descricao: 'Solicito a CND federal.', status: 'FINALIZADA',
      avaliacaoNota: 5, avaliacaoComentario: 'Rapido e atencioso, obrigado!',
      mensagens: { create: { autorTipo: 'CONTATO', autorNome: 'Responsavel 1', texto: 'Solicito a CND federal.' } },
    },
  });

  console.log('\nSeed concluido!');
  console.log(`  Matrizes de processo: ${matrizes.length}`);
  if (emailContatoDemo) console.log(`  Portal (Area VIP): ${emailContatoDemo} / cliente123`);
  console.log(`  Entregas geradas (6 meses): ${entregasGeradas}`);
  console.log(`  Processos rodando: ${processosCriados} | Cobrancas ACDOX: ${cobr}`);
  console.log(`  Departamentos: ${depsDados.length} | Tags: ${tagsDados.length} | Empresas: ${nomes.length} | Grupos: ${gruposDados.length}`);
  console.log(`  Obrigacoes: ${catalogo.length} | Regimes: ${Object.keys(regimeDefs).length} | Grupos: ${Object.keys(grupoDefs).length}`);
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
