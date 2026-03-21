import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// GET /api/tags - Lista tags ativas
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";

        const tags = await (prisma as any).tag.findMany({
            where: {
                active: true,
                ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            tags: tags.map((t: any) => ({
                ...t,
                id: t.id.toString(),
                created_at: t.created_at?.toISOString(),
            })),
        });
    } catch (error) {
        console.error("[GET /api/tags]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// POST /api/tags - Cria nova tag (admin)
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        
        // Verifica se tem permissão (admin)
        if (user.role !== "admin") return NextResponse.json({ error: "Apenas admins podem criar tags" }, { status: 403 });

        const body = await request.json();
        const { name, color } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: "Nome da tag é obrigatório" }, { status: 400 });
        }

        // Verifica se já existe uma tag com este nome (ativa ou inativa - se for inativa não vamos reativar automaticamente, mas poderíamos. 
        // Pra simplificar, vamos impedir criar com mesmo nome caso exista independente de active, Prisma `@unique` exige isso).
        // Ah, o nome no schema tem @unique. Então impedimos.
        
        try {
            const tag = await (prisma as any).tag.create({
                data: {
                    name: name.trim(),
                    color: color?.trim() || "#6366f1",
                    active: true, // Garante que nasce ativa
                },
            });

            return NextResponse.json({
                success: true,
                tag: {
                    ...tag,
                    id: tag.id.toString(),
                    created_at: tag.created_at?.toISOString(),
                },
            }, { status: 201 });
        } catch (e: any) {
            if (e.code === 'P2002') {
                return NextResponse.json({ error: "Já existe uma tag com este nome" }, { status: 400 });
            }
            throw e;
        }
    } catch (error) {
        console.error("[POST /api/tags]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
