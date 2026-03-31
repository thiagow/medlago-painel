import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/broadcasts - Lista broadcasts
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        const where: any = {};
        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                where.created_at.gte = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                where.created_at.lte = e;
            }
        }

        const broadcasts = await (prisma as any).broadcast.findMany({
            where,
            orderBy: { created_at: "desc" },
            take: 100, // Aumentado para 100 já que tem filtro
            include: { template: { select: { id: true, name: true } } },
        });

        return NextResponse.json({
            broadcasts: broadcasts.map((b: any) => ({
                ...b,
                id: b.id.toString(),
                template_id: b.template_id.toString(),
                created_by: b.created_by?.toString() ?? null,
                created_at: b.created_at?.toISOString(),
                scheduled_at: b.scheduled_at?.toISOString() ?? null,
                started_at: b.started_at?.toISOString() ?? null,
                finished_at: b.finished_at?.toISOString() ?? null,
                template: b.template ? { ...b.template, id: b.template.id.toString() } : null,
            })),
        });
    } catch (error) {
        console.error("[GET /api/broadcasts]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// POST /api/broadcasts - Cria novo broadcast (imediato ou agendado)
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (user.role !== "admin") return NextResponse.json({ error: "Apenas admins podem criar disparos" }, { status: 403 });

        const body = await request.json();
        const { template_id, patient_ids, scheduled_at } = body;

        if (!template_id) return NextResponse.json({ error: "template_id é obrigatório" }, { status: 400 });
        if (!patient_ids?.length) return NextResponse.json({ error: "Selecione ao menos um paciente" }, { status: 400 });

        // Busca template
        const template = await (prisma as any).messageTemplate.findUnique({
            where: { id: BigInt(template_id), active: true },
        });
        if (!template) return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });

        // Busca dados dos pacientes selecionados
        const patients = await (prisma as any).paciente.findMany({
            where: { id: { in: patient_ids.map((id: string) => BigInt(id)) } },
            select: { id: true, nome: true, telefone_principal: true },
        });

        const validPatients = patients.filter((p: any) => p.telefone_principal);
        if (!validPatients.length) {
            return NextResponse.json({ error: "Nenhum paciente selecionado possui telefone cadastrado" }, { status: 400 });
        }

        const isScheduled = !!scheduled_at;

        // Cria broadcast + recipients em transação
        const broadcast = await (prisma as any).broadcast.create({
            data: {
                template_id: BigInt(template_id),
                status: isScheduled ? "scheduled" : "processing",
                scheduled_at: isScheduled ? new Date(scheduled_at) : null,
                total_recipients: validPatients.length,
                created_by: BigInt(user.userId),
                recipients: {
                    create: validPatients.map((p: any) => ({
                        patient_id: p.id,
                        phone: p.telefone_principal,
                        name: p.nome || null,
                        status: "pending",
                    })),
                },
            },
        });

        const broadcastId = broadcast.id.toString();

        // Disparo imediato: chama webhook N8N
        if (!isScheduled) {
            const N8N_BROADCAST_WEBHOOK = process.env.N8N_BROADCAST_WEBHOOK;
            if (N8N_BROADCAST_WEBHOOK) {
                try {
                    const response = await fetch(N8N_BROADCAST_WEBHOOK, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            broadcast_id: broadcastId,
                            template: {
                                body: template.body || null,
                                image_url: template.image_url || null,
                                image_caption: template.image_caption || null,
                            },
                            recipients: validPatients.map((p: any) => ({
                                patient_id: p.id.toString(),
                                phone: p.telefone_principal,
                                name: p.nome || null,
                            })),
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`Webhook respondeu com status ${response.status}`);
                    }
                } catch (webhookErr) {
                    console.error("[Broadcast] Erro ao chamar webhook N8N:", webhookErr);
                    // Marca o disparo e os destinatários como falha
                    await (prisma as any).broadcast.update({
                        where: { id: broadcast.id },
                        data: { 
                            status: "failed",
                            failed_count: validPatients.length,
                            finished_at: new Date(),
                            recipients: {
                                updateMany: {
                                    where: { status: "pending" },
                                    data: { status: "failed", error: "Erro na comunicação com o N8N" }
                                }
                            }
                        },
                    });
                }
            }
        }

        return NextResponse.json({ success: true, broadcast_id: broadcastId }, { status: 201 });
    } catch (error) {
        console.error("[POST /api/broadcasts]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
