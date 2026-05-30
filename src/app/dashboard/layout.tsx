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
    TrendingUp,
    Eraser,
    LifeBuoy,
    Headphones,
    Radio,
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
    const [atendimentoOpen, setAtendimentoOpen] = useState(false);
    const [comunicacaoOpen, setComunicacaoOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Auto-expand submenus ao navegar direto para uma sub-rota
    useEffect(() => {
        if (
            pathname.startsWith("/dashboard/history") ||
            pathname.startsWith("/dashboard/agendamentos") ||
            pathname.startsWith("/dashboard/patients")
        ) {
            setAtendimentoOpen(true);
        }
        if (
            pathname.startsWith("/dashboard/broadcasts") ||
            pathname.startsWith("/dashboard/nps")
        ) {
            setComunicacaoOpen(true);
        }
        if (
            pathname.startsWith("/dashboard/departments") ||
            pathname.startsWith("/dashboard/external-contacts") ||
            pathname.startsWith("/dashboard/tags") ||
            pathname.startsWith("/dashboard/users") ||
            pathname.startsWith("/dashboard/analysis") ||
            pathname.startsWith("/dashboard/logs")
        ) {
            setSettingsOpen(true);
        }
    }, [pathname]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <span className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    const admin = isAdmin();

    // ── Itens do submenu Atendimento ─────────────────────────────────────────
    const atendimentoItems = [
        { href: "/dashboard/history",      icon: Clock,        label: "Histórico",     id: "nav-history" },
        { href: "/dashboard/agendamentos", icon: CalendarDays, label: "Agendamentos",  id: "nav-agendamentos" },
        { href: "/dashboard/patients",     icon: Users,        label: "Pacientes",     id: "nav-patients" },
    ];

    // ── Itens do submenu Comunicação ─────────────────────────────────────────
    const comunicacaoItems = [
        { href: "/dashboard/broadcasts", icon: Send, label: "Disparos", id: "nav-broadcasts" },
        ...(admin
            ? [{ href: "/dashboard/nps", icon: Star, label: "Avaliações NPS", id: "nav-nps" }]
            : []),
    ];

    // ── Itens do submenu Configurações (admin) ───────────────────────────────
    const settingsItems = [
        { href: "/dashboard/users",                    icon: Users,     label: "Usuários",            id: "nav-users" },
        { href: "/dashboard/departments",              icon: Building2, label: "Departamentos",        id: "nav-departments" },
        { href: "/dashboard/tags",                     icon: Tag,       label: "Tags de Atendimento",  id: "nav-tags" },
        { href: "/dashboard/external-contacts",        icon: Phone,     label: "Contatos Externos",    id: "nav-external-contacts" },
        { href: "/dashboard/nps/config",               icon: Settings,  label: "Config. NPS",          id: "nav-nps-config" },
        { href: "/dashboard/analysis/ai-transfers",    icon: TrendingUp, label: "Análise IA",          id: "nav-analysis-ai" },
        { href: "/dashboard/logs/deleted-messages",    icon: Eraser,    label: "Mensagens Apagadas",   id: "nav-logs-deleted-messages" },
    ];

    // Helper de active state
    const isActive = (href: string) =>
        pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

    const isGroupActive = (paths: string[]) => paths.some(p => pathname.startsWith(p));

    // ── Classes reutilizáveis ────────────────────────────────────────────────
    const linkCls = (active: boolean) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
            active
                ? "bg-blue-600/20 text-blue-400 font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
        }`;

    const subLinkCls = (active: boolean) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-sm ${
            active
                ? "bg-violet-600/20 text-violet-400 font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
        }`;

    const groupBtnCls = (open: boolean, groupActive: boolean) =>
        `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
            open || groupActive ? "text-slate-200 bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"
        }`;

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

                    {/* Painel — admin only */}
                    {admin && (
                        <Link
                            id="nav-overview"
                            href="/dashboard"
                            className={linkCls(pathname === "/dashboard")}
                        >
                            <LayoutDashboard className={`w-5 h-5 shrink-0 ${pathname === "/dashboard" ? "text-blue-400" : "text-slate-400 group-hover:text-white"}`} />
                            <span className="hidden md:block text-sm">Painel</span>
                        </Link>
                    )}

                    {/* Conversas — todos */}
                    <Link
                        id="nav-conversations"
                        href="/dashboard/conversations"
                        className={linkCls(isActive("/dashboard/conversations"))}
                    >
                        <MessageSquare className={`w-5 h-5 shrink-0 ${isActive("/dashboard/conversations") ? "text-blue-400" : "text-slate-400 group-hover:text-white"}`} />
                        <span className="hidden md:block text-sm">Conversas</span>
                    </Link>

                    {/* ── Atendimento (submenu) ── */}
                    <div>
                        <button
                            id="nav-atendimento"
                            onClick={() => setAtendimentoOpen(v => !v)}
                            className={groupBtnCls(atendimentoOpen, isGroupActive(["/dashboard/history", "/dashboard/agendamentos", "/dashboard/patients"]))}
                        >
                            <Headphones className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-white" />
                            <span className="hidden md:flex flex-1 items-center justify-between text-sm">
                                Atendimento
                                {atendimentoOpen
                                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                                }
                            </span>
                        </button>

                        {atendimentoOpen && (
                            <div className="hidden md:block mt-1 ml-3 pl-3 border-l border-slate-700 space-y-1">
                                {atendimentoItems.map(({ href, icon: Icon, label, id }) => {
                                    const active = isActive(href);
                                    return (
                                        <Link key={href} id={id} href={href} className={subLinkCls(active)}>
                                            <Icon className={`w-4 h-4 shrink-0 ${active ? "text-violet-400" : ""}`} />
                                            {label}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Comunicação (submenu) — admin + atendente ── */}
                    {(admin || user?.role === "atendente") && (
                        <div>
                            <button
                                id="nav-comunicacao"
                                onClick={() => setComunicacaoOpen(v => !v)}
                                className={groupBtnCls(comunicacaoOpen, isGroupActive(["/dashboard/broadcasts", "/dashboard/nps"]))}
                            >
                                <Radio className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-white" />
                                <span className="hidden md:flex flex-1 items-center justify-between text-sm">
                                    Comunicação
                                    {comunicacaoOpen
                                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                                    }
                                </span>
                            </button>

                            {comunicacaoOpen && (
                                <div className="hidden md:block mt-1 ml-3 pl-3 border-l border-slate-700 space-y-1">
                                    {comunicacaoItems.map(({ href, icon: Icon, label, id }) => {
                                        const active = isActive(href);
                                        return (
                                            <Link key={href} id={id} href={href} className={subLinkCls(active)}>
                                                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-violet-400" : ""}`} />
                                                {label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Configurações (submenu, admin only) ── */}
                    {admin && (
                        <div>
                            <button
                                id="nav-settings"
                                onClick={() => setSettingsOpen(v => !v)}
                                className={groupBtnCls(settingsOpen, isGroupActive([
                                    "/dashboard/departments", "/dashboard/external-contacts",
                                    "/dashboard/tags", "/dashboard/users",
                                    "/dashboard/analysis", "/dashboard/logs",
                                ]))}
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
                                        const active = isActive(href);
                                        return (
                                            <Link key={href} id={id} href={href} className={subLinkCls(active)}>
                                                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-violet-400" : ""}`} />
                                                {label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Suporte — todos */}
                    <Link
                        id="nav-suporte"
                        href="/dashboard/suporte"
                        className={linkCls(isActive("/dashboard/suporte"))}
                    >
                        <LifeBuoy className={`w-5 h-5 shrink-0 ${isActive("/dashboard/suporte") ? "text-blue-400" : "text-slate-400 group-hover:text-white"}`} />
                        <span className="hidden md:block text-sm">Suporte</span>
                    </Link>
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
