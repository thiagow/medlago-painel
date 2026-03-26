import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEvolutionMessage } from "@/lib/evolution-api";

const EVO_DOMAIN  = () => (process.env.EVO_DOMAIN || "").replace(/\/+$/, '');
const EVO_API_KEY = () => process.env.EVO_API_KEY!;
const EVO_INSTANCE = () => process.env.EVO_INSTANCE_BOT || "medlago_producao";

// Mapeamento de button_id ou texto → dados do rating
const RATING_MAP: Record<string, { rating: string; nps_score: number }> = {
    // IDs dos botões
    nps_bad:     { rating: "bad",     nps_score: 2 },
    nps_neutral: { rating: "neutral", nps_score: 6 },
    nps_good:    { rating: "good",    nps_score: 9 },
    
    // Fallback numérico direto
    "0": { rating: "bad", nps_score: 0 },
    "1": { rating: "bad", nps_score: 1 },
    "2": { rating: "bad", nps_score: 2 },
    "3": { rating: "bad", nps_score: 3 },
    "4": { rating: "neutral", nps_score: 4 },
    "5": { rating: "neutral", nps_score: 5 },
    "6": { rating: "neutral", nps_score: 6 },
    "7": { rating: "neutral", nps_score: 7 },
    "8": { rating: "good", nps_score: 8 },
    "9": { rating: "good", nps_score: 9 },
    "10": { rating: "good", nps_score: 10 },
};

async function getConfig(): Promise<Record<string, string>> {
    const configs = await prisma.npsConfig.findMany();
    const cfg: Record<string, string> = {};
    for (const c of configs) cfg[c.key] = c.value;
    return cfg;
}

async function sendMsg(phone: string, text: string) {
    try {
        await sendEvolutionMessage({
            domain: EVO_DOMAIN(),
            apiKey: EVO_API_KEY(),
            instance: EVO_INSTANCE(),
            number: phone,
            text,
        });
    } catch (err) {
        console.error("[NPS Webhook] Erro ao enviar mensagem:", err);
    }
}

async function finalizarChat(chatId: bigint, phone: string) {
    const now = new Date();
    await prisma.chat.update({
        where: { id: chatId },
        data: {
            ai_service: "paused",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: "finished" as any,
            finished: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            finished_at: now as any,
            updated_at: now,
        },
    });
    await prisma.chatMessage.updateMany({
        where: { phone },
        data: { active: false },
    });
}

/**
 * POST /api/nps/webhook
 *
 * Chamado pelo N8N quando detecta ai_service = 'nps_pending' ou 'nps_comment'.
 *
 * Body esperado:
 * {
 *   phone: string,          // número do paciente
 *   message: string,        // texto ou button_id enviado pelo paciente
 *   step: "rating" | "comment"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const { phone, message, step } = await request.json();

        if (!phone || !message || !step) {
            return NextResponse.json({ error: "Campos obrigatórios: phone, message, step" }, { status: 400 });
        }

        const cfg = await getConfig();

        // Buscar o NPS response pendente mais recente desse telefone
        const npsRecord = await prisma.npsResponse.findFirst({
            where: {
                phone,
                status: { in: ["pending", "rated"] },
            },
            orderBy: { created_at: "desc" },
        });

        if (!npsRecord) {
            console.warn(`[NPS Webhook] Nenhum NPS pendente encontrado para ${phone}`);
            return NextResponse.json({ ok: false, reason: "no_pending_nps" });
        }

        // ── FASE 1: Receber a nota (rating) ──────────────────────────────────
        if (step === "rating") {
            const ratingData = RATING_MAP[message.trim()];

            if (!ratingData) {
                // Resposta inválida — reenviar a pergunta
                const question = cfg.question || "De 0 a 10, como você avalia o atendimento?";
                await sendMsg(phone, `Por favor, utilize os botões acima para responder. ${question}`);
                return NextResponse.json({ ok: false, reason: "invalid_button" });
            }

            // Salvar a nota
            await prisma.npsResponse.update({
                where: { id: npsRecord.id },
                data: {
                    rating:    ratingData.rating,
                    nps_score: ratingData.nps_score,
                    status:    "rated",
                },
            });

            // Atualizar o chat para aguardar comentário
            await prisma.chat.update({
                where: { id: npsRecord.chat_id },
                data: {
                    ai_service: "nps_comment",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    status: "nps_comment" as any,
                    updated_at: new Date(),
                },
            });

            // Enviar followup condicional
            let followup: string;
            if (ratingData.rating === "bad")     followup = cfg.followup_bad     || "Sentimos muito. O que poderíamos ter feito para melhorar?";
            else if (ratingData.rating === "good") followup = cfg.followup_good   || "Que bom! O que você mais gostou no atendimento?";
            else                                   followup = cfg.followup_neutral || "O que poderíamos ter feito diferente?";

            await sendMsg(phone, followup);

            return NextResponse.json({ ok: true, step: "rating_saved", next: "comment" });
        }

        // ── FASE 2: Receber o comentário ─────────────────────────────────────
        if (step === "comment") {
            const now = new Date();

            await prisma.npsResponse.update({
                where: { id: npsRecord.id },
                data: {
                    comment:      message.trim(),
                    status:       "completed",
                    completed_at: now,
                },
            });

            // Enviar agradecimento
            const thankYou = cfg.thank_you || "Obrigado pela sua avaliação! ✨";
            await sendMsg(phone, thankYou);

            // Finalizar o chat de verdade
            await finalizarChat(npsRecord.chat_id, phone);

            return NextResponse.json({ ok: true, step: "completed" });
        }

        return NextResponse.json({ error: "step inválido" }, { status: 400 });

    } catch (error) {
        console.error("[NPS Webhook] Erro:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
