import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;

// ── GET /api/suporte ──────────────────────────────────────────────────────────
// Lista tickets. Admin vê todos; atendente vê apenas os próprios.
// Query: page, limit, status, prioridade, tipo, created_by (admin), date_from, date_to

export async function GET(req: NextRequest) {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const isAdmin = userRole === "admin";

    const params = req.nextUrl.searchParams;
    const page       = Math.max(1, Number(params.get("page") ?? "1"));
    const limit      = Math.min(100, Math.max(1, Number(params.get("limit") ?? "50")));
    const status     = params.get("status") ?? undefined;
    const prioridade = params.get("prioridade") ?? undefined;
    const tipo       = params.get("tipo") ?? undefined;
    const createdBy  = params.get("created_by") ?? undefined;
    const dateFrom   = params.get("date_from") ?? undefined;
    const dateTo     = params.get("date_to") ?? undefined;

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { deleted_at: null };

        // RBAC: atendentes só veem seus próprios tickets
        if (!isAdmin) {
            where.created_by = BigInt(userId);
        } else if (createdBy) {
            where.created_by = BigInt(createdBy);
        }

        if (status)     where.status     = status;
        if (prioridade) where.prioridade = prioridade;
        if (tipo)       where.tipo       = tipo;

        if (dateFrom || dateTo) {
            where.created_at = {};
            if (dateFrom) where.created_at.gte = new Date(dateFrom);
            if (dateTo)   where.created_at.lte = new Date(dateTo + "T23:59:59.999Z");
        }

        const [tickets, total] = await Promise.all([
            prisma.suporteTicket.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.suporteTicket.count({ where }),
        ]);

        // Buscar nomes dos criadores e contagem de respostas
        const creatorIds = [...new Set(tickets.map(t => t.created_by))];
        const creators = creatorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: creatorIds } },
                select: { id: true, name: true },
            })
            : [];
        const creatorMap = new Map(creators.map(u => [String(u.id), u.name]));

        const ticketIds = tickets.map(t => t.id);
        const respostaCounts = ticketIds.length > 0
            ? await prisma.suporteTicketResposta.groupBy({
                by: ["ticket_id"],
                where: { ticket_id: { in: ticketIds } },
                _count: { id: true },
            })
            : [];
        const repostaCountMap = new Map(respostaCounts.map(r => [String(r.ticket_id), r._count.id]));

        const data = tickets.map(t => ({
            id:            String(t.id),
            ticket_number: t.ticket_number,
            titulo:        t.titulo,
            tipo:          t.tipo,
            prioridade:    t.prioridade,
            status:        t.status,
            video_url:     t.video_url ?? null,
            created_at:    t.created_at.toISOString(),
            updated_at:    t.updated_at.toISOString(),
            resolved_at:   t.resolved_at?.toISOString() ?? null,
            created_by:    String(t.created_by),
            creator_name:  creatorMap.get(String(t.created_by)) ?? "—",
            respostas:     repostaCountMap.get(String(t.id)) ?? 0,
        }));

        return NextResponse.json({
            data,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("Erro ao listar tickets:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}

// ── POST /api/suporte ─────────────────────────────────────────────────────────
// Cria um novo ticket. Aceita multipart/form-data (campos + imagens opcionais).

export async function POST(req: NextRequest) {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    try {
        const formData = await req.formData();

        const titulo     = (formData.get("titulo")     as string | null)?.trim();
        const descricao  = (formData.get("descricao")  as string | null)?.trim();
        const tipo       = (formData.get("tipo")       as string | null)?.trim();
        const prioridade = (formData.get("prioridade") as string | null)?.trim();
        const video_url  = (formData.get("video_url")  as string | null)?.trim() || null;

        // Validações básicas
        const TIPOS_VALIDOS      = ["bug", "erro", "melhoria", "duvida"];
        const PRIORIDADES_VALIDAS = ["baixa", "media", "alta", "critica"];

        if (!titulo || titulo.length < 5) {
            return NextResponse.json({ error: "Título deve ter ao menos 5 caracteres" }, { status: 400 });
        }
        if (!descricao || descricao.length < 10) {
            return NextResponse.json({ error: "Descrição deve ter ao menos 10 caracteres" }, { status: 400 });
        }
        if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
            return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
        }
        if (!prioridade || !PRIORIDADES_VALIDAS.includes(prioridade)) {
            return NextResponse.json({ error: "Prioridade inválida" }, { status: 400 });
        }

        // Coletar arquivos de imagem
        const files: File[] = [];
        for (const [key, value] of formData.entries()) {
            if ((key === "imagens" || key.startsWith("imagens")) && value instanceof File && value.size > 0) {
                files.push(value);
            }
        }

        if (files.length > MAX_FILES) {
            return NextResponse.json({ error: `Máximo de ${MAX_FILES} imagens por chamado` }, { status: 400 });
        }
        for (const f of files) {
            if (!ALLOWED_MIME_TYPES.includes(f.type)) {
                return NextResponse.json({ error: `Tipo de arquivo não permitido: ${f.type}` }, { status: 400 });
            }
            if (f.size > MAX_FILE_SIZE) {
                return NextResponse.json({ error: `Arquivo "${f.name}" excede 5 MB` }, { status: 400 });
            }
        }

        // 1. Criar ticket com ticket_number temporário
        const ticket = await prisma.suporteTicket.create({
            data: {
                ticket_number: "TEMP",
                titulo,
                descricao,
                tipo,
                prioridade,
                status: "aberto",
                video_url,
                created_by: BigInt(userId),
            },
        });

        // 2. Gerar ticket_number definitivo com o ID
        const year         = new Date().getFullYear();
        const ticketNumber = `TK-${year}-${String(ticket.id).padStart(5, "0")}`;
        await prisma.suporteTicket.update({
            where: { id: ticket.id },
            data:  { ticket_number: ticketNumber },
        });

        // 3. Upload das imagens para R2 + registrar anexos
        const anexos: { file_name: string; file_size: number; mime_type: string; r2_key: string; proxy_url: string }[] = [];

        for (const file of files) {
            try {
                const ext     = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
                const r2Key   = `suporte/tickets/${ticket.id}/${uuidv4()}-${Date.now()}.${ext}`;
                const buffer  = Buffer.from(await file.arrayBuffer());

                await r2.send(new PutObjectCommand({
                    Bucket:      R2_BUCKET_NAME,
                    Key:         r2Key,
                    Body:        buffer,
                    ContentType: file.type,
                }));

                const r2Url = R2_PUBLIC_URL
                    ? `${R2_PUBLIC_URL}/${r2Key}`
                    : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${r2Key}`;

                await prisma.suporteTicketAnexo.create({
                    data: {
                        ticket_id:   ticket.id,
                        file_name:   file.name,
                        file_size:   file.size,
                        mime_type:   file.type,
                        r2_key:      r2Url,
                        uploaded_by: BigInt(userId),
                    },
                });

                anexos.push({
                    file_name: file.name,
                    file_size: file.size,
                    mime_type: file.type,
                    r2_key:    r2Url,
                    proxy_url: `/api/media/proxy?url=${encodeURIComponent(r2Url)}`,
                });
            } catch (uploadErr) {
                console.error(`Erro ao fazer upload de ${file.name}:`, uploadErr);
                // Continua — ticket já criado, imagem ignorada
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                id:            String(ticket.id),
                ticket_number: ticketNumber,
                titulo,
                descricao,
                tipo,
                prioridade,
                status:        "aberto",
                video_url,
                created_at:    ticket.created_at.toISOString(),
                created_by:    userId,
                anexos,
            },
        }, { status: 201 });

    } catch (error) {
        console.error("Erro ao criar ticket:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
