"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Bot,
    UserCheck,
    Clock,
    CheckCircle2,
    PhoneForwarded,
    Hourglass,
    MessageSquare,
    Users,
    TrendingUp,
    Activity,
    RefreshCw,
    Building2,
    ArrowUpRight,
    CircleDot,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StatsResponse {
    by_status: {
        ai: number;
        waiting: number;
        human: number;
        finished: number;
        transferred_external: number;
        total: number;
    };
    by_agent: { id: string; name: string; total: number; finished: number; transferred_external: number }[];
    by_department: { id: string; name: string; total: number }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (value === 0) { setDisplay(0); return; }
        const start = Date.now();
        const from = display;
        const to = value;
        const step = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setDisplay(Math.round(from + (to - from) * eased));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return <>{display}</>;
}

// Donut component for status distribution
function StatusDonut({ data }: { data: { label: string; value: number; color: string }[] }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) {
        return (
            <div className="w-40 h-40 rounded-full border-[12px] border-slate-800 flex items-center justify-center">
                <span className="text-slate-600 text-xs">Sem dados</span>
            </div>
        );
    }

    let cumulative = 0;
    const segments = data.filter(d => d.value > 0).map((d) => {
        const pct = (d.value / total) * 100;
        const seg = { ...d, pct, start: cumulative };
        cumulative += pct;
        return seg;
    });

    // Build conic gradient
    const stops = segments.map(s => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");

    return (
        <div className="relative w-40 h-40 mx-auto">
            <div
                className="w-full h-full rounded-full"
                style={{ background: `conic-gradient(${stops})` }}
            />
            <div className="absolute inset-3 rounded-full bg-slate-900 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white"><AnimatedNumber value={total} /></span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total</span>
            </div>
        </div>
    );
}

// Progress bar for agents/departments
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [stats, setStats] = useState<StatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const today = new Date();

    const fetchStats = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);
        try {
            const res = await fetch(`/api/dashboard-today?_t=${Date.now()}`, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error("Erro ao buscar stats:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        // Auto-refresh a cada 60s
        const interval = setInterval(() => fetchStats(false), 60000);
        return () => clearInterval(interval);
    }, [fetchStats]);

    const bs = stats?.by_status ?? { ai: 0, waiting: 0, human: 0, finished: 0, transferred_external: 0, total: 0 };

    // Cards de status
    const statusCards = [
        {
            label: "Atendimentos IA",
            sublabel: "Em aberto pela IA",
            value: bs.ai,
            icon: Bot,
            gradient: "from-blue-500 to-cyan-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            text: "text-blue-400",
        },
        {
            label: "Aguardando",
            sublabel: "Transferidos para equipe",
            value: bs.waiting,
            icon: Hourglass,
            gradient: "from-orange-500 to-amber-400",
            bg: "bg-orange-500/10",
            border: "border-orange-500/20",
            text: "text-orange-400",
        },
        {
            label: "Atendimento Humano",
            sublabel: "Em aberto por agentes",
            value: bs.human,
            icon: UserCheck,
            gradient: "from-amber-500 to-yellow-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            text: "text-amber-400",
        },
        {
            label: "Finalizados",
            sublabel: "Concluídos hoje",
            value: bs.finished,
            icon: CheckCircle2,
            gradient: "from-emerald-500 to-green-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            text: "text-emerald-400",
        },
        {
            label: "Transf. Externo",
            sublabel: "Enviados para contato externo",
            value: bs.transferred_external,
            icon: PhoneForwarded,
            gradient: "from-violet-500 to-purple-400",
            bg: "bg-violet-500/10",
            border: "border-violet-500/20",
            text: "text-violet-400",
        },
        {
            label: "Total do Dia",
            sublabel: "Todos os atendimentos",
            value: bs.total,
            icon: MessageSquare,
            gradient: "from-slate-400 to-slate-300",
            bg: "bg-slate-500/10",
            border: "border-slate-500/20",
            text: "text-slate-300",
        },
    ];

    // Donut data
    const donutData = [
        { label: "IA", value: bs.ai, color: "#3b82f6" },
        { label: "Aguardando", value: bs.waiting, color: "#f97316" },
        { label: "Humano", value: bs.human, color: "#f59e0b" },
        { label: "Finalizados", value: bs.finished, color: "#10b981" },
        { label: "Transf. Externo", value: bs.transferred_external, color: "#8b5cf6" },
    ];

    const donutLegend = [
        { label: "IA", color: "bg-blue-500", value: bs.ai },
        { label: "Aguardando", color: "bg-orange-500", value: bs.waiting },
        { label: "Humano", color: "bg-amber-500", value: bs.human },
        { label: "Finalizados", color: "bg-emerald-500", value: bs.finished },
        { label: "Transf. Ext.", color: "bg-violet-500", value: bs.transferred_external },
    ];

    // Skeleton
    if (loading) {
        return (
            <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
                <div className="h-8 w-64 bg-slate-800 rounded-lg animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-28 animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-64 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const maxAgentTotal = Math.max(...(stats?.by_agent ?? []).map(a => a.total), 1);
    const maxDeptTotal = Math.max(...(stats?.by_department ?? []).map(d => d.total), 1);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        Painel de Controle
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 ml-12">
                        {format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
                    </p>
                </div>
                <button
                    onClick={() => fetchStats(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all text-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Atualizar
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {statusCards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={i}
                            className={`relative overflow-hidden bg-slate-900 border ${card.border} rounded-2xl p-4 group hover:border-opacity-60 transition-all`}
                        >
                            {/* Gradient accent bar */}
                            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.gradient}`} />

                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2 rounded-lg ${card.bg}`}>
                                    <Icon className={`w-4 h-4 ${card.text}`} />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">
                                <AnimatedNumber value={card.value} />
                            </div>
                            <p className="text-xs text-slate-400 font-medium leading-tight">{card.label}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">{card.sublabel}</p>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Section: Donut + Agents + Departments */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Distribuição */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                        </div>
                        <h2 className="text-sm font-semibold text-white">Distribuição</h2>
                    </div>

                    <StatusDonut data={donutData} />

                    <div className="mt-5 space-y-2">
                        {donutLegend.map((item) => (
                            <div key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                    <span className="text-xs text-slate-400">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-white">{item.value}</span>
                                    {bs.total > 0 && (
                                        <span className="text-[10px] text-slate-600">
                                            {((item.value / bs.total) * 100).toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Por Atendente */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <Users className="w-4 h-4 text-amber-400" />
                        </div>
                        <h2 className="text-sm font-semibold text-white">Por Atendente</h2>
                    </div>

                    {(stats?.by_agent ?? []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Users className="w-8 h-8 text-slate-700 mb-2" />
                            <p className="text-xs text-slate-500">Nenhum atendente ativo hoje</p>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {(stats?.by_agent ?? []).slice(0, 6).map((agent) => (
                                <div key={agent.id}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                                {agent.name?.charAt(0)?.toUpperCase() ?? "?"}
                                            </div>
                                            <span className="text-xs text-slate-300 truncate">{agent.name}</span>
                                        </div>
                                        <span className="text-sm font-bold text-white">{agent.total}</span>
                                    </div>
                                    <ProgressBar value={agent.total} max={maxAgentTotal} color="bg-amber-500" />
                                    <div className="flex gap-3 mt-0.5">
                                        <span className="text-[10px] text-emerald-400/70">{agent.finished} fin.</span>
                                        <span className="text-[10px] text-violet-400/70">{agent.transferred_external} transf.</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Por Departamento + Status do Sistema */}
                <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="flex items-center gap-2.5 mb-5">
                            <div className="p-2 rounded-lg bg-violet-500/10">
                                <Building2 className="w-4 h-4 text-violet-400" />
                            </div>
                            <h2 className="text-sm font-semibold text-white">Por Departamento</h2>
                        </div>

                        {(stats?.by_department ?? []).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                <Building2 className="w-7 h-7 text-slate-700 mb-2" />
                                <p className="text-xs text-slate-500">Nenhum departamento ativo hoje</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {(stats?.by_department ?? []).slice(0, 5).map((dept) => (
                                    <div key={dept.id}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-slate-300">{dept.name}</span>
                                            <span className="text-sm font-bold text-white">{dept.total}</span>
                                        </div>
                                        <ProgressBar value={dept.total} max={maxDeptTotal} color="bg-violet-500" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status do Sistema */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <CircleDot className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h2 className="text-sm font-semibold text-white">Status do Sistema</h2>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-800/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-slate-300 text-xs font-medium">Instância WhatsApp</span>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                                Online
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
