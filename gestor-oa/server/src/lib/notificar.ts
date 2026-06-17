import { prisma } from '../prisma.js';

type TipoNotificacao = 'ENTREGA_ATRASADA' | 'PRAZO_PROXIMO' | 'PROTOCOLO_NAO_LIDO' | 'SOLICITACAO' | 'PROCESSO' | 'SISTEMA';

export interface NovaNotificacao {
  escritorioId: string;
  usuarioId: string;
  tipo?: TipoNotificacao;
  titulo: string;
  mensagem: string;
  link?: string | null;
  // chave de deduplicacao: se informada e ja existir uma para o usuario, nao recria
  chave?: string | null;
}

// Cria uma notificacao. Se houver `chave`, faz upsert (idempotente) para nao
// duplicar o mesmo alerta a cada rodada do scheduler. Retorna true se criou.
export async function criarNotificacao(n: NovaNotificacao): Promise<boolean> {
  if (n.chave) {
    const existe = await prisma.notificacao.findUnique({
      where: { usuarioId_chave: { usuarioId: n.usuarioId, chave: n.chave } },
    });
    if (existe) return false;
  }
  await prisma.notificacao.create({
    data: {
      escritorioId: n.escritorioId,
      usuarioId: n.usuarioId,
      tipo: (n.tipo ?? 'SISTEMA') as never,
      titulo: n.titulo,
      mensagem: n.mensagem,
      link: n.link ?? null,
      chave: n.chave ?? null,
    },
  });
  return true;
}
