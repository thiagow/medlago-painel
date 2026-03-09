import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTeamNotification, sendPatientTransferMessage } from "@/lib/evolution-api";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);
        const { reason, summary } = await request.json();

        if (!reason || !summary) {
            return NextResponse.json({ error: "Motivo e resumo são obrigatórios" }, { status: 400 });
        }

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || !chat.phone) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }

        const phone = chat.phone;

        // Obter usuário logado do token via Headers (injetados pelo middleware)
        const userName = request.headers.get("x-user-name") || "Sistema";

        // 1. Gravar Log no Banco de Dados
        await prisma.chatTransferLog.create({
            data: {
                chat_id: chatId,
                user_name: userName,
                reason,
                summary
            }
        });

        // 2. Enviar mensagem de transferência ao paciente via Evolution API
        try {
            await sendPatientTransferMessage(phone);
        } catch (evoErr) {
            console.error("Erro interno ao notificar paciente sobre transferência:", evoErr);
        }

        // 3. Notificar equipe via Evolution API (com credenciais do Bot agora)
        try {
            await sendTeamNotification(phone, summary);
        } catch (evoErr) {
            console.error("Erro ao notificar equipe via Evolution API:", evoErr);
        }

        // 4. Pausar IA
        const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.chat.update({
            where: { id: chatId },
            data: {
                ai_service: "paused",
                updated_at: pauseUntil,
            },
        });

        // 5. Desativar mensagens ativas do telefone
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
