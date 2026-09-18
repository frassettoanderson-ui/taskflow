import crypto from 'node:crypto';

// Token de SSO compacto e autoassinado (HMAC-SHA256): "<payloadb64url>.<sigb64url>".
// Mesmo formato gerado no lado da Nauta (lib/sso.ts). Sem dependencia de libs de JWT
// nos dois lados — apenas o crypto nativo e um segredo compartilhado.

export interface SsoPayload {
  email: string;
  nome?: string;
  role?: string;
  iat: number;
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function verifySsoToken(token: string, secret: string): SsoPayload {
  if (!secret) throw new Error('SSO sem segredo configurado.');
  const [data, sig] = String(token).split('.');
  if (!data || !sig) throw new Error('Token SSO malformado.');

  const esperado = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Assinatura SSO invalida.');
  }

  const body = JSON.parse(
    Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
  ) as SsoPayload;

  const agora = Math.floor(Date.now() / 1000);
  if (typeof body.exp !== 'number' || body.exp < agora) throw new Error('Token SSO expirado.');
  if (!body.email) throw new Error('Token SSO sem e-mail.');
  return body;
}
