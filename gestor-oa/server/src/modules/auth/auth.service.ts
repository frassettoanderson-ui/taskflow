import { addMinutes } from 'date-fns';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { Errors } from '../../lib/errors.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  sha256,
} from '../../lib/password.js';
import { signAccessToken, durationToMs } from '../../lib/jwt.js';
import { allPermissions } from '../../lib/permissions.js';
import { dentroDoHorario } from '../../lib/horario.js';
import { sendMail } from '../../lib/mailer.js';
import type { JanelaAcesso, SessaoAtual, UsuarioPublico } from '@gestoroa/shared';
import type { RegistrarEscritorioInput, LoginInput } from './auth.schemas.js';
import type { Usuario, Permissao, Escritorio } from '@prisma/client';

function soDigitos(v?: string): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  return d.length ? d : null;
}

function usuarioPublico(
  u: Usuario & { permissao: Permissao | null },
): UsuarioPublico {
  const permissoes: Record<string, boolean> = {};
  if (u.permissao) {
    for (const [k, v] of Object.entries(u.permissao)) {
      if (typeof v === 'boolean') permissoes[k] = v;
    }
  }
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    permissoes: permissoes as UsuarioPublico['permissoes'],
  };
}

function escritorioPublico(e: Escritorio): SessaoAtual['escritorio'] {
  return { id: e.id, nome: e.nome, cnpj: e.cnpj, logoUrl: e.logoUrl };
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

// Cria uma sessao (refresh token) e retorna o token em claro (so' aqui).
async function criarSessao(
  escritorioId: string,
  usuarioId: string,
  meta: SessionMeta,
): Promise<string> {
  const refreshToken = generateToken();
  await prisma.sessao.create({
    data: {
      escritorioId,
      usuarioId,
      tokenHash: sha256(refreshToken),
      userAgent: meta.userAgent?.slice(0, 255),
      ip: meta.ip,
      expiresAt: new Date(Date.now() + durationToMs(env.jwt.refreshExpires)),
    },
  });
  return refreshToken;
}

export interface AuthResult {
  sessao: SessaoAtual;
  refreshToken: string;
}

// 1. Registro do escritorio: cria tenant + primeiro usuario admin (todas as flags).
export async function registrarEscritorio(
  input: RegistrarEscritorioInput,
  meta: SessionMeta,
): Promise<AuthResult> {
  const senhaHash = await hashPassword(input.admin.senha);

  const { escritorio, usuario } = await prisma.$transaction(async (tx) => {
    const escritorio = await tx.escritorio.create({
      data: {
        nome: input.escritorio.nome,
        cnpj: soDigitos(input.escritorio.cnpj),
      },
    });

    const usuario = await tx.usuario.create({
      data: {
        escritorioId: escritorio.id,
        nome: input.admin.nome,
        email: input.admin.email.toLowerCase(),
        senhaHash,
        permissao: { create: allPermissions(true) },
      },
      include: { permissao: true },
    });

    return { escritorio, usuario };
  });

  const refreshToken = await criarSessao(escritorio.id, usuario.id, meta);
  const accessToken = signAccessToken({
    sub: usuario.id,
    escritorioId: escritorio.id,
  });

  return {
    sessao: {
      usuario: usuarioPublico(usuario),
      escritorio: escritorioPublico(escritorio),
      accessToken,
    },
    refreshToken,
  };
}

// 2. Login com e-mail/senha (+ bloqueio por horario).
export async function login(
  input: LoginInput,
  meta: SessionMeta,
): Promise<AuthResult> {
  const usuario = await prisma.usuario.findFirst({
    where: { email: input.email.toLowerCase(), deletedAt: null },
    include: { permissao: true, escritorio: true },
  });

  if (!usuario || !usuario.ativo) throw Errors.credenciaisInvalidas();

  const ok = await verifyPassword(input.senha, usuario.senhaHash);
  if (!ok) throw Errors.credenciaisInvalidas();

  const janelas = (usuario.horariosAcesso as unknown as JanelaAcesso[]) ?? [];
  if (!dentroDoHorario(janelas)) throw Errors.foraDoHorario();

  const refreshToken = await criarSessao(
    usuario.escritorioId,
    usuario.id,
    meta,
  );
  const accessToken = signAccessToken({
    sub: usuario.id,
    escritorioId: usuario.escritorioId,
  });

  return {
    sessao: {
      usuario: usuarioPublico(usuario),
      escritorio: escritorioPublico(usuario.escritorio),
      accessToken,
    },
    refreshToken,
  };
}

// Refresh com rotacao: revoga a sessao antiga e cria uma nova.
export async function refresh(
  refreshToken: string | undefined,
  meta: SessionMeta,
): Promise<AuthResult> {
  if (!refreshToken) throw Errors.naoAutenticado();

  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: sha256(refreshToken) },
  });

  if (!sessao || sessao.revokedAt || sessao.expiresAt < new Date()) {
    throw Errors.naoAutenticado();
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: sessao.usuarioId, deletedAt: null, ativo: true },
    include: { permissao: true, escritorio: true },
  });
  if (!usuario) throw Errors.naoAutenticado();

  // rotacao
  await prisma.sessao.update({
    where: { id: sessao.id },
    data: { revokedAt: new Date() },
  });
  const novoRefresh = await criarSessao(
    usuario.escritorioId,
    usuario.id,
    meta,
  );
  const accessToken = signAccessToken({
    sub: usuario.id,
    escritorioId: usuario.escritorioId,
  });

  return {
    sessao: {
      usuario: usuarioPublico(usuario),
      escritorio: escritorioPublico(usuario.escritorio),
      accessToken,
    },
    refreshToken: novoRefresh,
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await prisma.sessao
    .updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => undefined);
}

// 3. Recuperacao de senha - solicitar (resposta sempre generica).
export async function solicitarReset(email: string): Promise<void> {
  const usuario = await prisma.usuario.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null, ativo: true },
    include: { escritorio: true },
  });
  if (!usuario) return; // resposta generica no controller

  const token = generateToken(32);
  await prisma.passwordResetToken.create({
    data: {
      escritorioId: usuario.escritorioId,
      usuarioId: usuario.id,
      tokenHash: sha256(token),
      expiresAt: addMinutes(new Date(), 60),
    },
  });

  const link = `${env.appUrl}/redefinir-senha?token=${token}`;
  await sendMail({
    to: usuario.email,
    subject: 'Redefinicao de senha - GestorOA',
    html: `<p>Ola, ${usuario.nome}.</p><p>Recebemos um pedido para redefinir sua senha. O link abaixo expira em 1 hora:</p><p><a href="${link}">${link}</a></p><p>Se voce nao solicitou, ignore este e-mail.</p>`,
    text: `Redefinir senha (expira em 1h): ${link}`,
  });
}

// 3. Recuperacao de senha - redefinir.
export async function redefinirSenha(
  token: string,
  novaSenha: string,
): Promise<void> {
  const registro = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
    throw Errors.validacao('Token invalido ou expirado.');
  }

  const senhaHash = await hashPassword(novaSenha);
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { senhaHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: registro.id },
      data: { usedAt: new Date() },
    }),
    // invalida todas as sessoes ativas do usuario
    prisma.sessao.updateMany({
      where: { usuarioId: registro.usuarioId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function sessaoAtual(usuarioId: string): Promise<SessaoAtual> {
  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    include: { permissao: true, escritorio: true },
  });
  return {
    usuario: usuarioPublico(usuario),
    escritorio: escritorioPublico(usuario.escritorio),
    accessToken: '', // o cliente ja' possui; nao reemitimos aqui
  };
}
