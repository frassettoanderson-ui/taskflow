import nodemailer from 'nodemailer';
import { env } from '../env.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string; // sobrescreve o nome do remetente (ex.: responsavel pela entrega)
  attachments?: { filename: string; path?: string; content?: Buffer }[];
  smtp?: Partial<SmtpConfig>; // SMTP proprio do escritorio
}

function resolveSmtp(override?: Partial<SmtpConfig>): SmtpConfig {
  return {
    host: override?.host || env.smtp.host,
    port: override?.port || env.smtp.port,
    secure: override?.secure ?? env.smtp.secure,
    user: override?.user || env.smtp.user,
    pass: override?.pass || env.smtp.pass,
    fromName: override?.fromName || env.smtp.fromName,
    fromEmail: override?.fromEmail || env.smtp.fromEmail,
  };
}

// Envia e-mail. Se SMTP nao estiver configurado, loga o conteudo no
// console (modo desenvolvimento) em vez de falhar.
export async function sendMail(input: SendMailInput): Promise<{ sent: boolean }> {
  const smtp = resolveSmtp(input.smtp);
  const fromName = input.fromName || smtp.fromName;
  const from = `"${fromName}" <${smtp.fromEmail}>`;

  if (!smtp.host) {
    console.log('[mailer] SMTP nao configurado - e-mail simulado:');
    console.log(`  De: ${from}`);
    console.log(`  Para: ${input.to}`);
    console.log(`  Assunto: ${input.subject}`);
    console.log(`  Conteudo:\n${input.text ?? input.html}`);
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  });

  return { sent: true };
}
