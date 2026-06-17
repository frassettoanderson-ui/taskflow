import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { ok } from '../../lib/http.js';
import { authenticate } from '../../middleware/auth.js';
import { statusEfetivo, type StatusEntrega } from '../entrega/entrega.status.js';

const router = Router();
router.use(authenticate);

interface Acc {
  pendenteAntecipado: number;
  pendenteNoPrazo: number;
  entregueNoPrazo: number;
  entregueComMulta: number;
}
const novoAcc = (): Acc => ({ pendenteAntecipado: 0, pendenteNoPrazo: 0, entregueNoPrazo: 0, entregueComMulta: 0 });

function classificar(acc: Acc, status: StatusEntrega) {
  if (status === 'PENDENTE_ANTECIPADO') acc.pendenteAntecipado++;
  else if (status === 'ENTREGUE') acc.entregueNoPrazo++;
  else if (status === 'ENTREGUE_JUSTIFICADA') acc.entregueComMulta++;
  else acc.pendenteNoPrazo++; // PENDENTE + EM_ATRASO_*
}

function comPct(acc: Acc) {
  const total = acc.pendenteAntecipado + acc.pendenteNoPrazo + acc.entregueNoPrazo + acc.entregueComMulta;
  const m = (c: number) => ({ count: c, pct: total ? Math.round((c / total) * 100) : 0 });
  return {
    pendenteAntecipado: m(acc.pendenteAntecipado),
    pendenteNoPrazo: m(acc.pendenteNoPrazo),
    entregueNoPrazo: m(acc.entregueNoPrazo),
    entregueComMulta: m(acc.entregueComMulta),
  };
}

router.get('/painel', async (req, res) => {
  const escritorioId = req.auth!.escritorioId;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const cfgRaw = (await prisma.escritorio.findUniqueOrThrow({ where: { id: escritorioId } })).config as Record<string, unknown>;
  const diasAntecipado = typeof cfgRaw.diasAntecipado === 'number' ? cfgRaw.diasAntecipado : 7;

  const [usuarios, departamentos, totalEmpresas, entregas] = await Promise.all([
    prisma.usuario.findMany({ where: { escritorioId, deletedAt: null, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.departamento.findMany({ where: { escritorioId, ativo: true }, select: { id: true, nome: true, cor: true }, orderBy: { nome: 'asc' } }),
    prisma.empresa.count({ where: { escritorioId, deletedAt: null } }),
    prisma.entrega.findMany({
      where: { escritorioId, competenciaAno: ano, competenciaMes: mes },
      select: {
        status: true, prazoTecnico: true, prazoLegal: true, dataEntrega: true,
        responsavelPrazoId: true, obrigacao: { select: { departamentoId: true } },
      },
    }),
  ]);

  const porColab = new Map<string, Acc>();
  const porDep = new Map<string, Acc>();
  usuarios.forEach((u) => porColab.set(u.id, novoAcc()));
  departamentos.forEach((d) => porDep.set(d.id, novoAcc()));

  const num = {
    entregasBaixadas: 0, antecipadas: 0, prazoTecnico: 0, atrasadas: 0, comMulta: 0, atrasoJustificado: 0,
    aRealizar: 0, arPrazoAntecipado: 0, arPrazoTecnico: 0, arAtrasoLegal: 0,
  };

  for (const e of entregas) {
    const status = statusEfetivo(e.status as StatusEntrega, e.prazoTecnico, e.prazoLegal, hoje, diasAntecipado);
    if (e.responsavelPrazoId && porColab.has(e.responsavelPrazoId)) classificar(porColab.get(e.responsavelPrazoId)!, status);
    if (e.obrigacao.departamentoId && porDep.has(e.obrigacao.departamentoId)) classificar(porDep.get(e.obrigacao.departamentoId)!, status);

    const baixada = status === 'ENTREGUE' || status === 'ENTREGUE_JUSTIFICADA';
    if (baixada) {
      num.entregasBaixadas++;
      if (status === 'ENTREGUE_JUSTIFICADA') { num.comMulta++; num.atrasadas++; num.atrasoJustificado++; }
      else if (e.dataEntrega && e.dataEntrega < e.prazoTecnico) num.antecipadas++;
      else num.prazoTecnico++;
    } else {
      num.aRealizar++;
      if (status === 'PENDENTE_ANTECIPADO') num.arPrazoAntecipado++;
      else if (status === 'EM_ATRASO_LEGAL') num.arAtrasoLegal++;
      else num.arPrazoTecnico++;
    }
  }

  const pctNum = (c: number, total: number) => ({ count: c, pct: total ? Math.round((c / total) * 100) : 0 });

  return ok(res, {
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    colaboradores: usuarios.map((u) => ({ id: u.id, nome: u.nome, metricas: comPct(porColab.get(u.id)!) })),
    departamentos: departamentos.map((d) => ({ id: d.id, nome: d.nome, cor: d.cor, metricas: comPct(porDep.get(d.id)!) })),
    numericos: {
      entregas: {
        total: num.entregasBaixadas,
        antecipadas: pctNum(num.antecipadas, num.entregasBaixadas),
        prazoTecnico: pctNum(num.prazoTecnico, num.entregasBaixadas),
        atrasadas: pctNum(num.atrasadas, num.entregasBaixadas),
        comMulta: pctNum(num.comMulta, num.entregasBaixadas),
        atrasoJustificado: pctNum(num.atrasoJustificado, num.entregasBaixadas),
      },
      aRealizar: {
        total: num.aRealizar,
        prazoAntecipado: pctNum(num.arPrazoAntecipado, num.aRealizar),
        prazoTecnico: pctNum(num.arPrazoTecnico, num.aRealizar),
        atrasoLegal: pctNum(num.arAtrasoLegal, num.aRealizar),
        comMulta: pctNum(0, num.aRealizar),
        atrasoJustificado: pctNum(0, num.aRealizar),
      },
      docs: { total: 0, lidos: pctNum(0, 0), naoLidos: pctNum(0, 0) },
      processos: { total: 0, iniciados: pctNum(0, 0), concluidos: pctNum(0, 0), passosOk: pctNum(0, 0), followups: pctNum(0, 0) },
      solicitacoes: { total: 0, abertas: 0, finalizadas: 0, aguardando: 0, resolvendo: 0, mediaAvaliacoes: 0 },
      empresas: totalEmpresas,
    },
  });
});

export default router;
