"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Users, Bot, UserCheck, Activity } from "lucide-react";

interface DashboardStats {
    totalConversationsToday: number;
    totalConversationsMonth: number;
    humanTransfersToday: number;
    humanTransfersMonth: number;
    humanInteractionsToday: number;
    humanInteractionsMonth: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("/api/dashboard-stats");
                if (res.ok) {
                    const data = await res.json();
                    setStats(data.stats);
                }
            } catch (err) {
                console.error("Erro ao buscar estatísticas", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const cards = [
        {
            title: "Atendimentos Iniciados (Hoje)",
            value: stats?.totalConversationsToday || 0,
            icon: MessageSquare,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
        },
        {
            title: "Transferências Clínicas (Hoje)",
            value: stats?.humanTransfersToday || 0,
            icon: Users,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
        },
        {
            title: "Chats com Interação Humana (Hoje)",
            value: stats?.humanInteractionsToday || 0,
            icon: UserCheck,
            color: "text-purple-500",
            bg: "bg-purple-500/10",
        },
        {
            title: "Atendimentos Totais (Mês)",
            value: stats?.totalConversationsMonth || 0,
            icon: MessageSquare,
            color: "text-blue-400",
            bg: "bg-blue-900/40",
        },
        {
            title: "Transferências Totais (Mês)",
            value: stats?.humanTransfersMonth || 0,
            icon: Users,
            color: "text-amber-400",
            bg: "bg-amber-900/40",
        },
        {
            title: "Interações Totais (Mês)",
            value: stats?.humanInteractionsMonth || 0,
            icon: UserCheck,
            color: "text-purple-400",
            bg: "bg-purple-900/40",
        },
    ];

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Painel de Controle</h1>
                <p className="text-slate-400">Resumo dos atendimentos e integrações da clínica.</p>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-32 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {cards.map((card, i) => {
                        const Icon = card.icon;
                        return (
                            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-slate-400 font-medium text-sm">{card.title}</h3>
                                    <div className={`p-2 rounded-lg ${card.bg}`}>
                                        <Icon className={`w-5 h-5 ${card.color}`} />
                                    </div>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold text-white">{card.value}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Activity className="w-5 h-5 text-blue-500" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Status do Sistema</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-slate-300 font-medium">Evolution API (Bot)</span>
                            </div>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Online</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
