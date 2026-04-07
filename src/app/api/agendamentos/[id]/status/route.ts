import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = ["confirmado", "pendente", "cancelado"];
const STATUSES_REQUIRING_MOTIVO = ["pendente", "cancelado"];

/**
 * PATCH /api/agendamentos/[id]/status
 * Body: { status: "confirmado" | "pendente" | "cancelado", motivo?: string }
 *
 * Atualiza a situação de um agendamento.
 * Para "pendente" e "cancelado" o campo motivo é obrigatório.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const agendamentoId = parseInt(id, 10);

        if (isNaN(agendamentoId)) {
            return NextResponse.json(
                { error: "ID inválido" },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { status, motivo } = body;

        if (!status || !ALLOWED_STATUSES.includes(status.toLowerCase())) {
            return NextResponse.json(
                {
                    error: `Status inválido. Valores permitidos: ${ALLOWED_STATUSES.join(", ")}`,
                },
                { status: 400 }
            );
        }

        // Motivo obrigatório para pendente e cancelado
        if (STATUSES_REQUIRING_MOTIVO.includes(status.toLowerCase())) {
            if (!motivo || motivo.trim().length === 0) {
                return NextResponse.json(
                    { error: "O campo 'motivo' é obrigatório para este status." },
                    { status: 400 }
                );
            }
        }

        // Verificar se o agendamento existe
        const existing = await prisma.agendamento.findUnique({
            where: { id: agendamentoId },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "Agendamento não encontrado" },
                { status: 404 }
            );
        }

        // Não permitir alterar agendamentos já atendidos
        if (existing.status?.toLowerCase() === "atendido") {
            return NextResponse.json(
                { error: "Não é possível alterar a situação de um agendamento já atendido" },
                { status: 422 }
            );
        }

        const novoMotivo = STATUSES_REQUIRING_MOTIVO.includes(status.toLowerCase())
            ? motivo.trim()
            : null; // Limpa o motivo quando aprovado

        const updated = await prisma.agendamento.update({
            where: { id: agendamentoId },
            data: {
                status: status.toLowerCase(),
                motivo: novoMotivo,
                updated_at: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            agendamento: {
                id: updated.id,
                status: updated.status,
                motivo: updated.motivo ?? null,
            },
        });
    } catch (error) {
        console.error("Erro ao atualizar status do agendamento:", error);
        return NextResponse.json(
            { error: "Erro interno ao atualizar status" },
            { status: 500 }
        );
    }
}
