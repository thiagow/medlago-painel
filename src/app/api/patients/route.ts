import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const searchQuery = searchParams.get("search") || "";
        const sortOrder = searchParams.get("sort") === "desc" ? "desc" : "asc";

        // Logic for Prisma Query
        const whereClause = searchQuery ? {
            OR: [
                { nome: { contains: searchQuery, mode: 'insensitive' as const } },
                { telefone_principal: { contains: searchQuery } },
                { cpf: { contains: searchQuery } }
            ]
        } : {};

        const total = await prisma.paciente.count({ where: whereClause });

        const patients = await prisma.paciente.findMany({
            where: whereClause,
            orderBy: { nome: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        });

        // Convert BigInts to Strings for JSON serialization
        const serialized = patients.map(p => ({
            ...p,
            id: p.id.toString(),
            data_nascimento: p.data_nascimento?.toISOString() || null,
            created_at: (p as any).created_at ? (p as any).created_at.toISOString() : null,
            updated_at: (p as any).updated_at ? (p as any).updated_at.toISOString() : null
        }));

        return NextResponse.json({
            patients: serialized,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Erro ao buscar pacientes:", error);
        return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { nome, telefone_principal, cpf, email, data_nascimento } = body;

        if (!nome || !telefone_principal) {
            return NextResponse.json({ error: "Nome e Telefone Principal s\u00e3o obrigat\u00f3rios." }, { status: 400 });
        }

        // Check unique CPF only if provided
        if (cpf) {
            const existing = await prisma.paciente.findUnique({
                where: { cpf }
            });
            if (existing) {
                return NextResponse.json({ error: "J\u00e1 existe um paciente cadastrado com este CPF." }, { status: 400 });
            }
        }

        // CPFs vazios devem ser salvos como NULL para não violar o limite de caracteres
        // e permitir múltiplos cadastros sem CPF (Postgres permite múltiplos NULL em UNIQUE)
        const payloadCpf = (cpf && cpf.trim() !== "") ? cpf : null;

        const newPatient = await prisma.paciente.create({
            data: {
                nome: nome.toUpperCase(),
                telefone_principal,
                cpf: payloadCpf,
                email: email || null,
                data_nascimento: data_nascimento ? new Date(data_nascimento) : null,
            }
        });

        const serialized = {
            ...newPatient,
            id: newPatient.id.toString(),
            data_nascimento: newPatient.data_nascimento?.toISOString() || null,
            created_at: (newPatient as any).created_at ? (newPatient as any).created_at.toISOString() : null,
            updated_at: (newPatient as any).updated_at ? (newPatient as any).updated_at.toISOString() : null
        };

        return NextResponse.json({ patient: serialized }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar paciente:", error);
        return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
    }
}
