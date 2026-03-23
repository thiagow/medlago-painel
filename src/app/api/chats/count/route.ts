import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const currentUserId = request.headers.get("x-user-id");
        const currentUserRole = request.headers.get("x-user-role") || "atendente";

        let query: string;
        const params: (string | number)[] = [];

        if (currentUserRole === "admin" || !currentUserId) {
            // Admin vê tudo
            query = `
                SELECT COUNT(DISTINCT c.id)::int AS waiting
                FROM chats c
                WHERE c.ai_service = 'waiting'
                  AND (c.finished IS NULL OR c.finished = false)
                  AND c.ai_service NOT IN ('transferred', 'finished')
            `;
        } else {
            // Atendente vê apenas chats do seu departamento ou atribuídos a si
            params.push(currentUserId);
            query = `
                SELECT COUNT(DISTINCT c.id)::int AS waiting
                FROM chats c
                WHERE c.ai_service = 'waiting'
                  AND (c.finished IS NULL OR c.finished = false)
                  AND c.ai_service NOT IN ('transferred', 'finished')
                  AND (
                      c.assigned_to = $1::bigint
                      OR (
                          c.assigned_to IS NULL
                          AND (
                              c.department_id IS NULL
                              OR c.department_id IN (
                                  SELECT ud.department_id FROM user_departments ud WHERE ud.user_id = $1::bigint
                              )
                          )
                      )
                  )
            `;
        }

        const result = await prisma.$queryRawUnsafe<{ waiting: number }[]>(query, ...params);
        const waiting = result[0]?.waiting ?? 0;

        return NextResponse.json({ waiting });
    } catch (error) {
        console.error("Erro ao contar chats em espera:", error);
        return NextResponse.json({ waiting: 0 }, { status: 500 });
    }
}
