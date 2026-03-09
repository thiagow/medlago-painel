import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        // Obter data de referênca de hoje no início do dia
        const todayStr = request.nextUrl.searchParams.get("date");
        const today = todayStr ? new Date(todayStr) : new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // 1. Total Atendimentos (Dia e Mês) (Chats criados no período)
        const totalConversationsToday = await prisma.chat.count({
            where: { created_at: { gte: today, lt: tomorrow } }
        });
        const totalConversationsMonth = await prisma.chat.count({
            where: { created_at: { gte: firstDayOfMonth, lt: tomorrow } }
        });

        // 2. Transferências Totais (Dia e Mês)
        const humanTransfersToday = await prisma.chatTransferLog.count({
            where: { created_at: { gte: today, lt: tomorrow } }
        });
        const humanTransfersMonth = await prisma.chatTransferLog.count({
            where: { created_at: { gte: firstDayOfMonth, lt: tomorrow } }
        });

        // 3. Interações Humanas Totais (Dia e Mês) - Quantos chats únicos a equipe participou
        // Poderia ser complexo, mas por hora o conceito de "Interação Humana" pode refletir diretamente o volume de Transferências logadas ou conversas que estão Pausadas
        // Para simplificar vamos contabilizar chats cujo status atual seja "paused" OU a própria contagem de transferências que representam interações
        // Para alinhar à solicitação: total de atendimento que tiveram interação humana do dia e do mês. Vamos usar as entries do ChatTransferLog por chat_id distintas.
        const humanInteractionsTodayObj = await prisma.chatTransferLog.findMany({
            where: { created_at: { gte: today, lt: tomorrow } },
            distinct: ['chat_id'],
            select: { chat_id: true }
        });
        const humanInteractionsMonthObj = await prisma.chatTransferLog.findMany({
            where: { created_at: { gte: firstDayOfMonth, lt: tomorrow } },
            distinct: ['chat_id'],
            select: { chat_id: true }
        });

        const humanInteractionsToday = humanInteractionsTodayObj.length;
        const humanInteractionsMonth = humanInteractionsMonthObj.length;

        return NextResponse.json({
            stats: {
                totalConversationsToday,
                totalConversationsMonth,
                humanTransfersToday,
                humanTransfersMonth,
                humanInteractionsToday,
                humanInteractionsMonth
            }
        });
    } catch (error) {
        console.error("Erro ao buscar estatísticas do dashboard:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
