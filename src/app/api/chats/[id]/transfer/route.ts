import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    sendPatientTransferMessage,
    sendTeamNotification,
} from "@/lib/evolution-api";

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

        // 1. Enviar mensagem de transferência ao paciente via Evolution API
        try {
            await sendPatientTransferMessage(phone);
        } catch (evoErr) {
            console.error("Erro ao notificar paciente via Evolution API:", evoErr);
        }

        // 2. Notificar equipe via Evolution API
        try {
            await sendTeamNotification(phone);
        } catch (evoErr) {
            console.error("Erro ao notificar equipe via Evolution API:", evoErr);
        }

        // 3. Pausar IA: ai_service = 'paused', updated_at = NOW() + 24h
        const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.chat.update({
            where: { id: chatId },
            data: {
                ai_service: "paused",
                updated_at: pauseUntil,
            },
        });

        // 4. Desativar mensagens ativas do telefone
        await prisma.chatMessage.updateMany({
            where: { phone },
            data: { active: false },
        });

        return NextResponse.json({
            success: true,
            message: "Conversa transferida com sucesso",
        });
    } catch (error) {
        console.error("Erro ao transferir conversa:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
