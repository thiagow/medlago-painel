import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/agendamentos
 * Query params:
 *   month  = "2026-03"  (filtra por mês - padrão: mês atual)
 *   search = "CPF ou nome"
 *   status = "agendado" | "cancelado" | ...
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get("month"); // "2026-03"
        const search = searchParams.get("search") ?? "";
        const status = searchParams.get("status") ?? "";

        // Determinar faixa de datas: se não informado, usa mês atual
        let startDate: Date;
        let endDate: Date;

        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            const [year, month] = monthParam.split("-").map(Number);
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0); // último dia do mês
        } else {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params: any[] = [startDate, endDate];
        let paramIndex = 3;

        let searchFilter = "";
        if (search) {
            searchFilter = `AND (pac.cpf ILIKE $${paramIndex} OR pac.nome ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        let statusFilter = "";
        if (status) {
            statusFilter = `AND a.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        const query = `
            SELECT
                a.id,
                a.created_at,
                a.data_atendimento,
                a.horario::text AS horario,
                a.paciente_cpf,
                a.status,
                a.motivo,
                a.unidade_id,
                a.convenio_id,
                a.profissional_id,
                a.tipo_atendimento_id,
                pac.nome  AS paciente_nome,
                prof.nome AS profissional_nome,
                ta.nome   AS tipo_atendimento_nome,
                c.convenio AS convenio_nome
            FROM agendamentos a
            LEFT JOIN pacientes       pac  ON a.paciente_cpf       = pac.cpf
            LEFT JOIN profissionais   prof ON a.profissional_id     = prof.id
            LEFT JOIN tipos_atendimento ta ON a.tipo_atendimento_id = ta.id
            LEFT JOIN convenios        c   ON a.convenio_id         = c.id
            WHERE a.data_atendimento >= $1
              AND a.data_atendimento <= $2
              ${searchFilter}
              ${statusFilter}
            ORDER BY a.data_atendimento, a.horario
        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await prisma.$queryRawUnsafe<any[]>(query, ...params);

        const agendamentos = rows.map((r) => ({
            id: Number(r.id),
            created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
            data_atendimento: r.data_atendimento
                ? new Date(r.data_atendimento).toISOString().split("T")[0]
                : null,
            horario: r.horario ?? null, // "HH:MM:SS"
            paciente_cpf: r.paciente_cpf ?? null,
            paciente_nome: r.paciente_nome ?? null,
            profissional_id: r.profissional_id ? String(r.profissional_id) : null,
            profissional_nome: r.profissional_nome ?? null,
            tipo_atendimento_id: r.tipo_atendimento_id ? Number(r.tipo_atendimento_id) : null,
            tipo_atendimento_nome: r.tipo_atendimento_nome ?? null,
            convenio_id: r.convenio_id ? String(r.convenio_id) : null,
            convenio_nome: r.convenio_nome ?? null,
            unidade_id: r.unidade_id ? Number(r.unidade_id) : null,
            status: r.status ?? "agendado",
            motivo: r.motivo ?? null,
        }));

        return NextResponse.json({ agendamentos });
    } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
