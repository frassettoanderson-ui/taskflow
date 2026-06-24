import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { ensureDir, STORAGE_ROOT } from '../../lib/storage.js';
import { processarArquivo } from '../robo/robo.service.js';

// ============================================================
// Integracao Google Drive (substitui o agente desktop)
// - OAuth (cliente tipo Desktop): usuario autoriza 1x e cola o codigo.
// - A VPS vigia a pasta "Entrada", lanca no robo e organiza o arquivo em
//   {Departamento}/{Apelido}/{Obrigacao}/Obrigacao - MM-AAAA.pdf
// Config por escritorio fica em Escritorio.config.drive = { refreshToken, raizId, entradaId, processados[] }
// ============================================================

const SCOPE = 'https://www.googleapis.com/auth/drive';
const PASTA = 'application/vnd.google-apps.folder';

interface DriveCfg {
  refreshToken?: string;
  raizId?: string;
  entradaId?: string;
  processados?: string[]; // fileIds ja processados (p/ nao repetir nao-identificados)
  email?: string;
}

function lerCfg(config: unknown): DriveCfg {
  const c = config as Record<string, unknown>;
  return (c?.drive as DriveCfg) ?? {};
}

async function salvarCfg(escritorioId: string, patch: Partial<DriveCfg>) {
  const esc = await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } });
  const config = (esc.config as Record<string, unknown>) ?? {};
  const drive = { ...(config.drive as DriveCfg), ...patch };
  await prisma.escritorio.update({ where: { id: escritorioId }, data: { config: { ...config, drive } } });
  return drive;
}

export async function statusDrive(escritorioId: string) {
  const esc = await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } });
  const c = lerCfg(esc.config);
  return { conectado: !!c.refreshToken, email: c.email ?? null, entradaId: c.entradaId ?? null };
}

// ---------- OAuth ----------
export function gerarUrlAuth(): string {
  const p = new URLSearchParams({
    client_id: env.drive.clientId,
    redirect_uri: env.drive.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // forca vir o refresh_token
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function trocarToken(body: Record<string, string>): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; error?: string }> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  return resp.json() as Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; error?: string }>;
}

// Troca o codigo (colado pelo usuario) por tokens e prepara as pastas.
export async function conectar(escritorioId: string, code: string) {
  const limpo = extrairCode(code);
  const tok = await trocarToken({
    code: limpo,
    client_id: env.drive.clientId,
    client_secret: env.drive.clientSecret,
    redirect_uri: env.drive.redirectUri,
    grant_type: 'authorization_code',
  });
  if (!tok.refresh_token) throw new Error('Nao recebi a autorizacao (refresh_token). Refaca a conexao marcando "permitir acesso offline".');

  await salvarCfg(escritorioId, { refreshToken: tok.refresh_token });

  // descobre o e-mail da conta (informativo)
  let email: string | undefined;
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
    email = ((await r.json()) as { email?: string }).email;
  } catch { /* opcional */ }

  // cria a estrutura de pastas (DRIVE / outros / entrada)
  const token = tok.access_token!;
  const { entradaId } = await garantirEstrutura(token, escritorioId);
  await salvarCfg(escritorioId, { email });

  return { email: email ?? null, entradaId };
}

// Estrutura no Drive: a pasta de entrada fica em DRIVE/outros/entrada (escondida);
// os arquivos organizados ficam direto em DRIVE/{Departamento}/{Apelido}/{Obrigacao}.
// Idempotente: reusa as pastas que ja existem.
async function garantirEstrutura(token: string, escritorioId: string) {
  const raizId = await acharOuCriarPasta(token, 'DRIVE', 'root');
  const outrosId = await acharOuCriarPasta(token, 'outros', raizId);
  const entradaId = await acharOuCriarPasta(token, 'entrada', outrosId);
  await salvarCfg(escritorioId, { raizId, entradaId });
  return { raizId, entradaId };
}

// Recria/atualiza a estrutura de pastas usando a conexao atual (sem refazer o OAuth).
export async function recriarPastas(escritorioId: string) {
  const token = await getToken(escritorioId);
  return garantirEstrutura(token, escritorioId);
}

export async function desconectar(escritorioId: string) {
  await salvarCfg(escritorioId, { refreshToken: undefined, raizId: undefined, entradaId: undefined, email: undefined });
}

// O usuario pode colar o codigo cru OU a URL inteira de redirecionamento (http://localhost/?code=...)
function extrairCode(entrada: string): string {
  const s = entrada.trim();
  const m = s.match(/[?&]code=([^&\s]+)/);
  if (m) return decodeURIComponent(m[1]);
  return s;
}

// ---------- Access token (cache em memoria + refresh) ----------
const cacheToken = new Map<string, { token: string; exp: number }>();
async function getToken(escritorioId: string): Promise<string> {
  const c = cacheToken.get(escritorioId);
  if (c && c.exp > Date.now() + 30_000) return c.token;
  const esc = await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } });
  const cfg = lerCfg(esc.config);
  if (!cfg.refreshToken) throw new Error('Google Drive nao conectado.');
  const tok = await trocarToken({
    refresh_token: cfg.refreshToken,
    client_id: env.drive.clientId,
    client_secret: env.drive.clientSecret,
    grant_type: 'refresh_token',
  });
  if (!tok.access_token) throw new Error('Falha ao renovar o acesso ao Drive (reconecte).');
  cacheToken.set(escritorioId, { token: tok.access_token, exp: Date.now() + (tok.expires_in ?? 3600) * 1000 });
  return tok.access_token;
}

// ---------- Operacoes no Drive (REST v3) ----------
function esc(s: string) { return s.replace(/'/g, "\\'"); }

async function driveGet(token: string, url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive GET ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function acharOuCriarPasta(token: string, nome: string, parentId: string): Promise<string> {
  const q = `name='${esc(nome)}' and '${parentId}' in parents and mimeType='${PASTA}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const data = (await driveGet(token, url)) as { files?: { id: string }[] };
  if (data.files && data.files.length) return data.files[0].id;
  // cria
  const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [parentId] }),
  });
  if (!r.ok) throw new Error(`Drive criar pasta ${r.status}: ${await r.text()}`);
  return ((await r.json()) as { id: string }).id;
}

async function listarPdfs(token: string, pastaId: string): Promise<{ id: string; name: string }[]> {
  const q = `'${pastaId}' in parents and mimeType='application/pdf' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=100`;
  const data = (await driveGet(token, url)) as { files?: { id: string; name: string }[] };
  return data.files ?? [];
}

async function baixar(token: string, fileId: string): Promise<Buffer> {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive baixar ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function moverRenomear(token: string, fileId: string, novoNome: string, novoParentId: string, oldParentId: string) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${novoParentId}&removeParents=${oldParentId}&fields=id`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: novoNome }),
  });
  if (!r.ok) throw new Error(`Drive mover ${r.status}: ${await r.text()}`);
}

// ---------- Organizacao: cria a arvore e move o arquivo ----------
function nomeArquivo(obrigacao: string, ano: number, mes: number): string {
  return `${obrigacao} - ${String(mes).padStart(2, '0')}-${ano}.pdf`;
}

async function organizar(
  token: string,
  fileId: string,
  entradaId: string,
  dados: { departamento: string; apelido: string; obrigacao: string; ano: number; mes: number },
  raizId: string,
) {
  const deptoId = await acharOuCriarPasta(token, dados.departamento || 'Sem Departamento', raizId);
  const clienteId = await acharOuCriarPasta(token, dados.apelido || 'Sem Apelido', deptoId);
  const obrigId = await acharOuCriarPasta(token, dados.obrigacao, clienteId);
  await moverRenomear(token, fileId, nomeArquivo(dados.obrigacao, dados.ano, dados.mes), obrigId, entradaId);
}

// ---------- Loop: processa os PDFs novos da Entrada ----------
export async function processarEntrada(escritorioId: string): Promise<{ vistos: number; baixados: number; revisao: number }> {
  const esc0 = await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } });
  const cfg = lerCfg(esc0.config);
  if (!cfg.refreshToken || !cfg.entradaId || !cfg.raizId) return { vistos: 0, baixados: 0, revisao: 0 };

  const token = await getToken(escritorioId);
  const arquivos = await listarPdfs(token, cfg.entradaId);
  const jaVistos = new Set(cfg.processados ?? []);
  const dir = ensureDir(path.join(STORAGE_ROOT, 'drive', escritorioId));

  let baixados = 0;
  let revisao = 0;
  const novosVistos: string[] = [];

  for (const arq of arquivos) {
    if (jaVistos.has(arq.id)) continue;
    try {
      const buf = await baixar(token, arq.id);
      const local = path.join(dir, `${Date.now()}_${arq.name.replace(/[^\w.\-]/g, '_')}`);
      fs.writeFileSync(local, buf);

      const resultados = await processarArquivo(escritorioId, local, arq.name, 'API');
      const baixou = resultados.find((r) => r.status === 'BAIXADO');

      if (baixou && baixou.empresaId && baixou.obrigacaoNome && baixou.competenciaAno && baixou.competenciaMes) {
        const [empresa, obrig] = await Promise.all([
          prisma.empresa.findUnique({ where: { id: baixou.empresaId }, select: { apelidoEcontinuo: true, nomeFantasia: true, razaoSocial: true } }),
          prisma.obrigacao.findFirst({ where: { escritorioId, nome: baixou.obrigacaoNome }, select: { departamento: { select: { nome: true } } } }),
        ]);
        const apelido = empresa?.apelidoEcontinuo || empresa?.nomeFantasia || empresa?.razaoSocial || 'Sem Apelido';
        const departamento = obrig?.departamento?.nome || 'Sem Departamento';
        await organizar(token, arq.id, cfg.entradaId, {
          departamento, apelido, obrigacao: baixou.obrigacaoNome, ano: baixou.competenciaAno, mes: baixou.competenciaMes,
        }, cfg.raizId);
        baixados++;
        // arquivo foi movido p/ fora da Entrada; nao precisa marcar como visto
      } else {
        // nao identificado: fica na Entrada; marca como visto p/ nao reprocessar todo poll
        revisao++;
        novosVistos.push(arq.id);
      }
    } catch (e) {
      // erro ao processar este arquivo: marca como visto p/ nao travar o loop
      novosVistos.push(arq.id);
      console.warn('[drive] erro no arquivo', arq.name, (e as Error).message);
    }
  }

  if (novosVistos.length) {
    const atual = (cfg.processados ?? []).concat(novosVistos).slice(-500);
    await salvarCfg(escritorioId, { processados: atual });
  }
  return { vistos: arquivos.length, baixados, revisao };
}
