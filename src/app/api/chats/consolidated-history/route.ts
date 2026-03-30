import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * GET /api/chats/consolidated-history?phone=5511999998888&page=1&limit=50
 * Retorna o histórico consolidado de mensagens de TODOS os chats de um telefone,
 * agrupadas por atendimento, ordenadas cronologicamente.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const phone = searchParams.get("phone");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = Math.min(parseInt(searchParams.get("limit") || "60"), 200);
        const skip = (page - 1) * limit;

        if (!phone) {
            return NextResponse.json({ error: "Parâmetro 'phone' é obrigatório" }, { status: 400 });
        }

        // Normaliza o telefone
        const normalizedPhone = phone.replace(/\D/g, "");

        // Busca com variações de número (com/sem DDI 55)
        const phoneVariants = [
            normalizedPhone,
            normalizedPhone.replace(/^55/, ""),
            `55${normalizedPhone}`,
        ];

        // Busca todos os chats deste telefone (incluindo finalizados)
        const chats = await prisma.$queryRawUnsafe<{ id: bigint; conversation_id: string; created_at: Date; ai_service: string | null; status: string | null }[]>(`
            SELECT id, conversation_id, created_at, ai_service, status
            FROM chats
            WHERE (regexp_replace(phone, '\\D', '', 'g') = ANY($1::text[]) 
               OR phone = ANY($1::text[]))
              AND conversation_id IS NOT NULL
            ORDER BY created_at ASC
        `, phoneVariants);

        if (chats.length === 0) {
            return NextResponse.json({ messages: [], total: 0, page, limit, totalPages: 0, chatsCount: 0 });
        }

        const conversationIds = chats.map(c => c.conversation_id).filter(Boolean);

        // Conta total de mensagens para paginação
        const countResult = await prisma.$queryRawUnsafe<{ total: bigint }[]>(`
            SELECT COUNT(*)::bigint AS total
            FROM chat_messages m
            WHERE (m.conversation_id = ANY($1::text[]) OR regexp_replace(m.phone, '\\D', '', 'g') = ANY($2::text[]))
        `, conversationIds, phoneVariants);

        const total = Number(countResult[0]?.total ?? 0);

        // Busca as mensagens com JOIN no usuário e informações do chat
        const messages = await prisma.$queryRawUnsafe<any[]>(`
            SELECT
                m.id,
                m.created_at,
                m.phone,
                m.conversation_id,
                m.bot_message,
                m.user_message,
                m.media_url,
                m.media_type,
                m.media_name,
                m.active,
                m.sent_by,
                m.deleted_at,
                m.deleted_by,
                u.name AS sender_name,
                l.user_name AS deleted_by_name,
                c.id AS chat_id,
                c.created_at AS chat_created_at,
                c.ai_service AS chat_status
            FROM chat_messages m
            LEFT JOIN users u ON u.id = m.sent_by
            LEFT JOIN chat_message_delete_logs l ON l.message_id = m.id
            LEFT JOIN chats c ON c.conversation_id = m.conversation_id
            WHERE (m.conversation_id = ANY($1::text[]) OR regexp_replace(m.phone, '\\D', '', 'g') = ANY($4::text[]))
            ORDER BY m.created_at ASC
            LIMIT $2 OFFSET $3
        `, conversationIds, limit, skip, phoneVariants);

        const serialized = messages.map(msg => {
            // Determinar o tipo de remente (contact, bot, user)
            let sender_type = "contact";
            if (msg.bot_message && !msg.sent_by) {
                sender_type = "bot";
            } else if (msg.sent_by) {
                sender_type = "user";
            } else if (msg.bot_message && msg.user_message) {
                 // Fallback se houver ambos
                 sender_type = msg.sent_by ? "user" : "bot";
            } else if (!msg.bot_message && !msg.user_message && msg.media_url) {
                 // Envio de mídia, se tem sent_by é user, alertar para fallback
                 sender_type = msg.sent_by ? "user" : "contact";
            }

            // Determinar tipo de mensagem (text, image, audio, video, document)
            let message_type = "text";
            if (msg.media_url) {
                message_type = msg.media_type || "document";
                // Limpeza básica se for image/jpeg vira image
                if (message_type.startsWith("image/")) message_type = "image";
                else if (message_type.startsWith("audio/")) message_type = "audio";
                else if (message_type.startsWith("video/")) message_type = "video";
            }

            return {
                ...msg,
                id: msg.id?.toString(),
                conversation_id: msg.conversation_id || null,
                chat_id: msg.chat_id?.toString() ?? null,
                sent_by: msg.sent_by?.toString() ?? null,
                deleted_by: msg.deleted_by?.toString() ?? null,
                created_at: msg.created_at ? new Date(msg.created_at).toISOString() : null,
                deleted_at: msg.deleted_at ? new Date(msg.deleted_at).toISOString() : null,
                chat_created_at: msg.chat_created_at ? new Date(msg.chat_created_at).toISOString() : null,
                sender_name: msg.sender_name ?? null,
                deleted_by_name: msg.deleted_by_name ?? null,
                sender_type,
                message_type
            };
        });

        return NextResponse.json({
            messages: serialized,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            chatsCount: chats.length,
        });
    } catch (error) {
        console.error("[consolidated-history] Erro:", error);
        return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
}
