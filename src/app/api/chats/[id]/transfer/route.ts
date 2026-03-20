import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTeamNotification, sendPatientTransferMessage, sendEvolutionMessage } from "@/lib/evolution-api";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const chatId = BigInt(id);
        const {
            reason,
            summary,
            transfer_type = "human", // "human" | "external"
            department_id,
            external_contact_id,
        } = await request.json();

        if (!reason || !summary) {
            return NextResponse.json({ error: "Motivo e resumo são obrigatórios" }, { status: 400 });
        }

        if (transfer_type !== "human" && transfer_type !== "external") {
            return NextResponse.json({ error: "Tipo de transferência inválido" }, { status: 400 });
        }

        const chat = await prisma.chat.findUnique({ where: { id: chatId } });
        if (!chat || !chat.phone) {
            return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
        }

        const phone = chat.phone;
        const userName = request.headers.get("x-user-name") || "Sistema";
        const userId = request.headers.get("x-user-id");
        const userIdBigInt = userId ? BigInt(userId) : null;

        // 1. Gravar log de transferência
        await prisma.chatTransferLog.create({
            data: {
                chat_id: chatId,
                user_name: userName,
                reason,
                summary,
                transfer_type,
                ...(department_id ? { department_id: BigInt(department_id) } : {}),
                ...(external_contact_id ? { external_contact_id: BigInt(external_contact_id) } : {}),
            },
        });

        if (transfer_type === "human") {
            // ── TRANSFERÊNCIA HUMANA ──────────────────────────────
            // Coloca em espera (waiting): IA pausada, aguardando atendente assumir

            await prisma.chat.update({
                where: { id: chatId },
                data: {
                    ai_service: "waiting",
                    status: "waiting",
                    finished: false,
                    ...(department_id ? { department_id: BigInt(department_id) } : {}),
                    updated_at: new Date(),
                },
            });

            // Notificar equipe sobre a transferência
            try {
                await sendTeamNotification(phone, summary);
            } catch (err) {
                console.error("Erro ao notificar equipe:", err);
            }

        } else {
            // ── TRANSFERÊNCIA EXTERNA ─────────────────────────────
            // Finaliza o chat e registra como transferido externamente

            // Obter telefone do contato externo
            let externalPhone: string | null = null;
            if (external_contact_id) {
                const ext = await prisma.externalContact.findUnique({
                    where: { id: BigInt(external_contact_id) },
                });
                externalPhone = ext?.phone ?? null;
            }

            // Enviar mensagem ao paciente informando sobre a transferência
            try {
                await sendPatientTransferMessage(phone);
            } catch (err) {
                console.error("Erro ao notificar paciente:", err);
            }

            // Enviar resumo ao contato externo
            if (externalPhone) {
                try {
                    const notifText = `📋 *Transferência de Atendimento*\n\n*Telefone do paciente:* ${phone}\n*Resumo:* ${summary}\n*Motivo:* ${reason}`;
                    await sendEvolutionMessage({
                        domain: process.env.EVO_DOMAIN || "",
                        apiKey: process.env.EVO_API_KEY!,
                        instance: process.env.EVO_INSTANCE_BOT || "",
                        number: externalPhone,
                        text: notifText,
                    });
                } catch (err) {
                    console.error("Erro ao notificar contato externo:", err);
                }
            }

            const now = new Date();

            // Finalizar chat com status dedicado para transferência externa
            await prisma.chat.update({
                where: { id: chatId },
                data: {
                    ai_service: "paused",
                    status: "transferred_external",
                    finished: true,
                    finished_at: now,
                    ...(userIdBigInt ? { finished_by: userIdBigInt } : {}),
                    updated_at: now,
                },
            });

            // Desativar mensagens do telefone
            await prisma.chatMessage.updateMany({
                where: { phone },
                data: { active: false },
            });
        }

        return NextResponse.json({
            success: true,
            transfer_type,
            message: transfer_type === "human"
                ? "Conversa transferida para atendimento humano"
                : "Atendimento transferido externamente e finalizado",
        });
    } catch (error) {
        console.error("Erro ao transferir conversa:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
