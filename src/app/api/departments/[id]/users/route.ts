import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/departments/[id]/users — Listar atendentes do departamento
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const links = await prisma.userDepartment.findMany({
            where: { department_id: BigInt(id) },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true, active: true },
                },
            },
            orderBy: { created_at: "asc" },
        });

        const users = links.map((link) => ({
            ...link.user,
            id: link.user.id.toString(),
            link_id: link.id.toString(),
        }));

        return NextResponse.json({ users });
    } catch (error) {
        console.error("Erro ao listar atendentes:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// POST /api/departments/[id]/users — Vincular atendente ao departamento
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
        const { user_id } = await request.json();

        if (!user_id) {
            return NextResponse.json({ error: "user_id é obrigatório" }, { status: 400 });
        }

        // Verificar se vínculo já existe
        const existing = await prisma.userDepartment.findFirst({
            where: { user_id: BigInt(user_id), department_id: BigInt(id) },
        });
        if (existing) {
            return NextResponse.json({ error: "Atendente já vinculado a este departamento" }, { status: 409 });
        }

        const link = await prisma.userDepartment.create({
            data: {
                user_id: BigInt(user_id),
                department_id: BigInt(id),
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true, active: true },
                },
            },
        });

        return NextResponse.json({
            user: {
                ...link.user,
                id: link.user.id.toString(),
                link_id: link.id.toString(),
            },
        }, { status: 201 });
    } catch (error) {
        console.error("Erro ao vincular atendente:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// DELETE /api/departments/[id]/users — Desvincular atendente do departamento
// Body: { user_id }
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
        const { user_id } = await request.json();

        if (!user_id) {
            return NextResponse.json({ error: "user_id é obrigatório" }, { status: 400 });
        }

        await prisma.userDepartment.deleteMany({
            where: {
                user_id: BigInt(user_id),
                department_id: BigInt(id),
            },
        });

        return NextResponse.json({ success: true, message: "Atendente desvinculado" });
    } catch (error) {
        console.error("Erro ao desvincular atendente:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
