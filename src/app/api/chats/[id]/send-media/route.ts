import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMediaMessage } from "@/lib/evolution-api";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);
        const { mediaUrl, mediaType, fileName, caption } = await request.json();

        if (!mediaUrl || !mediaType) {
            return NextResponse.json({ error: "mediaUrl e mediaType são obrigatórios" }, { status: 400 });
        }

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || !chat.phone) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }

        // Extrair ID do Atendente logado para validação e registro
        const userId = request.headers.get("x-user-id");
        const userIdBigInt = userId ? BigInt(userId) : null;

        // Validar que somente o atendente responsável pode enviar mídia
        if (chat.ai_service === "paused" && chat.assigned_to && userIdBigInt && chat.assigned_to !== userIdBigInt) {
            return NextResponse.json({ error: "Somente o atendente responsável pode interagir com este atendimento." }, { status: 403 });
        }

        // 1. Grava no BD — created_at explícito para garantir ordenação cronológica correta
        const now = new Date();
        const chatMsg = await (prisma.chatMessage as any).create({
            data: {
                conversation_id: chat.conversation_id,
                phone: chat.phone,
                bot_message: caption || null,
                media_url: mediaUrl,
                media_type: mediaType,
                media_name: fileName || null,
                created_at: now,
                sent_by: userIdBigInt,
            },
        });

        // 2. Atualiza a conversa: pausa IA e garante atendente vinculado
        const updateData: any = { updated_at: new Date() };
        if (chat.ai_service !== "paused") {
            // 'waiting' e 'active' passam para 'paused' quando atendente envia mensagem
            updateData.ai_service = "paused";
        }
        if (userIdBigInt) {
            updateData.assigned_to = userIdBigInt;
            if (!(chat as any).assigned_at) {
                updateData.assigned_at = new Date();
            }
        }
        await prisma.chat.update({
            where: { id: chatId },
            data: updateData,
        });

        // 3. Envia mídia para o Whatsapp via Uazapi
        const EVO_DOMAIN = process.env.EVO_DOMAIN || "";
        const EVO_API_KEY = process.env.EVO_API_KEY || "";
        const EVO_INSTANCE_BOT = process.env.EVO_INSTANCE_BOT || "";

        let uazapiMessageId: string | null = null;
        try {
            uazapiMessageId = await sendMediaMessage({
                domain: EVO_DOMAIN,
                apiKey: EVO_API_KEY,
                instance: EVO_INSTANCE_BOT,
                number: chat.phone,
                mediaUrl,
                mediaType,
                fileName,
                caption,
            });
        } catch (err: any) {
            console.error("Erro ao enviar mídia UAZAPI:", err);
            // Mesmo se falhar envio na Evolution, retorna 200 pois gravamos a intenção no log,
            // mas avisa o front do erro de disparo
            const serializedMsg = { ...chatMsg, id: chatMsg.id.toString(), created_at: now.toISOString() };
            return NextResponse.json(
                { success: true, message: serializedMsg, warning: "Mídia gravada mas com falha no disparo: " + err.message },
                { status: 200 }
            );
        }

        // Salva o uazapi_message_id para permitir apagar a mensagem futuramente
        if (uazapiMessageId) {
            await prisma.chatMessage.update({
                where: { id: chatMsg.id },
                data: { uazapi_message_id: uazapiMessageId } as any,
            });
        }

        const serializedMsg = { 
            ...chatMsg, 
            id: chatMsg.id.toString(), 
            created_at: now.toISOString(),
            sent_by: chatMsg.sent_by?.toString() || null,
            uazapi_message_id: uazapiMessageId ?? null,
            deleted_at: null,
        };
        return NextResponse.json({
            success: true,
            message: serializedMsg,
        });
    } catch (error: any) {
        console.error("Erro na rota send-media:", error);
        return NextResponse.json({ error: "Erro interno no servidor: " + (error.message || "Erro desconhecido") }, { status: 500 });
    }
}
