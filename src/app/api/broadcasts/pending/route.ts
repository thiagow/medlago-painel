import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/broadcasts/pending - Para o N8N polling (broadcasts agendados vencidos)
export async function GET(request: NextRequest) {
    try {
        const now = new Date();

        const pending = await (prisma as any).broadcast.findMany({
            where: {
                status: "scheduled",
                scheduled_at: { lte: now },
            },
            include: {
                template: true,
                recipients: {
                    where: { status: "pending" },
                    select: { id: true, patient_id: true, phone: true, name: true },
                },
            },
        });

        return NextResponse.json({
            broadcasts: pending.map((b: any) => ({
                broadcast_id: b.id.toString(),
                template: {
                    body: b.template?.body || null,
                    image_url: b.template?.image_url || null,
                    image_caption: b.template?.image_caption || null,
                },
                recipients: b.recipients.map((r: any) => ({
                    patient_id: r.patient_id.toString(),
                    phone: r.phone,
                    name: r.name,
                })),
            })),
        });
    } catch (error) {
        console.error("[GET /api/broadcasts/pending]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
