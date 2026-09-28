export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { expirarPedidos } = await import("./lib/pedidos");
  const { processarFila } = await import("./lib/disparos");
  // varre reservas vencidas a cada 30s (além da varredura preguiçosa nas páginas)
  setInterval(() => expirarPedidos(true).catch((e) => console.error("[expirar]", e)), 30_000);
  // fila de disparo nos grupos: tenta 1 envio a cada 10s (os intervalos reais são controlados pela fila)
  setInterval(() => processarFila().catch((e) => console.error("[disparos]", e)), 10_000);
}
