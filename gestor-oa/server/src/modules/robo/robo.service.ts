import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../prisma.js';
import { ensureDir, STORAGE_ROOT } from '../../lib/storage.js';
import { generateToken } from '../../lib/password.js';
import { sendMail } from '../../lib/mailer.js';
import { env } from '../../env.js';
import { dividirPaginas, extrairTexto, digitosDoTexto } from './extracao.js';
import { gerarAvulsaObrigacao } from '../entrega/entrega.service.js';

interface Etapa {
  etapa: string;
  ok: boolean;
  ms: number;
  detalhe?: string;
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const MESES_EXT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

// Tenta extrair { ano, mes } de um trecho de texto.
function parseCompetencia(s: string): { ano: number; mes: number } | null {
  const t = semAcento(s);
  let m = t.match(/(\d{1,2})[\/\-.](\d{4})/);
  if (m) return { mes: Number(m[1]), ano: Number(m[2]) };
  m = t.match(/(\d{4})[\/\-.](\d{1,2})/);
  if (m) return { ano: Number(m[1]), mes: Number(m[2]) };
  m = t.match(/([a-z]+)\s*(?:de|\/)?\s*(\d{4})/);
  if (m && MESES_EXT[m[1]]) return { mes: MESES_EXT[m[1]], ano: Number(m[2]) };
  return null;
}

// ---------- Identificacao da empresa ----------
async function identificarEmpresa(escritorioId: string, texto: string) {
  const digitos = digitosDoTexto(texto);
  const ids = await prisma.empresaIdentificador.findMany({
    where: { escritorioId },
    select: { valor: true, empresaId: true, tipo: true },
  });
  // prioriza valores mais longos (CNPJ/CPF) para evitar falso positivo
  ids.sort((a, b) => b.valor.length - a.valor.length);
  for (const i of ids) {
    if (i.valor.length >= 8 && digitos.includes(i.valor)) {
      return { empresaId: i.empresaId, valor: i.valor };
    }
  }
  return null;
}

// ---------- Identificacao da obrigacao + competencia ----------
async function identificarObrigacao(escritorioId: string, texto: string) {
  const t = semAcento(texto);
  const assinaturas = await prisma.assinaturaDocumento.findMany({
    where: { escritorioId, ativo: true },
  });
  // testa primeiro as assinaturas com MAIS palavras-chave (mais especificas),
  // assim DAS-MEI (2 palavras) vence o DAS comum (1 palavra) quando ambos casam.
  assinaturas.sort((a, b) => ((b.palavras as string[])?.length ?? 0) - ((a.palavras as string[])?.length ?? 0));
  for (const a of assinaturas) {
    const palavras = (a.palavras as string[]) ?? [];
    if (palavras.length === 0) continue;
    const todasCasam = palavras.every((p) => {
      try {
        return new RegExp(semAcento(p), 'i').test(t);
      } catch {
        return t.includes(semAcento(p));
      }
    });
    if (!todasCasam) continue;

    // competencia
    let comp: { ano: number; mes: number } | null = null;
    if (a.regexCompetencia) {
      try {
        const m = t.match(new RegExp(a.regexCompetencia, 'i'));
        if (m) comp = parseCompetencia(m[0]);
      } catch {
        /* regex invalida */
      }
    }
    if (!comp) comp = parseCompetencia(t);
    return { obrigacaoNome: a.obrigacaoNome, competencia: comp, semDemanda: a.semDemanda };
  }
  return null;
}

// ---------- Distribuicao aos contatos ----------
async function distribuir(escritorioId: string, empresaId: string, documentoId: string, departamentoId: string | null) {
  const contatos = await prisma.empresaContato.findMany({
    where: { escritorioId, empresaId, ativo: true },
  });
  let enviados = 0;
  for (const c of contatos) {
    const depIds = (c.departamentoIds as string[]) ?? [];
    const liberado = depIds.length === 0 || (departamentoId && depIds.includes(departamentoId));
    if (!liberado || !c.email) continue;
    const token = generateToken(24);
    await prisma.protocolo.create({
      data: { escritorioId, empresaId, documentoId, destinatario: c.email, contatoId: c.id, canal: 'EMAIL', token },
    });
    await sendMail({
      to: c.email,
      subject: 'Novo documento disponivel',
      html: `<p>Ola ${c.nome},</p><p>Um novo documento foi disponibilizado.</p><p><a href="${env.appUrl}/p/${token}">Visualizar</a></p>`,
    }).catch(() => undefined);
    enviados++;
  }
  return enviados;
}

// ---------- Processa uma pagina (documento independente) ----------
async function processarPagina(
  escritorioId: string,
  caminho: string,
  nomeOriginal: string,
  paginaIndex: number | null,
  buffer: Buffer,
  origem: 'UPLOAD' | 'WATCHER' | 'API',
) {
  const etapas: Etapa[] = [];
  const t0 = Date.now();
  const marcar = (etapa: string, ok: boolean, inicio: number, detalhe?: string) =>
    etapas.push({ etapa, ok, ms: Date.now() - inicio, detalhe });

  const job = await prisma.roboJob.create({
    data: { escritorioId, arquivoNome: nomeOriginal, caminho, paginaIndex, origem, status: 'PROCESSANDO' },
  });

  try {
    // 1. extracao
    let ini = Date.now();
    const { texto, metodo } = await extrairTexto(buffer);
    marcar('extracao', metodo !== 'VAZIO', ini, metodo);
    const trecho = texto.slice(0, 1000);

    if (metodo === 'VAZIO') {
      return finalizar(job.id, 'REVISAO', etapas, t0, { motivo: 'PDF sem texto (escaneado) - revisar manualmente', textoTrecho: trecho });
    }

    // 2. empresa
    ini = Date.now();
    const emp = await identificarEmpresa(escritorioId, texto);
    marcar('identificar_empresa', !!emp, ini, emp?.valor);
    if (!emp) {
      return finalizar(job.id, 'REVISAO', etapas, t0, { motivo: 'Empresa nao identificada', textoTrecho: trecho });
    }

    // 3. obrigacao + competencia
    ini = Date.now();
    const obr = await identificarObrigacao(escritorioId, texto);
    marcar('identificar_obrigacao', !!obr?.obrigacaoNome, ini, obr?.obrigacaoNome);
    if (!obr?.obrigacaoNome || !obr.competencia) {
      return finalizar(job.id, 'REVISAO', etapas, t0, {
        motivo: !obr?.obrigacaoNome ? 'Obrigacao nao identificada' : 'Competencia nao identificada',
        textoTrecho: trecho,
        empresaId: emp.empresaId,
        obrigacaoNome: obr?.obrigacaoNome,
      });
    }

    // 4. localizar entrega pendente
    ini = Date.now();
    const obrigacao = await prisma.obrigacao.findFirst({
      where: { escritorioId, nome: obr.obrigacaoNome, deletedAt: null },
      select: { id: true, nome: true, departamentoId: true },
    });
    let entrega = obrigacao
      ? await prisma.entrega.findFirst({
          where: {
            escritorioId,
            empresaId: emp.empresaId,
            obrigacaoId: obrigacao.id,
            competenciaAno: obr.competencia.ano,
            competenciaMes: obr.competencia.mes,
          },
        })
      : null;
    marcar('localizar_entrega', !!entrega, ini);

    // Igual ao original: se nao existe a entrega/demanda na competencia e a assinatura
    // esta como "Criar entrega/demanda", o robo cria o vinculo + a entrega e segue para a baixa.
    if (!entrega && obrigacao && obr.semDemanda === 'Criar entrega/demanda') {
      const iniCriar = Date.now();
      await gerarAvulsaObrigacao(
        escritorioId, obrigacao.id, emp.empresaId,
        { ano: obr.competencia.ano, mes: obr.competencia.mes },
        { ano: obr.competencia.ano, mes: obr.competencia.mes },
      ).catch(() => undefined);
      entrega = await prisma.entrega.findFirst({
        where: { escritorioId, empresaId: emp.empresaId, obrigacaoId: obrigacao.id, competenciaAno: obr.competencia.ano, competenciaMes: obr.competencia.mes },
      });
      marcar('criar_entrega', !!entrega, iniCriar, 'demanda criada automaticamente');
    }

    if (!entrega || !obrigacao) {
      return finalizar(job.id, 'REVISAO', etapas, t0, {
        motivo: 'Entrega correspondente nao encontrada para a competencia',
        textoTrecho: trecho,
        empresaId: emp.empresaId,
        obrigacaoNome: obr.obrigacaoNome,
        competenciaAno: obr.competencia.ano,
        competenciaMes: obr.competencia.mes,
      });
    }

    // 5. baixa ROBO + anexo + GED
    ini = Date.now();
    const aposLegal = new Date() > entrega.prazoLegal;
    await prisma.entrega.update({
      where: { id: entrega.id },
      data: {
        status: aposLegal ? 'ENTREGUE_JUSTIFICADA' : 'ENTREGUE',
        dataEntrega: new Date(),
        origemBaixa: 'ROBO',
        justificativa: aposLegal ? 'Baixa automatica pelo robo (apos prazo)' : null,
      },
    });
    await prisma.entregaAnexo.create({
      data: { escritorioId, entregaId: entrega.id, nomeArquivo: nomeOriginal, caminho, tamanho: buffer.length, mimeType: 'application/pdf' },
    });
    const comp = `${obr.competencia.ano}/${String(obr.competencia.mes).padStart(2, '0')}`;
    const doc = await prisma.documentoGED.create({
      data: {
        escritorioId, empresaId: emp.empresaId, raiz: 'DocsEntregas',
        pasta: `${comp}/${obrigacao.nome}`, nomeArquivo: nomeOriginal, caminho,
        tamanho: buffer.length, mimeType: 'application/pdf', origem: 'ROBO', entregaId: entrega.id,
      },
    });
    marcar('baixa', true, ini);

    // 6. distribuicao
    ini = Date.now();
    const enviados = await distribuir(escritorioId, emp.empresaId, doc.id, obrigacao.departamentoId);
    marcar('distribuicao', true, ini, `${enviados} contato(s)`);

    return finalizar(job.id, 'BAIXADO', etapas, t0, {
      empresaId: emp.empresaId,
      obrigacaoNome: obrigacao.nome,
      competenciaAno: obr.competencia.ano,
      competenciaMes: obr.competencia.mes,
      entregaId: entrega.id,
      textoTrecho: trecho,
    });
  } catch (e) {
    return finalizar(job.id, 'ERRO', etapas, t0, { motivo: e instanceof Error ? e.message : 'Erro desconhecido' });
  }
}

async function finalizar(
  jobId: string,
  status: 'BAIXADO' | 'REVISAO' | 'ERRO' | 'IGNORADO',
  etapas: Etapa[],
  t0: number,
  extra: Record<string, unknown>,
) {
  return prisma.roboJob.update({
    where: { id: jobId },
    data: {
      status,
      etapas: [...etapas, { etapa: 'total', ok: status === 'BAIXADO', ms: Date.now() - t0 }] as object,
      processadoEm: new Date(),
      ...extra,
    },
  });
}

// ---------- Processa um arquivo (divide em paginas) ----------
export async function processarArquivo(
  escritorioId: string,
  caminhoArquivo: string,
  nomeOriginal: string,
  origem: 'UPLOAD' | 'WATCHER' | 'API',
) {
  const buffer = fs.readFileSync(caminhoArquivo);
  const paginas = await dividirPaginas(buffer);
  const dir = ensureDir(path.join(STORAGE_ROOT, 'robo', 'paginas', escritorioId));
  const resultados = [];

  if (paginas.length === 1) {
    resultados.push(await processarPagina(escritorioId, caminhoArquivo, nomeOriginal, null, buffer, origem));
  } else {
    for (let i = 0; i < paginas.length; i++) {
      const nome = `${Date.now()}_${i + 1}_${nomeOriginal.replace(/[^\w.\-]/g, '_')}`;
      const cam = path.join(dir, nome);
      fs.writeFileSync(cam, paginas[i]);
      resultados.push(await processarPagina(escritorioId, cam, `${nomeOriginal} (p.${i + 1})`, i + 1, paginas[i], origem));
    }
  }
  return resultados;
}

// ---------- Resolver item de revisao manualmente ----------
export async function resolverRevisao(
  escritorioId: string,
  jobId: string,
  dados: { empresaId: string; obrigacaoNome: string; competenciaAno: number; competenciaMes: number },
) {
  const job = await prisma.roboJob.findFirst({ where: { id: jobId, escritorioId } });
  if (!job) throw new Error('Job nao encontrado');

  const obrigacao = await prisma.obrigacao.findFirst({
    where: { escritorioId, nome: dados.obrigacaoNome, deletedAt: null },
    select: { id: true, nome: true, departamentoId: true },
  });
  if (!obrigacao) throw new Error('Obrigacao nao encontrada');

  const entrega = await prisma.entrega.findFirst({
    where: {
      escritorioId, empresaId: dados.empresaId, obrigacaoId: obrigacao.id,
      competenciaAno: dados.competenciaAno, competenciaMes: dados.competenciaMes,
    },
  });
  if (!entrega) throw new Error('Entrega correspondente nao encontrada');

  const buffer = fs.existsSync(job.caminho) ? fs.readFileSync(job.caminho) : Buffer.alloc(0);
  const aposLegal = new Date() > entrega.prazoLegal;
  await prisma.entrega.update({
    where: { id: entrega.id },
    data: {
      status: aposLegal ? 'ENTREGUE_JUSTIFICADA' : 'ENTREGUE',
      dataEntrega: new Date(), origemBaixa: 'ROBO',
      justificativa: aposLegal ? 'Baixa via revisao do robo (apos prazo)' : null,
    },
  });
  await prisma.entregaAnexo.create({
    data: { escritorioId, entregaId: entrega.id, nomeArquivo: job.arquivoNome, caminho: job.caminho, tamanho: buffer.length, mimeType: 'application/pdf' },
  });
  const comp = `${dados.competenciaAno}/${String(dados.competenciaMes).padStart(2, '0')}`;
  const doc = await prisma.documentoGED.create({
    data: {
      escritorioId, empresaId: dados.empresaId, raiz: 'DocsEntregas', pasta: `${comp}/${obrigacao.nome}`,
      nomeArquivo: job.arquivoNome, caminho: job.caminho, tamanho: buffer.length, mimeType: 'application/pdf', origem: 'ROBO', entregaId: entrega.id,
    },
  });
  await distribuir(escritorioId, dados.empresaId, doc.id, obrigacao.departamentoId);

  await prisma.roboJob.update({
    where: { id: jobId },
    data: {
      status: 'BAIXADO', empresaId: dados.empresaId, obrigacaoNome: obrigacao.nome,
      competenciaAno: dados.competenciaAno, competenciaMes: dados.competenciaMes, entregaId: entrega.id, motivo: null,
    },
  });
  return { ok: true };
}

// ---------- Reprocessar um job (re-roda a identificacao automatica no arquivo guardado) ----------
export async function reprocessarJob(escritorioId: string, jobId: string) {
  const job = await prisma.roboJob.findFirst({ where: { id: jobId, escritorioId } });
  if (!job) throw new Error('Job nao encontrado');
  if (!fs.existsSync(job.caminho)) throw new Error('Arquivo original nao encontrado para reprocessar');
  // tira o sufixo de pagina (ex.: " (p.2)") para reusar o nome original
  const nome = job.arquivoNome.replace(/\s*\(p\.\d+\)\s*$/, '');
  const resultados = await processarArquivo(escritorioId, job.caminho, nome, job.origem as 'UPLOAD' | 'WATCHER' | 'API');
  // o job antigo foi substituido pelos novos resultados
  await prisma.roboJob.delete({ where: { id: jobId } }).catch(() => undefined);
  const baixados = resultados.filter((r) => r.status === 'BAIXADO').length;
  const revisao = resultados.filter((r) => r.status === 'REVISAO').length;
  return { total: resultados.length, baixados, revisao };
}

// ---------- Painel / estatisticas ----------
// ---------- Consulta documento (dry-run de identificacao na base de conhecimento) ----------
export interface ConsultaResultado {
  arquivo: string;
  identificado: boolean;
  obrigacaoNome: string | null;
  empresa: string | null;
  competencia: string | null;
}

export async function consultarDocumentos(
  escritorioId: string,
  arquivos: { nome: string; buffer: Buffer }[],
): Promise<ConsultaResultado[]> {
  const out: ConsultaResultado[] = [];
  for (const arq of arquivos) {
    try {
      const { texto, metodo } = await extrairTexto(arq.buffer);
      if (metodo === 'VAZIO') {
        out.push({ arquivo: arq.nome, identificado: false, obrigacaoNome: null, empresa: null, competencia: null });
        continue;
      }
      const emp = await identificarEmpresa(escritorioId, texto);
      const obr = await identificarObrigacao(escritorioId, texto);
      const comp = obr?.competencia ? `${String(obr.competencia.mes).padStart(2, '0')}/${obr.competencia.ano}` : null;
      out.push({
        arquivo: arq.nome,
        identificado: !!obr?.obrigacaoNome,
        obrigacaoNome: obr?.obrigacaoNome ?? null,
        empresa: emp?.valor ?? null,
        competencia: comp,
      });
    } catch {
      out.push({ arquivo: arq.nome, identificado: false, obrigacaoNome: null, empresa: null, competencia: null });
    }
  }
  return out;
}

export async function estatisticas(escritorioId: string) {
  const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

  const [hoje, mes, baixadosMes, revisao] = await Promise.all([
    prisma.roboJob.count({ where: { escritorioId, createdAt: { gte: inicioHoje } } }),
    prisma.roboJob.count({ where: { escritorioId, createdAt: { gte: inicioMes } } }),
    prisma.roboJob.count({ where: { escritorioId, status: 'BAIXADO', createdAt: { gte: inicioMes } } }),
    prisma.roboJob.count({ where: { escritorioId, status: 'REVISAO' } }),
  ]);
  const taxaMatch = mes > 0 ? Math.round((baixadosMes / mes) * 100) : 0;
  return { processadosHoje: hoje, processadosMes: mes, baixadosMes, pendentesRevisao: revisao, taxaMatch };
}
