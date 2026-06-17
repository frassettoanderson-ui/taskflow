import { PrismaClient, Prisma } from '@prisma/client';
import { getContext } from './context.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Models cujas mutacoes geram LogAuditoria automaticamente.
// (cresce conforme novos modulos sao adicionados)
const AUDITED_MODELS = new Set<string>([
  'Escritorio',
  'Usuario',
  'Permissao',
  'Empresa',
  'EmpresaIdentificador',
  'EmpresaContato',
  'EmpresaResponsavelDepartamento',
  'Departamento',
  'Tag',
  'Obrigacao',
  'RegimeTributario',
  'GrupoObrigacoes',
  'EmpresaObrigacao',
  'Feriado',
  'Entrega',
  'DocumentoGED',
  'Protocolo',
  'ProtocoloFisico',
  'AssinaturaDocumento',
  'MatrizProcesso',
  'Processo',
  'Comunicado',
  'SolicitacaoPortal',
  'TemplateEmail',
  'ChatbotFluxo',
]);

// Evita recursao: a propria gravacao do log nao deve ser auditada.
const AUDIT_MODEL = 'LogAuditoria';

prisma.$use(async (params, next) => {
  const { model, action } = params;

  if (!model || model === AUDIT_MODEL || !AUDITED_MODELS.has(model)) {
    return next(params);
  }

  const ctx = getContext();
  // Sem contexto (ex.: seed, jobs) -> nao audita, apenas executa.
  if (!ctx?.escritorioId) {
    return next(params);
  }

  const isCreate = action === 'create';
  const isUpdate = action === 'update' || action === 'updateMany';
  const isDelete = action === 'delete' || action === 'deleteMany';

  if (!isCreate && !isUpdate && !isDelete) {
    return next(params);
  }

  // Captura estado "antes" para update/delete unitarios.
  let antes: unknown = null;
  let entidadeId: string | undefined;
  if ((action === 'update' || action === 'delete') && params.args?.where) {
    try {
      // @ts-expect-error - acesso dinamico ao delegate
      antes = await prisma[model[0].toLowerCase() + model.slice(1)].findUnique({
        where: params.args.where,
      });
      entidadeId = (antes as { id?: string } | null)?.id;
    } catch {
      antes = null;
    }
  }

  const result = await next(params);

  let depois: unknown = null;
  if (isCreate || action === 'update') {
    depois = result;
    entidadeId = entidadeId ?? (result as { id?: string } | null)?.id;
  }

  try {
    await prisma.logAuditoria.create({
      data: {
        escritorioId: ctx.escritorioId,
        usuarioId: ctx.usuarioId ?? null,
        acao: isCreate ? 'CREATE' : isDelete ? 'DELETE' : 'UPDATE',
        entidade: model,
        entidadeId: entidadeId ?? null,
        antes: antes ? (antes as Prisma.InputJsonValue) : Prisma.JsonNull,
        depois: depois ? (depois as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch {
    // Auditoria nao deve quebrar a operacao principal.
  }

  return result;
});
