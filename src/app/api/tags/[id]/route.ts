import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// PUT /api/tags/[id] - Editar tag (admin)
export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (user.role !== "admin") return NextResponse.json({ error: "Apenas admins podem editar tags" }, { status: 403 });

        const params = await context.params;
        const { id } = params;
        const body = await request.json();
        const { name, color } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: "Nome da tag é obrigatório" }, { status: 400 });
        }

        // Verifica existêcia
        const existing = await (prisma as any).tag.findUnique({
            where: { id: BigInt(id) },
        });

        if (!existing || !existing.active) {
            return NextResponse.json({ error: "Tag não encontrada ou inativa" }, { status: 404 });
        }

        try {
            const tag = await (prisma as any).tag.update({
                where: { id: BigInt(id) },
                data: {
                    name: name.trim(),
                    color: color?.trim() || existing.color,
                },
            });

            return NextResponse.json({
                success: true,
                tag: {
                    ...tag,
                    id: tag.id.toString(),
                    created_at: tag.created_at?.toISOString(),
                },
            });
        } catch (e: any) {
            if (e.code === 'P2002') {
                return NextResponse.json({ error: "Já existe outra tag com este nome" }, { status: 400 });
            }
            throw e;
        }
    } catch (error) {
        console.error("[PUT /api/tags/[id]]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// DELETE /api/tags/[id] - Desativar tag (admin)
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (user.role !== "admin") return NextResponse.json({ error: "Apenas admins podem deletar tags" }, { status: 403 });

        const params = await context.params;
        const { id } = params;

        const tag = await (prisma as any).tag.update({
            where: { id: BigInt(id) },
            data: {
                active: false,
                // Opcional: Para evitar problemas com a constraint UNIQUE name se o usuário quiser recriar a mesma tag,
                // poderíamos renomear o name da tag para "nome_deleted_timestamp".
                // name: `deleted_${Date.now()}_${existing.name}` mas pra simplificar vamos apenas inativar.
            },
        });

        // Opcional: Desvincular de chats ativos? Geralmente não é necessário.

        return NextResponse.json({
            success: true,
            tag: {
                ...tag,
                id: tag.id.toString(),
            },
        });
    } catch (error) {
        console.error("[DELETE /api/tags/[id]]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
