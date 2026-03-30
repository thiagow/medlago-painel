import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: NextRequest,
) {
    try {
        // Verificar autenticação e permissão através dos headers do middleware
        const currentUserRole = request.headers.get("x-user-role")?.toLowerCase();
        
        if (currentUserRole !== "admin") {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "15");
        const skip = (page - 1) * limit;

        // Buscar logs com paginação (cast as any para lidar com atraso de tipagem no dev server)
        const [logs, total] = await Promise.all([
            (prisma as any).chatMessageDeleteLog.findMany({
                orderBy: {
                    created_at: "desc",
                },
                skip,
                take: limit,
            }),
            (prisma as any).chatMessageDeleteLog.count(),
        ]);

        return NextResponse.json({
            success: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            logs: logs.map((log: any) => ({
                ...log,
                id: log.id.toString(),
                message_id: log.message_id.toString(),
                chat_id: log.chat_id.toString(),
                deleted_by: log.deleted_by?.toString() || null,
                created_at: log.created_at.toISOString(),
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Erro ao buscar logs de exclusão:", error);
        return NextResponse.json(
            { error: "Erro interno no servidor." },
            { status: 500 }
        );
    }
}
