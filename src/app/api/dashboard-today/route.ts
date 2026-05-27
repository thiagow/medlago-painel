import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard-today
 *
 * Modelo único: universo = chats com `created_at` no período selecionado.
 *
 * Retorna:
 * - started:             total iniciados pela IA (created_at no período)
 * - resolved_by_ai:      finalizados sem passar por atendente
 * - transferred_to_team: com atendente atribuído (assigned_to NOT NULL)
 * - finished:            total finalizados
 * - waiting_now:         snapshot — chats aguardando agora (sem filtro de data)
 * - with_team_now:       snapshot — chats sendo atendidos agora (sem filtro de data)
 * - donut.{resolved_by_ai, attended_by_team, open_with_ai}: 3 fatias mutuamente exclusivas
 *   cuja soma = started.
 * - by_agent / by_department: chats iniciados no período E atribuídos ao atendente/depto.
 * - by_tag: tags aplicadas no período.
 */
export async function GET() {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // ── Contagens sobre chats iniciados no período + Donut em uma única query ──
        const periodCountsQuery = `
            SELECT
                COUNT(*)::int AS started,
                COUNT(CASE WHEN c.assigned_to IS NULL
                            AND NOT (c.status = 'waiting' OR c.ai_service = 'waiting')
                          THEN 1 END)::int AS served_by_ai_only,
                COUNT(CASE WHEN c.assigned_to IS NULL
                            AND (c.status = 'waiting' OR c.ai_service = 'waiting')
                          THEN 1 END)::int AS waiting_in_period,
                COUNT(CASE WHEN c.assigned_to IS NOT NULL THEN 1 END)::int AS transferred_to_team,
                COUNT(CASE WHEN c.finished = true THEN 1 END)::int AS finished
            FROM chats c
            WHERE c.created_at >= $1 AND c.created_at <= $2
        `;

        // ── Snapshots (sem filtro de data) ────────────────────────────────────
        const waitingNowQuery = `
            SELECT COUNT(*)::int AS total
            FROM chats c
            WHERE (c.finished IS NULL OR c.finished = false)
              AND (c.status = 'waiting' OR c.ai_service = 'waiting')
        `;

        const withTeamNowQuery = `
            SELECT COUNT(*)::int AS total
            FROM chats c
            WHERE (c.finished IS NULL OR c.finished = false)
              AND (c.status = 'human' OR c.ai_service = 'paused')
        `;

        // ── Por atendente — chats iniciados no período E atribuídos ao atendente ──
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

        // ── Por departamento — chats iniciados no período E com departamento ──
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

        // ── Top tags do período ───────────────────────────────────────────────
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
        const [periodRows, waitingRows, withTeamRows, agentRows, deptRows, tagRows] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(periodCountsQuery, todayStart, todayEnd),
            prisma.$queryRawUnsafe<any[]>(waitingNowQuery),
            prisma.$queryRawUnsafe<any[]>(withTeamNowQuery),
            prisma.$queryRawUnsafe<any[]>(agentQuery, todayStart, todayEnd),
            prisma.$queryRawUnsafe<any[]>(deptQuery, todayStart, todayEnd),
            prisma.$queryRawUnsafe<any[]>(tagsQuery, todayStart, todayEnd),
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
        console.error("Erro ao buscar dados do dashboard hoje:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
