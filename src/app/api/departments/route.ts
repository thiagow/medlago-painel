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

// GET /api/departments — Listar departamentos
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const includeInactive = searchParams.get("includeInactive") === "true";

        const departments = await prisma.department.findMany({
            where: includeInactive ? undefined : { active: true },
            include: {
                users: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, role: true, active: true },
                        },
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        const serialized = departments.map((dept) => serializeBigInt({
            ...dept,
            users: dept.users.map(u => ({
                ...u.user,
                link_id: u.id
            })),
        }));

        return NextResponse.json({ departments: serialized });
    } catch (error) {
        console.error("Erro ao listar departamentos:", error);
        return NextResponse.json({ error: "Erro interno", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

// POST /api/departments — Criar departamento
export async function POST(request: NextRequest) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { name, description } = await request.json();

        if (!name?.trim()) {
            return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
        }

        const existing = await prisma.department.findUnique({ where: { name: name.trim() } });
        if (existing) {
            return NextResponse.json({ error: "Já existe um departamento com esse nome" }, { status: 409 });
        }

        const dept = await prisma.department.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
            },
        });

        return NextResponse.json({
            department: serializeBigInt({
                ...dept,
                users: [],
            }),
        }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar departamento:", error);
        return NextResponse.json({ error: "Erro interno", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}


