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

        // Raw query com LEFT JOIN para trazer o nome do atendente que enviou cada mensagem
        const messages: any[] = await prisma.$queryRaw`
            SELECT 
                m.id, m.created_at, m.phone, m.conversation_id,
                m.bot_message, m.user_message, m.media_url, m.media_type, m.media_name,
                m.active, m.sent_by,
                u.name AS sender_name
            FROM chat_messages m
            LEFT JOIN users u ON u.id = m.sent_by
            WHERE m.conversation_id = ${chat.conversation_id}
            ORDER BY m.created_at ASC
        `;

        const serialized = messages.map((msg) => ({
            ...msg,
            id: msg.id.toString(),
            sent_by: msg.sent_by?.toString() || null,
            created_at: msg.created_at ? new Date(msg.created_at).toISOString() : null,
            sender_name: msg.sender_name || null,
        }));

        return NextResponse.json({ messages: serialized });
    } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
