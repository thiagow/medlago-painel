import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";

export async function GET(req: NextRequest) {
    const urlParam = req.nextUrl.searchParams.get("url");

    if (!urlParam) {
        return new NextResponse("URL is required", { status: 400 });
    }

    try {
        let key = "";
        
        // Verifica se é uma URL do nosso R2
        if (urlParam.includes("r2.cloudflarestorage.com")) {
            // A URL tem o formato: https://<account_id>.r2.cloudflarestorage.com/<bucket_name>/<key...>
            const urlObj = new URL(urlParam);
            const pathParts = urlObj.pathname.split("/").filter(Boolean);
            
            // O primeiro segmento do path é o buckt_name, o resto é a key
            if (pathParts.length > 1 && pathParts[0] === R2_BUCKET_NAME) {
                key = pathParts.slice(1).join("/");
            } else {
                // Caso não tenha bucket no path (domain customizado), pega todo o path
                key = pathParts.join("/");
            }
        } else if (urlParam.includes(process.env.R2_PUBLIC_URL || "___NONE___")) {
            // Ex: https://media.medlago.com/documentos/image-xxx.jpg
            const baseUrl = process.env.R2_PUBLIC_URL || "";
            key = urlParam.replace(baseUrl, "").replace(/^\//, "");
        } else {
            // Tenta fetch direto para URLs genéricas
            const response = await fetch(urlParam);
            if (!response.ok) throw new Error("Failed to fetch image");
            const buffer = await response.arrayBuffer();
            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": response.headers.get("content-type") || "application/octet-stream",
                    "Cache-Control": "public, max-age=86400",
                },
            });
        }

        if (!key) {
            return new NextResponse("Invalid R2 URL format", { status: 400 });
        }

        // Buscar pelo S3 SDK (com as credenciais corretas configuradas em r2)
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: decodeURIComponent(key),
        });

        const r2Response = await r2.send(command);
        
        // r2Response.Body is a ReadableStream (transform to buffer or stream)
        const stream = r2Response.Body as any;
        
        return new NextResponse(stream, {
            headers: {
                "Content-Type": r2Response.ContentType || "application/octet-stream",
                "Cache-Control": "public, max-age=86400",
            },
        });

    } catch (error) {
        console.error("Erro no proxy de imagem R2:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
