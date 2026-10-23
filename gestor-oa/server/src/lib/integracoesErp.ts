// Webhooks do Obrigô: os avisos moram no ERP (tabelas integracao_* do banco nauta, tela
// Sistema › Integrações). Aqui só enfileiramos o evento do Obrigô (empresa.cadastrada) na mesma
// fila e pedimos ao ERP para enviar na hora (/api/integracoes/processar). Nunca lança.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import { clienteNauta } from './nautaBridge.js';

const ERP_URL = process.env.ERP_INTERNO_URL ?? 'http://127.0.0.1:3000';
const ERP_ENV = process.env.ERP_ENV_FILE ?? '/var/www/nauta/.env.local';

// Perfil (slug da empresa no ERP) deste escritório: o inverso de SSO_ESCRITORIOS
function perfilDoEscritorio(escritorioId: string): string | null {
  const achado = Object.entries(env.sso.escritorios).find(([, id]) => id === escritorioId)?.[0];
  return achado ?? (escritorioId === env.sso.escritorioId ? 'atuan' : null);
}

let tokenCache = '';
function cronToken(): string {
  if (process.env.ERP_CRON_TOKEN) return process.env.ERP_CRON_TOKEN;
  if (!tokenCache) {
    try { tokenCache = (fs.readFileSync(ERP_ENV, 'utf8').match(/^CRON_TOKEN=(.*)$/m)?.[1] ?? '').trim().replace(/^['"]|['"]$/g, ''); } catch { tokenCache = ''; }
  }
  return tokenCache;
}

export async function emitirNoErp(escritorioId: string, evento: string, dados: unknown) {
  try {
    const db = clienteNauta();
    const slug = perfilDoEscritorio(escritorioId);
    if (!db || !slug) return;
    const hooks = await db.$queryRawUnsafe<{ id: string; empresa_id: string }[]>(
      `SELECT w.id, w.empresa_id FROM integracao_webhooks w JOIN empresas e ON e.id = w.empresa_id
        WHERE e.slug = $1 AND w.ativo AND ($2 = ANY(w.eventos) OR '*' = ANY(w.eventos))`, slug, evento,
    );
    if (!hooks.length) return;
    const eventoId = randomUUID();
    const envelope = JSON.stringify({ id: eventoId, evento, criado_em: new Date().toISOString(), perfil: slug, dados });
    for (const h of hooks) {
      await db.$executeRawUnsafe(
        `INSERT INTO integracao_entregas (webhook_id, empresa_id, evento, evento_id, payload) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::jsonb)`,
        h.id, h.empresa_id, evento, eventoId, envelope,
      );
    }
    const t = cronToken();
    if (t) fetch(`${ERP_URL}/api/integracoes/processar`, { method: 'POST', headers: { 'x-cron-token': t }, signal: AbortSignal.timeout(30000) }).catch(() => undefined);
  } catch (e) {
    console.error('[integracoes] emitirNoErp falhou:', evento, (e as Error).message);
  }
}

// empresa.cadastrada — o mesmo retrato para cadastro manual e para a empresa vinda do onboarding
export function emitirEmpresaCadastrada(escritorioId: string, e: { id: string; numero: number | null; razaoSocial: string; nomeFantasia?: string | null; cnpj?: string | null; nautaClienteId?: string | null; nautaLeadId?: string | null }, origem: 'manual' | 'erp') {
  void emitirNoErp(escritorioId, 'empresa.cadastrada', {
    empresa: {
      id: e.id, numero: e.numero, razao_social: e.razaoSocial, nome_fantasia: e.nomeFantasia ?? null, cnpj: e.cnpj ?? null,
      cliente_id: e.nautaClienteId ?? null, lead_id: e.nautaLeadId ?? null, origem,
    },
  });
}
