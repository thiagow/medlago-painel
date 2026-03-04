"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    must_change_password: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Verificar sessão ao carregar
    useEffect(() => {
        const savedUser = sessionStorage.getItem("medlago_user");
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch {
                sessionStorage.removeItem("medlago_user");
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Erro ao fazer login");
        }

        const data = await res.json();
        setUser(data.user);
        sessionStorage.setItem("medlago_user", JSON.stringify(data.user));

        // Bypass mandatory password change redirect
        /*
        if (data.user.must_change_password) {
            router.push("/change-password");
        } else {
            router.push("/dashboard/conversations");
        }
        */
        router.push("/dashboard/conversations");
    }, [router]);

    const logout = useCallback(async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        sessionStorage.removeItem("medlago_user");
        router.push("/login");
    }, [router]);

    const isAdmin = useCallback(() => user?.role === "admin", [user]);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth deve ser usado dentro de AuthProvider");
    }
    return context;
}
