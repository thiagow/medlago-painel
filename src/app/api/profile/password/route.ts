import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, verifyPassword, hashPassword } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: "Senhas n\u00e3o fornecidas." }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
        }

        // Get Auth User utilizing standard library
        const authUser = await getAuthUser(request);
        if (!authUser || !authUser.userId) {
            return NextResponse.json({ error: "N\u00e3o autorizado." }, { status: 401 });
        }

        const userId = authUser.userId;
        
        // Find User
        const user = await prisma.user.findUnique({
            where: { id: BigInt(userId) }
        });

        if (!user) {
            return NextResponse.json({ error: "Usu\u00e1rio não encontrado." }, { status: 404 });
        }

        // Validate Current Password
        const isValid = await verifyPassword(currentPassword, user.password_hash);
        if (!isValid) {
            return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 400 });
        }

        // Hash New Password
        const newPasswordHash = await hashPassword(newPassword);

        // Update User
        await prisma.user.update({
            where: { id: BigInt(userId) },
            data: { password_hash: newPasswordHash }
        });

        return NextResponse.json({ success: true, message: "Senha atualizada com sucesso!" });
    } catch (error) {
        console.error("Erro ao alterar senha:", error);
        return NextResponse.json({ error: "Sua o\u00f3rden\u00e7\u00e3o de autoriza\u00e7\u00e3o expirou. Faça login novamente para trocar a senha." }, { status: 401 });
    }
}
