import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const status = searchParams.get("status");
        const tagId = searchParams.get("tag");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        if (search) {
            where.phone = { contains: search };
        }

        if (status) {
            where.status = status;
        }

        if (tagId) {
            where.tags = {
                some: {
                    tag_id: BigInt(tagId)
                }
            };
        }

        if (startDate && endDate) {
            // Fim do dia para o endDate
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            where.created_at = {
                gte: new Date(startDate),
                lte: end,
            };
        }

        const [chats, total] = await Promise.all([
            prisma.chat.findMany({
                where,
                orderBy: { updated_at: "desc" },
                skip,
                take: limit,
                include: {
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            }),
            prisma.chat.count({ where }),
        ]);

        // Serializar BigInt e datas
        const serialized = chats.map((chat) => ({
            ...chat,
            id: chat.id.toString(),
            assigned_to: chat.assigned_to?.toString() ?? null,
            department_id: chat.department_id?.toString() ?? null,
            finished_by: chat.finished_by?.toString() ?? null,
            created_at: chat.created_at?.toISOString?.() ?? (chat.created_at ? new Date(chat.created_at).toISOString() : null),
            updated_at: chat.updated_at?.toISOString?.() ?? (chat.updated_at ? new Date(chat.updated_at).toISOString() : null),
            assigned_at: chat.assigned_at?.toISOString?.() ?? (chat.assigned_at ? new Date(chat.assigned_at).toISOString() : null),
            finished_at: chat.finished_at?.toISOString?.() ?? (chat.finished_at ? new Date(chat.finished_at).toISOString() : null),
            tags: chat.tags?.map((ct: any) => ({
                id: ct.tag.id.toString(),
                name: ct.tag.name,
                color: ct.tag.color,
            })) || [],
        }));

        return NextResponse.json({
            chats: serialized,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("Erro ao listar histórico:", error);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
