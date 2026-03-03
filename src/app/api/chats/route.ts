import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        if (search) {
            where.phone = { contains: search };
        }

        if (status && (status === "active" || status === "paused")) {
            where.ai_service = status;
        }

        const [chats, total] = await Promise.all([
            prisma.chat.findMany({
                where,
                orderBy: { updated_at: "desc" },
                skip,
                take: limit,
            }),
            prisma.chat.count({ where }),
        ]);

        // Serializar BigInt
        const serialized = chats.map((chat) => ({
            ...chat,
            id: chat.id.toString(),
            created_at: chat.created_at?.toISOString() || null,
            updated_at: chat.updated_at?.toISOString() || null,
        }));

        return NextResponse.json({
            chats: serialized,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("Erro ao listar chats:", error);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
