import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const skip = (page - 1) * limit;

        // Construir cláusulas WHERE dinâmicas
        const conditions: string[] = [];
        const values: (string | number)[] = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`c.phone ILIKE $${paramIndex}`);
            values.push(`%${search}%`);
            paramIndex++;
        }

        if (status && (status === "active" || status === "paused")) {
            conditions.push(`c.ai_service = $${paramIndex}`);
            values.push(status);
            paramIndex++;
        }

        // Sempre excluir transferidos e finalizados da tela de conversas
        conditions.push(`(c.ai_service IS NULL OR c.ai_service NOT IN ('transferred', 'finished'))`);

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        // Query principal com LEFT JOIN para obter a data da última mensagem
        const chatsQuery = `
            SELECT c.*, MAX(m.created_at) AS last_message_at
            FROM chats c
            LEFT JOIN chat_messages m ON c.phone = m.phone
            ${whereClause}
            GROUP BY c.id
            ORDER BY COALESCE(MAX(m.created_at), c.updated_at) DESC NULLS LAST
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        // Query de contagem
        const countQuery = `
            SELECT COUNT(DISTINCT c.id)::int AS total
            FROM chats c
            ${whereClause}
        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [chats, countResult] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(chatsQuery, ...values, limit, skip),
            prisma.$queryRawUnsafe<any[]>(countQuery, ...values),
        ]);

        const total = countResult[0]?.total ?? 0;

        // Serializar BigInt e datas
        const serialized = chats.map((chat) => ({
            ...chat,
            id: chat.id.toString(),
            created_at: chat.created_at?.toISOString?.() ?? (chat.created_at ? new Date(chat.created_at).toISOString() : null),
            updated_at: chat.updated_at?.toISOString?.() ?? (chat.updated_at ? new Date(chat.updated_at).toISOString() : null),
            last_message_at: chat.last_message_at?.toISOString?.() ?? (chat.last_message_at ? new Date(chat.last_message_at).toISOString() : null),
        }));

        return NextResponse.json({
            chats: serialized,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("Erro ao listar chats:", error);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
