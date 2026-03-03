import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// PUT /api/users/[id]  - Editar usuário
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const { name, email, userRole } = await request.json();

        const user = await prisma.user.update({
            where: { id: BigInt(id) },
            data: { name, email, role: userRole },
            select: { id: true, name: true, email: true, role: true, active: true, created_at: true },
        });

        return NextResponse.json({
            user: { ...user, id: user.id.toString(), created_at: user.created_at.toISOString() },
        });
    } catch (error) {
        console.error("Erro ao editar usuário:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// PATCH /api/users/[id] - Ativar/Desativar
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const { active } = await request.json();

        const user = await prisma.user.update({
            where: { id: BigInt(id) },
            data: { active },
            select: { id: true, name: true, email: true, role: true, active: true },
        });

        return NextResponse.json({
            user: { ...user, id: user.id.toString() },
        });
    } catch (error) {
        console.error("Erro ao atualizar status do usuário:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
