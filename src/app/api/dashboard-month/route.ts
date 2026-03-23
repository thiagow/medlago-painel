import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard-month
 *
 * Retorna métricas do dashboard separando:
 * - Ativos agora
 * - Concluídos no mês
 * - Iniciados no mês
 * - Por atendente
 * - Por departamento
 */
export async function GET() {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

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

        // ── 6. Top Tags do Dia ────────────────────────────────────────────────
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

        // ── 7. Total Equipe (Passou por Atendentes) ───────────────────────────
        const teamHandledQuery = `
            SELECT COUNT(*)::int AS total
            FROM chats c
            WHERE (c.assigned_to IS NOT NULL OR c.finished_by IS NOT NULL)
              AND (
                  (c.created_at >= $1 AND c.created_at <= $2)
                  OR (c.updated_at >= $1 AND c.updated_at <= $2)
              )
        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [activeRows, finishedRows, startedRows, agentRows, deptRows, tagRows, teamHandledRows] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(activeStatusQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(finishedTodayQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(startedTodayQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(agentQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(deptQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(tagsQuery, monthStart, monthEnd),
            prisma.$queryRawUnsafe<any[]>(teamHandledQuery, monthStart, monthEnd),
        ]);

        // Montar by_status
        const byStatus = {
            ai: 0,
            waiting: 0,
            human: 0,
            finished: 0,
            team_handled: Number(teamHandledRows?.[0]?.total || 0),
            total: Number(startedRows?.[0]?.total || 0),
        };

        // Preencher active
        if (Array.isArray(activeRows)) {
            for (const r of activeRows) {
                if (r.status === "ai") byStatus.ai = Number(r.total);
                if (r.status === "waiting") byStatus.waiting = Number(r.total);
                if (r.status === "human") byStatus.human = Number(r.total);
            }
        }

        // Preencher finished
        if (Array.isArray(finishedRows)) {
            for (const r of finishedRows) {
                if (r.status === "finished") byStatus.finished += Number(r.total);
            }
        }

        const startedToday = Number(startedRows?.[0]?.total ?? 0);

        return NextResponse.json({
            by_status: byStatus,
            started_today: startedToday,
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
        console.error("Erro ao buscar dados do dashboard:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
