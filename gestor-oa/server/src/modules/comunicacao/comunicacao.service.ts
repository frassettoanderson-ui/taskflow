import fs from 'node:fs';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { Errors } from '../../lib/errors.js';
import { sendMail } from '../../lib/mailer.js';
import { generateToken } from '../../lib/password.js';
import { isInsideStorage } from '../../lib/storage.js';

export function render(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? '');
}

interface EnviarEmailInput {
  escritorioId: string;
  empresaId?: string | null;
  to: string;
  assunto: string;
  corpo: string;
  responsavelId?: string | null;
  documentoId?: string | null;
  loteId?: string | null;
  anexos?: { filename: string; path: string }[];
  vars?: Record<string, string>;
  fromName?: string;
}

// Cria protocolo (se houver documento), envia e registra no log unificado.
export async function enviarEmail(input: EnviarEmailInput) {
  let protocoloId: string | null = null;
  let linkProtocolo = env.appUrl;
  if (input.documentoId && input.empresaId) {
    const token = generateToken(20);
    const p = await prisma.protocolo.create({
      data: { escritorioId: input.escritorioId, empresaId: input.empresaId, documentoId: input.documentoId, destinatario: input.to, canal: 'EMAIL', token },
    });
    protocoloId = p.id;
    linkProtocolo = `${env.appUrl}/p/${token}`;
  }

  const vars = { link_protocolo: linkProtocolo, ...(input.vars ?? {}) };
  const assunto = render(input.assunto, vars);
  const corpo = render(input.corpo, vars);

  const log = await prisma.comunicacaoLog.create({
    data: {
      escritorioId: input.escritorioId, empresaId: input.empresaId ?? null, canal: 'EMAIL',
      destinatario: input.to, assunto, conteudo: corpo, status: 'FILA',
      responsavelId: input.responsavelId ?? null, protocoloId, loteId: input.loteId ?? null,
    },
  });

  try {
    const anexos = (input.anexos ?? []).filter((a) => isInsideStorage(a.path) && fs.existsSync(a.path));
    await sendMail({ to: input.to, subject: assunto, html: corpo.replace(/\n/g, '<br>'), fromName: input.fromName, attachments: anexos });
    return prisma.comunicacaoLog.update({ where: { id: log.id }, data: { status: 'ENVIADO', enviadoEm: new Date(), tentativas: 1 } });
  } catch (e) {
    return prisma.comunicacaoLog.update({ where: { id: log.id }, data: { status: 'FALHOU', tentativas: 1, erro: e instanceof Error ? e.message : 'Erro' } });
  }
}

export async function reenviar(escritorioId: string, logId: string) {
  const log = await prisma.comunicacaoLog.findFirst({ where: { id: logId, escritorioId } });
  if (!log) throw Errors.naoEncontrado('Comunicacao');
  if (log.canal !== 'EMAIL') throw Errors.validacao('Reenvio disponivel apenas para e-mail.');
  try {
    await sendMail({ to: log.destinatario, subject: log.assunto ?? '', html: (log.conteudo ?? '').replace(/\n/g, '<br>') });
    return prisma.comunicacaoLog.update({ where: { id: log.id }, data: { status: 'ENVIADO', enviadoEm: new Date(), tentativas: log.tentativas + 1, erro: null } });
  } catch (e) {
    return prisma.comunicacaoLog.update({ where: { id: log.id }, data: { status: 'FALHOU', tentativas: log.tentativas + 1, erro: e instanceof Error ? e.message : 'Erro' } });
  }
}

// Envia uma entrega baixada aos contatos da empresa (usado pela baixa "enviar ao cliente").
export async function enviarEntrega(escritorioId: string, entregaId: string, responsavelId: string) {
  const entrega = await prisma.entrega.findFirst({
    where: { id: entregaId, escritorioId },
    include: { obrigacao: { select: { nome: true, departamentoId: true } }, empresa: { select: { id: true, razaoSocial: true } } },
  });
  if (!entrega) throw Errors.naoEncontrado('Entrega');

  const template = await prisma.templateEmail.findFirst({ where: { escritorioId, tipo: 'ENTREGA', ativo: true } });
  const assuntoTpl = template?.assunto ?? 'Documento disponivel: {{obrigacao}} ({{competencia}})';
  const corpoTpl = template?.corpo ?? 'Ola {{contato}},\n\nSegue o documento referente a {{obrigacao}} - competencia {{competencia}}.\nAcesse: {{link_protocolo}}\n\nAtenciosamente,\n{{empresa}}';

  // docs da GED desta entrega
  const docs = await prisma.documentoGED.findMany({ where: { entregaId: entrega.id } });
  const anexos = docs.map((d) => ({ filename: d.nomeArquivo, path: d.caminho }));

  const contatos = await prisma.empresaContato.findMany({ where: { escritorioId, empresaId: entrega.empresaId, ativo: true } });
  const competencia = `${String(entrega.competenciaMes).padStart(2, '0')}/${entrega.competenciaAno}`;
  let enviados = 0;
  for (const c of contatos) {
    const depIds = (c.departamentoIds as string[]) ?? [];
    const liberado = depIds.length === 0 || (entrega.obrigacao.departamentoId && depIds.includes(entrega.obrigacao.departamentoId));
    if (!liberado || !c.email) continue;
    await enviarEmail({
      escritorioId, empresaId: entrega.empresaId, to: c.email,
      assunto: assuntoTpl, corpo: corpoTpl, responsavelId,
      documentoId: docs[0]?.id ?? null, anexos,
      vars: { empresa: entrega.empresa.razaoSocial, obrigacao: entrega.obrigacao.nome, competencia, contato: c.nome },
    });
    enviados++;
  }
  return { enviados };
}

export async function historico(escritorioId: string, empresaId: string) {
  return prisma.comunicacaoLog.findMany({
    where: { escritorioId, empresaId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}
