import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/external-contacts/[id] — Atualizar contato
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const { name, phone, description } = await request.json();

        if (!name?.trim() || !phone?.trim()) {
            return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
        }

        const cleanPhone = phone.replace(/\D/g, "");

        // Verificar duplicata excluindo o próprio ID
        const existing = await (prisma.externalContact as any).findFirst({
            where: { phone: cleanPhone, id: { not: BigInt(id) } },
        });
        if (existing) {
            return NextResponse.json({ error: "Já existe um contato com esse número" }, { status: 409 });
        }

        const contact = await (prisma.externalContact as any).update({
            where: { id: BigInt(id) },
            data: {
                name: name.trim(),
                phone: cleanPhone,
                description: description?.trim() || null,
                updated_at: new Date(),
            },
        });

        return NextResponse.json({
            contact: {
                ...contact,
                id: contact.id.toString(),
                created_at: contact.created_at?.toISOString() || null,
                updated_at: contact.updated_at?.toISOString() || null,
            },
        });
    } catch (error) {
        console.error("Erro ao atualizar contato externo:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// DELETE /api/external-contacts/[id] — Desativar (soft delete)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { id } = await params;

        await (prisma.externalContact as any).update({
            where: { id: BigInt(id) },
            data: { active: false, updated_at: new Date() },
        });

        return NextResponse.json({ success: true, message: "Contato desativado" });
    } catch (error) {
        console.error("Erro ao desativar contato externo:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
