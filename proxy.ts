import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const protectedRoutes = [
  "/dashboard",
  "/projects",
  "/analytics",
  "/settings",
  "/predictions",
  "/schedule",
  "/stadiums",
  "/teams",
  "/leagues",
  "/leaderboard",
  "/rules",
];

const authRoutes = ["/login", "/signup"];

/**
 * Check if user is authenticated by checking both:
 * 1. HTTP-only cookies (preferred method)
 * 2. localStorage auth state (fallback for cookie issues)
 */
function isUserAuthenticated(request: NextRequest): boolean {
  // Primary check: accessToken cookie (HTTP-only from backend)
  const accessTokenCookie = request.cookies.get("accessToken");
  if (accessTokenCookie) {
    return true;
  }

  // Fallback check: Check for auth state in cookie/header that client can set
  // This works because the client can set a non-HTTP-only cookie as a signal
  const authStateCookie = request.cookies.get("porraza-auth-state");
  if (authStateCookie) {
    try {
      const authState = JSON.parse(authStateCookie.value);
      return !!(authState?.state?.userId && authState?.state?.accessToken);
    } catch {
      return false;
    }
  }

  return false;
}

// Crear middleware de i18n
const handleI18nRouting = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // PASO 1: Aplicar routing de i18n primero
  const response = handleI18nRouting(request);

  // PASO 2: Extraer locale de la respuesta de i18n
  // next-intl inyecta el locale en un header
  const locale =
    response.headers.get("x-middleware-request-x-next-intl-locale") ||
    routing.defaultLocale;

  // PASO 3: Normalizar pathname sin el prefijo de locale para comparar rutas
  // Ejemplo: /en/dashboard -> /dashboard
  const pathnameWithoutLocale = pathname.replace(/^\/(en|es)/, "") || "/";

  // PASO 4: Aplicar lógica de autenticación
  const isAuthenticated = isUserAuthenticated(request);

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  const isAuthRoute = authRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  // Redirigir a login si intenta acceder a ruta protegida sin autenticación
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirigir a dashboard si está autenticado e intenta acceder a auth routes
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // Retornar la respuesta de i18n (puede incluir redirects de locale)
  return response;
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto:
     * - api (API routes)
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (favicon)
     * - public (archivos públicos)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
  ],
};
