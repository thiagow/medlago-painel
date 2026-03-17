import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const serializeBigInt = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(serializeBigInt);
    if (typeof obj === 'object') {
        const serialized: any = {};
        for (const key in obj) {
            serialized[key] = serializeBigInt(obj[key]);
        }
        return serialized;
    }
    return obj;
};

// GET /api/external-contacts — Listar contatos externos
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const includeInactive = searchParams.get("includeInactive") === "true";

        const contacts = await prisma.externalContact.findMany({
            where: includeInactive ? undefined : { active: true },
            orderBy: { name: "asc" },
        });

        const serialized = contacts.map((c) => serializeBigInt(c));

        return NextResponse.json({ externalContacts: serialized });
    } catch (error) {
        console.error("Erro ao listar contatos externos:", error);
        return NextResponse.json({ error: "Erro interno", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

// POST /api/external-contacts — Criar contato externo
export async function POST(request: NextRequest) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { name, phone, description } = await request.json();

        if (!name?.trim() || !phone?.trim()) {
            return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
        }

        // Limpar número: remover caracteres não numéricos
        const cleanPhone = phone.replace(/\D/g, "");

        const existing = await prisma.externalContact.findUnique({ where: { phone: cleanPhone } });
        if (existing) {
            return NextResponse.json({ error: "Já existe um contato com esse número" }, { status: 409 });
        }

        const contact = await prisma.externalContact.create({
            data: {
                name: name.trim(),
                phone: cleanPhone,
                description: description?.trim() || null,
            },
        });

        return NextResponse.json({
            contact: serializeBigInt(contact),
        }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar contato externo:", error);
        return NextResponse.json({ error: "Erro interno", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

