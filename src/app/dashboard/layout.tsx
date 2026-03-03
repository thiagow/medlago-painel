"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import {
    MessageSquare,
    Users,
    LogOut,
    MessageSquareHeart,
} from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, logout, isAdmin } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <span className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    const navItems = [
        {
            href: "/dashboard/conversations",
            icon: MessageSquare,
            label: "Conversas",
            id: "nav-conversations",
        },
        ...(isAdmin()
            ? [
                {
                    href: "/dashboard/users",
                    icon: Users,
                    label: "Usuários",
                    id: "nav-users",
                },
            ]
            : []),
    ];

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-16 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
                {/* Logo */}
                <div className="h-16 flex items-center justify-center md:justify-start px-0 md:px-6 border-b border-slate-800 gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center shrink-0">
                        <MessageSquareHeart className="w-4 h-4 text-white" />
                    </div>
                    <span className="hidden md:block font-bold text-white text-lg">MedLago</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2 md:p-4 space-y-1">
                    {navItems.map(({ href, icon: Icon, label, id }) => {
                        const isActive = pathname.startsWith(href);
                        return (
                            <Link
                                key={href}
                                id={id}
                                href={href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive
                                        ? "bg-blue-600/20 text-blue-400 font-medium"
                                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                                    }`}
                            >
                                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-blue-400" : "text-slate-400 group-hover:text-white"}`} />
                                <span className="hidden md:block text-sm">{label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User info + logout */}
                <div className="p-2 md:p-4 border-t border-slate-800">
                    <div className="hidden md:flex items-center gap-3 mb-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{user.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{user.role}</p>
                        </div>
                    </div>
                    <button
                        id="btn-logout"
                        onClick={logout}
                        className="w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all group text-sm"
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span className="hidden md:block">Sair</span>
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-hidden flex flex-col min-w-0">
                {children}
            </main>
        </div>
    );
}
