import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/nps/config — Retorna todas as configurações do NPS (admin) */
export async function GET(request: NextRequest) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const configs = await prisma.npsConfig.findMany({ orderBy: { key: "asc" } });
        const cfg: Record<string, string> = {};
        for (const c of configs) cfg[c.key] = c.value;
        return NextResponse.json({ config: cfg });
    } catch (error) {
        console.error("Erro ao buscar NPS config:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

/** PUT /api/nps/config — Atualiza uma ou mais chaves de configuração (admin) */
export async function PUT(request: NextRequest) {
    const role = request.headers.get("x-user-role");
    if (role !== "admin") {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    try {
        const body: Record<string, string> = await request.json();

        // Atualizar cada chave recebida
        const updates = Object.entries(body).map(([key, value]) =>
            prisma.npsConfig.upsert({
                where: { key },
                update: { value, updated_at: new Date() },
                create: { key, value },
            })
        );

        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro ao atualizar NPS config:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
