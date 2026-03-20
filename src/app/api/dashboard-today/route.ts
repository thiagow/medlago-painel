import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard-today
 *
 * Retorna métricas do dashboard separando:
 * - Ativos agora (sem filtro de data): ai, waiting, human
 * - Concluídos hoje: finished, transferred_external
 * - Iniciados hoje: total criado no dia
 * - Por atendente (chats ativos ou finalizados hoje)
 * - Por departamento (chats ativos ou finalizados hoje)
 */
export async function GET() {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // ── 1. Estado atual dos chats ativos (Com filtro de data de hoje) ─────────────
        const activeStatusQuery = `
            SELECT
                COALESCE(
                    c.status,
                    CASE
                        WHEN c.ai_service = 'waiting' THEN 'waiting'
                        WHEN c.ai_service = 'paused'  THEN 'human'
                        ELSE 'ai'
                    END
                ) AS status,
                COUNT(*)::int AS total
            FROM chats c
            WHERE (c.finished IS NULL OR c.finished = false)
              AND COALESCE(c.status, '') NOT IN ('finished', 'transferred_external')
              AND ((c.created_at >= $1 AND c.created_at <= $2) OR (c.updated_at >= $1 AND c.updated_at <= $2))
            GROUP BY 1
        `;

        // ── 2. Concluídos HOJE (filtro por updated_at) ────────────────────────
        const finishedTodayQuery = `
            SELECT
                COALESCE(c.status, 'finished') AS status,
                COUNT(*)::int AS total
            FROM chats c
            WHERE c.finished = true
              AND c.updated_at >= $1
              AND c.updated_at <= $2
            GROUP BY 1
        `;

        // ── 3. Total iniciados hoje ───────────────────────────────────────────
        const startedTodayQuery = `
            SELECT COUNT(*)::int AS total
            FROM chats c
            WHERE c.created_at >= $1 AND c.created_at <= $2
        `;

        // ── 4. Por atendente (ativos + finalizados hoje) ──────────────────────
        const agentQuery = `
            SELECT
                u.id::text AS user_id,
                u.name     AS user_name,
                COUNT(DISTINCT c.id)::int AS total,
                COUNT(DISTINCT CASE
                    WHEN c.status = 'finished' OR (c.finished = true AND COALESCE(c.status,'') != 'transferred_external')
                    THEN c.id END)::int AS finished_count,
                COUNT(DISTINCT CASE WHEN c.status = 'transferred_external' THEN c.id END)::int AS transferred_count
            FROM chats c
            INNER JOIN users u ON c.assigned_to = u.id
            WHERE (
                (c.finished IS NULL OR c.finished = false)
                OR (c.finished = true AND c.updated_at >= $1 AND c.updated_at <= $2)
            )
            GROUP BY u.id, u.name
            ORDER BY total DESC
            LIMIT 10
        `;

        // ── 5. Por departamento ───────────────────────────────────────────────
        const deptQuery = `
            SELECT
                d.id::text AS dept_id,
                d.name     AS dept_name,
                COUNT(DISTINCT c.id)::int AS total
            FROM chats c
            INNER JOIN departments d ON c.department_id = d.id
            WHERE (
                (c.finished IS NULL OR c.finished = false)
                OR (c.finished = true AND c.updated_at >= $1 AND c.updated_at <= $2)
            )
            GROUP BY d.id, d.name
            ORDER BY total DESC
            LIMIT 8
        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [activeRows, finishedRows, startedRows, agentRows, deptRows] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(activeStatusQuery, todayStart, todayEnd),
            prisma.$queryRawUnsafe<any[]>(finishedTodayQuery, todayStart, todayEnd),
            prisma.$queryRawUnsafe<any[]>(startedTodayQuery, todayStart, todayEnd),
            prisma.$queryRawUnsafe<any[]>(agentQuery, todayStart, todayEnd),
            prisma.$queryRawUnsafe<any[]>(deptQuery, todayStart, todayEnd),
        ]);

        // Montar by_status
        const byStatus = { ai: 0, waiting: 0, human: 0, finished: 0, transferred_external: 0, total: 0 };

        for (const r of activeRows) {
            const key = String(r.status) as keyof typeof byStatus;
            if (key in byStatus) byStatus[key] += Number(r.total);
        }
        for (const r of finishedRows) {
            const key = String(r.status) as keyof typeof byStatus;
            if (key === "transferred_external") byStatus.transferred_external += Number(r.total);
            else byStatus.finished += Number(r.total);
        }

        const startedToday = Number(startedRows[0]?.total ?? 0);
        byStatus.total = startedToday;

        return NextResponse.json({
            by_status: byStatus,
            started_today: startedToday,
            by_agent: agentRows.map(r => ({
                id: String(r.user_id),
                name: r.user_name,
                total: Number(r.total),
                finished: Number(r.finished_count),
                transferred_external: Number(r.transferred_count),
            })),
            by_department: deptRows.map(r => ({
                id: String(r.dept_id),
                name: r.dept_name,
                total: Number(r.total),
            })),
        });
    } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
