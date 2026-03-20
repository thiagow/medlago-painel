import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/broadcasts/[id]/complete - Chamado pelo N8N ao finalizar disparo
// Body: { sent_count, failed_count, recipients: [{ phone, status, error? }] }
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { sent_count = 0, failed_count = 0, recipients = [] } = body;

        // Atualiza status dos recipients individuais
        for (const r of recipients) {
            await (prisma as any).broadcastRecipient.updateMany({
                where: {
                    broadcast_id: BigInt(id),
                    phone: r.phone,
                },
                data: {
                    status: r.status, // "sent" | "failed"
                    error: r.error || null,
                    sent_at: r.status === "sent" ? new Date() : null,
                },
            });
        }

        // Atualiza contadores do broadcast
        await (prisma as any).broadcast.update({
            where: { id: BigInt(id) },
            data: {
                status: "completed",
                sent_count,
                failed_count,
                finished_at: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[POST /api/broadcasts/[id]/complete]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
