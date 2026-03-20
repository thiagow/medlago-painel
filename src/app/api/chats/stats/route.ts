import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/chats/stats
 *
 * Retorna estatísticas de atendimento por estado, atendente e departamento.
 * Suporta filtros de período: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Resposta:
 * {
 *   by_status: { ai, waiting, human, finished, transferred_external, total },
 *   by_agent: [{ id, name, total, finished, transferred_external }],
 *   by_department: [{ id, name, total }],
 *   period: { start, end }
 * }
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dateValues: any[] = [];
        let dateWhere = "";
        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateValues.push(new Date(startDate), end);
            dateWhere = "AND c.created_at >= $1 AND c.created_at <= $2";
        }

        // ─── Contagem por status ──────────────────────────────────────────
        // Usa o campo 'status' quando preenchido; fallback para ai_service/finished (dados legados)
        const statusQuery = `
            SELECT
                COALESCE(
                    c.status,
                    CASE
                        WHEN c.finished = true AND EXISTS (
                            SELECT 1 FROM chat_transfer_logs ctl
                            WHERE ctl.chat_id = c.id AND ctl.transfer_type = 'external'
                        ) THEN 'transferred_external'
                        WHEN c.finished = true THEN 'finished'
                        WHEN c.ai_service = 'waiting' THEN 'waiting'
                        WHEN c.ai_service = 'paused' AND (c.finished IS NULL OR c.finished = false) THEN 'human'
                        ELSE 'ai'
                    END
                ) AS status,
                COUNT(*)::bigint AS total
            FROM chats c
            WHERE 1=1 ${dateWhere}
            GROUP BY 1
        `;

        // ─── Por atendente ────────────────────────────────────────────────
        const agentQuery = `
            SELECT
                u.id::text AS user_id,
                u.name AS user_name,
                COUNT(DISTINCT c.id)::bigint AS total,
                COUNT(DISTINCT CASE
                    WHEN c.status = 'finished' OR (c.finished = true AND (c.status IS NULL OR c.status != 'transferred_external'))
                    THEN c.id END)::bigint AS finished_count,
                COUNT(DISTINCT CASE WHEN c.status = 'transferred_external' THEN c.id END)::bigint AS transferred_count
            FROM chats c
            INNER JOIN users u ON c.assigned_to = u.id
            WHERE 1=1 ${dateWhere}
            GROUP BY u.id, u.name
            ORDER BY total DESC
        `;

        // ─── Por departamento ─────────────────────────────────────────────
        const deptQuery = `
            SELECT
                d.id::text AS dept_id,
                d.name AS dept_name,
                COUNT(DISTINCT c.id)::bigint AS total
            FROM chats c
            INNER JOIN departments d ON c.department_id = d.id
            WHERE 1=1 ${dateWhere}
            GROUP BY d.id, d.name
            ORDER BY total DESC
        `;

        const [statusCounts, agentStats, deptStats] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma.$queryRawUnsafe<any[]>(statusQuery, ...dateValues),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma.$queryRawUnsafe<any[]>(agentQuery, ...dateValues),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            prisma.$queryRawUnsafe<any[]>(deptQuery, ...dateValues),
        ]);

        // Montar objeto by_status com fallback 0
        const byStatus: Record<string, number> = {
            ai: 0,
            waiting: 0,
            human: 0,
            finished: 0,
            transferred_external: 0,
        };
        let total = 0;
        for (const row of statusCounts) {
            const key = String(row.status);
            const count = Number(row.total);
            if (key in byStatus) byStatus[key] = count;
            total += count;
        }
        byStatus.total = total;

        return NextResponse.json({
            by_status: byStatus,
            by_agent: agentStats.map((r) => ({
                id: String(r.user_id),
                name: r.user_name,
                total: Number(r.total),
                finished: Number(r.finished_count),
                transferred_external: Number(r.transferred_count),
            })),
            by_department: deptStats.map((r) => ({
                id: String(r.dept_id),
                name: r.dept_name,
                total: Number(r.total),
            })),
            period: startDate && endDate ? { start: startDate, end: endDate } : null,
        });
    } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
        return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
}
