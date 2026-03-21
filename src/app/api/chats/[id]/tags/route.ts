import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/chats/[id]/tags - Listar tags do chat
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const params = await context.params;
        const { id } = params;

        const chatTags = await (prisma as any).chatTag.findMany({
            where: { chat_id: BigInt(id) },
            include: { tag: true },
        });

        return NextResponse.json({
            tags: chatTags.map((ct: any) => ({
                id: ct.tag.id.toString(),
                name: ct.tag.name,
                color: ct.tag.color,
                source: ct.source,
                added_by: ct.added_by?.toString() ?? null,
                chat_tag_id: ct.id.toString(),
            })),
        });
    } catch (error) {
        console.error("[GET /api/chats/[id]/tags]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// POST /api/chats/[id]/tags - Aplicar tag no chat
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        
        const params = await context.params;
        const { id } = params;
        const body = await request.json();
        const { tag_id, source = "manual" } = body;

        if (!tag_id) {
            return NextResponse.json({ error: "tag_id é obrigatório" }, { status: 400 });
        }

        // Verifica existência da tag
        const tag = await (prisma as any).tag.findUnique({
            where: { id: BigInt(tag_id) },
        });

        if (!tag || !tag.active) {
            return NextResponse.json({ error: "Tag não encontrada ou inativa" }, { status: 404 });
        }

        const addedBy = source === "manual" ? BigInt(user.userId) : null;

        try {
            const chatTag = await (prisma as any).chatTag.create({
                data: {
                    chat_id: BigInt(id),
                    tag_id: BigInt(tag_id),
                    added_by: addedBy,
                    source,
                },
                include: { tag: true }
            });

            return NextResponse.json({
                success: true,
                tag: {
                    id: chatTag.tag.id.toString(),
                    name: chatTag.tag.name,
                    color: chatTag.tag.color,
                    source: chatTag.source,
                    added_by: chatTag.added_by?.toString() ?? null,
                    chat_tag_id: chatTag.id.toString(),
                },
            }, { status: 201 });
        } catch (e: any) {
            if (e.code === 'P2002') {
                return NextResponse.json({ error: "Esta tag já está aplicada no chat" }, { status: 400 });
            }
            throw e;
        }
    } catch (error) {
        console.error("[POST /api/chats/[id]/tags]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// DELETE /api/chats/[id]/tags - Remover tag do chat
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const params = await context.params;
        const { id } = params;
        const { searchParams } = new URL(request.url);
        const tag_id = searchParams.get("tag_id");

        if (!tag_id) {
            return NextResponse.json({ error: "tag_id é obrigatório (query param)" }, { status: 400 });
        }

        const chatTag = await (prisma as any).chatTag.findFirst({
            where: {
                chat_id: BigInt(id),
                tag_id: BigInt(tag_id),
            },
        });

        if (!chatTag) {
            return NextResponse.json({ error: "Tag não encontrada neste chat" }, { status: 404 });
        }

        await (prisma as any).chatTag.delete({
            where: { id: chatTag.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[DELETE /api/chats/[id]/tags]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
