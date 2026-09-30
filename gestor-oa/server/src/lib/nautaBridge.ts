import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { env } from '../env.js';

// Ponte Obrigô → ERP (Nauta/Atuan), até a fusão dos sistemas.
// O cadastro de cliente passa a ser SÓ o do Obrigô; ao salvar uma Empresa vinculada
// (nautaClienteId), espelhamos os campos que os fluxos do ERP ainda usam (contrato,
// cobrança/Asaas, comissões, onboarding) nas tabelas `clientes`, `cliente_socios` e `leads`.
// Nunca bloqueia o salvamento: qualquer falha só vai pro log.

let nauta: PrismaClient | null = null;
function clienteNauta(): PrismaClient | null {
  if (!env.nautaDatabaseUrl) return null;
  if (!nauta) nauta = new PrismaClient({ datasources: { db: { url: env.nautaDatabaseUrl } } });
  return nauta;
}

const nz = (v: unknown): string | null => { const s = String(v ?? '').trim(); return s ? s : null; };
const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));

export async function sincronizarComNauta(empresaId: string): Promise<void> {
  const db = clienteNauta();
  if (!db) return;
  try {
    const e = await prisma.empresa.findUnique({
      where: { id: empresaId },
      include: { socios: { orderBy: { ordem: 'asc' } }, identificadores: true, regimeTributario: true },
    });
    if (!e || !e.nautaClienteId) return;

    // O ERP guarda o CNPJ formatado (xx.xxx.xxx/xxxx-xx); o Obrigô guarda só dígitos
    const cnpjDig = (e.identificadores.find((i) => i.tipo === 'CNPJ')?.valor ?? '').replace(/\D/g, '');
    const cnpj = cnpjDig.length === 14 ? cnpjDig.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : null;
    const t = e.socios[0]; // titular = sócio 1
    const situacao = !e.ativo ? 'inativo' : e.emAbertura ? 'em_processo' : 'ativo';
    const filiais = Array.isArray(e.filiais) ? (e.filiais as unknown[]) : [];
    const endereco = [e.logradouro, e.numeroEndereco].filter(Boolean).join(', ') || e.endereco || null;
    const cidadeEstado = e.cidade ? `${e.cidade}/${e.uf ?? ''}` : null;

    await db.$executeRawUnsafe(
      `UPDATE clientes SET
         emp_nome=$2, emp_fantasia=$3, emp_cnpj=$4, emp_regime=$5, emp_endereco=$6, emp_bairro=$7, emp_cep=$8,
         emp_cidade_estado=$9, emp_telefone=$10, emp_email=$11, emp_atividade=$12, emp_capital_social=$13::numeric,
         emp_inscricao_imobiliaria=$14, emp_area_ocupada=$15, emp_edificacao=$16, emp_proprietario_nome=$17,
         emp_proprietario_cpf=$18, emp_usa_glp=$19::boolean, emp_tem_filiais=$20::boolean, emp_filiais=$21::jsonb,
         cli_nome_completo=COALESCE($22, cli_nome_completo), cli_cpf=$23, cli_rg=$24, cli_nascimento=$25, cli_nome_pai=$26,
         cli_nome_mae=$27, cli_estado_civil=$28, cli_recibo_irpf=$29, cli_titulo_eleitor=$30, cli_senha_gov=$31,
         cli_email=COALESCE($32, cli_email), cli_endereco=$33, cli_bairro=$34, cli_cep=$35, cli_cidade_estado=$36,
         cli_doc_url=$37, cli_cert_url=$38, cli_cert_senha=$39,
         situacao=$40, atualizado_em=NOW()
       WHERE id=$1::uuid`,
      e.nautaClienteId,
      nz(e.razaoSocial), nz(e.nomeFantasia), cnpj, nz(e.regimeTributario?.nome), endereco, nz(e.bairro), nz(e.cep),
      cidadeEstado, nz(e.telefone), nz(e.emailPrincipal), nz(e.atividade), num(e.capitalSocial),
      nz(e.inscricaoImobiliaria), nz(e.areaOcupada), nz(e.areaEdificacao), nz(e.proprietarioNome),
      nz(e.proprietarioCpf), e.usaGlp ?? null, filiais.length > 0, JSON.stringify(filiais),
      nz(t?.nomeCompleto), nz(t?.cpf), nz(t?.rg), nz(t?.nascimento), nz(t?.nomePai),
      nz(t?.nomeMae), nz(t?.estadoCivil), nz(t?.reciboIrpf), nz(t?.tituloEleitor), nz(t?.senhaGov),
      nz(t?.email), nz(t?.endereco), nz(t?.bairro), nz(t?.cep), nz(t?.cidadeEstado),
      nz(t?.docUrl), nz(t?.certUrl), nz(t?.certSenha),
      situacao,
    );

    // Quadro societário: espelha inteiro (o ERP também apaga/reinsere ao salvar)
    await db.$executeRawUnsafe(`DELETE FROM cliente_socios WHERE cliente_id=$1::uuid`, e.nautaClienteId);
    for (let i = 0; i < e.socios.length; i++) {
      const s = e.socios[i];
      await db.$executeRawUnsafe(
        `INSERT INTO cliente_socios (id, cliente_id, ordem, nome_completo, rg, cpf, nascimento, nome_pai, nome_mae, participacao,
           estado_civil, recibo_irpf, titulo_eleitor, doc_url, cert_url, cert_senha, senha_gov)
         VALUES (gen_random_uuid(), $1::uuid, $2::int, $3, $4, $5, $6, $7, $8, $9::numeric, $10, $11, $12, $13, $14, $15, $16)`,
        e.nautaClienteId, i, s.nomeCompleto, nz(s.rg), nz(s.cpf), nz(s.nascimento), nz(s.nomePai), nz(s.nomeMae),
        num(s.participacao), nz(s.estadoCivil), nz(s.reciboIrpf), nz(s.tituloEleitor), nz(s.docUrl), nz(s.certUrl),
        nz(s.certSenha), nz(s.senhaGov),
      );
    }

    // Lead (honorário, abertura, condições, tipo de contrato, contato principal)
    if (e.nautaLeadId) {
      await db.$executeRawUnsafe(
        `UPDATE leads SET
           valor_honorario=COALESCE($2::numeric, valor_honorario), valor_abertura=COALESCE($3::numeric, valor_abertura),
           negociacao_obs=$4, honorario_vencimento=COALESCE($5::date, honorario_vencimento),
           interesse=COALESCE($6, interesse), nome=COALESCE($7, nome),
           email=COALESCE($8, email), whatsapp=COALESCE($9, whatsapp)
         WHERE id=$1::uuid`,
        e.nautaLeadId, num(e.honorario), num(e.valorAbertura), nz(e.negociacaoObs),
        e.primeiroVencimento ? e.primeiroVencimento.toISOString().slice(0, 10) : null,
        nz(e.interesse), nz(t?.nomeCompleto), nz(e.emailPrincipal), nz(e.telefone),
      );
    }
  } catch (err) {
    console.error('[nautaBridge] falha ao sincronizar empresa', empresaId, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ponte reversa ERP → Obrigô: o cadastro preenchido no ERP (link público, tela antiga)
// e o "Concluir onboarding" sobem para a Empresa do Obrigô (fonte da verdade do cadastro).
// Idempotente por nautaClienteId. Cria a Empresa se ainda não existir (tenant = SSO_ESCRITORIO_ID).
// Nunca lança: falha só vai pro log.
// ─────────────────────────────────────────────────────────────────────────────
const num2 = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
const soDig = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

export async function sincronizarDoNauta(nautaClienteId: string): Promise<string | null> {
  const db = clienteNauta();
  if (!db) return null;
  const escritorioId = env.sso.escritorioId;
  if (!escritorioId) { console.error('[nautaBridge] SSO_ESCRITORIO_ID ausente; sync reversa ignorada'); return null; }
  try {
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT c.*, l.valor_honorario AS l_honorario, l.valor_abertura AS l_abertura, l.negociacao_obs AS l_obs,
              l.honorario_vencimento AS l_venc, l.interesse AS l_interesse, l.whatsapp AS l_whatsapp,
              l.email AS l_email, l.nome AS l_nome, l.onboarding_concluido AS l_onb_ok, l.em_onboarding AS l_em_onb
         FROM clientes c LEFT JOIN leads l ON l.id = c.lead_id
        WHERE c.id = $1::uuid`,
      nautaClienteId,
    );
    const c = rows[0];
    if (!c) return null;

    const socs = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM cliente_socios WHERE cliente_id = $1::uuid ORDER BY ordem`, nautaClienteId,
    );

    const cnpjDig = soDig(c.emp_cnpj);
    const cnpj = cnpjDig.length === 14 ? cnpjDig.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : null;
    const [cidade, uf] = String(c.emp_cidade_estado ?? '').split('/').map((x) => x.trim());
    const situacao = String(c.situacao ?? 'ativo');
    const emAbertura = situacao === 'em_processo' || (!cnpjDig && /abrir/i.test(String(c.l_interesse ?? '')));
    const razao = nz(c.emp_nome) || nz(c.cli_nome_completo) || nz(c.l_nome) || '(sem nome)';
    const venc = c.l_venc ? new Date(c.l_venc as string) : null;
    const filiais = Array.isArray(c.emp_filiais) ? c.emp_filiais
      : (typeof c.emp_filiais === 'string' && c.emp_filiais ? JSON.parse(c.emp_filiais as string) : null);

    // sócios: a linha ordem 0/1 do ERP é o titular; garante o titular como sócio 1
    const socios = socs.map((sx, i) => ({
      ordem: i + 1, nomeCompleto: nz(sx.nome_completo) || nz(c.cli_nome_completo) || razao,
      cpf: nz(sx.cpf), rg: nz(sx.rg), nascimento: nz(sx.nascimento), nomePai: nz(sx.nome_pai), nomeMae: nz(sx.nome_mae),
      participacao: num2(sx.participacao), estadoCivil: nz(sx.estado_civil), reciboIrpf: nz(sx.recibo_irpf),
      tituloEleitor: nz(sx.titulo_eleitor), senhaGov: nz(sx.senha_gov), docUrl: nz(sx.doc_url), certUrl: nz(sx.cert_url),
      certSenha: nz(sx.cert_senha),
      email: i === 0 ? nz(c.cli_email) : null, telefone: i === 0 ? (nz(c.emp_telefone) || nz(c.l_whatsapp)) : null,
      cep: i === 0 ? nz(c.cli_cep) : null, endereco: i === 0 ? nz(c.cli_endereco) : null, bairro: i === 0 ? nz(c.cli_bairro) : null,
      cidadeEstado: i === 0 ? nz(c.cli_cidade_estado) : null,
    }));
    if (socios.length === 0 && nz(c.cli_nome_completo)) {
      socios.push({ ordem: 1, nomeCompleto: String(c.cli_nome_completo), cpf: nz(c.cli_cpf), rg: nz(c.cli_rg),
        nascimento: nz(c.cli_nascimento), nomePai: nz(c.cli_nome_pai), nomeMae: nz(c.cli_nome_mae), participacao: 100,
        estadoCivil: nz(c.cli_estado_civil), reciboIrpf: nz(c.cli_recibo_irpf), tituloEleitor: nz(c.cli_titulo_eleitor),
        senhaGov: nz(c.cli_senha_gov), docUrl: nz(c.cli_doc_url), certUrl: nz(c.cli_cert_url), certSenha: nz(c.cli_cert_senha),
        email: nz(c.cli_email), telefone: nz(c.emp_telefone) || nz(c.l_whatsapp), cep: nz(c.cli_cep), endereco: nz(c.cli_endereco),
        bairro: nz(c.cli_bairro), cidadeEstado: nz(c.cli_cidade_estado) });
    }

    const regimeId = c.emp_regime
      ? (await prisma.regimeTributario.findFirst({ where: { escritorioId, nome: String(c.emp_regime) } }))?.id ?? null
      : null;

    const data = {
      razaoSocial: razao, nomeFantasia: nz(c.emp_fantasia),
      emailPrincipal: nz(c.emp_email) || nz(c.cli_email) || nz(c.l_email),
      telefone: nz(c.emp_telefone) || nz(c.l_whatsapp), cep: nz(c.emp_cep), logradouro: nz(c.emp_endereco),
      bairro: nz(c.emp_bairro), cidade: nz(cidade), uf: (nz(uf) ?? '').slice(0, 2) || null, regimeTributarioId: regimeId,
      honorario: num2(c.l_honorario), diaVencimento: venc ? venc.getUTCDate() : null, primeiroVencimento: venc,
      valorAbertura: num2(c.l_abertura), negociacaoObs: nz(c.l_obs), interesse: nz(c.l_interesse), emAbertura,
      atividade: nz(c.emp_atividade), capitalSocial: num2(c.emp_capital_social), inscricaoImobiliaria: nz(c.emp_inscricao_imobiliaria),
      areaOcupada: nz(c.emp_area_ocupada), areaEdificacao: nz(c.emp_edificacao), proprietarioNome: nz(c.emp_proprietario_nome),
      proprietarioCpf: nz(c.emp_proprietario_cpf), usaGlp: typeof c.emp_usa_glp === 'boolean' ? c.emp_usa_glp : null,
      filiais: filiais && filiais.length ? filiais : undefined,
      ativo: situacao !== 'inativo',
      // Regra do fluxo: empresa vinda de lead só aparece em Empresas após "Concluir onboarding".
      // Sem lead vinculado (cadastro manual no Obrigô) → considera concluído (visível).
      onboardingConcluido: c.lead_id ? !!c.l_onb_ok : true,
      nautaLeadId: (c.lead_id as string) ?? null,
    };

    const existente = await prisma.empresa.findUnique({ where: { nautaClienteId } });
    let empId: string;
    if (existente) {
      const up = await prisma.empresa.update({
        where: { id: existente.id },
        data: { ...data, socios: { deleteMany: {}, create: socios } },
      });
      empId = up.id;
    } else {
      const maxNumero = (await prisma.empresa.aggregate({ where: { escritorioId }, _max: { numero: true } }))._max.numero ?? 0;
      const nova = await prisma.empresa.create({
        data: { ...data, escritorioId, numero: maxNumero + 1, nautaClienteId, socios: { create: socios } },
      });
      empId = nova.id;
    }

    // Identificador CNPJ (armazenado só com dígitos, como no import)
    if (cnpjDig.length === 14) {
      const ja = await prisma.empresaIdentificador.findFirst({ where: { empresaId: empId, tipo: 'CNPJ' } });
      if (!ja) await prisma.empresaIdentificador.create({ data: { escritorioId, empresaId: empId, tipo: 'CNPJ', valor: cnpjDig } });
      else if (ja.valor !== cnpjDig) await prisma.empresaIdentificador.update({ where: { id: ja.id }, data: { valor: cnpjDig } });
    }
    void cnpj; // (formatado só se algum dia precisar exibir)

    // Contato principal (titular)
    const nomeContato = nz(c.cli_nome_completo) || nz(c.l_nome);
    if (nomeContato) {
      const jaC = await prisma.empresaContato.findFirst({ where: { empresaId: empId, nome: nomeContato } });
      if (!jaC) await prisma.empresaContato.create({ data: { escritorioId, empresaId: empId, nome: nomeContato,
        email: nz(c.cli_email) || nz(c.l_email), whatsapp: nz(c.emp_telefone) || nz(c.l_whatsapp), cargo: 'Titular' } });
    }
    return empId;
  } catch (err) {
    console.error('[nautaBridge] falha ao sincronizar DO Nauta', nautaClienteId, err);
    return null;
  }
}

// Devolve o lead ao Onboarding no ERP (volta pro Kanban/lista de onboarding).
export async function reabrirOnboardingNoNauta(nautaLeadId: string): Promise<void> {
  const db = clienteNauta();
  if (!db || !nautaLeadId) return;
  try {
    await db.$executeRawUnsafe(
      `UPDATE leads SET em_onboarding = true, onboarding_concluido = false WHERE id = $1::uuid`,
      nautaLeadId,
    );
  } catch (err) {
    console.error('[nautaBridge] falha ao reabrir onboarding', nautaLeadId, err);
  }
}

export type { Prisma };
