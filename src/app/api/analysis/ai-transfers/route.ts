import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // Filtro de data
        const dateFilter: Record<string, Date> = {};
        if (startDate) dateFilter.gte = new Date(startDate + "T00:00:00Z");
        if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59Z");

        // Construir WHERE clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            user_name: { in: ['agent-ai', 'Sistema', 'IA'] },
        };

        if (Object.keys(dateFilter).length > 0) {
            where.created_at = dateFilter;
        }

        if (search) {
            where.OR = [
                { reason: { contains: search, mode: "insensitive" } },
                { summary: { contains: search, mode: "insensitive" } },
            ];
        }

        // Buscar dados paginados, total e departamentos para o mapeamento
        const [transfers, total, allDepartments] = await Promise.all([
            prisma.chatTransferLog.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip,
                take: limit,
            }),
            prisma.chatTransferLog.count({ where }),
            prisma.department.findMany({ select: { id: true, name: true } })
        ]);

        const deptMap = Object.fromEntries(allDepartments.map(d => [d.id.toString(), d.name]));

        // Para os indicadores (Top motivos), precisamos buscar todos os logs no período (sem paginação, mas agrupados)
        // Isso pode ser pesado se houver muitos, mas por enquanto fazemos agrupação
        const allTransfersForStats = await prisma.chatTransferLog.findMany({
            where,
            select: { reason: true }
        });

        // Contar frequência de cada motivo exato
        const reasonCounts = allTransfersForStats.reduce((acc: Record<string, number>, log) => {
            const r = log.reason.trim();
            acc[r] = (acc[r] || 0) + 1;
            return acc;
        }, {});

        // Ordenar os motivos decrescente
        const topReasons = Object.entries(reasonCounts)
            .map(([reason, count]) => ({ reason, count, pct: Math.round((count / allTransfersForStats.length) * 100) }))
            .sort((a, b) => b.count - a.count);

        // O Prisma retorna BigInt, precisamos serializar
        const serialized = transfers.map(t => ({
            ...t,
            id: t.id.toString(),
            chat_id: t.chat_id.toString(),
            department_id: t.department_id?.toString() || null,
            external_contact_id: t.external_contact_id?.toString() || null,
            created_at: t.created_at.toISOString(),
            department_name: t.department_id ? (deptMap[t.department_id.toString()] || "Desconhecido") : "Fila Geral"
        }));

        return NextResponse.json({
            transfers: serialized,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            stats: {
                total_period: allTransfersForStats.length,
                top_reasons: topReasons.slice(0, 10), // Mostra o top 10
            }
        });
    } catch (error) {
        console.error("Erro ao buscar logs de transferência da IA:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
