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

export type { Prisma };
