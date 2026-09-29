import Link from "next/link";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { estadoConexao } from "@/lib/evolution";
import { linkProduto } from "@/lib/disparos";
import { montarMensagem } from "@/lib/mensagem";
import { brl } from "@/lib/format";
import { BotaoSincronizar, CancelarProduto, ControlesFila, ToggleGrupo } from "./Controles";
import { FormDisparoConfig } from "./FormDisparoConfig";
import { exigirAdmin } from "@/lib/auth";

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const CONEXAO: Record<string, [string, string]> = {
  demo: ["Modo demonstração", "Sem WhatsApp conectado: os envios são simulados e os grupos são de teste."],
  open: ["WhatsApp conectado", "Pronto para disparar."],
  connecting: ["Conectando…", "Aguardando o WhatsApp parear."],
  close: ["WhatsApp desconectado", "Leia o QR Code no painel da Evolution para reconectar."],
  erro: ["Sem resposta da Evolution", "Confira EVOLUTION_URL / chave / instância no servidor."],
};

function janelas() {
  const hoje = new Date(Date.now() - 3 * 3600_000); // meia-noite em Brasília
  hoje.setUTCHours(3, 0, 0, 0);
  return { seteDias: new Date(Date.now() - 7 * 86400_000), hoje };
}

export default async function Disparos() {
  await exigirAdmin();
  const { seteDias, hoje } = janelas();

  const [cfg, conexao, grupos, pendentes, filaPorProduto, recentes, enviadosHoje, falhas, cliques, vendas, ultimo] = await Promise.all([
    getConfig(),
    estadoConexao(),
    db.grupo.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    db.disparo.count({ where: { status: "PENDENTE" } }),
    db.disparo.groupBy({ by: ["produtoId"], where: { status: "PENDENTE" }, _count: true }),
    db.disparo.findMany({
      where: { status: { in: ["ENVIADO", "FALHOU", "CANCELADO"] } },
      orderBy: [{ enviadoEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
      take: 25,
      include: { grupo: { select: { nome: true } }, produto: { select: { titulo: true } } },
    }),
    db.disparo.count({ where: { status: "ENVIADO", enviadoEm: { gte: hoje } } }),
    db.disparo.count({ where: { status: "FALHOU", criadoEm: { gte: seteDias } } }),
    db.clique.groupBy({ by: ["grupoId"], where: { criadoEm: { gte: seteDias } }, _count: true }),
    db.pedido.groupBy({
      by: ["origemGrupo"],
      where: { origemGrupo: { not: null }, status: { in: ["PAGO", "SEPARANDO", "PRONTO", "RETIRADO"] }, pagoEm: { gte: seteDias } },
      _count: true,
      _sum: { totalCents: true },
    }),
    db.produto.findFirst({ where: { status: "ATIVO" }, orderBy: { publicadoEm: "desc" } }),
  ]);
  const produtosFila = await db.produto.findMany({ where: { id: { in: filaPorProduto.map((f) => f.produtoId) } }, select: { id: true, titulo: true } });
  const proximo = (await db.config.findUnique({ where: { chave: "disparo_proximo" } }))?.valor;
  const enviadosPorGrupo = await db.disparo.groupBy({ by: ["grupoId"], where: { status: "ENVIADO", enviadoEm: { gte: seteDias } }, _count: true });

  const ativo = cfg.disparo_ativo === "1";
  const [titConexao, subConexao] = CONEXAO[conexao];
  const ativos = grupos.filter((g) => g.ativo);
  const previa = ultimo ? montarMensagem(ultimo, linkProduto(ultimo.slug, ativos[0]?.numero), "NOVO", "previa") : null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-center text-2xl font-extrabold md:text-left">Disparos no WhatsApp</h1>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border filete bg-white p-5 text-center">
          <p className={`inline-flex items-center gap-2 text-sm font-bold ${conexao === "open" ? "text-jade" : conexao === "demo" ? "text-ouro-escuro" : "text-rubi"}`}>
            <span className={`h-2 w-2 rounded-full ${conexao === "open" ? "bg-jade" : conexao === "demo" ? "bg-ouro" : "bg-rubi"}`} />
            {titConexao}
          </p>
          <p className="mt-1 text-xs text-cinza">{subConexao}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["Na fila", pendentes],
              ["Enviados hoje", enviadosHoje],
              ["Falhas (7d)", falhas],
            ].map(([r, v]) => (
              <div key={r as string} className="rounded-xl bg-grafite p-3">
                <p className="text-2xl font-extrabold">{v}</p>
                <p className="text-[10px] uppercase tracking-wider text-cinza">{r}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-cinza">
            {!ativo
              ? "Fila pausada."
              : pendentes
                ? `Próximo envio ${proximo && new Date(proximo) > new Date() ? `por volta de ${fmt(new Date(proximo))}` : "em instantes"} · horário ${cfg.disparo_hora_inicio}h–${cfg.disparo_hora_fim}h`
                : "Fila vazia."}
          </p>
          <ControlesFila ativo={ativo} pendentes={pendentes} />
        </section>

        <section className="rounded-2xl border filete bg-white p-5">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-cinza">Prévia da mensagem</p>
          {previa ? (
            <div className="mx-auto mt-3 max-w-sm rounded-2xl rounded-tl-sm bg-[#d9fdd3] p-3 text-[13px] leading-relaxed text-[#111b21] shadow">
              <p className="whitespace-pre-line">{previa.replace(/\*(.+?)\*/g, "$1").replace(/~(.+?)~/g, "$1")}</p>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-cinza">Cadastre um produto para ver a prévia.</p>
          )}
          <p className="mt-3 text-center text-[11px] text-cinza">
            Cada grupo recebe uma variação diferente de abertura e chamada — o WhatsApp restringe números que mandam textos idênticos em série.
          </p>
        </section>
      </div>

      {filaPorProduto.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-bold">Na fila agora</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {filaPorProduto.map((f) => (
              <li key={f.produtoId} className="flex items-center justify-between gap-3 rounded-xl border filete bg-white px-3 py-2 text-sm">
                <span className="line-clamp-1">{produtosFila.find((p) => p.id === f.produtoId)?.titulo}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-ouro-escuro">{f._count} grupo(s)</span>
                  <CancelarProduto produtoId={f.produtoId} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold">Grupos <span className="text-sm font-normal text-cinza">({ativos.length} ativo(s) de {grupos.length})</span></h2>
          <BotaoSincronizar />
        </div>
        {grupos.length === 0 ? (
          <p className="rounded-2xl border filete p-6 text-center text-sm text-cinza">Nenhum grupo ainda. Clique em “Buscar grupos do WhatsApp”.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {grupos.map((g) => {
              const env = enviadosPorGrupo.find((e) => e.grupoId === g.id)?._count ?? 0;
              const cli = cliques.find((c) => c.grupoId === g.id)?._count ?? 0;
              const ven = vendas.find((v) => v.origemGrupo === String(g.numero));
              return (
                <li key={g.id} className="flex items-center gap-3 rounded-xl border filete bg-white px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold">{g.nome}</p>
                    <p className="text-[11px] text-cinza">
                      {g.participantes ? `${g.participantes} membros · ` : ""}7 dias: {env} envios · {cli} cliques · {ven?._count ?? 0} vendas{ven?._sum.totalCents ? ` (${brl(ven._sum.totalCents)})` : ""}
                    </p>
                  </div>
                  <ToggleGrupo id={g.id} ativo={g.ativo} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-bold">Últimos envios</h2>
        {recentes.length === 0 ? (
          <p className="rounded-2xl border filete p-6 text-center text-sm text-cinza">Nada enviado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {recentes.map((d) => (
              <li key={d.id} className="rounded-xl border filete bg-white px-3 py-2 text-sm">
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="line-clamp-1">{d.produto.titulo}</span>
                      <span className="text-[11px] text-cinza">{d.grupo.nome} · {d.tipo === "PROMOCAO" ? "promoção" : d.tipo === "REENVIO" ? "reenvio" : "novo"}</span>
                    </span>
                    <span className={`shrink-0 text-[11px] font-bold ${d.status === "ENVIADO" ? "text-jade" : d.status === "FALHOU" ? "text-rubi" : "text-cinza"}`}>
                      {d.status === "ENVIADO" ? (d.enviadoEm ? fmt(d.enviadoEm) : "enviado") : d.status.toLowerCase()}
                    </span>
                  </summary>
                  {d.erro && <p className="mt-2 text-xs text-cinza">{d.erro}</p>}
                  {d.texto && <p className="mt-2 whitespace-pre-line rounded-lg bg-grafite p-2 text-xs text-marfim/80">{d.texto}</p>}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-center font-bold">Ritmo de envio (proteção contra bloqueio)</h2>
        <FormDisparoConfig cfg={cfg} />
      </section>

      <p className="mt-6 text-center text-xs text-cinza">
        <Link href="/painel/produtos" className="underline underline-offset-4">Para disparar um produto, abra-o em Produtos e marque “Avisar nos grupos”.</Link>
      </p>
    </div>
  );
}
