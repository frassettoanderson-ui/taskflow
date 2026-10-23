import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { Errors } from '../../lib/errors.js';
import { generateToken, sha256 } from '../../lib/password.js';
import { durationToMs } from '../../lib/jwt.js';
import { allPermissions } from '../../lib/permissions.js';
import { verifySsoToken } from '../../lib/ssoToken.js';
import type { SessionMeta } from './auth.service.js';

// Resolve o escritorio (tenant) em que os usuarios do SSO entram.
// Preferencia: env SSO_ESCRITORIO_ID; senao, se houver so um escritorio ativo, usa esse.
export async function resolverEscritorioId(perfil?: string): Promise<string> {
  if (perfil && env.sso.escritorios[perfil]) return env.sso.escritorios[perfil];
  if (env.sso.escritorioId) return env.sso.escritorioId;
  const ativos = await prisma.escritorio.findMany({
    where: { deletedAt: null },
    select: { id: true },
    take: 2,
  });
  if (ativos.length === 1) return ativos[0]!.id;
  throw Errors.validacao(
    'SSO: defina SSO_ESCRITORIO_ID (ha mais de um escritorio ou nenhum).',
  );
}

// Cargo do ERP -> permissoes do Obrigo (aplicadas ao criar o usuario e quando o cargo muda).
// admin/gerente: tudo. Fiscal/pessoal/contabil: operacional. Comercial/atendente: basico.
// Ninguem alem de admin/gerente administra usuarios, permissoes, auditoria ou escritorio.
const OPERACIONAL = [
  'empresas_ver', 'empresas_criar', 'empresas_editar', 'obrigacoes_ver', 'entregas_ver', 'entregas_baixar',
  'entregas_editar_prazos', 'entregas_dispensar', 'processos_ver', 'processos_operar', 'documentos_ver',
  'documentos_upload', 'relatorios_ver', 'apla_ver', 'portal_solicitacoes', 'solicitacoes_internas_ver',
  'societario_ver', 'societario_operar', 'alvaras_ver', 'alvaras_operar', 'mei_ver', 'mei_operar', 'ecac_ver', 'ecac_operar',
];
const BASICO = [
  'empresas_ver', 'empresas_criar', 'empresas_editar', 'obrigacoes_ver', 'entregas_ver', 'documentos_ver',
  'documentos_upload', 'relatorios_ver', 'solicitacoes_internas_ver', 'societario_ver', 'alvaras_ver', 'mei_ver', 'ecac_ver',
];
export function permissoesParaCargo(role?: string) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'gerente') return allPermissions(true);
  const lista = r === 'comercial' || r === 'atendente' ? BASICO : OPERACIONAL;
  const p = allPermissions(false) as Record<string, boolean>;
  for (const f of lista) if (f in p) p[f] = true;
  return p as ReturnType<typeof allPermissions>;
}
const CARGOS_ERP = new Set(['admin', 'gerente', 'fiscal', 'pessoal', 'contabil', 'comercial', 'atendente']);

// Valida o token vindo da Nauta, garante o usuario no escritorio e cria uma sessao
// (refresh token). Retorna o refresh token em claro para virar cookie no controller.
export async function loginViaSso(token: string, meta: SessionMeta): Promise<string> {
  if (!env.sso.secret) throw Errors.validacao('SSO nao configurado no servidor.');

  const payload = verifySsoToken(token, env.sso.secret);
  const email = payload.email.toLowerCase();
  const escritorioId = await resolverEscritorioId(payload.perfil);

  let usuario = await prisma.usuario.findUnique({
    where: { escritorioId_email: { escritorioId, email } },
  });

  if (!usuario) {
    usuario = await prisma.usuario.create({
      data: {
        escritorioId,
        nome: payload.nome || email,
        email,
        // Sem senha utilizavel: entra apenas via SSO (o hash nunca casa no bcrypt).
        senhaHash: sha256(generateToken(48)),
        tipo: payload.role || 'Colaborador',
        permissao: { create: permissoesParaCargo(payload.role) },
      },
    });
  } else if (!usuario.ativo || usuario.deletedAt) {
    throw Errors.credenciaisInvalidas();
  } else if (payload.role && CARGOS_ERP.has(payload.role) && usuario.tipo !== payload.role) {
    // Cargo mudou no ERP: atualiza o tipo e as permissoes do Obrigo para o novo cargo
    usuario = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { tipo: payload.role, permissao: { upsert: { create: permissoesParaCargo(payload.role), update: permissoesParaCargo(payload.role) } } },
    });
  }

  const refreshToken = generateToken();
  await prisma.sessao.create({
    data: {
      escritorioId,
      usuarioId: usuario.id,
      tokenHash: sha256(refreshToken),
      userAgent: meta.userAgent?.slice(0, 255),
      ip: meta.ip,
      expiresAt: new Date(Date.now() + durationToMs(env.jwt.refreshExpires)),
    },
  });

  return refreshToken;
}
