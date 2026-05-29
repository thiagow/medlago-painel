"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    UserCheck,
    CheckCircle2,
    Hourglass,
    Users,
    TrendingUp,
    Activity,
    RefreshCw,
    Building2,
    CircleDot,
    Tag,
    Calendar,
    CalendarDays,
    Sun,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    UsersRound,
    PlayCircle,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StatsResponse {
    by_status: {
        started: number;
        served_by_ai_only: number;
        waiting_in_period: number;
        transferred_to_team: number;
        finished: number;
        waiting_now?: number;
        with_team_now?: number;
        ai_active_now?: number;
    };
    by_agent: { id: string; name: string; total: number; finished: number; transferred_external: number }[];
    by_department: { id: string; name: string; total: number }[];
    by_tag?: { id: string; name: string; color: string; total: number }[];
}

type TabId = "hoje" | "mensal" | "anual";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
    const safeValue = Number.isFinite(value) ? value : 0;
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        if (safeValue === 0) { setDisplay(0); return; }
        const start = Date.now();
        const from = Number.isFinite(display) ? display : 0;
        const to = safeValue;
        const step = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(from + (to - from) * eased));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safeValue]);

    return <>{display}</>;
}

// ─── DatePickerCalendar ────────────────────────────────────────────────────────
function DatePickerCalendar({
    selected,
    today,
    onSelect,
}: {
    selected: Date | null;
    today: Date;
    onSelect: (date: Date) => void;
}) {
    const [viewDate, setViewDate] = useState(selected ?? today);

    const monthStart = startOfMonth(viewDate);
    const monthEnd   = endOfMonth(viewDate);
    const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 0 });
    const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const canGoNext = isSameMonth(viewDate, today)
        ? false
        : !isAfter(addMonths(viewDate, 1), today);
    const canGoPrev = viewDate.getFullYear() > today.getFullYear() - 1 ||
        (viewDate.getFullYear() === today.getFullYear() - 1 && viewDate.getMonth() >= today.getMonth() - 2);

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 w-72">
            {/* Navegação de mês */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => setViewDate(v => subMonths(v, 1))}
                    disabled={!canGoPrev}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-white">
                    {format(viewDate, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
                </span>
                <button
                    onClick={() => setViewDate(v => addMonths(v, 1))}
                    disabled={!canGoNext}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 mb-1">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-semibold text-slate-500 py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Grade de dias */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((day) => {
                    const isCurrMonth = isSameMonth(day, viewDate);
                    const isSelected  = selected ? isSameDay(day, selected) : false;
                    const isToday_    = isSameDay(day, today);
                    const isFuture    = isAfter(day, today);

                    return (
                        <button
                            key={day.toISOString()}
                            disabled={isFuture || !isCurrMonth}
                            onClick={() => onSelect(day)}
                            className={`
                                h-8 w-8 mx-auto rounded-full text-xs font-medium transition-all
                                ${isSelected
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                    : isToday_ && isCurrMonth
                                        ? "bg-slate-700 text-white ring-1 ring-blue-500/50"
                                        : isCurrMonth && !isFuture
                                            ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                                            : "text-slate-700 cursor-default"
                                }
                            `}
                        >
                            {format(day, "d")}
                        </button>
                    );
                })}
            </div>

            {/* Atalho "Hoje" */}
            {!isSameDay(selected ?? today, today) && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                    <button
                        onClick={() => onSelect(today)}
                        className="w-full text-center text-xs text-blue-400 hover:text-blue-300 transition-colors py-1"
                    >
                        Ir para hoje
                    </button>
                </div>
            )}
        </div>
    );
}

function StatusDonut({ data, total: forcedTotal }: { data: { label: string; value: number; color: string }[], total?: number }) {
    const dataSum = data.reduce((s, d) => s + d.value, 0);
    const total = forcedTotal ?? dataSum;
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

    const stops = segments.length > 0
        ? segments.map(s => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ")
        : "#1e293b 0% 100%";

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
    const today = useMemo(() => new Date(), []);

    // ── State ──────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab]         = useState<TabId>("hoje");
    const [activeData, setActiveData]       = useState<StatsResponse | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>(""); // "YYYY-MM" ou "" = mês atual
    const [selectedDate, setSelectedDate]   = useState<string>(""); // "YYYY-MM-DD" ou "" = hoje
    const [loading, setLoading]             = useState(true);
    const [refreshing, setRefreshing]       = useState(false);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showDateDropdown, setShowDateDropdown]   = useState(false);

    // ── Lista de dias recentes (ontem → 90 dias atrás) ────────────────────────
    const pastDays = useMemo(() => {
        return Array.from({ length: 90 }, (_, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - (i + 1));
            return {
                value: format(d, "yyyy-MM-dd"),
                label: format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
                shortLabel: format(d, "dd/MM/yyyy"),
                isYesterday: i === 0,
            };
        });
    }, [today]);

    const todayStr = format(today, "yyyy-MM-dd");
    const isToday  = !selectedDate || selectedDate === todayStr;

    // ── Lista de meses anteriores ao mês atual ─────────────────────────────────
    const pastMonths = useMemo(() => {
        // today.getMonth() é 0-indexed; se for 0 (janeiro), não há meses anteriores no ano
        return Array.from({ length: today.getMonth() }, (_, i) => ({
            value: `${today.getFullYear()}-${String(i + 1).padStart(2, "0")}`,
            label: format(new Date(today.getFullYear(), i, 1), "MMMM 'de' yyyy", { locale: ptBR }),
        }));
    }, [today]);

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchStats = useCallback(async (
        tab: TabId,
        month: string = selectedMonth,
        showRefreshing = false,
        date: string = selectedDate,
    ) => {
        if (showRefreshing) setRefreshing(true);
        try {
            let url: string;
            if (tab === "hoje") {
                url = `/api/dashboard-today?${date ? `date=${date}&` : ""}_t=${Date.now()}`;
            } else if (tab === "mensal") {
                url = `/api/dashboard-month${month ? `?month=${month}&` : "?"}_t=${Date.now()}`;
            } else {
                url = `/api/dashboard-annual?_t=${Date.now()}`;
            }

            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) {
                setActiveData(await res.json());
            }
        } catch (err) {
            console.error("Erro ao buscar stats:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedMonth]);

    // Busca inicial e ao trocar de aba
    useEffect(() => {
        setLoading(true);
        fetchStats(activeTab, selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Auto-refresh a cada 60s — somente na aba Hoje E quando visualizando hoje
    useEffect(() => {
        if (activeTab !== "hoje" || !isToday) return;
        const interval = setInterval(() => fetchStats("hoje", "", false, ""), 60000);
        return () => clearInterval(interval);
    }, [fetchStats, activeTab, isToday]);

    // ── Derived ────────────────────────────────────────────────────────────────
    const bs = activeData?.by_status ?? {
        started: 0,
        served_by_ai_only: 0,
        waiting_in_period: 0,
        transferred_to_team: 0,
        finished: 0,
        waiting_now: 0,
        with_team_now: 0,
    };

    // Label do período selecionado na aba Mensal
    const mensalLabel = useMemo(() => {
        if (!selectedMonth) {
            return format(today, "MMMM 'de' yyyy", { locale: ptBR });
        }
        const [y, m] = selectedMonth.split("-").map(Number);
        return format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
    }, [selectedMonth, today]);

    const cardGridTitle = useMemo(() => {
        if (activeTab === "hoje") {
            if (!isToday && selectedDate) {
                const [y, m, d] = selectedDate.split("-").map(Number);
                return format(new Date(y, m - 1, d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
            }
            return "HOJE";
        }
        if (activeTab === "mensal") {
            const capitalized = mensalLabel.charAt(0).toUpperCase() + mensalLabel.slice(1);
            return capitalized;
        }
        return `ANO ${today.getFullYear()}`;
    }, [activeTab, mensalLabel, today, isToday, selectedDate]);

    const tagSectionLabel = { hoje: "Dia", mensal: "Mês", anual: "Ano" }[activeTab];
    const emptyPeriodLabel = { hoje: "hoje", mensal: "no mês", anual: "no ano" }[activeTab];

    // Snapshots (Aguardando / Sendo Atendidos) apenas na aba Hoje E no dia atual
    const showSnapshots = activeTab === "hoje" && isToday;

    // ── Configuração dos cards de status ───────────────────────────────────────
    const statusCards = [
        {
            key: "started",
            label: "Iniciados pela IA",
            sublabel: "Atendimentos no período",
            value: bs.started,
            icon: PlayCircle,
            gradient: "from-blue-500 to-cyan-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            text: "text-blue-400",
        },
        {
            key: "served_by_ai_only",
            label: "Atendidos só pela IA",
            sublabel: "Sem transferência para equipe",
            value: bs.served_by_ai_only,
            icon: Sparkles,
            gradient: "from-emerald-500 to-teal-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            text: "text-emerald-400",
        },
        {
            key: "transferred_to_team",
            label: "Transferidos p/ Equipe",
            sublabel: "Com atendente atribuído",
            value: bs.transferred_to_team,
            icon: UsersRound,
            gradient: "from-violet-500 to-purple-400",
            bg: "bg-violet-500/10",
            border: "border-violet-500/20",
            text: "text-violet-400",
        },
        {
            key: "finished",
            label: "Finalizados",
            sublabel: "Concluídos no período",
            value: bs.finished,
            icon: CheckCircle2,
            gradient: "from-green-500 to-lime-400",
            bg: "bg-green-500/10",
            border: "border-green-500/20",
            text: "text-green-400",
        },
        {
            key: "waiting_now",
            label: "Aguardando agora",
            sublabel: "Todos os dias · Tempo real",
            value: bs.waiting_now ?? 0,
            icon: Hourglass,
            gradient: "from-orange-500 to-amber-400",
            bg: "bg-orange-500/10",
            border: "border-orange-500/20",
            text: "text-orange-400",
        },
        {
            key: "with_team_now",
            label: "Sendo atendidos agora",
            sublabel: "Todos os dias · Tempo real",
            value: bs.with_team_now ?? 0,
            icon: UserCheck,
            gradient: "from-amber-500 to-yellow-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            text: "text-amber-400",
        },
    ];

    const visibleCards = showSnapshots
        ? statusCards
        : statusCards.filter(c => c.key !== "waiting_now" && c.key !== "with_team_now");

    const cardsGridClass = showSnapshots
        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        : "grid grid-cols-2 lg:grid-cols-4 gap-3";

    const maxAgentTotal = Math.max(...(activeData?.by_agent ?? []).map(a => a.total), 1);
    const maxDeptTotal  = Math.max(...(activeData?.by_department ?? []).map(d => d.total), 1);
    const maxTagTotal   = Math.max(...(activeData?.by_tag ?? []).map(t => t.total), 1);

    // Donut — 2 fatias do período selecionado; centro = bs.started
    const donutData = [
        { label: "Atendidos só pela IA",  value: bs.served_by_ai_only,   color: "#10b981" },
        { label: "Atendidos pela Equipe", value: bs.transferred_to_team, color: "#8b5cf6" },
    ];
    const donutLegend = [
        { label: "Atendidos só pela IA",  color: "bg-emerald-500", value: bs.served_by_ai_only },
        { label: "Atendidos pela Equipe", color: "bg-violet-500",  value: bs.transferred_to_team },
    ];

    // ── Tabs config ────────────────────────────────────────────────────────────
    const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
        { id: "hoje",   label: "Hoje",   icon: Sun },
        { id: "mensal", label: "Mensal", icon: CalendarDays },
        { id: "anual",  label: "Anual",  icon: Calendar },
    ];

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleTabChange = (tab: TabId) => {
        if (tab === activeTab) return;
        setSelectedMonth("");
        setSelectedDate("");
        setShowMonthDropdown(false);
        setShowDateDropdown(false);
        setActiveTab(tab);
    };

    const handleDateSelect = (date: string) => {
        setSelectedDate(date);
        setShowDateDropdown(false);
        fetchStats("hoje", "", true, date);
    };

    const handleResetToday = () => {
        setSelectedDate("");
        setShowDateDropdown(false);
        fetchStats("hoje", "", true, "");
    };

    const handleMonthSelect = (month: string) => {
        setSelectedMonth(month);
        setShowMonthDropdown(false);
        fetchStats("mensal", month, true);
    };

    // ── Skeleton ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
                <div className="h-8 w-64 bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-10 w-72 bg-slate-800 rounded-xl animate-pulse" />
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

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto h-full">

            {/* ── Header ─────────────────────────────────────────────────────── */}
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
                    onClick={() => fetchStats(activeTab, selectedMonth, true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all text-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Atualizar
                </button>
            </div>

            {/* ── Tab Bar ────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-1 w-fit">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`
                                flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Selector de Mês (somente aba Mensal) ───────────────────────── */}
            {activeTab === "mensal" && (
                <div className="mb-6 flex items-center gap-3">
                    <span className="text-sm text-slate-400">Período:</span>

                    {pastMonths.length === 0 ? (
                        // Janeiro — nenhum mês anterior disponível
                        <span className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm">
                            {format(today, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())} (atual)
                        </span>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => setShowMonthDropdown(v => !v)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-all text-sm"
                            >
                                <CalendarDays className="w-4 h-4 text-slate-400" />
                                {selectedMonth
                                    ? mensalLabel.charAt(0).toUpperCase() + mensalLabel.slice(1)
                                    : format(today, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()) + " (atual)"
                                }
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMonthDropdown ? "rotate-180" : ""}`} />
                            </button>

                            {showMonthDropdown && (
                                <div className="absolute top-full left-0 mt-2 z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden min-w-[220px]">
                                    {/* Mês atual */}
                                    <button
                                        onClick={() => handleMonthSelect("")}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-800 ${!selectedMonth ? "text-blue-400 font-semibold bg-blue-500/10" : "text-slate-300"}`}
                                    >
                                        {format(today, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())} <span className="text-slate-500 text-xs">(atual)</span>
                                    </button>

                                    {/* Divisor */}
                                    <div className="border-t border-slate-800" />

                                    {/* Meses anteriores — mais recente primeiro */}
                                    {[...pastMonths].reverse().map((m) => (
                                        <button
                                            key={m.value}
                                            onClick={() => handleMonthSelect(m.value)}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-800 ${selectedMonth === m.value ? "text-blue-400 font-semibold bg-blue-500/10" : "text-slate-300"}`}
                                        >
                                            {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Cards de Status ────────────────────────────────────────────── */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 pl-1 border-l-4 border-slate-700">
                    <h2 className="text-xl font-bold text-white">{cardGridTitle}</h2>

                    {/* Seletor de data — somente aba Hoje */}
                    {activeTab === "hoje" && (
                        <div className="relative flex items-center gap-2">
                            <button
                                onClick={() => setShowDateDropdown(v => !v)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all text-xs"
                            >
                                <CalendarDays className="w-3.5 h-3.5" />
                                {isToday ? "Hoje" : (pastDays.find(d => d.value === selectedDate)?.shortLabel ?? selectedDate)}
                                <ChevronDown className={`w-3 h-3 transition-transform ${showDateDropdown ? "rotate-180" : ""}`} />
                            </button>

                            {showDateDropdown && (
                                <div className="absolute top-full left-0 mt-2 z-50">
                                    <DatePickerCalendar
                                        selected={selectedDate ? parseISO(selectedDate) : today}
                                        today={today}
                                        onSelect={(date) => {
                                            const val = format(date, "yyyy-MM-dd");
                                            if (val === format(today, "yyyy-MM-dd")) {
                                                handleResetToday();
                                            } else {
                                                handleDateSelect(val);
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {!isToday && (
                                <button
                                    onClick={handleResetToday}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                                >
                                    ← Hoje
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {showSnapshots ? (
                    <>
                        {/* Seção 1: Atendimentos de hoje (4 cards — período) */}
                        <div className="mb-6">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1">
                                Atendimentos de hoje
                            </p>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {statusCards
                                    .filter(c => !["waiting_now", "with_team_now"].includes(c.key))
                                    .map((card, i) => {
                                        const Icon = card.icon;
                                        return (
                                            <div
                                                key={i}
                                                className={`relative overflow-hidden bg-slate-900 border ${card.border} rounded-2xl p-4 group hover:border-opacity-60 transition-all`}
                                            >
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
                                                <p className="text-[10px] text-slate-600 mt-0.5 truncate">{card.sublabel}</p>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        {/* Seção 2: Ao vivo — snapshots globais (2 cards) */}
                        <div>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Ao vivo — todos os dias
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {statusCards
                                    .filter(c => ["waiting_now", "with_team_now"].includes(c.key))
                                    .map((card, i) => {
                                        const Icon = card.icon;
                                        return (
                                            <div
                                                key={i}
                                                className={`relative overflow-hidden bg-slate-900 border ${card.border} rounded-2xl p-4 group hover:border-opacity-60 transition-all`}
                                            >
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
                                                <p className="text-[10px] text-slate-600 mt-0.5 truncate">{card.sublabel}</p>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </>
                ) : (
                    /* Mensal / Anual — 4 cards no grid normal */
                    <div className={cardsGridClass}>
                        {visibleCards.map((card, i) => {
                            const Icon = card.icon;
                            return (
                                <div
                                    key={i}
                                    className={`relative overflow-hidden bg-slate-900 border ${card.border} rounded-2xl p-4 group hover:border-opacity-60 transition-all`}
                                >
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
                                    <p className="text-[10px] text-slate-600 mt-0.5 truncate">{card.sublabel}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Bottom Section ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Distribuição */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                        </div>
                        <h2 className="text-sm font-semibold text-white">Distribuição</h2>
                    </div>

                    <StatusDonut data={donutData} total={bs.started} />

                    <div className="mt-5 space-y-2">
                        {(() => {
                            const donutTotal = bs.started;
                            return donutLegend.map((item) => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                        <span className="text-xs text-slate-400">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-white">{item.value}</span>
                                        {donutTotal > 0 && (
                                            <span className="text-[10px] text-slate-600">
                                                {((item.value / donutTotal) * 100).toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}
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

                    {(activeData?.by_agent ?? []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Users className="w-8 h-8 text-slate-700 mb-2" />
                            <p className="text-xs text-slate-500">Nenhum atendente ativo {emptyPeriodLabel}</p>
                        </div>
                    ) : (
                        <div className="space-y-3.5">
                            {(activeData?.by_agent ?? []).slice(0, 6).map((agent) => (
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

                {/* Por Departamento + Tags + Status */}
                <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="flex items-center gap-2.5 mb-5">
                            <div className="p-2 rounded-lg bg-violet-500/10">
                                <Building2 className="w-4 h-4 text-violet-400" />
                            </div>
                            <h2 className="text-sm font-semibold text-white">Por Departamento</h2>
                        </div>

                        {(activeData?.by_department ?? []).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                <Building2 className="w-7 h-7 text-slate-700 mb-2" />
                                <p className="text-xs text-slate-500">Nenhum departamento ativo {emptyPeriodLabel}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {(activeData?.by_department ?? []).slice(0, 5).map((dept) => (
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

                    {/* Top Tags */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="flex items-center gap-2.5 mb-5">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <Tag className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h2 className="text-sm font-semibold text-white">Top Tags do {tagSectionLabel}</h2>
                        </div>

                        {(activeData?.by_tag ?? []).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                <Tag className="w-7 h-7 text-slate-700 mb-2" />
                                <p className="text-xs text-slate-500">Nenhuma tag usada {emptyPeriodLabel}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {(activeData?.by_tag ?? []).slice(0, 5).map((t) => (
                                    <div key={t.id}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                                <span className="text-xs text-slate-300">{t.name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-white">{t.total}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${maxTagTotal > 0 ? (t.total / maxTagTotal) * 100 : 0}%`,
                                                    backgroundColor: t.color,
                                                }}
                                            />
                                        </div>
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

            {/* Fechar dropdown ao clicar fora */}
            {showMonthDropdown && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMonthDropdown(false)}
                />
            )}
        </div>
    );
}
