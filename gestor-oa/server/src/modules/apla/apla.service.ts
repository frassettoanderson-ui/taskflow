import { prisma } from '../../prisma.js';
import { statusEfetivo, type StatusEntrega } from '../entrega/entrega.status.js';

export interface AplaConfig {
  custoHora: number; // custo medio da hora produtiva (R$/h)
}

export function lerAplaConfig(config: unknown): AplaConfig {
  const c = (config ?? {}) as Record<string, unknown>;
  const apla = (c.apla ?? {}) as Record<string, unknown>;
  return { custoHora: typeof apla.custoHora === 'number' ? apla.custoHora : 50 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (parte: number, total: number) => (total ? round2((parte / total) * 100) : 0);

// Metodo APLA: BI de produtividade e lucratividade.
// Receita = honorarios mensais (EmpresaObrigacao.honorario dos vinculos ativos).
// Custo  = horas previstas x custoHora. Margem = receita - custo.
export async function computarApla(escritorioId: string, ano: number, mes: number) {
  const escritorio = await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } });
  const cfg = lerAplaConfig(escritorio.config);
  const custoHora = cfg.custoHora;

  const [vinculos, departamentos, usuarios, entregas] = await Promise.all([
    prisma.empresaObrigacao.findMany({
      where: { escritorioId, ativo: true, obrigacao: { deletedAt: null } },
      select: {
        honorario: true, tempoPrevistoOverride: true,
        empresaId: true, empresa: { select: { razaoSocial: true, deletedAt: true } },
        obrigacao: { select: { tempoPrevistoMin: true, departamentoId: true } },
      },
    }),
    prisma.departamento.findMany({ where: { escritorioId, ativo: true }, select: { id: true, nome: true, cor: true } }),
    prisma.usuario.findMany({ where: { escritorioId, deletedAt: null, ativo: true }, select: { id: true, nome: true } }),
    prisma.entrega.findMany({
      where: { escritorioId, competenciaAno: ano, competenciaMes: mes },
      select: { status: true, prazoTecnico: true, prazoLegal: true, dataEntrega: true, responsavelEntregaId: true, obrigacao: { select: { tempoPrevistoMin: true } } },
    }),
  ]);

  const diasAntecipado = (() => { const c = escritorio.config as Record<string, unknown>; return typeof c.diasAntecipado === 'number' ? c.diasAntecipado : 7; })();

  // ----- por empresa (carteira mensal) -----
  const empMap = new Map<string, { empresa: string; honorario: number; tempoMin: number; obrigacoes: number }>();
  const depMap = new Map(departamentos.map((d) => [d.id, { nome: d.nome, cor: d.cor, honorario: 0, tempoMin: 0 }]));

  for (const v of vinculos) {
    if (v.empresa.deletedAt) continue;
    const honor = Number(v.honorario ?? 0);
    const tempo = v.tempoPrevistoOverride ?? v.obrigacao.tempoPrevistoMin ?? 0;
    const e = empMap.get(v.empresaId) ?? { empresa: v.empresa.razaoSocial, honorario: 0, tempoMin: 0, obrigacoes: 0 };
    e.honorario += honor; e.tempoMin += tempo; e.obrigacoes++;
    empMap.set(v.empresaId, e);
    if (v.obrigacao.departamentoId && depMap.has(v.obrigacao.departamentoId)) {
      const d = depMap.get(v.obrigacao.departamentoId)!;
      d.honorario += honor; d.tempoMin += tempo;
    }
  }

  const empresas = [...empMap.values()].map((e) => {
    const custo = round2((e.tempoMin / 60) * custoHora);
    const margem = round2(e.honorario - custo);
    return {
      empresa: e.empresa, obrigacoes: e.obrigacoes, honorario: round2(e.honorario),
      horas: round2(e.tempoMin / 60), custo, margem, margemPct: pct(margem, e.honorario),
    };
  }).sort((a, b) => a.margem - b.margem); // pior margem primeiro

  const porDepartamento = [...depMap.values()].filter((d) => d.honorario > 0 || d.tempoMin > 0).map((d) => {
    const custo = round2((d.tempoMin / 60) * custoHora);
    return { nome: d.nome, cor: d.cor, receita: round2(d.honorario), custo, margem: round2(d.honorario - custo) };
  });

  // ----- produtividade por colaborador (entregas do mes) -----
  const hoje = new Date();
  const colabMap = new Map(usuarios.map((u) => [u.id, { nome: u.nome, baixadas: 0, pendentes: 0, minProduzidos: 0 }]));
  for (const ent of entregas) {
    const st = statusEfetivo(ent.status as StatusEntrega, ent.prazoTecnico, ent.prazoLegal, hoje, diasAntecipado);
    const baixada = st === 'ENTREGUE' || st === 'ENTREGUE_JUSTIFICADA';
    const uid = ent.responsavelEntregaId;
    if (uid && colabMap.has(uid)) {
      const c = colabMap.get(uid)!;
      if (baixada) { c.baixadas++; c.minProduzidos += ent.obrigacao.tempoPrevistoMin ?? 0; }
      else c.pendentes++;
    }
  }
  const porColaborador = [...colabMap.values()].filter((c) => c.baixadas + c.pendentes > 0).map((c) => ({
    nome: c.nome, baixadas: c.baixadas, pendentes: c.pendentes, horasProduzidas: round2(c.minProduzidos / 60),
    valorProduzido: round2((c.minProduzidos / 60) * custoHora),
  })).sort((a, b) => b.horasProduzidas - a.horasProduzidas);

  // ----- KPIs -----
  const receitaTotal = round2(empresas.reduce((s, e) => s + e.honorario, 0));
  const custoTotal = round2(empresas.reduce((s, e) => s + e.custo, 0));
  const lucro = round2(receitaTotal - custoTotal);
  const horasTotais = round2(empresas.reduce((s, e) => s + e.horas, 0));
  const comHonorario = empresas.filter((e) => e.honorario > 0).length;

  return {
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    custoHora,
    kpis: {
      receitaTotal, custoTotal, lucro, margemPct: pct(lucro, receitaTotal),
      horasTotais, ticketMedio: round2(comHonorario ? receitaTotal / comHonorario : 0),
      empresas: empresas.length, deficitarias: empresas.filter((e) => e.margem < 0).length,
    },
    empresas,
    porDepartamento,
    porColaborador,
  };
}
