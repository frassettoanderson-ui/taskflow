import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'restaurante_token';

/**
 * Porteiro do lado das telas: quem não tem cookie de login nem chega a ver
 * o Painel — é redirecionado para /login.
 *
 * A checagem "de verdade" continua sendo no backend; isto aqui é só para não
 * mostrar tela quebrada ao visitante.
 */
export function middleware(request: NextRequest) {
  const logado = Boolean(request.cookies.get(AUTH_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  const precisaLogin =
    pathname.startsWith('/painel') ||
    pathname.startsWith('/kds') ||
    pathname.startsWith('/pedidos') ||
    pathname.startsWith('/salao') ||
    pathname.startsWith('/clientes') ||
    pathname.startsWith('/marketing') ||
    pathname.startsWith('/relatorios') ||
    pathname.startsWith('/estoque') ||
    pathname.startsWith('/financeiro') ||
    pathname.startsWith('/entregadores') ||
    pathname.startsWith('/admin');

  if (!logado && precisaLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (logado && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/painel';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/painel/:path*',
    '/kds/:path*',
    '/pedidos/:path*',
    '/salao/:path*',
    '/clientes/:path*',
    '/marketing/:path*',
    '/relatorios/:path*',
    '/estoque/:path*',
    '/financeiro/:path*',
    '/entregadores/:path*',
    '/admin/:path*',
    '/login',
  ],
};
