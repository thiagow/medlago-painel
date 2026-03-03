import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { id } = await params;

        // Gerar senha temporária aleatória
        const tempPassword = Math.random().toString(36).slice(-8) + "Med@1";
        const hash = await hashPassword(tempPassword);

        await prisma.user.update({
            where: { id: BigInt(id) },
            data: { password_hash: hash, must_change_password: true },
        });

        return NextResponse.json({ tempPassword });
    } catch (error) {
        console.error("Erro ao resetar senha:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
