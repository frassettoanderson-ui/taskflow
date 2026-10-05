import { NextResponse, type NextRequest } from "next/server";

/** cadastro.<domínio> abre direto o cadastro rápido (o resto do site continua no domínio principal). */
export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (!host.startsWith("cadastro.")) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/recebimento") || pathname.startsWith("/api/")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/recebimento${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|icone|manifest).*)"],
};
