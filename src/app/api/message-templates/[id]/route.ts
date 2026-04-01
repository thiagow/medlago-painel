import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// PUT /api/message-templates/[id] - Edita template
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (user.role !== "admin" && user.role !== "atendente") return NextResponse.json({ error: "Apenas admins e atendentes podem editar templates" }, { status: 403 });

        const { id } = await params;
        const body = await request.json();
        const { name, body: messageBody, image_url, image_caption } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
        }
        if (!messageBody?.trim() && !image_url?.trim()) {
            return NextResponse.json({ error: "Template precisa ter texto e/ou imagem" }, { status: 400 });
        }

        const template = await (prisma as any).messageTemplate.update({
            where: { id: BigInt(id) },
            data: {
                name: name.trim(),
                body: messageBody?.trim() || null,
                image_url: image_url?.trim() || null,
                image_caption: image_caption?.trim() || null,
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
        });
    } catch (error) {
        console.error("[PUT /api/message-templates/[id]]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// DELETE /api/message-templates/[id] - Soft delete
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (user.role !== "admin" && user.role !== "atendente") return NextResponse.json({ error: "Apenas admins e atendentes podem excluir templates" }, { status: 403 });

        const { id } = await params;

        await (prisma as any).messageTemplate.update({
            where: { id: BigInt(id) },
            data: { active: false },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[DELETE /api/message-templates/[id]]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
