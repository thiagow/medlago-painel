import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/chats/[id]/assume — Atendente humano assume o atendimento em espera
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);

        const userId = request.headers.get("x-user-id");
        const userName = request.headers.get("x-user-name") || "Atendente";

        if (!userId) {
            return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
        }

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }

        if (chat.ai_service !== "waiting") {
            return NextResponse.json(
                { error: "Este atendimento não está aguardando um atendente" },
                { status: 400 }
            );
        }

        // Atribuir ao atendente e marcar como em atendimento humano ativo
        const updated = await prisma.chat.update({
            where: { id: chatId },
            data: {
                ai_service: "paused",
                finished: false,
                assigned_to: BigInt(userId),
                assigned_at: new Date(),
                updated_at: new Date(),
            },
        });

        // Gravar log de assumir atendimento
        await prisma.chatTransferLog.create({
            data: {
                chat_id: chatId,
                user_name: userName,
                reason: "Atendimento assumido pelo atendente",
                summary: `${userName} assumiu o atendimento`,
                transfer_type: "assume",
            },
        });

        return NextResponse.json({
            success: true,
            chat: {
                ...updated,
                id: updated.id.toString(),
                assigned_to: updated.assigned_to?.toString() ?? null,
                department_id: updated.department_id?.toString() ?? null,
                created_at: updated.created_at?.toISOString() ?? null,
                updated_at: updated.updated_at?.toISOString() ?? null,
                assigned_at: updated.assigned_at?.toISOString() ?? null,
            },
        });
    } catch (error) {
        console.error("Erro ao assumir atendimento:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
