import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);

        const userId = request.headers.get("x-user-id");
        const userName = request.headers.get("x-user-name") || "Atendente";

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || !chat.phone) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }

        const phone = chat.phone;
        const now = new Date();

        // 1. Marcar atendimento como finalizado com rastreamento completo
        await prisma.chat.update({
            where: { id: chatId },
            data: {
                ai_service: "paused",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                status: "finished" as any,
                finished: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                finished_at: now as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ...(userId ? { finished_by: BigInt(userId) as any } : {}),
                updated_at: now,
            },
        });

        // 2. Gravar log de finalização (quem finalizou + quando)
        await prisma.chatTransferLog.create({
            data: {
                chat_id: chatId,
                user_name: userName,
                reason: "Atendimento finalizado pelo atendente",
                summary: `${userName} finalizou o atendimento`,
                transfer_type: "finish",
            },
        });

        // 3. Desativar mensagens ativas do telefone
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
