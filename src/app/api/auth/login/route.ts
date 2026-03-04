import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateAccessToken, generateRefreshToken } from "@/lib/auth";

// Rate limiting simples em memória
const loginAttempts: Map<string, { count: number; resetAt: number }> = new Map();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = loginAttempts.get(ip);

    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
        return true;
    }

    if (entry.count >= 5) {
        return false;
    }

    entry.count += 1;
    return true;
}

export async function POST(request: NextRequest) {
    const ip =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown";

    // Rate limiting
    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { error: "Muitas tentativas de login. Tente novamente em 1 minuto." },
            { status: 429 }
        );
    }

    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email ou senha incorretos" },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!user || !user.active) {
            return NextResponse.json(
                { error: "Email ou senha incorretos" },
                { status: 401 }
            );
        }

        const validPassword = await verifyPassword(password, user.password_hash);
        if (!validPassword) {
            return NextResponse.json(
                { error: "Email ou senha incorretos" },
                { status: 401 }
            );
        }

        const payload = {
            userId: user.id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
        };

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        const response = NextResponse.json({
            user: {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                must_change_password: user.must_change_password,
            },
        });

        // Definir cookies HTTP-only
        response.cookies.set("access_token", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 8 * 60 * 60, // 8 horas
        });

        response.cookies.set("refresh_token", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60, // 7 dias
        });

        return response;
    } catch (error) {
        console.error("Erro no login:", error);
        return NextResponse.json(
            {
                error: "Erro interno do servidor",
                details: error instanceof Error ? error.message : String(error),
                dbUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@') : 'no_db_url_found'
            },
            { status: 500 }
        );
    }
}
