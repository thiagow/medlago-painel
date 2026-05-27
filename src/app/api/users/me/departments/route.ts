import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/me/departments
 *
 * Retorna os departamentos ativos vinculados ao usuário autenticado,
 * usado pelo frontend para saber se precisa abrir o modal de escolha
 * de departamento ao assumir um chat.
 */
export async function GET(req: NextRequest) {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const rows = await prisma.userDepartment.findMany({
            where: { user_id: BigInt(userId) },
            include: { department: { select: { id: true, name: true, active: true } } },
            orderBy: { created_at: "asc" },
        });

        return NextResponse.json({
            departments: rows
                .filter(r => r.department.active)
                .map(r => ({ id: String(r.department.id), name: r.department.name })),
        });
    } catch (error) {
        console.error("Erro ao buscar departamentos do usuário:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
