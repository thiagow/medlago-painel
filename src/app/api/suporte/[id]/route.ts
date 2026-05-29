import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STATUSES_VALIDOS = ["aberto", "em_andamento", "finalizado", "cancelado"];

// ── GET /api/suporte/[id] ─────────────────────────────────────────────────────
// Detalhe do ticket com anexos (proxy URLs) e respostas.
// Permissão: admin vê qualquer ticket; atendente vê apenas os próprios.

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId   = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id } = await params;

    try {
        const ticketId = BigInt(id);
        const ticket = await prisma.suporteTicket.findUnique({ where: { id: ticketId } });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!ticket || (ticket as any).deleted_at) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

        // RBAC: atendente só acessa seus próprios tickets
        if (userRole !== "admin" && String(ticket.created_by) !== userId) {
            return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
        }

        // Buscar dados relacionados em paralelo
        const [anexos, respostas, creator, resolver] = await Promise.all([
            prisma.suporteTicketAnexo.findMany({
                where:   { ticket_id: ticketId },
                orderBy: { created_at: "asc" },
            }),
            prisma.suporteTicketResposta.findMany({
                where:   { ticket_id: ticketId },
                orderBy: { created_at: "asc" },
            }),
            prisma.user.findUnique({
                where:  { id: ticket.created_by },
                select: { id: true, name: true },
            }),
            ticket.resolved_by
                ? prisma.user.findUnique({
                    where:  { id: ticket.resolved_by },
                    select: { id: true, name: true },
                })
                : null,
        ]);

        // Buscar autores das respostas
        const authorIds = [...new Set(respostas.map(r => r.created_by))];
        const authors = authorIds.length > 0
            ? await prisma.user.findMany({
                where:  { id: { in: authorIds } },
                select: { id: true, name: true },
            })
            : [];
        const authorMap = new Map(authors.map(u => [String(u.id), u.name]));

        return NextResponse.json({
            success: true,
            data: {
                id:            String(ticket.id),
                ticket_number: ticket.ticket_number,
                titulo:        ticket.titulo,
                descricao:     ticket.descricao,
                tipo:          ticket.tipo,
                prioridade:    ticket.prioridade,
                status:        ticket.status,
                video_url:     ticket.video_url ?? null,
                created_at:    ticket.created_at.toISOString(),
                updated_at:    ticket.updated_at.toISOString(),
                resolved_at:   ticket.resolved_at?.toISOString() ?? null,
                created_by:    String(ticket.created_by),
                creator_name:  creator?.name ?? "—",
                resolved_by:   ticket.resolved_by ? String(ticket.resolved_by) : null,
                resolver_name: resolver?.name ?? null,

                anexos: anexos.map(a => ({
                    id:        String(a.id),
                    file_name: a.file_name,
                    file_size: a.file_size,
                    mime_type: a.mime_type,
                    proxy_url: `/api/media/proxy?url=${encodeURIComponent(a.r2_key)}`,
                    created_at: a.created_at.toISOString(),
                })),

                respostas: respostas.map(r => ({
                    id:           String(r.id),
                    mensagem:     r.mensagem,
                    is_admin:     r.is_admin,
                    created_by:   String(r.created_by),
                    author_name:  authorMap.get(String(r.created_by)) ?? "—",
                    created_at:   r.created_at.toISOString(),
                })),
            },
        });
    } catch (error) {
        console.error("Erro ao buscar ticket:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// ── DELETE /api/suporte/[id] ─────────────────────────────────────────────────
// Exclusão lógica (soft delete). Apenas admin.

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId   = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");
    if (!userId)            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (userRole !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { id } = await params;

    try {
        const ticketId = BigInt(id);
        const ticket = await prisma.suporteTicket.findUnique({ where: { id: ticketId } });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!ticket || (ticket as any).deleted_at) {
            return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
        }

        await (prisma.suporteTicket as any).update({
            where: { id: ticketId },
            data: {
                deleted_at: new Date(),
                deleted_by: BigInt(userId),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao excluir ticket:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// ── PATCH /api/suporte/[id] ───────────────────────────────────────────────────
// Atualiza o status do ticket. Apenas admin.

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId   = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (userRole !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { id } = await params;

    try {
        const { status } = await req.json();

        if (!status || !STATUSES_VALIDOS.includes(status)) {
            return NextResponse.json({
                error: `Status inválido. Permitidos: ${STATUSES_VALIDOS.join(", ")}`,
            }, { status: 400 });
        }

        const ticketId = BigInt(id);
        const existing = await prisma.suporteTicket.findUnique({ where: { id: ticketId } });
        if (!existing) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

        // Impede reabrir ticket cancelado/finalizado para status inválido
        // (permite qualquer transição pelo admin)

        const updateData: {
            status: string;
            resolved_by?: bigint;
            resolved_at?: Date;
        } = { status };

        if (status === "finalizado") {
            updateData.resolved_by = BigInt(userId);
            updateData.resolved_at = new Date();
        }

        const updated = await prisma.suporteTicket.update({
            where: { id: ticketId },
            data:  updateData,
        });

        return NextResponse.json({
            success: true,
            data: {
                id:           String(updated.id),
                ticket_number: updated.ticket_number,
                status:       updated.status,
                resolved_at:  updated.resolved_at?.toISOString() ?? null,
                resolved_by:  updated.resolved_by ? String(updated.resolved_by) : null,
                updated_at:   updated.updated_at.toISOString(),
            },
        });
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
