// Importa os clientes do ERP (banco `nauta`, tabelas clientes/cliente_socios/leads) para o Obrigô
// como Empresas do escritório "Atuan Contabilidade". IDEMPOTENTE: chave = nautaClienteId
// (roda quantas vezes quiser; atualiza o que já existe). Não apaga nada em nenhum dos bancos.
//
// Uso (na VPS, dentro de gestor-oa/server):
//   NAUTA_DATABASE_URL='postgresql://...' node scripts/importar-nauta.mjs [--dry]
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DRY = process.argv.includes('--dry');
const TENANT = 'Atuan Contabilidade';
const REGIMES = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'];

const goa = new PrismaClient();
const nauta = new PrismaClient({ datasources: { db: { url: process.env.NAUTA_DATABASE_URL } } });

const nz = (v) => { const s = String(v ?? '').trim(); return s ? s : null; };
const num = (v) => (v == null || v === '' ? null : Number(v));
const dig = (v) => String(v ?? '').replace(/\D/g, '');

async function main() {
  if (!process.env.NAUTA_DATABASE_URL) throw new Error('NAUTA_DATABASE_URL não definido');

  // 1) Tenant
  let esc = await goa.escritorio.findFirst({ where: { nome: TENANT, deletedAt: null } });
  if (!esc) {
    console.log(`[tenant] criando escritório "${TENANT}"`);
    esc = DRY ? { id: 'DRY' } : await goa.escritorio.create({ data: { nome: TENANT } });
  }
  console.log(`[tenant] ${TENANT} = ${esc.id}`);

  // 2) Regimes tributários do tenant (por nome)
  const regimeId = {};
  for (const nome of REGIMES) {
    let r = await goa.regimeTributario.findFirst({ where: { escritorioId: esc.id, nome } });
    if (!r && !DRY) r = await goa.regimeTributario.create({ data: { escritorioId: esc.id, nome } });
    regimeId[nome] = r?.id ?? null;
  }

  // 3) Clientes do ERP (+ lead + sócios)
  const clientes = await nauta.$queryRawUnsafe(`
    SELECT c.*, l.valor_honorario AS l_honorario, l.valor_abertura AS l_abertura, l.negociacao_obs AS l_obs,
           l.honorario_vencimento AS l_venc, l.interesse AS l_interesse, l.whatsapp AS l_whatsapp, l.email AS l_email, l.nome AS l_nome
      FROM clientes c LEFT JOIN leads l ON l.id = c.lead_id ORDER BY c.criado_em`);
  const sociosAll = await nauta.$queryRawUnsafe(`SELECT * FROM cliente_socios ORDER BY cliente_id, ordem`);
  const sociosBy = {};
  for (const s of sociosAll) (sociosBy[s.cliente_id] ||= []).push(s);

  let maxNumero = (await goa.empresa.aggregate({ where: { escritorioId: esc.id }, _max: { numero: true } }))._max.numero ?? 0;
  const rel = { criadas: 0, atualizadas: 0, emAbertura: 0, semCnpj: 0, avisos: [] };

  for (const c of clientes) {
    const cnpj = dig(c.emp_cnpj).length === 14 ? dig(c.emp_cnpj) : null;
    const [cidade, uf] = String(c.emp_cidade_estado ?? '').split('/').map((x) => x.trim());
    const situacao = c.situacao || 'ativo';
    const emAbertura = situacao === 'em_processo' || (!cnpj && /abrir/i.test(c.l_interesse ?? ''));
    const razao = nz(c.emp_nome) || nz(c.cli_nome_completo) || nz(c.l_nome) || '(sem nome)';
    const venc = c.l_venc ? new Date(c.l_venc) : null;
    const filiais = Array.isArray(c.emp_filiais) ? c.emp_filiais : (typeof c.emp_filiais === 'string' && c.emp_filiais ? JSON.parse(c.emp_filiais) : null);

    // sócios: no ERP a linha ordem 0/1 é o titular montado a partir de cli_*; garantimos o titular como sócio 1
    const src = sociosBy[c.id] ?? [];
    const socios = src.map((s, i) => ({
      ordem: i + 1, nomeCompleto: nz(s.nome_completo) || nz(c.cli_nome_completo) || razao,
      cpf: nz(s.cpf), rg: nz(s.rg), nascimento: nz(s.nascimento), nomePai: nz(s.nome_pai), nomeMae: nz(s.nome_mae),
      participacao: num(s.participacao), estadoCivil: nz(s.estado_civil), reciboIrpf: nz(s.recibo_irpf),
      tituloEleitor: nz(s.titulo_eleitor), senhaGov: nz(s.senha_gov), docUrl: nz(s.doc_url), certUrl: nz(s.cert_url), certSenha: nz(s.cert_senha),
      email: i === 0 ? nz(c.cli_email) : null, telefone: i === 0 ? (nz(c.emp_telefone) || nz(c.l_whatsapp)) : null,
      cep: i === 0 ? nz(c.cli_cep) : null, endereco: i === 0 ? nz(c.cli_endereco) : null, bairro: i === 0 ? nz(c.cli_bairro) : null,
      cidadeEstado: i === 0 ? nz(c.cli_cidade_estado) : null,
    }));
    if (socios.length === 0 && nz(c.cli_nome_completo)) {
      socios.push({ ordem: 1, nomeCompleto: c.cli_nome_completo, cpf: nz(c.cli_cpf), rg: nz(c.cli_rg), nascimento: nz(c.cli_nascimento),
        nomePai: nz(c.cli_nome_pai), nomeMae: nz(c.cli_nome_mae), participacao: 100, estadoCivil: nz(c.cli_estado_civil),
        reciboIrpf: nz(c.cli_recibo_irpf), tituloEleitor: nz(c.cli_titulo_eleitor), senhaGov: nz(c.cli_senha_gov),
        docUrl: nz(c.cli_doc_url), certUrl: nz(c.cli_cert_url), certSenha: nz(c.cli_cert_senha),
        email: nz(c.cli_email), telefone: nz(c.emp_telefone) || nz(c.l_whatsapp), cep: nz(c.cli_cep), endereco: nz(c.cli_endereco),
        bairro: nz(c.cli_bairro), cidadeEstado: nz(c.cli_cidade_estado) });
    }

    const data = {
      razaoSocial: razao, nomeFantasia: nz(c.emp_fantasia), emailPrincipal: nz(c.emp_email) || nz(c.cli_email) || nz(c.l_email),
      telefone: nz(c.emp_telefone) || nz(c.l_whatsapp), cep: nz(c.emp_cep), logradouro: nz(c.emp_endereco), bairro: nz(c.emp_bairro),
      cidade: nz(cidade), uf: nz(uf)?.slice(0, 2) ?? null, regimeTributarioId: regimeId[c.emp_regime] ?? null,
      honorario: num(c.l_honorario), diaVencimento: venc ? venc.getUTCDate() : null, primeiroVencimento: venc,
      valorAbertura: num(c.l_abertura), negociacaoObs: nz(c.l_obs), interesse: nz(c.l_interesse), emAbertura,
      atividade: nz(c.emp_atividade), capitalSocial: num(c.emp_capital_social), inscricaoImobiliaria: nz(c.emp_inscricao_imobiliaria),
      areaOcupada: nz(c.emp_area_ocupada), areaEdificacao: nz(c.emp_edificacao), proprietarioNome: nz(c.emp_proprietario_nome),
      proprietarioCpf: nz(c.emp_proprietario_cpf), usaGlp: typeof c.emp_usa_glp === 'boolean' ? c.emp_usa_glp : null,
      filiais: filiais && filiais.length ? filiais : undefined,
      ativo: situacao !== 'inativo', dataEntrada: c.criado_em ? new Date(c.criado_em) : null,
      anotacoes: nz(c.observacoes) ?? undefined,
      nautaClienteId: c.id, nautaLeadId: c.lead_id ?? null,
    };

    if (emAbertura) rel.emAbertura++;
    if (!cnpj) rel.semCnpj++;

    const existente = await goa.empresa.findUnique({ where: { nautaClienteId: c.id } });
    if (DRY) { console.log(`${existente ? 'ATUALIZAR' : 'CRIAR   '} ${razao} cnpj=${cnpj ?? '-'} abertura=${emAbertura} socios=${socios.length}`); continue; }

    let emp;
    if (existente) {
      emp = await goa.empresa.update({ where: { id: existente.id }, data: { ...data, socios: { deleteMany: {}, create: socios } } });
      rel.atualizadas++;
    } else {
      maxNumero += 1;
      emp = await goa.empresa.create({ data: { ...data, escritorioId: esc.id, numero: maxNumero, socios: { create: socios } } });
      rel.criadas++;
    }
    // Identificador CNPJ
    if (cnpj) {
      const ja = await goa.empresaIdentificador.findFirst({ where: { empresaId: emp.id, tipo: 'CNPJ' } });
      if (!ja) await goa.empresaIdentificador.create({ data: { empresaId: emp.id, tipo: 'CNPJ', valor: cnpj } });
      else if (ja.valor !== cnpj) await goa.empresaIdentificador.update({ where: { id: ja.id }, data: { valor: cnpj } });
    }
    // Contato principal (titular)
    const nomeContato = nz(c.cli_nome_completo) || nz(c.l_nome);
    if (nomeContato) {
      const jaC = await goa.empresaContato.findFirst({ where: { empresaId: emp.id, nome: nomeContato } });
      if (!jaC) await goa.empresaContato.create({ data: { empresaId: emp.id, nome: nomeContato, email: nz(c.cli_email) || nz(c.l_email), whatsapp: nz(c.emp_telefone) || nz(c.l_whatsapp), cargo: 'Titular' } });
    }
  }

  console.log('\n=== RELATÓRIO ===');
  console.log(`clientes lidos do ERP: ${clientes.length}`);
  console.log(`criadas: ${rel.criadas} | atualizadas: ${rel.atualizadas} | em abertura: ${rel.emAbertura} | sem CNPJ: ${rel.semCnpj}`);
  console.log(`ATUAN_ESCRITORIO_ID=${esc.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await goa.$disconnect(); await nauta.$disconnect(); });
