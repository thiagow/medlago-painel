import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);
        const { message } = await request.json();

        if (!message?.trim()) {
            return NextResponse.json({ error: "Mensagem não pode ser vazia" }, { status: 400 });
        }

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || !chat.phone) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }

        const phone = chat.phone;

        // 1. Enviar mensagem via Evolution API (instância bot)
        try {
            const EVO_DOMAIN = process.env.EVO_DOMAIN!.replace(/\/+$/, '');
            const EVO_API_KEY = process.env.EVO_API_KEY!;
            const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || "medlago_producao";
            const cleanPhone = phone.split('@')[0];

            await fetch(`${EVO_DOMAIN}/message/sendText/${EVO_INSTANCE_BOT}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: EVO_API_KEY,
                },
                body: JSON.stringify({ number: cleanPhone, text: message.trim() }),
            });
        } catch (evoErr) {
            console.error("Erro ao enviar via Evolution API:", evoErr);
        }

        // 2. Pausar IA: ai_service = 'paused', updated_at = NOW() + 24h
        const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.chat.update({
            where: { id: chatId },
            data: {
                ai_service: "paused",
                updated_at: pauseUntil,
            },
        });

        // 3. Registrar mensagem enviada na tabela chat_messages
        const newMsg = await prisma.chatMessage.create({
            data: {
                phone,
                conversation_id: chat.conversation_id,
                bot_message: message.trim(),
                active: false,
                created_at: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            message: {
                ...newMsg,
                id: newMsg.id.toString(),
                created_at: newMsg.created_at?.toISOString() || null,
            },
        });
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
