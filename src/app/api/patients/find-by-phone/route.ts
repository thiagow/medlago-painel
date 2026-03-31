import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

        // Normaliza o telefone: remove sufixo WhatsApp se houver e limpa não-dígitos
        const phoneWithoutSuffix = phone?.split("@")[0] ?? "";
        const normalizedPhone = phoneWithoutSuffix.replace(/\D/g, "");

        if (!normalizedPhone) {
            return NextResponse.json({ patient: null });
        }

        // Variações para busca (com e sem 55, com e sem o 9 extra de celular no Brasil)
        const variations = new Set<string>();
        variations.add(normalizedPhone); // Original (Ex: 556291785173 ou 5562991785173)
        variations.add(normalizedPhone.replace(/^55/, "")); // Sem DDI

        const phoneNoDDI = normalizedPhone.replace(/^55/, "");
        if (phoneNoDDI.length === 10) {
            // Se tem 10 dígitos (DDD + 8), tenta adicionar o 9: DDD + 9 + 8 dígitos
            const with9 = phoneNoDDI.substring(0, 2) + "9" + phoneNoDDI.substring(2);
            variations.add(with9);
            variations.add("55" + with9);
        } else if (phoneNoDDI.length === 11 && phoneNoDDI[2] === "9") {
            // Se tem 11 dígitos e o terceiro é 9, tenta remover o 9: DDD + 8 dígitos
            const without9 = phoneNoDDI.substring(0, 2) + phoneNoDDI.substring(3);
            variations.add(without9);
            variations.add("55" + without9);
        }

        const searchTerms = Array.from(variations);

        // Busca usando query bruta para ignorar caracteres não-numéricos no banco de dados
        console.log(`Buscando paciente por variações de telefone: ${searchTerms.join(", ")}`);
        
        const query = `
            SELECT * FROM "pacientes" 
            WHERE regexp_replace(telefone_principal, '[^0-9]', '', 'g') IN (${searchTerms.map(t => `'${t}'`).join(',')})
            LIMIT 1
        `;

        const results = await prisma.$queryRawUnsafe(query) as any[];

        console.log(`Resultados encontrados: ${results.length}`);
        const patient = results[0] || null;

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
