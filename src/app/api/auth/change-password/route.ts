import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, getAuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    try {
        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: "A nova senha deve ter pelo menos 6 caracteres" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: BigInt(authUser.userId) },
        });

        if (!user) {
            return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
        }

        const validPassword = await verifyPassword(currentPassword, user.password_hash);
        if (!validPassword) {
            return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 });
        }

        const newHash = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password_hash: newHash,
                must_change_password: false,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao trocar senha:", error);
        return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
}
