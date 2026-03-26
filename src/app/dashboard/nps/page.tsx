"use client";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
    Star,
    TrendingUp,
    ThumbsUp,
    ThumbsDown,
    Meh,
    MessageCircle,
    CalendarDays,
    RefreshCw,
} from "lucide-react";

interface NpsStats {
    total: number;
    nps_score: number | null;
    distribution: {
        bad:     { count: number; pct: number };
        neutral: { count: number; pct: number };
        good:    { count: number; pct: number };
    };
    responses: Array<{
        id: string;
        phone: string;
        agent_name: string | null;
        rating: string | null;
        nps_score: number | null;
        comment: string | null;
        status: string;
        created_at: string;
    }>;
}

const RATING_INFO = {
    bad:     { label: "Ruim (0–3)",    icon: ThumbsDown, color: "text-red-400",   bg: "bg-red-500/20",   bar: "bg-red-500" },
    neutral: { label: "Regular (4–7)", icon: Meh,        color: "text-yellow-400", bg: "bg-yellow-500/20", bar: "bg-yellow-500" },
    good:    { label: "Ótimo (8–10)",  icon: ThumbsUp,   color: "text-green-400",  bg: "bg-green-500/20",  bar: "bg-green-500" },
};

function NpsGauge({ score }: { score: number | null }) {
    if (score === null) return (
        <div className="text-4xl font-bold text-slate-500">—</div>
    );

    const color = score >= 50 ? "text-green-400" : score >= 0 ? "text-yellow-400" : "text-red-400";
    const label = score >= 50 ? "Excelente" : score >= 0 ? "Bom" : "Precisa melhorar";

    return (
        <div className="text-center">
            <div className={`text-6xl font-bold ${color}`}>{score}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
            <div className="text-xs text-slate-600 mt-0.5">de -100 a 100</div>
        </div>
    );
}

export default function NpsDashboardPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [stats, setStats]  = useState<NpsStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate,   setEndDate]   = useState("");
    const [filter, setFilter] = useState<string>("all");

    useEffect(() => {
        if (!authLoading && user && !isAdmin()) {
            router.push("/dashboard");
        }
    }, [user, isAdmin, authLoading, router]);

    const fetchStats = useCallback(async () => {
        if (!isAdmin()) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.set("startDate", startDate);
            if (endDate)   params.set("endDate",   endDate);
            const res  = await fetch(`/api/nps/stats?${params.toString()}`);
            if (!res.ok) return;
            const data = await res.json();
            setStats(data);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const filteredResponses = stats?.responses.filter(r =>
        filter === "all" ? true : r.rating === filter
    ) ?? [];

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-white">Avaliações NPS</h1>
                        <p className="text-sm text-slate-400">Resultados da pesquisa de satisfação pós-atendimento.</p>
                    </div>
                </div>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                </button>
            </div>

            {/* Filtros de data */}
            <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
                <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-400">Período:</span>
                <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-slate-600">até</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {(startDate || endDate) && (
                    <button
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        className="text-xs text-slate-500 hover:text-white transition-colors ml-1"
                    >
                        Limpar
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                </div>
            ) : !stats ? (
                <div className="text-center py-16 text-slate-500">Erro ao carregar dados.</div>
            ) : (
                <>
                    {/* Cards de indicadores */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* NPS Score */}
                        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-col items-center justify-center gap-2">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-amber-400" />
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">NPS Score</span>
                            </div>
                            <NpsGauge score={stats.nps_score} />
                        </div>

                        {/* Total */}
                        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-col justify-center">
                            <p className="text-xs text-slate-400 mb-1">Total de Avaliações</p>
                            <p className="text-3xl font-bold text-white">{stats.total}</p>
                        </div>

                        {/* Distribuição */}
                        {(["bad", "neutral", "good"] as const).map(key => {
                            const info = RATING_INFO[key];
                            const Icon = info.icon;
                            const dist = stats.distribution[key];
                            return (
                                <div key={key} className={`bg-slate-800/60 border border-slate-700 rounded-2xl p-5`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Icon className={`w-4 h-4 ${info.color}`} />
                                        <span className="text-xs text-slate-400">{info.label}</span>
                                    </div>
                                    <p className={`text-2xl font-bold ${info.color}`}>{dist.count}</p>
                                    <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${info.bar} rounded-full transition-all`}
                                            style={{ width: `${dist.pct}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{dist.pct}% do total</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tabela de respostas */}
                    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
                        {/* Filtro de rating */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700">
                            <MessageCircle className="w-4 h-4 text-slate-400 mr-1" />
                            <span className="text-sm text-slate-400 mr-2">Filtrar:</span>
                            {[
                                { value: "all",     label: "Todas" },
                                { value: "bad",     label: "😞 Ruim" },
                                { value: "neutral", label: "😐 Regular" },
                                { value: "good",    label: "😍 Ótimo" },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilter(opt.value)}
                                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                                        filter === opt.value
                                            ? "bg-amber-500 text-slate-900 font-semibold"
                                            : "bg-slate-700 text-slate-400 hover:text-white"
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {filteredResponses.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 text-sm">
                                Nenhuma avaliação encontrada para os filtros selecionados.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                            <th className="text-left px-5 py-3 font-medium">Data</th>
                                            <th className="text-left px-5 py-3 font-medium">Telefone</th>
                                            <th className="text-left px-5 py-3 font-medium">Atendente</th>
                                            <th className="text-left px-5 py-3 font-medium">Avaliação</th>
                                            <th className="text-left px-5 py-3 font-medium">Comentário</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {filteredResponses.map(r => {
                                            const ratingKey = r.rating as keyof typeof RATING_INFO | null;
                                            const info = ratingKey ? RATING_INFO[ratingKey] : null;
                                            return (
                                                <tr key={r.id} className="hover:bg-slate-700/30 transition-colors">
                                                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                                                        {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">
                                                        {r.phone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, "+$1 ($2) $3-$4")}
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-300">
                                                        {r.agent_name || <span className="text-slate-600">—</span>}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {info ? (
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${info.bg} ${info.color}`}>
                                                                <info.icon className="w-3 h-3" />
                                                                {info.label}
                                                                {r.nps_score !== null && <span className="opacity-60">(≈{r.nps_score})</span>}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-600 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-400 max-w-xs truncate">
                                                        {r.comment || <span className="text-slate-600 italic text-xs">Sem comentário</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
