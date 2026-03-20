import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { JWTPayload, verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken } from "./jwt";

export type { JWTPayload };
export { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken };

// Hash de senha
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Extrair usuário autenticado do request
export async function getAuthUser(
    request: NextRequest
): Promise<JWTPayload | null> {
    try {
        const token =
            request.cookies.get("access_token")?.value ||
            request.headers.get("authorization")?.replace("Bearer ", "");

        if (!token) return null;

        const payload = await verifyAccessToken(token);
        if (!payload) return null;

        // Verificar se usuário ainda existe e está ativo
        const user = await prisma.user.findUnique({
            where: { id: BigInt(payload.userId), active: true },
        });

        if (!user) return null;

        return {
            userId: user.id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
        };
    } catch {
        return null;
    }
}

// Verificação de permissões RBAC
export const PERMISSIONS = {
    admin: [
        "view_chats",
        "view_messages",
        "send_message",
        "transfer_to_human",
        "reactivate_ai",
        "manage_users",
        "manage_broadcasts",
    ],
    atendente: [
        "view_chats",
        "view_messages",
        "send_message",
        "transfer_to_human",
        "reactivate_ai",
    ],
} as const;

export function hasPermission(role: string, permission: string): boolean {
    const rolePermissions =
        PERMISSIONS[role as keyof typeof PERMISSIONS] || [];
    return rolePermissions.includes(permission as never);
}

export function requiresAdmin(role: string): boolean {
    return role === "admin";
}
