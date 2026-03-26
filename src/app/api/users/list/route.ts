import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        // Retorna apenas ID e Nome de usuários ativos para popular filtros
        // Sem restrição de admin para permitir uso no dashboard por atendentes
        const users = await prisma.user.findMany({
            where: {
                active: true,
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { name: "asc" },
        });

        const serialized = users.map((u) => ({
            id: u.id.toString(),
            name: u.name,
        }));

        return NextResponse.json({ users: serialized });
    } catch (error) {
        console.error("Erro ao listar usuários para filtro:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
