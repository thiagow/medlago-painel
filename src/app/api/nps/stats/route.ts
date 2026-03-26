import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/nps/stats
 * Retorna indicadores agregados do NPS pós-atendimento.
 * Suporta filtros: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate   = searchParams.get("endDate");

        const dateFilter: Record<string, Date> = {};
        if (startDate) dateFilter.gte = new Date(startDate + "T00:00:00Z");
        if (endDate)   dateFilter.lte = new Date(endDate   + "T23:59:59Z");

        const where = {
            status: { in: ["rated", "completed"] },
            ...(Object.keys(dateFilter).length ? { created_at: dateFilter } : {}),
        };

        const [responses, total] = await Promise.all([
            prisma.npsResponse.findMany({
                where,
                orderBy: { created_at: "desc" },
                take: 100,
                select: {
                    id: true,
                    phone: true,
                    agent_name: true,
                    rating: true,
                    nps_score: true,
                    comment: true,
                    status: true,
                    created_at: true,
                },
            }),
            prisma.npsResponse.count({ where }),
        ]);

        const bad     = responses.filter((r: { rating: string | null }) => r.rating === "bad").length;
        const neutral = responses.filter((r: { rating: string | null }) => r.rating === "neutral").length;
        const good    = responses.filter((r: { rating: string | null }) => r.rating === "good").length;

        // NPS Score = (% promotores - % detratores) × 100
        const npsScore = total > 0
            ? Math.round(((good - bad) / total) * 100)
            : null;

        const serialized = responses.map((r: { id: bigint; created_at: Date; [key: string]: unknown }) => ({
            ...r,
            id: r.id.toString(),
            created_at: r.created_at.toISOString(),
        }));

        return NextResponse.json({
            total,
            nps_score: npsScore,
            distribution: {
                bad:     { count: bad,     pct: total ? Math.round((bad    / total) * 100) : 0 },
                neutral: { count: neutral, pct: total ? Math.round((neutral / total) * 100) : 0 },
                good:    { count: good,    pct: total ? Math.round((good   / total) * 100) : 0 },
            },
            responses: serialized,
        });
    } catch (error) {
        console.error("Erro ao buscar NPS stats:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
