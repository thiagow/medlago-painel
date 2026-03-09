import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, generateAccessToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
        return NextResponse.json({ error: "Refresh token não encontrado" }, { status: 401 });
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
        return NextResponse.json({ error: "Refresh token inválido ou expirado" }, { status: 401 });
    }

    const newAccessToken = await generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        name: payload.name,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("access_token", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60,
    });

    return response;
}
