export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { expirarPedidos } = await import("./lib/pedidos");
  // varre reservas vencidas a cada 30s (além da varredura preguiçosa nas páginas)
  setInterval(() => expirarPedidos(true).catch((e) => console.error("[expirar]", e)), 30_000);
}
