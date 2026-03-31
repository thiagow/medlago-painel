import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/broadcasts/[id]/error - Chamado pelo N8N quando o fluxo falha globalmente
// Body: { error: "Mensagem de erro", details: {} }
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const errorMessage = body.error || "Erro desconhecido no fluxo do N8N";

        // 1. Marca todos os destinatários que ainda estão "pending" como "failed"
        await (prisma as any).broadcastRecipient.updateMany({
            where: {
                broadcast_id: BigInt(id),
                status: "pending",
            },
            data: {
                status: "failed",
                error: errorMessage,
            },
        });

        // 2. Recalcula os totais após atualizar
        const sentCount = await (prisma as any).broadcastRecipient.count({
            where: { broadcast_id: BigInt(id), status: "sent" },
        });
        const failedCount = await (prisma as any).broadcastRecipient.count({
            where: { broadcast_id: BigInt(id), status: "failed" },
        });

        // 3. Atualiza o broadcast em si para "failed"
        await (prisma as any).broadcast.update({
            where: { id: BigInt(id) },
            data: {
                status: "failed",
                sent_count: sentCount,
                failed_count: failedCount,
                finished_at: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[POST /api/broadcasts/[id]/error]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
