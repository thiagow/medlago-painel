import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET() {
    try {
        const prisma = new PrismaClient({ log: ['error', 'warn'] });
        const users = await prisma.user.findMany({ take: 2 });
        return NextResponse.json({ success: true, users: users.map(u => u.email) });
    } catch (e: any) {
        return NextResponse.json({
            success: false,
            errorName: e.name,
            errorMessage: e.message,
            errorCode: e.code,
            envVars: {
                hasDbUrl: !!process.env.DATABASE_URL
            }
        }, { status: 500 });
    }
}
