import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const tab = searchParams.get("tab") || "ai"; // "ai" | "human" | "waiting"
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const skip = (page - 1) * limit;

        // Identidade do usuário logado
        const currentUserId = request.headers.get("x-user-id");
        const currentUserRole = request.headers.get("x-user-role") || "atendente";

        // Construir cláusulas WHERE dinâmicas
        const conditions: string[] = [];
        const values: (string | number)[] = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`c.phone ILIKE $${paramIndex}`);
            values.push(`%${search}%`);
            paramIndex++;
        }

        // Filtro por aba
        if (tab === "human") {
            conditions.push(`c.ai_service = 'paused'`);
        } else if (tab === "waiting") {
            conditions.push(`c.ai_service = 'waiting'`);
        } else {
            // aba IA: active, NULL ou true (legado)
            conditions.push(`(c.ai_service IS NULL OR c.ai_service = 'active' OR c.ai_service = 'true')`);
        }

        // Sempre excluir transferidos e finalizados (pelo novo campo e também pro histórico 'ai_service')
        conditions.push(`(c.finished IS NULL OR c.finished = false)`);
        conditions.push(`(c.ai_service IS NULL OR c.ai_service NOT IN ('transferred', 'finished'))`);

        // Filtro de visibilidade por departamento (apenas atendentes, nas abas human e waiting)
        if (currentUserRole === "atendente" && currentUserId && (tab === "human" || tab === "waiting")) {
            values.push(currentUserId);
            conditions.push(`(
                c.assigned_to = $${paramIndex}::bigint
                OR (
                    c.assigned_to IS NULL
                    AND (
                        c.department_id IS NULL 
                        OR c.department_id IN (
                            SELECT ud.department_id FROM user_departments ud WHERE ud.user_id = $${paramIndex}::bigint
                        )
                    )
                )
            )`);
            paramIndex++;
        }

        const whereClause = `WHERE ${conditions.join(" AND ")}`;

        const chatsQuery = `
            SELECT c.*,
                   MAX(m.created_at) AS last_message_at,
                   u.name AS assigned_user_name,
                   d.name AS department_name,
                   (
                       SELECT json_agg(json_build_object('id', t.id::text, 'name', t.name, 'color', t.color))
                       FROM "chat_tags" ct
                       JOIN "tags" t ON ct.tag_id = t.id
                       WHERE ct.chat_id = c.id
                   ) as tags
            FROM chats c
            LEFT JOIN chat_messages m ON c.conversation_id = m.conversation_id
            LEFT JOIN users u ON c.assigned_to = u.id
            LEFT JOIN departments d ON c.department_id = d.id
            ${whereClause}
            GROUP BY c.id, u.name, d.name
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
            assigned_to: chat.assigned_to?.toString() ?? null,
            department_id: chat.department_id?.toString() ?? null,
            created_at: chat.created_at?.toISOString?.() ?? (chat.created_at ? new Date(chat.created_at).toISOString() : null),
            updated_at: chat.updated_at?.toISOString?.() ?? (chat.updated_at ? new Date(chat.updated_at).toISOString() : null),
            last_message_at: chat.last_message_at?.toISOString?.() ?? (chat.last_message_at ? new Date(chat.last_message_at).toISOString() : null),
            tags: chat.tags || [],
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
