import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name;
        // Obter extensao do arquivo. Ex: 'documento.pdf' -> 'pdf'
        const extension = originalName.split('.').pop()?.toLowerCase();
        
        // Determinar tipo de midia
        let mediaType = "document";
        if (file.type.startsWith("image/")) {
            mediaType = "image";
        } else if (file.type.startsWith("audio/")) {
            mediaType = "audio";
        } else if (file.type.startsWith("video/")) {
            mediaType = "video";
        }

        // Diretório especificado pelo usuário
        const fileName = `documentos/${mediaType}-${uuidv4()}-${Date.now()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: file.type,
        });

        await r2.send(command);

        // A URL final depende se foi configurado um domínio público no R2
        const url = R2_PUBLIC_URL 
            ? `${R2_PUBLIC_URL}/${fileName}`
            : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${fileName}`;

        return NextResponse.json({
            success: true,
            url,
            mediaType,
            fileName: originalName,
            mimeType: file.type
        });

    } catch (error) {
        console.error("Erro no upload R2:", error);
        return NextResponse.json({ error: "Erro interno no upload" }, { status: 500 });
    }
}
