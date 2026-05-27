import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── POST /api/suporte/[id]/resposta ───────────────────────────────────────────
// Adiciona uma resposta ao ticket. Apenas admin.

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId   = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");
    const userName = req.headers.get("x-user-name") ?? "Suporte";

    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (userRole !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { id } = await params;

    try {
        const { mensagem } = await req.json();

        if (!mensagem || String(mensagem).trim().length < 2) {
            return NextResponse.json({ error: "Mensagem muito curta" }, { status: 400 });
        }

        const ticketId = BigInt(id);
        const ticket = await prisma.suporteTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

        const resposta = await prisma.suporteTicketResposta.create({
            data: {
                ticket_id:  ticketId,
                mensagem:   String(mensagem).trim(),
                created_by: BigInt(userId),
                is_admin:   true,
            },
        });

        // Se o ticket ainda está "aberto", transiciona para "em_andamento" automaticamente
        if (ticket.status === "aberto") {
            await prisma.suporteTicket.update({
                where: { id: ticketId },
                data:  { status: "em_andamento" },
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                id:          String(resposta.id),
                ticket_id:   String(resposta.ticket_id),
                mensagem:    resposta.mensagem,
                is_admin:    resposta.is_admin,
                created_by:  String(resposta.created_by),
                author_name: userName,
                created_at:  resposta.created_at.toISOString(),
            },
        }, { status: 201 });
    } catch (error) {
        console.error("Erro ao adicionar resposta:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
