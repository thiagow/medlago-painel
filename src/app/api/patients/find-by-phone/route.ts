import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * GET /api/patients/find-by-phone?phone=5511999998888
 * Busca um paciente pelo número de telefone (campo telefone_principal).
 * Retorna { patient: {...} } ou { patient: null } se não encontrado.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const phone = searchParams.get("phone");

        if (!phone) {
            return NextResponse.json({ error: "Parâmetro 'phone' é obrigatório" }, { status: 400 });
        }

        // Normaliza o telefone: remove tudo que não seja dígito
        const normalizedPhone = phone.replace(/\D/g, "");

        // Busca exata primeiro, depois tenta com variações de prefixo DDI
        const patient = await prisma.paciente.findFirst({
            where: {
                OR: [
                    { telefone_principal: normalizedPhone },
                    // Caso o banco tenha sem DDI (55) e o telefone veio com
                    { telefone_principal: normalizedPhone.replace(/^55/, "") },
                    // Caso o banco tenha com DDI e o telefone veio sem
                    { telefone_principal: `55${normalizedPhone}` },
                ]
            },
            select: {
                id: true,
                nome: true,
                cpf: true,
                email: true,
                data_nascimento: true,
                telefone_principal: true,
            }
        });

        if (!patient) {
            return NextResponse.json({ patient: null });
        }

        const serialized = {
            ...patient,
            id: patient.id.toString(),
            data_nascimento: patient.data_nascimento?.toISOString() ?? null,
        };

        return NextResponse.json({ patient: serialized });
    } catch (error) {
        console.error("[find-by-phone] Erro:", error);
        return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
}
