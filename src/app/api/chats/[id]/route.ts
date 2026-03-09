import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chat = await prisma.chat.findUnique({
            where: { id: BigInt(id) }
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat não encontrado" }, { status: 404 });
        }

        const serialized = {
            ...chat,
            id: chat.id.toString(),
            created_at: chat.created_at?.toISOString() || null,
            updated_at: chat.updated_at?.toISOString() || null,
        };

        return NextResponse.json({ chat: serialized });
    } catch (error) {
        console.error("Erro ao buscar chat único:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
