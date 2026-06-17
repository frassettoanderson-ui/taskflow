import { prisma } from '../../prisma.js';
import { statusEfetivo, type StatusEntrega } from '../entrega/entrega.status.js';

// Cores alinhadas ao tema (status de entrega).
export const CORES = {
  ok: '#5cb85c',
  info: '#5b9bd5',
  warn: '#f0ad4e',
  danger: '#cf3c5d',
  neutro: '#94a3b8',
};

function competenciasAnteriores(qtd: number): { ano: number; mes: number; label: string }[] {
  const hoje = new Date();
  const lista: { ano: number; mes: number; label: string }[] = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    lista.push({ ano: d.getFullYear(), mes: d.getMonth() + 1, label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` });
  }
  return lista;
}

// Computa todos os dados que os widgets do dashboard configuravel consomem.
export async function computarDados(escritorioId: string, meses = 6) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const cfg = (await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } })).config as Record<string, unknown>;
  const diasAntecipado = typeof cfg.diasAntecipado === 'number' ? cfg.diasAntecipado : 7;

  const comps = competenciasAnteriores(meses);
  const compMin = comps[0];

  const [empresasAtivas, departamentos, usuarios, entregasJanela, processosAndamento, solicitacoesAbertas, docsTotal] = await Promise.all([
    prisma.empresa.count({ where: { escritorioId, deletedAt: null, ativo: true } }),
    prisma.departamento.findMany({ where: { escritorioId, ativo: true }, select: { id: true, nome: true, cor: true }, orderBy: { nome: 'asc' } }),
    prisma.usuario.findMany({ where: { escritorioId, deletedAt: null, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.entrega.findMany({
      // janela dos ultimos N meses (filtro amplo; refina por competencia no loop)
      where: {
        escritorioId,
        OR: comps.map((c) => ({ competenciaAno: c.ano, competenciaMes: c.mes })),
      },
      select: {
        status: true, prazoTecnico: true, prazoLegal: true, dataEntrega: true,
        competenciaAno: true, competenciaMes: true, empresaId: true,
        responsavelPrazoId: true, obrigacao: { select: { departamentoId: true } },
        empresa: { select: { razaoSocial: true } },
      },
    }),
    prisma.processo.count({ where: { escritorioId, status: 'EM_ANDAMENTO' } }),
    prisma.solicitacaoInterna.count({ where: { escritorioId, status: { in: ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO'] } } }),
    prisma.documentoGED.count({ where: { escritorioId } }),
  ]);
  void compMin;

  // estruturas de agregacao
  const depMap = new Map(departamentos.map((d) => [d.id, { nome: d.nome, cor: d.cor, baixadas: 0, pendentes: 0 }]));
  const colabMap = new Map(usuarios.map((u) => [u.id, { nome: u.nome, baixadas: 0, pendentes: 0 }]));
  const evolMap = new Map(comps.map((c) => [c.label, { competencia: c.label, baixadas: 0, atrasadas: 0, total: 0 }]));
  const pendPorEmpresa = new Map<string, { empresa: string; pendentes: number }>();
  const statusMesAtual = { antecipado: 0, noPrazo: 0, baixada: 0, comMulta: 0 };

  for (const e of entregasJanela) {
    const ref = new Date(e.competenciaAno, e.competenciaMes - 1, 1);
    const st = statusEfetivo(e.status as StatusEntrega, e.prazoTecnico, e.prazoLegal, hoje, diasAntecipado);
    const baixada = st === 'ENTREGUE' || st === 'ENTREGUE_JUSTIFICADA';
    const label = `${String(e.competenciaMes).padStart(2, '0')}/${e.competenciaAno}`;
    void ref;

    const ev = evolMap.get(label);
    if (ev) {
      ev.total++;
      if (baixada) ev.baixadas++;
      if (st === 'EM_ATRASO_LEGAL' || st === 'ENTREGUE_JUSTIFICADA') ev.atrasadas++;
    }

    // mes atual: detalhamento por dep/colab/status/empresa
    if (e.competenciaAno === ano && e.competenciaMes === mes) {
      if (st === 'PENDENTE_ANTECIPADO') statusMesAtual.antecipado++;
      else if (st === 'ENTREGUE') statusMesAtual.baixada++;
      else if (st === 'ENTREGUE_JUSTIFICADA') statusMesAtual.comMulta++;
      else statusMesAtual.noPrazo++;

      if (e.obrigacao.departamentoId && depMap.has(e.obrigacao.departamentoId)) {
        const d = depMap.get(e.obrigacao.departamentoId)!;
        baixada ? d.baixadas++ : d.pendentes++;
      }
      if (e.responsavelPrazoId && colabMap.has(e.responsavelPrazoId)) {
        const c = colabMap.get(e.responsavelPrazoId)!;
        baixada ? c.baixadas++ : c.pendentes++;
      }
      if (!baixada) {
        const cur = pendPorEmpresa.get(e.empresaId) ?? { empresa: e.empresa.razaoSocial, pendentes: 0 };
        cur.pendentes++;
        pendPorEmpresa.set(e.empresaId, cur);
      }
    }
  }

  const entregasBaixadas = statusMesAtual.baixada + statusMesAtual.comMulta;
  const aRealizar = statusMesAtual.antecipado + statusMesAtual.noPrazo;
  const atrasadas = (evolMap.get(`${String(mes).padStart(2, '0')}/${ano}`)?.atrasadas) ?? 0;

  return {
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    kpis: {
      empresasAtivas,
      entregasBaixadas,
      aRealizar,
      atrasadas,
      processosAndamento,
      solicitacoesAbertas,
      docsTotal,
    },
    entregasPorStatus: [
      { nome: 'Antecipadas', valor: statusMesAtual.antecipado, cor: CORES.ok },
      { nome: 'No prazo (a fazer)', valor: statusMesAtual.noPrazo, cor: CORES.warn },
      { nome: 'Baixadas', valor: statusMesAtual.baixada, cor: CORES.info },
      { nome: 'Com multa', valor: statusMesAtual.comMulta, cor: CORES.danger },
    ],
    porDepartamento: [...depMap.values()].map((d) => ({ nome: d.nome, baixadas: d.baixadas, pendentes: d.pendentes })),
    porColaborador: [...colabMap.values()].filter((c) => c.baixadas + c.pendentes > 0).map((c) => ({ nome: c.nome, baixadas: c.baixadas, pendentes: c.pendentes })),
    evolucao: [...evolMap.values()],
    topPendencias: [...pendPorEmpresa.values()].sort((a, b) => b.pendentes - a.pendentes).slice(0, 8),
  };
}
