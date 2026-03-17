import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const result = await prisma.$queryRawUnsafe<{ waiting: number }[]>(`
            SELECT COUNT(DISTINCT c.id)::int AS waiting
            FROM chats c
            WHERE c.ai_service = 'waiting'
              AND (c.finished IS NULL OR c.finished = false)
              AND c.ai_service NOT IN ('transferred', 'finished')
        `);

        const waiting = result[0]?.waiting ?? 0;

        return NextResponse.json({ waiting });
    } catch (error) {
        console.error("Erro ao contar chats em espera:", error);
        return NextResponse.json({ waiting: 0 }, { status: 500 });
    }
}
