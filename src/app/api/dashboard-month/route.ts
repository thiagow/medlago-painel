import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard-month
 * GET /api/dashboard-month?month=YYYY-MM
 *
 * Modelo único: universo = chats com `created_at` no mês selecionado.
 * Sem snapshots de fila (estado real-time não faz sentido para mês).
 */
export async function GET(req: NextRequest) {
    try {
        const now = new Date();

        const monthParam = req.nextUrl.searchParams.get("month");
        let year = now.getFullYear();
        let month = now.getMonth(); // 0-indexed

        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            const [y, m] = monthParam.split("-").map(Number);
            if (y >= 2020 && m >= 1 && m <= 12) {
                year = y;
                month = m - 1;
            }
        }

        const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
        const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const periodCountsQuery = `
            SELECT
                COUNT(*)::int AS started,
                COUNT(CASE WHEN c.assigned_to IS NULL
                            AND COALESCE(c.ai_service, '') <> 'waiting'
                          THEN 1 END)::int AS served_by_ai_only,
                COUNT(CASE WHEN c.ai_service = 'waiting'
                          THEN 1 END)::int AS waiting_in_period,
                COUNT(CASE WHEN c.assigned_to IS NOT NULL
                            AND COALESCE(c.ai_service, '') <> 'waiting'
                          THEN 1 END)::int AS transferred_to_team,
                COUNT(CASE WHEN c.finished = true THEN 1 END)::int AS finished
            FROM chats c
            WHERE c.created_at >= $1 AND c.created_at <= $2
        `;

        const waitingNowQuery = `
            SELECT COUNT(*)::int AS total
            FROM chats c
            WHERE (c.finished IS NULL OR c.finished = false)
              AND c.ai_service = 'waiting'
        `;

        const withTeamNowQuery = `
            SELECT COUNT(*)::int AS total
            FROM chats c
            WHERE (c.finished IS NULL OR c.finished = false)
              AND (c.status = 'human' OR c.ai_service = 'paused')
        `;

        const aiActiveNowQuery = `
            SELECT COUNT(*)::int AS total
            FROM chats c
            WHERE (c.finished IS NULL OR c.finished = false)
              AND (c.ai_service IS NULL OR c.ai_service IN ('active', 'true'))
        `;

        const agentQuery = `
            SELECT
                u.id::text AS user_id,
                u.name     AS user_name,
                COUNT(DISTINCT c.id)::int AS total,
                COUNT(DISTINCT CASE WHEN c.finished = true THEN c.id END)::int AS finished_count,
                COUNT(DISTINCT CASE WHEN c.status = 'transferred_external' THEN c.id END)::int AS transferred_count
            FROM chats c
            INNER JOIN users u ON c.assigned_to = u.id
            WHERE c.created_at >= $1 AND c.created_at <= $2
            GROUP BY u.id, u.name
            ORDER BY total DESC
            LIMIT 10
        `;

        const deptQuery = `
            SELECT
                d.id::text AS dept_id,
                d.name     AS dept_name,
                COUNT(DISTINCT c.id)::int AS total
            FROM chats c
            INNER JOIN departments d ON c.department_id = d.id
            WHERE c.created_at >= $1 AND c.created_at <= $2
            GROUP BY d.id, d.name
            ORDER BY total DESC
            LIMIT 8
        `;

        const tagsQuery = `
            SELECT
                t.id::text AS tag_id,
                t.name     AS tag_name,
                t.color    AS tag_color,
                COUNT(ct.id)::int AS total
            FROM "chat_tags" ct
            INNER JOIN "tags" t ON ct.tag_id = t.id
            WHERE ct.created_at >= $1 AND ct.created_at <= $2
            GROUP BY t.id, t.name, t.color
            ORDER BY total DESC
            LIMIT 5
        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [periodRows, waitingRows, withTeamRows, aiActiveRows, agentRows, deptRows, tagRows] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(periodCountsQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(waitingNowQuery),
            prisma.$queryRawUnsafe<any[]>(withTeamNowQuery),
            prisma.$queryRawUnsafe<any[]>(aiActiveNowQuery),
            prisma.$queryRawUnsafe<any[]>(agentQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(deptQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(tagsQuery, monthStart, monthEnd),
        ]);

        const p = periodRows?.[0] ?? {};
        const started = Number(p.started || 0);
        const served_by_ai_only = Number(p.served_by_ai_only || 0);
        const waiting_in_period = Number(p.waiting_in_period || 0);
        const transferred_to_team = Number(p.transferred_to_team || 0);
        const finished = Number(p.finished || 0);

        return NextResponse.json({
            by_status: {
                started,
                served_by_ai_only,
                waiting_in_period,
                transferred_to_team,
                finished,
                waiting_now: Number(waitingRows?.[0]?.total || 0),
                with_team_now: Number(withTeamRows?.[0]?.total || 0),
                ai_active_now: Number(aiActiveRows?.[0]?.total || 0),
            },
            by_agent: Array.isArray(agentRows) ? agentRows.map(r => ({
                id: String(r.user_id),
                name: r.user_name,
                total: Number(r.total),
                finished: Number(r.finished_count),
                transferred_external: Number(r.transferred_count),
            })) : [],
            by_department: Array.isArray(deptRows) ? deptRows.map(r => ({
                id: String(r.dept_id),
                name: r.dept_name,
                total: Number(r.total),
            })) : [],
            by_tag: Array.isArray(tagRows) ? tagRows.map(r => ({
                id: String(r.tag_id),
                name: r.tag_name,
                color: r.tag_color,
                total: Number(r.total),
            })) : [],
        });
    } catch (error) {
        console.error("Erro ao buscar dados do dashboard mensal:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
