import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });

        if (!chat) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }
        if (!chat.conversation_id) {
            return NextResponse.json({ messages: [] });
        }

        const messages = await prisma.chatMessage.findMany({
            where: { conversation_id: chat.conversation_id },
            orderBy: { created_at: "asc" },
        });

        const serialized = messages.map((msg) => ({
            ...msg,
            id: msg.id.toString(),
            created_at: msg.created_at?.toISOString() || null,
        }));

        return NextResponse.json({ messages: serialized });
    } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
