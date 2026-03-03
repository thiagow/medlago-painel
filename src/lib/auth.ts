import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    name: string;
}

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

// JWT Tokens
export function generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);
}

export function generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
        return null;
    }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
    } catch {
        return null;
    }
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

        const payload = verifyAccessToken(token);
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
