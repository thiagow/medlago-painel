import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/message-templates - Lista templates ativos
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";

        const templates = await (prisma as any).messageTemplate.findMany({
            where: {
                active: true,
                ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
            },
            orderBy: { created_at: "desc" },
        });

        return NextResponse.json({
            templates: templates.map((t: any) => ({
                ...t,
                id: t.id.toString(),
                created_by: t.created_by?.toString() ?? null,
                created_at: t.created_at?.toISOString(),
                updated_at: t.updated_at?.toISOString(),
            })),
        });
    } catch (error) {
        console.error("[GET /api/message-templates]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// POST /api/message-templates - Cria novo template
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (user.role !== "admin" && user.role !== "atendente") return NextResponse.json({ error: "Apenas admins e atendentes podem criar templates" }, { status: 403 });

        const body = await request.json();
        const { name, body: messageBody, image_url, image_caption } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: "Nome do template é obrigatório" }, { status: 400 });
        }
        if (!messageBody?.trim() && !image_url?.trim()) {
            return NextResponse.json({ error: "O template precisa ter texto e/ou imagem" }, { status: 400 });
        }

        const template = await (prisma as any).messageTemplate.create({
            data: {
                name: name.trim(),
                body: messageBody?.trim() || null,
                image_url: image_url?.trim() || null,
                image_caption: image_caption?.trim() || null,
                created_by: BigInt(user.userId),
            },
        });

        return NextResponse.json({
            success: true,
            template: {
                ...template,
                id: template.id.toString(),
                created_by: template.created_by?.toString() ?? null,
                created_at: template.created_at?.toISOString(),
                updated_at: template.updated_at?.toISOString(),
            },
        }, { status: 201 });
    } catch (error) {
        console.error("[POST /api/message-templates]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
