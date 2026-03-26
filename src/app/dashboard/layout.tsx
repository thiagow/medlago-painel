"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import UpdatePasswordModal from "@/components/profile/UpdatePasswordModal";
import {
    MessageSquare,
    Users,
    LogOut,
    MessageSquareHeart,
    Clock,
    LayoutDashboard,
    Settings,
    Building2,
    Phone,
    ChevronDown,
    ChevronRight,
    CalendarDays,
    Send,
    Key,
    Tag,
    Star,
    BarChart3,
    TrendingUp,
} from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, logout, isAdmin } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [analysisOpen, setAnalysisOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Open settings menu automatically if on a settings page
    useEffect(() => {
        if (
            pathname.startsWith("/dashboard/departments") || 
            pathname.startsWith("/dashboard/external-contacts") || 
            pathname.startsWith("/dashboard/tags") || 
            pathname.startsWith("/dashboard/nps/config") ||
            pathname.startsWith("/dashboard/users")
        ) {
            setSettingsOpen(true);
        }
        
        if (pathname.startsWith("/dashboard/analysis")) {
            setAnalysisOpen(true);
        }
    }, [pathname]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <span className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    const navItems = [
        {
            href: "/dashboard",
            icon: LayoutDashboard,
            label: "Visão Geral",
            id: "nav-overview",
        },
        {
            href: "/dashboard/conversations",
            icon: MessageSquare,
            label: "Conversas",
            id: "nav-conversations",
        },
        {
            href: "/dashboard/history",
            icon: Clock,
            label: "Histórico",
            id: "nav-history",
        },
        {
            href: "/dashboard/agendamentos",
            icon: CalendarDays,
            label: "Agendamentos",
            id: "nav-agendamentos",
        },
        {
            href: "/dashboard/patients",
            icon: Users, // Pode usar Múltiplos ou Contact (importarei se necessário)
            label: "Pacientes",
            id: "nav-patients",
        },
        ...(isAdmin()
            ? [
                {
                    href: "/dashboard/broadcasts",
                    icon: Send,
                    label: "Disparos",
                    id: "nav-broadcasts",
                },
            ]
            : []),
        ...(isAdmin()
            ? [
                {
                    href: "/dashboard/nps",
                    icon: Star,
                    label: "Avaliações NPS",
                    id: "nav-nps",
                },
            ]
            : []),
    ];

    const settingsItems = [
        {
            href: "/dashboard/departments",
            icon: Building2,
            label: "Departamentos",
            id: "nav-departments",
        },
        {
            href: "/dashboard/external-contacts",
            icon: Phone,
            label: "Contatos Externos",
            id: "nav-external-contacts",
        },
        {
            href: "/dashboard/tags",
            icon: Tag,
            label: "Tags de Atendimento",
            id: "nav-tags",
        },
        ...(isAdmin()
            ? [
                {
                    href: "/dashboard/users",
                    icon: Users,
                    label: "Usuários",
                    id: "nav-users",
                },
                {
                    href: "/dashboard/nps/config",
                    icon: Settings,
                    label: "Config. NPS",
                    id: "nav-nps-config",
                },
            ]
            : []),
    ];

    const analysisItems = [
        ...(isAdmin()
            ? [
                {
                    href: "/dashboard/analysis/ai-transfers",
                    icon: TrendingUp,
                    label: "Atendimento IA",
                    id: "nav-analysis-ai",
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
                <nav className="flex-1 p-2 md:p-4 space-y-1 overflow-y-auto">
                    {navItems.map(({ href, icon: Icon, label, id }) => {
                        const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
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

                    {/* Análises (admin only) */}
                    {isAdmin() && analysisItems.length > 0 && (
                        <div>
                            <button
                                id="nav-analysis"
                                onClick={() => setAnalysisOpen(!analysisOpen)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${analysisOpen ? "text-slate-200 bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                            >
                                <BarChart3 className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-white" />
                                <span className="hidden md:flex flex-1 items-center justify-between text-sm">
                                    Análises
                                    {analysisOpen
                                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                                    }
                                </span>
                            </button>

                            {analysisOpen && (
                                <div className="hidden md:block mt-1 ml-3 pl-3 border-l border-slate-700 space-y-1">
                                    {analysisItems.map(({ href, icon: Icon, label, id }) => {
                                        const isActive = pathname.startsWith(href);
                                        return (
                                            <Link
                                                key={href}
                                                id={id}
                                                href={href}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-sm ${isActive
                                                    ? "bg-rose-600/20 text-rose-400 font-medium"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                                            >
                                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-rose-400" : ""}`} />
                                                {label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Configurações (admin only) */}
                    {isAdmin() && (
                        <div>
                            <button
                                id="nav-settings"
                                onClick={() => setSettingsOpen(!settingsOpen)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${settingsOpen ? "text-slate-200 bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                            >
                                <Settings className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-white" />
                                <span className="hidden md:flex flex-1 items-center justify-between text-sm">
                                    Configurações
                                    {settingsOpen
                                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                                    }
                                </span>
                            </button>

                            {settingsOpen && (
                                <div className="hidden md:block mt-1 ml-3 pl-3 border-l border-slate-700 space-y-1">
                                    {settingsItems.map(({ href, icon: Icon, label, id }) => {
                                        const isActive = pathname.startsWith(href);
                                        return (
                                            <Link
                                                key={href}
                                                id={id}
                                                href={href}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-sm ${isActive
                                                    ? "bg-violet-600/20 text-violet-400 font-medium"
                                                    : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                                            >
                                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-violet-400" : ""}`} />
                                                {label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
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
                        onClick={() => setPasswordModalOpen(true)}
                        className="w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all group text-sm mb-1"
                    >
                        <Key className="w-4 h-4 shrink-0" />
                        <span className="hidden md:block">Trocar Senha</span>
                    </button>
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
            <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
                {children}
            </main>

            <UpdatePasswordModal 
                isOpen={passwordModalOpen} 
                onClose={() => setPasswordModalOpen(false)} 
            />
        </div>
    );
}
