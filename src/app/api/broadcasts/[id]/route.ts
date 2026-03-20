import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/broadcasts/[id] - Detalhes de um broadcast
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { id } = await params;

        const broadcast = await (prisma as any).broadcast.findUnique({
            where: { id: BigInt(id) },
            include: {
                template: true,
                recipients: { orderBy: { id: "asc" } },
            },
        });

        if (!broadcast) return NextResponse.json({ error: "Broadcast não encontrado" }, { status: 404 });

        return NextResponse.json({
            broadcast: {
                ...broadcast,
                id: broadcast.id.toString(),
                template_id: broadcast.template_id.toString(),
                created_by: broadcast.created_by?.toString() ?? null,
                created_at: broadcast.created_at?.toISOString(),
                scheduled_at: broadcast.scheduled_at?.toISOString() ?? null,
                started_at: broadcast.started_at?.toISOString() ?? null,
                finished_at: broadcast.finished_at?.toISOString() ?? null,
                template: broadcast.template ? {
                    ...broadcast.template,
                    id: broadcast.template.id.toString(),
                    created_by: broadcast.template.created_by?.toString() ?? null,
                    created_at: broadcast.template.created_at?.toISOString(),
                    updated_at: broadcast.template.updated_at?.toISOString(),
                } : null,
                recipients: broadcast.recipients.map((r: any) => ({
                    ...r,
                    id: r.id.toString(),
                    broadcast_id: r.broadcast_id.toString(),
                    patient_id: r.patient_id.toString(),
                    sent_at: r.sent_at?.toISOString() ?? null,
                })),
            },
        });
    } catch (error) {
        console.error("[GET /api/broadcasts/[id]]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// DELETE /api/broadcasts/[id] - Cancela broadcast agendado
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (user.role !== "admin") return NextResponse.json({ error: "Apenas admins" }, { status: 403 });

        const { id } = await params;

        const broadcast = await (prisma as any).broadcast.findUnique({
            where: { id: BigInt(id) },
        });

        if (!broadcast) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
        if (broadcast.status !== "scheduled") {
            return NextResponse.json({ error: "Apenas disparos agendados podem ser cancelados" }, { status: 400 });
        }

        await (prisma as any).broadcast.update({
            where: { id: BigInt(id) },
            data: { status: "cancelled" },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[DELETE /api/broadcasts/[id]]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
