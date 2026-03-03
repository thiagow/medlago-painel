import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                active: true,
                created_at: true,
                must_change_password: true,
            },
            orderBy: { created_at: "desc" },
        });

        const serialized = users.map((u) => ({
            ...u,
            id: u.id.toString(),
            created_at: u.created_at.toISOString(),
        }));

        return NextResponse.json({ users: serialized });
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const { name, email, password, userRole } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: "Dados obrigatórios faltando" }, { status: 400 });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
        }

        const hash = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase().trim(),
                password_hash: hash,
                role: userRole || "atendente",
                must_change_password: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                active: true,
                created_at: true,
                must_change_password: true,
            },
        });

        return NextResponse.json({
            user: { ...user, id: user.id.toString(), created_at: user.created_at.toISOString() },
        });
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
