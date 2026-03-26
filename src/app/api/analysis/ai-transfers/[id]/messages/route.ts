import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const transferLogId = BigInt(id);

        // Buscar o log para obter o chat_id
        const transferLog = await prisma.chatTransferLog.findUnique({
            where: { id: transferLogId },
            select: { chat_id: true }
        });

        if (!transferLog) {
            return NextResponse.json({ error: "Log de transferência não encontrado" }, { status: 404 });
        }

        // Buscar o chat para obter o conversation_id
        const chat = await prisma.chat.findUnique({
            where: { id: transferLog.chat_id },
            select: { conversation_id: true }
        });

        if (!chat || !chat.conversation_id) {
            return NextResponse.json({ error: "Conversa não possui ID de conversação (ou não encontrada)" }, { status: 404 });
        }

        // Buscar todas as mensagens daquela conversation_id
        const messages = await prisma.chatMessage.findMany({
            where: { conversation_id: chat.conversation_id },
            orderBy: { created_at: "asc" }, // Para ficar em ordem cronológica de leitura
        });

        // Serializar BigInts e Datas
        const serialized = messages.map(m => ({
            ...m,
            id: m.id.toString(),
            created_at: m.created_at?.toISOString() || null,
        }));

        return NextResponse.json({ messages: serialized });
    } catch (error) {
        console.error("Erro ao buscar mensagens do chat transferido:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
