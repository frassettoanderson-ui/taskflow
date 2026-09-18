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
async function resolverEscritorioId(): Promise<string> {
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

// Cargo da Nauta -> permissoes do Obrigo. Colaboradores internos: acesso total por ora.
// (A granularidade pode ser ajustada por usuario depois, direto na tela de Usuarios.)
function permissoesParaCargo(_role?: string) {
  return allPermissions(true);
}

// Valida o token vindo da Nauta, garante o usuario no escritorio e cria uma sessao
// (refresh token). Retorna o refresh token em claro para virar cookie no controller.
export async function loginViaSso(token: string, meta: SessionMeta): Promise<string> {
  if (!env.sso.secret) throw Errors.validacao('SSO nao configurado no servidor.');

  const payload = verifySsoToken(token, env.sso.secret);
  const email = payload.email.toLowerCase();
  const escritorioId = await resolverEscritorioId();

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
