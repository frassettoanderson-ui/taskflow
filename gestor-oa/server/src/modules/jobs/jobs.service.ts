import { prisma } from '../../prisma.js';
import { gerarCompetencia } from '../entrega/entrega.service.js';
import { instanciar } from '../processo/processo.service.js';
import { statusEfetivo, type StatusEntrega } from '../entrega/entrega.status.js';
import { montarFeriados, nthDiaUtil, ehDiaUtil } from '../../lib/prazos.js';
import { criarNotificacao } from '../../lib/notificar.js';

export const JOBS = ['geracao_mensal', 'recorrencia_processos', 'alertas_prazos', 'lembrete_protocolos'] as const;
export type JobNome = (typeof JOBS)[number];

export const JOBS_INFO: Record<JobNome, string> = {
  geracao_mensal: 'Gera a lista de entregas da competencia corrente (idempotente).',
  recorrencia_processos: 'Instancia processos das recorrencias configuradas que vencem hoje.',
  alertas_prazos: 'Notifica responsaveis sobre entregas atrasadas e prazos proximos.',
  lembrete_protocolos: 'Avisa sobre protocolos digitais ainda nao visualizados.',
};

interface ResultadoJob { itens: number; detalhe: string }

function mesmaData(a: Date | null, b: Date): boolean {
  if (!a) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ---------- Geracao mensal ----------
async function geracaoMensal(): Promise<ResultadoJob> {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const escritorios = await prisma.escritorio.findMany({ where: { deletedAt: null }, select: { id: true } });
  let total = 0;
  for (const e of escritorios) {
    const r = await gerarCompetencia(e.id, ano, mes);
    total += r.criadas;
  }
  return { itens: total, detalhe: `${total} entrega(s) gerada(s) para ${String(mes).padStart(2, '0')}/${ano}.` };
}

// ---------- Recorrencia de processos ----------
async function recorrenciaProcessos(): Promise<ResultadoJob> {
  const hoje = new Date();
  const recorrencias = await prisma.processoRecorrente.findMany({ where: { ativo: true } });
  let criados = 0;

  // feriados por escritorio (cache simples)
  const feriadosCache = new Map<string, Awaited<ReturnType<typeof carregarFeriados>>>();
  async function carregarFeriados(escritorioId: string) {
    const fs = await prisma.feriado.findMany({ where: { escritorioId }, select: { data: true } });
    return montarFeriados(fs.map((f) => f.data));
  }

  for (const rec of recorrencias) {
    if (!rec.empresaId) continue; // sem empresa nao ha como instanciar
    if (mesmaData(rec.ultimaExecucao, hoje)) continue;

    const cfg = (rec.config ?? {}) as { diasMes?: number[]; diasSemana?: number[] };
    let venceHoje = false;
    if (rec.tipoRecorrencia === 'DIAS_MES') {
      venceHoje = (cfg.diasMes ?? []).includes(hoje.getDate());
    } else if (rec.tipoRecorrencia === 'DIAS_SEMANA') {
      venceHoje = (cfg.diasSemana ?? []).includes(hoje.getDay());
    } else if (rec.tipoRecorrencia === 'DIAS_UTEIS') {
      let feriados = feriadosCache.get(rec.escritorioId);
      if (!feriados) { feriados = await carregarFeriados(rec.escritorioId); feriadosCache.set(rec.escritorioId, feriados); }
      // interpreta diasMes como n-esimos dias uteis do mes
      venceHoje = (cfg.diasMes ?? []).some((n) => mesmaData(nthDiaUtil(hoje.getFullYear(), hoje.getMonth(), n, feriados!, false), hoje));
    }

    if (!venceHoje) continue;
    try {
      await instanciar(rec.escritorioId, rec.matrizId, rec.empresaId);
      await prisma.processoRecorrente.update({ where: { id: rec.id }, data: { ultimaExecucao: hoje } });
      criados++;
    } catch {
      // ignora recorrencia com matriz/empresa invalida
    }
  }
  return { itens: criados, detalhe: `${criados} processo(s) recorrente(s) iniciado(s).` };
}

// ---------- Alertas de prazos ----------
async function alertasPrazos(): Promise<ResultadoJob> {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const escritorios = await prisma.escritorio.findMany({ where: { deletedAt: null }, select: { id: true, config: true } });
  let criadas = 0;

  for (const e of escritorios) {
    const cfg = (e.config ?? {}) as Record<string, unknown>;
    const diasAntecipado = typeof cfg.diasAntecipado === 'number' ? cfg.diasAntecipado : 7;
    const entregas = await prisma.entrega.findMany({
      where: { escritorioId: e.id, competenciaAno: ano, competenciaMes: mes, status: { in: ['PENDENTE', 'PENDENTE_ANTECIPADO', 'EM_ATRASO_TECNICO', 'EM_ATRASO_LEGAL'] } },
      select: { id: true, prazoTecnico: true, prazoLegal: true, responsavelPrazoId: true, obrigacao: { select: { nome: true } }, empresa: { select: { razaoSocial: true } } },
    });

    for (const ent of entregas) {
      if (!ent.responsavelPrazoId) continue;
      const st = statusEfetivo('PENDENTE' as StatusEntrega, ent.prazoTecnico, ent.prazoLegal, hoje, diasAntecipado);
      const ref = `${ent.empresa.razaoSocial} · ${ent.obrigacao.nome}`;
      if (st === 'EM_ATRASO_LEGAL' || st === 'EM_ATRASO_TECNICO') {
        const criou = await criarNotificacao({
          escritorioId: e.id, usuarioId: ent.responsavelPrazoId, tipo: 'ENTREGA_ATRASADA',
          titulo: st === 'EM_ATRASO_LEGAL' ? 'Entrega em atraso legal' : 'Entrega em atraso tecnico',
          mensagem: `${ref} esta ${st === 'EM_ATRASO_LEGAL' ? 'vencida (prazo legal)' : 'fora do prazo tecnico'}.`,
          link: '/entregas', chave: `${st}:${ent.id}`,
        });
        if (criou) criadas++;
      } else {
        // prazo tecnico nos proximos 2 dias
        const diff = Math.ceil((ent.prazoTecnico.getTime() - hoje.getTime()) / 86400000);
        if (diff >= 0 && diff <= 2) {
          const criou = await criarNotificacao({
            escritorioId: e.id, usuarioId: ent.responsavelPrazoId, tipo: 'PRAZO_PROXIMO',
            titulo: 'Prazo se aproximando', mensagem: `${ref} vence (tecnico) em ${diff === 0 ? 'hoje' : `${diff} dia(s)`}.`,
            link: '/entregas', chave: `PRAZO_PROXIMO:${ent.id}`,
          });
          if (criou) criadas++;
        }
      }
    }
  }
  return { itens: criadas, detalhe: `${criadas} alerta(s) de prazo criado(s).` };
}

// ---------- Lembrete de protocolos nao lidos ----------
async function lembreteProtocolos(): Promise<ResultadoJob> {
  const hoje = new Date();
  const limite = new Date(hoje.getTime() - 3 * 86400000); // > 3 dias sem leitura
  const protocolos = await prisma.protocolo.findMany({
    where: { enviadoEm: { lt: limite }, lembreteEnviadoEm: null, visualizacoes: { none: {} } },
    select: { id: true, escritorioId: true, empresaId: true, destinatario: true, empresa: { select: { razaoSocial: true } } },
    take: 200,
  });
  let criadas = 0;
  for (const p of protocolos) {
    const resp = await prisma.empresaResponsavelDepartamento.findMany({ where: { empresaId: p.empresaId }, select: { usuarioId: true } });
    const alvos = [...new Set(resp.map((r) => r.usuarioId))];
    for (const usuarioId of alvos) {
      const criou = await criarNotificacao({
        escritorioId: p.escritorioId, usuarioId, tipo: 'PROTOCOLO_NAO_LIDO',
        titulo: 'Protocolo nao visualizado', mensagem: `${p.empresa.razaoSocial}: ${p.destinatario} ainda nao abriu um documento enviado.`,
        link: `/empresas/${p.empresaId}`, chave: `PROTOCOLO_NAO_LIDO:${p.id}:${usuarioId}`,
      });
      if (criou) criadas++;
    }
    await prisma.protocolo.update({ where: { id: p.id }, data: { lembreteEnviadoEm: hoje } });
  }
  return { itens: criadas, detalhe: `${criadas} lembrete(s) de protocolo criado(s).` };
}

const EXECUTORES: Record<JobNome, () => Promise<ResultadoJob>> = {
  geracao_mensal: geracaoMensal,
  recorrencia_processos: recorrenciaProcessos,
  alertas_prazos: alertasPrazos,
  lembrete_protocolos: lembreteProtocolos,
};

// Executa um job, registrando JobExecucao (sucesso ou erro).
export async function executarJob(nome: JobNome): Promise<{ status: string; itens: number; detalhe: string; duracaoMs: number }> {
  const inicio = Date.now();
  try {
    const r = await EXECUTORES[nome]();
    const duracaoMs = Date.now() - inicio;
    await prisma.jobExecucao.create({ data: { job: nome, status: 'OK', itens: r.itens, duracaoMs, detalhe: r.detalhe } });
    return { status: 'OK', itens: r.itens, detalhe: r.detalhe, duracaoMs };
  } catch (err) {
    const duracaoMs = Date.now() - inicio;
    const detalhe = err instanceof Error ? err.message : 'Erro desconhecido';
    await prisma.jobExecucao.create({ data: { job: nome, status: 'ERRO', duracaoMs, detalhe } });
    return { status: 'ERRO', itens: 0, detalhe, duracaoMs };
  }
}

// Roda todos os jobs em sequencia (usado pelo scheduler).
export async function executarTodos(): Promise<void> {
  for (const nome of JOBS) {
    await executarJob(nome);
  }
}
