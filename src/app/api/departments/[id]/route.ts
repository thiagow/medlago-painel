import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/departments/[id] — Atualizar departamento
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
        const { name, description } = await request.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
        }

        // Verificar duplicata excluindo o próprio ID
        const existing = await (prisma.department as any).findFirst({
            where: { name: name.trim(), id: { not: BigInt(id) } },
        });
        if (existing) {
            return NextResponse.json({ error: "Já existe um departamento com esse nome" }, { status: 409 });
        }

        const dept = await (prisma.department as any).update({
            where: { id: BigInt(id) },
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                updated_at: new Date(),
            },
        });

        return NextResponse.json({
            department: {
                ...dept,
                id: dept.id.toString(),
                created_at: dept.created_at?.toISOString() || null,
                updated_at: dept.updated_at?.toISOString() || null,
            },
        });
    } catch (error) {
        console.error("Erro ao atualizar departamento:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// DELETE /api/departments/[id] — Desativar (soft delete)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { id } = await params;

        await (prisma.department as any).update({
            where: { id: BigInt(id) },
            data: { active: false, updated_at: new Date() },
        });

        return NextResponse.json({ success: true, message: "Departamento desativado" });
    } catch (error) {
        console.error("Erro ao desativar departamento:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
