import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { nome, telefone_principal, cpf, email, data_nascimento } = body;

        if (!nome || !telefone_principal) {
            return NextResponse.json({ error: "Nome e Telefone Principal s\u00e3o obrigat\u00f3rios." }, { status: 400 });
        }

        // Se passar um CPF, checa se ja existe em outro ID
        if (cpf) {
            const existing = await prisma.paciente.findFirst({
                where: { 
                    cpf,
                    NOT: { id: BigInt(id) }
                }
            });
            if (existing) {
                return NextResponse.json({ error: "J\u00e1 existe um paciente cadastrado com este CPF." }, { status: 400 });
            }
        }

        // CPFs vazios devem ser salvos como NULL para não violar o limite de caracteres
        // e permitir múltiplos cadastros sem CPF (Postgres permite múltiplos NULL em UNIQUE)
        const payloadCpf = (cpf && cpf.trim() !== "") ? cpf : null;

        const updated = await prisma.paciente.update({
            where: { id: BigInt(id) },
            data: {
                nome: nome.toUpperCase(),
                telefone_principal: telefone_principal.split("@")[0].replace(/\D/g, ""),
                cpf: payloadCpf,
                email: email || null,
                data_nascimento: data_nascimento ? new Date(data_nascimento) : null,
            }
        });

        const serialized = {
            ...updated,
            id: updated.id.toString(),
            data_nascimento: updated.data_nascimento?.toISOString() || null,
            created_at: (updated as any).created_at ? (updated as any).created_at.toISOString() : null,
            updated_at: (updated as any).updated_at ? (updated as any).updated_at.toISOString() : null
        };

        return NextResponse.json({ patient: serialized });
    } catch (error) {
        console.error("Erro ao atualizar paciente:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        // Verifica se paciente existe
        const patient = await prisma.paciente.findUnique({
            where: { id: BigInt(id) }
        });

        if (!patient) {
            return NextResponse.json({ error: "Paciente n\u00e3o encontrado." }, { status: 404 });
        }

        // Deleta paciente
        await prisma.paciente.delete({
            where: { id: BigInt(id) }
        });

        return NextResponse.json({ success: true, message: "Paciente deletado." });
    } catch (error) {
        console.error("Erro ao deletar paciente:", error);
        return NextResponse.json({ error: "Paciente erro dele\u00e7\u00e3o (pode estar vinculado a agendamento ou outros dados)" }, { status: 500 });
    }
}
