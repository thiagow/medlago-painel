import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || !chat.phone) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }

        const phone = chat.phone;

        // 1. Marcar atendimento como finalizado
        await prisma.chat.update({
            where: { id: chatId },
            data: {
                ai_service: "paused",
                finished: true,
                updated_at: new Date(),
            },
        });

        // 2. Desativar mensagens ativas do telefone
        await prisma.chatMessage.updateMany({
            where: { phone },
            data: { active: false },
        });

        return NextResponse.json({
            success: true,
            message: "Atendimento finalizado com sucesso",
        });
    } catch (error) {
        console.error("Erro ao finalizar atendimento:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
