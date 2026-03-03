import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";

// Rotas que não precisam de auth
const PUBLIC_ROUTES = ["/login", "/api/auth/login", "/api/auth/refresh"];

// Rotas que precisam de role admin
const ADMIN_ROUTES = ["/dashboard/users", "/api/users"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Permitir rotas públicas
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Verificar token nas rotas protegidas
    const token = request.cookies.get("access_token")?.value;

    if (!token) {
        // Redirecionar para login em rotas de página
        if (!pathname.startsWith("/api/")) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
        // Retornar 401 para rotas de API
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
        if (!pathname.startsWith("/api/")) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
        return NextResponse.json(
            { error: "Token inválido ou expirado" },
            { status: 401 }
        );
    }

    // Verificar permissão de admin
    if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
        if (payload.role !== "admin") {
            if (!pathname.startsWith("/api/")) {
                return NextResponse.redirect(
                    new URL("/dashboard/conversations", request.url)
                );
            }
            return NextResponse.json(
                { error: "Acesso negado. Perfil insuficiente." },
                { status: 403 }
            );
        }
    }

    // Adicionar dados do usuário aos headers para as rotas de API
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-email", payload.email);
    requestHeaders.set("x-user-role", payload.role);
    requestHeaders.set("x-user-name", payload.name);

    return NextResponse.next({
        request: { headers: requestHeaders },
    });
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/api/((?!auth/login|auth/refresh|_next).*)",
    ],
};
