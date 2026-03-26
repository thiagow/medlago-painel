import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEvolutionMessage } from "@/lib/evolution-api";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);
        const { message } = await request.json();

        // Capturar usuário logado dos headers (setados pelo middleware)
        const userId = request.headers.get("x-user-id");
        const userIdBigInt = userId ? BigInt(userId) : null;

        if (!message?.trim()) {
            return NextResponse.json({ error: "Mensagem não pode ser vazia" }, { status: 400 });
        }

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || !chat.phone) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }

        // Validar que somente o atendente responsável pode enviar mensagem
        if (chat.ai_service === "paused" && chat.assigned_to && userIdBigInt && chat.assigned_to !== userIdBigInt) {
            return NextResponse.json({ error: "Somente o atendente responsável pode interagir com este atendimento." }, { status: 403 });
        }

        const phone = chat.phone;

        // 1. Enviar mensagem via UAZAPI
        try {
            await sendEvolutionMessage({
                domain: process.env.EVO_DOMAIN || "",
                apiKey: process.env.EVO_API_KEY!,
                instance: process.env.EVO_INSTANCE_BOT || "",
                number: phone,
                text: message.trim(),
            });
        } catch (evoErr) {
            console.error("Erro ao enviar via UAZAPI:", evoErr);
        }

        // 2. Pausar IA + atribuir atendente (se identificado)
        const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.chat.update({
            where: { id: chatId },
            data: {
                ai_service: "paused",
                updated_at: pauseUntil,
                ...(userIdBigInt ? {
                    assigned_to: userIdBigInt,
                    assigned_at: new Date(),
                } : {}),
            },
        });

        // 3. Registrar mensagem enviada
        const newMsg = await prisma.chatMessage.create({
            data: {
                phone,
                conversation_id: chat.conversation_id,
                bot_message: message.trim(),
                active: true,
                created_at: new Date(),
                sent_by: userIdBigInt,
            },
        });

        return NextResponse.json({
            success: true,
            message: {
                id: newMsg.id.toString(),
                phone: newMsg.phone,
                conversation_id: newMsg.conversation_id,
                bot_message: newMsg.bot_message,
                user_message: newMsg.user_message,
                media_url: newMsg.media_url ?? null,
                media_type: newMsg.media_type ?? null,
                media_name: newMsg.media_name ?? null,
                active: newMsg.active,
                sent_by: (newMsg as any).sent_by?.toString() ?? null,
                created_at: newMsg.created_at?.toISOString() || null,
            },
        });
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
