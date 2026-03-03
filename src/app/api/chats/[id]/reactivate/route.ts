import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReactivationMessage } from "@/lib/evolution-api";

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

        // 1. Reativar IA no banco
        await prisma.chat.update({
            where: { id: chatId },
            data: { ai_service: "active" },
        });

        // 2. Reativar mensagens do telefone
        await prisma.chatMessage.updateMany({
            where: { phone },
            data: { active: true },
        });

        // 3. Notificar paciente sobre reativação
        try {
            await sendReactivationMessage(phone);
        } catch (evoErr) {
            console.error("Erro ao notificar paciente sobre reativação:", evoErr);
        }

        return NextResponse.json({
            success: true,
            message: "IA reativada com sucesso",
        });
    } catch (error) {
        console.error("Erro ao reativar IA:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
