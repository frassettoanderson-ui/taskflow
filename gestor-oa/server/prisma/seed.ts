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
    const eid = existente.id;
    // Limpeza em ordem de dependencia (FKs com RESTRICT exigem ordem manual).
    await prisma.roboJob.deleteMany({ where: { escritorioId: eid } });
    await prisma.assinaturaDocumento.deleteMany({ where: { escritorioId: eid } });
    await prisma.aceiteLGPD.deleteMany({ where: { escritorioId: eid } });
    await prisma.comunicacaoLog.deleteMany({ where: { escritorioId: eid } });
    await prisma.templateEmail.deleteMany({ where: { escritorioId: eid } });
    await prisma.chatbotFluxo.deleteMany({ where: { escritorioId: eid } });
    await prisma.comunicado.deleteMany({ where: { escritorioId: eid } });
    await prisma.processoRecorrente.deleteMany({ where: { escritorioId: eid } });
    await prisma.empresaObrigacao.deleteMany({ where: { escritorioId: eid } });
    await prisma.empresa.deleteMany({ where: { escritorioId: eid } }); // cascade nos filhos (entregas, docs, protocolos, processos)
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

  const empresaIds: string[] = [];

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
    empresaIds.push(empresa.id);
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
    for (const n of lista) {
      const eo = await prisma.empresaObrigacao.create({
        data: {
          escritorioId: escritorio.id,
          empresaId: empresaIds[i],
          obrigacaoId: obrigIds[n],
          origens: [{ origem: 'REGIME', refId: regimeId }],
          ativo: true,
        },
      });

      // gera a entrega da competencia corrente (apenas MENSAL para o demo)
      const meta = metaPorNome.get(n);
      if (!meta || meta.per !== 'MENSAL') continue;
      const { prazoLegal, prazoTecnico } = calcularPrazos(
        { ...meta.regra, regraNaoUtil: meta.regra.regraNaoUtil ?? 'ANTECIPA', diasAntesTecnico: meta.regra.diasAntesTecnico ?? 2, tipoDiasAntes: meta.regra.tipoDiasAntes ?? 'UTEIS' },
        compAno, compMes - 1, feriadosSet, false,
      );
      const responsavel = meta.dep === F ? fiscalId : meta.dep === P ? pessoalId : null;
      const status = computarStatusPendente(prazoTecnico, prazoLegal, hoje, 7);
      await prisma.entrega.create({
        data: {
          escritorioId: escritorio.id,
          empresaId: empresaIds[i],
          empresaObrigacaoId: eo.id,
          obrigacaoId: obrigIds[n],
          competenciaAno: compAno,
          competenciaMes: compMes,
          prazoLegal, prazoTecnico,
          status,
          responsavelPrazoId: responsavel,
          responsavelEntregaId: responsavel,
        },
      });
      entregasGeradas++;
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

  console.log('\nSeed concluido!');
  console.log(`  Matrizes de processo: ${matrizes.length}`);
  if (emailContatoDemo) console.log(`  Portal (Area VIP): ${emailContatoDemo} / cliente123`);
  console.log(`  Entregas geradas (competencia ${compMes}/${compAno}): ${entregasGeradas}`);
  console.log(`  Departamentos: ${depsDados.length} | Tags: ${tagsDados.length} | Empresas: ${nomes.length}`);
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
