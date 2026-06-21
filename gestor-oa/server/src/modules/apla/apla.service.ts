import { prisma } from '../../prisma.js';
import { statusEfetivo, type StatusEntrega } from '../entrega/entrega.status.js';

export interface AplaConfig {
  custoHora: number; // custo medio da hora produtiva (R$/h) - fallback
}

export function lerAplaConfig(config: unknown): AplaConfig {
  const c = (config ?? {}) as Record<string, unknown>;
  const apla = (c.apla ?? {}) as Record<string, unknown>;
  return { custoHora: typeof apla.custoHora === 'number' ? apla.custoHora : 50 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (parte: number, total: number) => (total ? round2((parte / total) * 100) : 0);
const dec = (v: { toNumber: () => number } | number | null | undefined) => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());

// cor da barra de capacidade conforme ocupacao (alocado/disponivel)
function corOcupacao(p: number): string {
  if (p <= 30) return '#cf3c5d';   // ocioso
  if (p <= 60) return '#f0ad4e';   // baixo
  if (p <= 100) return '#5cb85c';  // ideal
  return '#7e57c2';                // sobrecarga
}

// Metodo APLA: BI de produtividade (capacidade) e lucratividade (com rateio de custos fixos).
export async function computarApla(escritorioId: string, ano: number, mes: number) {
  const escritorio = await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } });
  const cfg = lerAplaConfig(escritorio.config);
  const custoHoraFallback = cfg.custoHora;
  const diasAntecipado = (() => { const c = escritorio.config as Record<string, unknown>; return typeof c.diasAntecipado === 'number' ? c.diasAntecipado : 7; })();

  // Produtividade conta no mes do PRAZO TECNICO (nao na competencia nem na dataEntrega):
  // a competencia (mes de apuracao) costuma cair num mes e o prazo tecnico no seguinte.
  // prazoTecnico e @db.Date: limites em UTC para casar com a data armazenada (Date.UTC(ano, mes, 0) = ultimo dia do mes).
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMes = new Date(Date.UTC(ano, mes, 0));

  const [vinculos, departamentos, usuarios, entregas, empresasAll, custosFixos, regimeOverrides] = await Promise.all([
    prisma.empresaObrigacao.findMany({
      where: { escritorioId, ativo: true, obrigacao: { deletedAt: null } },
      select: {
        honorario: true, tempoPrevistoOverride: true, obrigacaoId: true,
        empresaId: true, empresa: { select: { razaoSocial: true, deletedAt: true, regimeTributarioId: true } },
        obrigacao: { select: { tempoPrevistoMin: true, departamentoId: true } },
      },
    }),
    prisma.departamento.findMany({ where: { escritorioId, ativo: true }, select: { id: true, nome: true, cor: true } }),
    prisma.usuario.findMany({ where: { escritorioId, deletedAt: null, ativo: true }, select: { id: true, nome: true, custoHora: true, minutosUteisMes: true, salario: true, encargos: true, beneficios: true } }),
    prisma.entrega.findMany({
      where: { escritorioId, prazoTecnico: { gte: inicioMes, lte: fimMes } },
      select: {
        status: true, prazoTecnico: true, prazoLegal: true, dataEntrega: true, responsavelPrazoId: true, responsavelEntregaId: true, obrigacaoId: true,
        obrigacao: { select: { tempoPrevistoMin: true } },
        empresaObrigacao: { select: { tempoPrevistoOverride: true, empresa: { select: { regimeTributarioId: true } } } },
      },
    }),
    prisma.empresa.findMany({ where: { escritorioId, deletedAt: null, ativo: true }, select: { id: true, grupoEmpresaId: true, tags: { select: { tagId: true } } } }),
    prisma.custoFixo.findMany({ where: { escritorioId, ativo: true } }),
    prisma.regimeObrigacao.findMany({ where: { regime: { escritorioId } }, select: { regimeId: true, obrigacaoId: true, tempoPrevistoOverride: true } }),
  ]);

  const hoje = new Date();

  // Tempo efetivo de uma (empresa, obrigacao): override da empresa -> override do regime -> catalogo da obrigacao.
  // (No Acessorias o tempo "mora" no regime; aqui o regime override e respeitado sem precisar snapshot na empresa.)
  const regOv = new Map<string, number>();
  for (const r of regimeOverrides) if (r.tempoPrevistoOverride != null) regOv.set(`${r.regimeId}|${r.obrigacaoId}`, r.tempoPrevistoOverride);
  const tempoEfetivo = (override: number | null | undefined, regimeId: string | null | undefined, obrigacaoId: string, catalogo: number | null | undefined) =>
    override ?? (regimeId ? regOv.get(`${regimeId}|${obrigacaoId}`) : undefined) ?? catalogo ?? 0;

  // ----- RH: custo da equipe -----
  const colab = usuarios.map((u) => {
    const rhMensal = dec(u.salario) + dec(u.encargos) + dec(u.beneficios);
    const minutos = u.minutosUteisMes ?? 0;
    const custoMensal = rhMensal > 0 ? rhMensal : round2((dec(u.custoHora) || custoHoraFallback) * (minutos / 60));
    return { id: u.id, nome: u.nome, minutos, custoMensal, alocado: 0, entregue: 0 };
  });
  const colabMap = new Map(colab.map((c) => [c.id, c]));
  const minutosEquipe = colab.reduce((s, c) => s + c.minutos, 0);
  const custoRHTotal = round2(colab.reduce((s, c) => s + c.custoMensal, 0));
  const custoMinuto = minutosEquipe ? round2(custoRHTotal / minutosEquipe) : 0;

  // ----- capacidade: alocado/entregue por colaborador (entregas do mes) -----
  for (const ent of entregas) {
    const tempo = tempoEfetivo(ent.empresaObrigacao?.tempoPrevistoOverride, ent.empresaObrigacao?.empresa.regimeTributarioId, ent.obrigacaoId, ent.obrigacao.tempoPrevistoMin);
    const st = statusEfetivo(ent.status as StatusEntrega, ent.prazoTecnico, ent.prazoLegal, hoje, diasAntecipado);
    const baixada = st === 'ENTREGUE' || st === 'ENTREGUE_JUSTIFICADA';
    const uid = ent.responsavelPrazoId ?? ent.responsavelEntregaId;
    if (uid && colabMap.has(uid)) {
      const c = colabMap.get(uid)!;
      c.alocado += tempo;
      if (baixada) c.entregue += tempo;
    }
  }
  const capacidade = colab.map((c) => {
    const prodPct = pct(c.alocado, c.minutos);
    return {
      id: c.id, nome: c.nome, disponivel: c.minutos, alocado: c.alocado, entregue: c.entregue,
      prodPct, entreguePct: pct(c.entregue, c.minutos), cor: corOcupacao(prodPct),
    };
  }).sort((a, b) => b.prodPct - a.prodPct);
  const minAlocados = colab.reduce((s, c) => s + c.alocado, 0);
  const minDisponiveis = Math.max(0, minutosEquipe - minAlocados);

  // ----- carteira por empresa (honorario + tempo) -----
  const empMap = new Map<string, { empresa: string; honorario: number; tempoMin: number; obrigacoes: number }>();
  const depMap = new Map(departamentos.map((d) => [d.id, { nome: d.nome, cor: d.cor, honorario: 0, tempoMin: 0 }]));
  for (const v of vinculos) {
    if (v.empresa.deletedAt) continue;
    const honor = Number(v.honorario ?? 0);
    const tempo = tempoEfetivo(v.tempoPrevistoOverride, v.empresa.regimeTributarioId, v.obrigacaoId, v.obrigacao.tempoPrevistoMin);
    const e = empMap.get(v.empresaId) ?? { empresa: v.empresa.razaoSocial, honorario: 0, tempoMin: 0, obrigacoes: 0 };
    e.honorario += honor; e.tempoMin += tempo; e.obrigacoes++;
    empMap.set(v.empresaId, e);
    if (v.obrigacao.departamentoId && depMap.has(v.obrigacao.departamentoId)) {
      const d = depMap.get(v.obrigacao.departamentoId)!; d.honorario += honor; d.tempoMin += tempo;
    }
  }

  // ----- rateio de custos fixos por empresa -----
  const grupoMembros = new Map<string, string[]>();
  const tagMembros = new Map<string, string[]>();
  for (const e of empresasAll) {
    if (e.grupoEmpresaId) grupoMembros.set(e.grupoEmpresaId, [...(grupoMembros.get(e.grupoEmpresaId) ?? []), e.id]);
    for (const t of e.tags) tagMembros.set(t.tagId, [...(tagMembros.get(t.tagId) ?? []), e.id]);
  }
  const custoFixoEmpresa = new Map<string, number>();
  const addRateio = (ids: string[], valor: number) => { if (!ids.length) return; const v = valor / ids.length; for (const id of ids) custoFixoEmpresa.set(id, (custoFixoEmpresa.get(id) ?? 0) + v); };
  let custosFixosTotal = 0;
  for (const cf of custosFixos) {
    const valor = dec(cf.valor); custosFixosTotal += valor;
    if (cf.escopo === 'EMPRESA' && cf.empresaId) addRateio([cf.empresaId], valor);
    else if (cf.escopo === 'GRUPO' && cf.grupoId) addRateio(grupoMembros.get(cf.grupoId) ?? [], valor);
    else if (cf.escopo === 'TAG' && cf.tagId) addRateio(tagMembros.get(cf.tagId) ?? [], valor);
    else addRateio(empresasAll.map((e) => e.id), valor); // GERAL
  }
  custosFixosTotal = round2(custosFixosTotal);

  // ----- lucratividade por empresa (RH + custo fixo rateado) -----
  const empresas = [...empMap.entries()].map(([id, e]) => {
    const custoRH = round2(e.tempoMin * custoMinuto);
    const custoFixo = round2(custoFixoEmpresa.get(id) ?? 0);
    const resultado = round2(e.honorario - custoRH - custoFixo);
    return {
      id, empresa: e.empresa, obrigacoes: e.obrigacoes, honorario: round2(e.honorario),
      horas: round2(e.tempoMin / 60), custoRH, custoFixo, resultado, resultadoPct: pct(resultado, e.honorario),
    };
  }).sort((a, b) => a.resultado - b.resultado);

  const porDepartamento = [...depMap.values()].filter((d) => d.honorario > 0 || d.tempoMin > 0).map((d) => {
    const custo = round2(d.tempoMin * custoMinuto);
    return { nome: d.nome, cor: d.cor, receita: round2(d.honorario), custo, margem: round2(d.honorario - custo) };
  });

  // ----- dashboard (15 indicadores) -----
  const honorarios = round2(empresas.reduce((s, e) => s + e.honorario, 0));
  const clientesAtivos = empMap.size;
  const ticketMedio = round2(clientesAtivos ? honorarios / clientesAtivos : 0);
  const dinheiroNaMesa = round2(minAlocados ? (minDisponiveis / minAlocados) * honorarios : 0);
  const resultado = round2(honorarios - custoRHTotal - custosFixosTotal);

  const dashboard = {
    colaboradores: usuarios.length,
    salarios: custoRHTotal,
    minutosEquipe,
    custoMinuto,
    minAlocados,
    produtividadePct: pct(minAlocados, minutosEquipe),
    minDisponiveis,
    capacidadeExpansaoPct: pct(minDisponiveis, minutosEquipe),
    clientesAtivos,
    honorarios,
    ticketMedio,
    dinheiroNaMesa,
    custosFixos: custosFixosTotal,
    resultado,
    lucratividadePct: pct(resultado, honorarios),
  };

  return {
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    custoHora: custoHoraFallback,
    custoMinuto,
    dashboard,
    capacidade,
    empresas,
    porDepartamento,
    custosFixos: custosFixos.map((c) => ({ id: c.id, nome: c.nome, escopo: c.escopo, grupoId: c.grupoId, tagId: c.tagId, empresaId: c.empresaId, valor: dec(c.valor), ativo: c.ativo })),
  };
}
