import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/departments/:id/agents
 * Retorna os atendentes ativos vinculados a um departamento.
 * Não requer role de admin — atendentes também podem usar essa rota ao transferir.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const deptId = BigInt(id);

        const userDepts = await prisma.userDepartment.findMany({
            where: {
                department_id: deptId,
                user: { active: true },
            },
            select: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                user: { name: "asc" },
            },
        });

        const agents = userDepts.map((ud) => ({
            id: ud.user.id.toString(),
            name: ud.user.name,
        }));

        return NextResponse.json({ agents });
    } catch (error) {
        console.error("Erro ao listar atendentes do departamento:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
