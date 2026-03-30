import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteUazapiMessage } from "@/lib/evolution-api";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; messageId: string }> }
) {
    try {
        const { id, messageId } = await params;
        const chatId = BigInt(id);
        const msgId = BigInt(messageId);

        // Capturar usuário logado dos headers (setados pelo middleware)
        const userId = request.headers.get("x-user-id");
        const userName = request.headers.get("x-user-name") || "Desconhecido";
        const userRole = request.headers.get("x-user-role") || "";

        if (!userId) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const userIdBigInt = BigInt(userId);

        // 1. Verificar permissão: somente admin ou atendente podem apagar mensagens
        if (userRole !== "admin" && userRole !== "atendente") {
            return NextResponse.json(
                { error: "Sem permissão para apagar mensagens" },
                { status: 403 }
            );
        }

        // 2. Buscar a mensagem no banco
        const message = await (prisma.chatMessage as any).findUnique({
            where: { id: msgId },
        });

        if (!message) {
            return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
        }

        // 3. Validar que a mensagem pertence ao chat correto
        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || message.conversation_id !== chat.conversation_id) {
            return NextResponse.json({ error: "Mensagem não pertence a este chat" }, { status: 403 });
        }

        // 4. Somente mensagens enviadas por humanos podem ser apagadas (sent_by != null)
        if (!message.sent_by) {
            return NextResponse.json(
                { error: "Somente mensagens enviadas por atendentes podem ser apagadas" },
                { status: 403 }
            );
        }

        // 5. Não apagar mensagem já excluída
        if (message.deleted_at) {
            return NextResponse.json({ error: "Mensagem já foi apagada" }, { status: 409 });
        }

        const deletedAt = new Date();

        // 6. Chamar UAZAPI para apagar a mensagem no WhatsApp (para todos)
        if (message.uazapi_message_id) {
            try {
                await deleteUazapiMessage(message.uazapi_message_id);
            } catch (uazApiErr: any) {
                // Log do erro, mas continua com soft delete local
                // (mensagem pode ter expirado ou já não existir no WhatsApp)
                console.error("[DeleteMessage] Erro UAZAPI (continuando soft delete):", uazApiErr.message);
            }
        } else {
            console.warn(`[DeleteMessage] Mensagem ${msgId} sem uazapi_message_id — pulando chamada UAZAPI.`);
        }

        // 7. Soft delete no banco: marca deleted_at e deleted_by
        await (prisma.chatMessage as any).update({
            where: { id: msgId },
            data: {
                deleted_at: deletedAt,
                deleted_by: userIdBigInt,
            },
        });

        // 8. Registrar log de auditoria
        const originalContent = message.bot_message || message.user_message || null;
        
        // Contorno para erro de "permission denied for sequence": gerando ID único baseado no timestamp
        const generatedId = BigInt(Date.now()) * BigInt(100) + BigInt(Math.floor(Math.random() * 100));

        await (prisma as any).chatMessageDeleteLog.create({
            data: {
                id: generatedId,
                message_id: msgId,
                chat_id: chatId,
                conversation_id: chat.conversation_id,
                deleted_by: userIdBigInt,
                user_name: userName,
                original_content: originalContent,
                media_type: message.media_type || null,
            },
        });

        return NextResponse.json({
            success: true,
            deleted_at: deletedAt.toISOString(),
        });
    } catch (error: any) {
        console.error("[DeleteMessage] Erro interno:", error);
        return NextResponse.json(
            { error: "Erro interno no servidor: " + (error.message || "Erro desconhecido") },
            { status: 500 }
        );
    }
}
