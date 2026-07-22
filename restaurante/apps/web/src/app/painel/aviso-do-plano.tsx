'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { chamarApi } from '@/lib/chamar-api';
import { dinheiro } from '../m/[slug]/cardapio';

type Consumo = {
  assinado: boolean;
  plano?: { nome: string; precoExcedenteCents: number };
  marcas: { usado: number; limite: number; cheio: boolean };
  pedidos: {
    usado: number;
    limite: number;
    excedente: number;
    excedenteCents?: number;
    avisar: boolean;
    estourou: boolean;
  };
  cobranca: {
    emDia: boolean;
    diasAtrasado: number;
    bloqueado: boolean;
    diasAteCortar?: number;
    faturaVencidaCents: number;
    faturaNumero?: string;
  };
};

/**
 * A faixa de aviso do Painel.
 *
 * Existe por uma razão só: **ninguém pode ser pego de surpresa**. Nem pelo
 * excedente que vai aparecer na fatura, nem pelo bloqueio por atraso. Quem
 * avisa antes cobra depois sem briga.
 */
export function AvisoDoPlano() {
  const [c, setC] = useState<Consumo | null>(null);

  useEffect(() => {
    chamarApi<Consumo>('/portal-admin/consumo').then((r) => r.ok && setC(r.dados));
  }, []);

  if (!c?.assinado) return null;

  const faixas: React.ReactNode[] = [];

  // ---- 1. Atraso de pagamento (o mais grave primeiro) ----
  if (!c.cobranca.emDia) {
    faixas.push(
      <div
        key="cobranca"
        className="fechado"
        style={{
          margin: '0 0 12px',
          background: 'rgba(239,68,68,.12)',
          borderColor: 'rgba(239,68,68,.4)',
          color: '#fca5a5',
        }}
      >
        💳 <strong>Fatura {c.cobranca.faturaNumero} vencida</strong> há {c.cobranca.diasAtrasado}{' '}
        dia(s) — {dinheiro(c.cobranca.faturaVencidaCents)}.{' '}
        {c.cobranca.diasAteCortar === 0 ? (
          <strong>O sistema está bloqueado até o pagamento.</strong>
        ) : (
          <>
            O sistema é bloqueado em <strong>{c.cobranca.diasAteCortar} dia(s)</strong> se não for
            pago — inclusive o cardápio dos seus clientes.
          </>
        )}{' '}
        <Link href="/portal">Ver assinatura</Link>
      </div>,
    );
  }

  // ---- 2. Limite de pedidos: avisa antes, cobra depois, nunca bloqueia ----
  if (c.pedidos.estourou) {
    faixas.push(
      <div
        key="excedente"
        className="fechado"
        style={{
          margin: '0 0 12px',
          background: 'rgba(234,179,8,.12)',
          borderColor: 'rgba(234,179,8,.35)',
          color: '#fde68a',
        }}
      >
        📈 Você já fez <strong>{c.pedidos.usado}</strong> pedidos este mês, e seu plano inclui{' '}
        {c.pedidos.limite}. <strong>Seus pedidos continuam entrando normalmente</strong> — os{' '}
        {c.pedidos.excedente} a mais entram como excedente na próxima fatura
        {c.pedidos.excedenteCents ? ` (${dinheiro(c.pedidos.excedenteCents)} até agora)` : ''}.{' '}
        <Link href="/portal">Um plano maior pode sair mais barato</Link>.
      </div>,
    );
  } else if (c.pedidos.avisar) {
    faixas.push(
      <div key="perto" className="hint" style={{ marginTop: 0 }}>
        📊 {c.pedidos.usado} de {c.pedidos.limite} pedidos do plano usados este mês. Passando
        disso, nada para de funcionar — o excedente é cobrado na fatura.
      </div>,
    );
  }

  // ---- 3. Marcas: este sim bloqueia, e é seguro bloquear ----
  if (c.marcas.cheio) {
    faixas.push(
      <div key="marcas" className="hint" style={{ marginTop: 0 }}>
        🏷 Você usou as {c.marcas.limite} marca(s) do plano {c.plano?.nome}. Para criar outra,{' '}
        <Link href="/portal">suba de plano</Link>.
      </div>,
    );
  }

  return <>{faixas}</>;
}
